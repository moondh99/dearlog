// @vitest-environment node
import os from 'node:os';
import path from 'node:path';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { COMMON_QUESTIONS, FIXED_CHAPTERS, MIN_ANSWERS_PER_CHAPTER } from './domain/constants';

let prisma: typeof import('./db').prisma;
let initLocalDatabase: typeof import('./prisma/init').initLocalDatabase;
let processDueInterviewSchedules: typeof import('./worker').processDueInterviewSchedules;
let processInactivityNotifications: typeof import('./worker').processInactivityNotifications;
let isFreeSpeech: typeof import('./domain/free-speech').isFreeSpeech;
let decideCoverDesign: typeof import('./domain/cover-agent').decideCoverDesign;
let generateLocalPrintPdf: typeof import('./publication').generateLocalPrintPdf;

beforeAll(async () => {
  process.env.DATABASE_URL = `file:${path.join(os.tmpdir(), `dearlog-${Date.now()}.db`)}`;
  process.env.OPENAI_API_KEY = '';
  process.env.TWILIO_ACCOUNT_SID = '';
  process.env.TWILIO_AUTH_TOKEN = '';
  process.env.TWILIO_FROM_NUMBER = '';

  ({ prisma } = await import('./db'));
  ({ initLocalDatabase } = await import('./prisma/init'));
  ({ processDueInterviewSchedules, processInactivityNotifications } = await import('./worker'));
  ({ isFreeSpeech } = await import('./domain/free-speech'));
  ({ decideCoverDesign } = await import('./domain/cover-agent'));
  ({ generateLocalPrintPdf } = await import('./publication'));
  await initLocalDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.publicationRequest.deleteMany();
  await prisma.coverDesign.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.pushSubscription.deleteMany();
  await prisma.freeSpeechRecord.deleteMany();
  await prisma.interviewRecord.deleteMany();
  await prisma.interviewSession.deleteMany();
  await prisma.interviewSchedule.deleteMany();
  await prisma.question.deleteMany();
  await prisma.photo.deleteMany();
  await prisma.guardianSeniorLink.deleteMany();
  await prisma.user.deleteMany();
  await prisma.chapter.deleteMany();

  for (const chapter of FIXED_CHAPTERS) {
    await prisma.chapter.create({
      data: { ...chapter, minAnswerCount: MIN_ANSWERS_PER_CHAPTER },
    });
  }
  for (const [index, [chapterId, text]] of COMMON_QUESTIONS.entries()) {
    await prisma.question.create({
      data: {
        id: `common_${String(index + 1).padStart(2, '0')}`,
        category: 'common_questions',
        chapterId,
        text,
        status: 'active',
      },
    });
  }
  await prisma.user.create({ data: { id: 'local_senior', name: '김영자', role: 'senior', phoneNumber: '+821012345678' } });
  await prisma.user.create({ data: { id: 'local_guardian', name: '보호자', role: 'guardian', phoneNumber: '+821087654321' } });
  await prisma.guardianSeniorLink.create({ data: { guardianId: 'local_guardian', seniorId: 'local_senior' } });
});

describe('local Dearlog server', () => {
  it('serves seeded fixed chapters and common questions', async () => {
    const chapters = await prisma.chapter.findMany({ orderBy: { order: 'asc' } });
    expect(chapters).toHaveLength(7);
    expect(chapters.map((chapter) => chapter.title)).toEqual([
      '유년기',
      '청소년기',
      '청년기',
      '가정을 꾸린 이야기',
      '취미',
      '인간관계',
      '전하고 싶은 이야기',
    ]);

    const questions = await prisma.question.findMany({ where: { category: 'common_questions' } });
    expect(questions).toHaveLength(30);
  });

  it('lets guardians create schedules and worker sends app interview calls without phone providers', async () => {
    const scheduledAt = new Date(Date.now() - 1000).toISOString();
    const schedule = await prisma.interviewSchedule.create({
      data: {
        seniorId: 'local_senior',
        guardianId: 'local_guardian',
        scheduledAt: new Date(scheduledAt),
      },
    });

    expect(schedule.status).toBe('scheduled');
    await processDueInterviewSchedules(new Date());
    const updated = await prisma.interviewSchedule.findUnique({ where: { id: schedule.id } });
    expect(updated?.status).toBe('app_call_ready');
    expect(updated?.callSid).toContain('app:');
    expect(updated?.lastError).toContain('Web Push');
    expect(await prisma.interviewSession.count({ where: { status: 'ringing', mode: 'app_call' } })).toBe(1);
  });

  it('stores interview records and mirrors unrelated speech into free_speech_db', async () => {
    const session = await prisma.interviewSession.create({
      data: { seniorId: 'local_senior', chapterId: 'childhood', mode: 'photo' },
    });
    const transcriptText = '오늘은 갑자기 냉장고 손잡이가 고장나서 수리 기사님을 불렀다는 이야기를 길게 하고 싶네요.';
    const record = await prisma.interviewRecord.create({
      data: {
        userId: 'local_senior',
        chapterId: 'childhood',
        sessionId: session.id,
        audioFileKey: 'audio/test.raw',
        transcriptText,
      },
    });

    if (isFreeSpeech({ questionText: '태어난 곳은 어떤 동네였나요?', transcriptText })) {
      await prisma.freeSpeechRecord.create({
        data: {
          userId: record.userId,
          chapterId: record.chapterId,
          sessionId: session.id,
          audioFileKey: record.audioFileKey,
          transcriptText: record.transcriptText,
        },
      });
    }

    const freeSpeech = await prisma.freeSpeechRecord.findMany({ where: { userId: 'local_senior' } });
    expect(freeSpeech).toHaveLength(1);
    expect(freeSpeech[0].transcriptText).toContain('냉장고');
  });

  it('creates internal notifications for inactivity and nudges without VAPID keys', async () => {
    const sent = await processInactivityNotifications(new Date('2026-05-19T00:00:00.000Z'));
    expect(sent).toBe(1);

    const notification = await prisma.notification.create({
      data: {
        userId: 'local_senior',
        type: 'nudge',
        title: 'Dearlog에서 기다리고 있어요',
        body: '가족이 오늘의 이야기를 조금 더 듣고 싶어 합니다.',
      },
    });

    expect(notification.type).toBe('nudge');
    expect(await prisma.notification.count()).toBe(2);
  });

  it('generates and confirms a cover, then creates a local publication request', async () => {
    await prisma.interviewRecord.create({
      data: {
        userId: 'local_senior',
        chapterId: 'childhood',
        audioFileKey: 'audio/test.raw',
        transcriptText: '어머니와 가족에게 고마웠던 따뜻한 어린 시절 기억입니다.',
      },
    });

    const decision = await decideCoverDesign(['어머니와 가족에게 고마웠던 따뜻한 어린 시절 기억입니다.']);
    const cover = await prisma.coverDesign.create({
      data: {
        userId: 'local_senior',
        palette: decision.palette,
        template: decision.template,
        font: decision.font,
        analysisJson: JSON.stringify(decision.analysis),
        confirmedAt: new Date(),
      },
    });
    const publication = await prisma.publicationRequest.create({
      data: {
        userId: 'local_senior',
        requestedById: 'local_guardian',
        coverDesignId: cover.id,
        format: 'A5',
        status: 'generating',
      },
    });
    const pdfFileKey = await generateLocalPrintPdf({ seniorId: 'local_senior', coverDesignId: cover.id, format: 'A5' });
    const updated = await prisma.publicationRequest.update({
      where: { id: publication.id },
      data: { status: 'ready', pdfFileKey },
    });

    expect(updated.status).toBe('ready');
    expect(updated.pdfFileKey).toMatch(/^pdfs\//);
  });
});
