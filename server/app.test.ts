// @vitest-environment node
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { COMMON_QUESTIONS, FIXED_CHAPTERS, MIN_ANSWERS_PER_CHAPTER } from './domain/constants';
import type { PublicationManifest } from './domain/publication-agent';

let prisma: typeof import('./db').prisma;
let initLocalDatabase: typeof import('./prisma/init').initLocalDatabase;
let processDueInterviewSchedules: typeof import('./worker').processDueInterviewSchedules;
let processInactivityNotifications: typeof import('./worker').processInactivityNotifications;
let isFreeSpeech: typeof import('./domain/free-speech').isFreeSpeech;
let decideCoverDesign: typeof import('./domain/cover-agent').decideCoverDesign;
let buildPublicationManifest: typeof import('./domain/publication-agent').buildPublicationManifest;
let buildPublicationEditorialPlan: typeof import('./domain/publication-agent').buildPublicationEditorialPlan;
let buildPublicationWritingDraft: typeof import('./domain/publication-agent').buildPublicationWritingDraft;
let PUBLICATION_EDITORIAL_PLAN_SYSTEM_PROMPT: typeof import('./domain/publication-agent').PUBLICATION_EDITORIAL_PLAN_SYSTEM_PROMPT;
let PUBLICATION_WRITING_DRAFT_SYSTEM_PROMPT: typeof import('./domain/publication-agent').PUBLICATION_WRITING_DRAFT_SYSTEM_PROMPT;
let PUBLICATION_MANIFEST_SYSTEM_PROMPT: typeof import('./domain/publication-agent').PUBLICATION_MANIFEST_SYSTEM_PROMPT;
let PUBLICATION_QUALITY_CHECKLIST: typeof import('./domain/publication-agent').PUBLICATION_QUALITY_CHECKLIST;
let renderHtmlToPdf: typeof import('./publication-html').renderHtmlToPdf;
let renderPublicationHtml: typeof import('./publication-html').renderPublicationHtml;
let generateLocalPrintPdf: typeof import('./publication').generateLocalPrintPdf;
let generateLocalPublicationDraft: typeof import('./publication').generateLocalPublicationDraft;
let generateLocalPublicationEditorialPlan: typeof import('./publication').generateLocalPublicationEditorialPlan;
let buildPublicationSourceRecords: typeof import('./publication').buildPublicationSourceRecords;
let startLocalPublicationPreviewJob: typeof import('./publication').startLocalPublicationPreviewJob;
let resolveLocalFileKey: typeof import('./storage').resolveLocalFileKey;

beforeAll(async () => {
  process.env.DATABASE_URL = `file:${path.join(os.tmpdir(), `dearlog-${Date.now()}.db`)}`;
  process.env.FACTCHAT_API_KEY = '';
  process.env.FACTCHAT_BASE_URL = 'https://factchat-cloud.mindlogic.ai/v1/gateway';
  process.env.FACTCHAT_CHAT_MODEL = 'gpt-5-mini';
  process.env.FACTCHAT_VISION_MODEL = '';
  process.env.OPENAI_API_KEY = '';
  process.env.TWILIO_ACCOUNT_SID = '';
  process.env.TWILIO_AUTH_TOKEN = '';
  process.env.TWILIO_FROM_NUMBER = '';

  ({ prisma } = await import('./db'));
  ({ initLocalDatabase } = await import('./prisma/init'));
  ({ processDueInterviewSchedules, processInactivityNotifications } = await import('./worker'));
  ({ isFreeSpeech } = await import('./domain/free-speech'));
  ({ decideCoverDesign } = await import('./domain/cover-agent'));
  ({
    buildPublicationManifest,
    buildPublicationEditorialPlan,
    buildPublicationWritingDraft,
    PUBLICATION_EDITORIAL_PLAN_SYSTEM_PROMPT,
    PUBLICATION_WRITING_DRAFT_SYSTEM_PROMPT,
    PUBLICATION_MANIFEST_SYSTEM_PROMPT,
    PUBLICATION_QUALITY_CHECKLIST,
  } = await import('./domain/publication-agent'));
  ({ renderHtmlToPdf, renderPublicationHtml } = await import('./publication-html'));
  ({
    generateLocalPrintPdf,
    generateLocalPublicationDraft,
    generateLocalPublicationEditorialPlan,
    buildPublicationSourceRecords,
    startLocalPublicationPreviewJob,
  } = await import('./publication'));
  ({ resolveLocalFileKey } = await import('./storage'));
  await initLocalDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  process.env.FACTCHAT_API_KEY = '';
  process.env.FACTCHAT_BASE_URL = 'https://factchat-cloud.mindlogic.ai/v1/gateway';
  process.env.FACTCHAT_CHAT_MODEL = 'gpt-5-mini';
  process.env.FACTCHAT_VISION_MODEL = '';
  process.env.OPENAI_API_KEY = '';
  await prisma.publicationRequest.deleteMany();
  await prisma.publicationPreviewJob.deleteMany();
  await prisma.publicationDraftCache.deleteMany();
  await prisma.aiProxyAuditLog.deleteMany();
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

async function waitForPublicationPreviewJob(jobId: string, status: string) {
  let latestJob: Awaited<ReturnType<typeof prisma.publicationPreviewJob.findUnique>> = null;
  for (let i = 0; i < 200; i += 1) {
    const job = await prisma.publicationPreviewJob.findUnique({ where: { id: jobId } });
    latestJob = job;
    if (job?.status === status) return job;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Publication preview job ${jobId} did not reach ${status}: ${JSON.stringify(latestJob)}`);
}

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
    expect(record.reviewStatus).toBe('pending');
    expect(record.reviewedAt).toBeNull();
    expect(record.reviewRequestText).toBeNull();

    const reviewed = await prisma.interviewRecord.update({
      where: { id: record.id },
      data: {
        reviewStatus: 'applied',
        reviewedAt: new Date('2026-05-31T00:00:00.000Z'),
      },
    });
    expect(reviewed.reviewStatus).toBe('applied');
    expect(reviewed.reviewedAt?.toISOString()).toBe('2026-05-31T00:00:00.000Z');

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

  it('keeps publication manifest paragraphs tied to real source records', async () => {
    const manifest = await buildPublicationManifest({
      seniorName: '김영자',
      records: [
        {
          id: 'record_childhood_1',
          chapterId: 'childhood',
          chapterTitle: '유년기',
          transcriptText: '어머니와 가족에게 고마웠던 따뜻한 어린 시절 기억입니다.',
          recordedAt: new Date('2026-06-03T00:00:00.000Z').toISOString(),
        },
      ],
      chapters: [{ id: 'childhood', title: '유년기', order: 1 }],
      draftChapters: [
        {
          chapterId: 'childhood',
          chapterTitle: '유년기',
          paragraphs: [
            {
              text: '어머니와 가족에게 고마웠던 따뜻한 어린 시절 기억입니다.',
              sourceChunkIds: ['record_childhood_1'],
              reliability: 'UNVERIFIED',
            },
            {
              text: '김영자는 대통령이 되어 우주선을 만들었습니다.',
              sourceChunkIds: ['record_childhood_1'],
              reliability: 'CONFIRMED',
            },
          ],
        },
      ],
      cover: null,
      photos: [],
    });

    const paragraphs = manifest.chapters.flatMap((chapter) => chapter.paragraphs);
    expect(paragraphs.every((paragraph) => paragraph.sourceRecordIds.length > 0)).toBe(true);
    expect(paragraphs.some((paragraph) => paragraph.text.includes('우주선'))).toBe(false);
    expect(manifest.provenance.hallucinationGuard).toHaveLength(3);
  });

  it('rewrites report-like memory fragment wording into reader-facing publication prose', async () => {
    const transcriptText = '결혼 첫해 추석 부산의 작은 전셋집에서 배우자와 양가 가족과 함께했던 일이 또렷합니다. 상보를 앞에 두고 "집도 배처럼 균형을 잡아야 한다"라는 말을 들었고, 그때 손님이 돌아간 뒤 둘이서 마루를 닦던 일이 오래 남았습니다. 지금 돌아보면 그 장면은 제 삶에서 서툰 따뜻함을 배운 시간입니다.';
    const manifest = await buildPublicationManifest({
      seniorName: '최정훈',
      records: [
        {
          id: 'record_family_1',
          chapterId: 'family',
          chapterTitle: '결혼과 가족',
          transcriptText,
          recordedAt: new Date('2026-06-07T00:00:00.000Z').toISOString(),
        },
      ],
      chapters: [{ id: 'family', title: '결혼과 가족', order: 4 }],
      draftChapters: [
        {
          chapterId: 'family',
          chapterTitle: '결혼과 가족',
          toneProfile: { name: '이야기책 형태', patterns: ['따뜻한 서술형'] },
          paragraphs: [
            {
              text: '기억 조각에는 결혼 첫해 추석, 부산의 작은 전셋집에서 배우자와 양가 가족이 함께한 장면이 남아 있습니다. 상보를 앞에 두고 “집도 배처럼 균형을 잡아야 한다”는 말을 들었고, 손님이 돌아간 뒤 둘이서 마루를 닦던 일이 오래 마음에 머문 것으로 기록되어 있습니다.',
              sourceChunkIds: ['record_family_1'],
              reliability: 'CONFIRMED',
            },
          ],
        },
      ],
      cover: null,
      photos: [],
    });

    const text = manifest.chapters[0].paragraphs[0].text;
    expect(text).toContain('결혼 첫해 추석');
    expect(text).toContain('집도 배처럼 균형을 잡아야 한다');
    expect(text).not.toMatch(/기억\s*조각|기록에는|기록되어|적혀\s*있|말을\s*들었고|앞에\s*두고|배운\s*시간입니다/);
    expect(text).not.toContain('가족와');
  });

  it('builds a source-grounded writing draft that removes report-like repetition', async () => {
    const transcriptText = '결혼 첫해 추석 부산의 작은 전셋집에서 배우자와 양가 가족과 함께했던 일이 또렷합니다. 상보를 앞에 두고 "집도 배처럼 균형을 잡아야 한다"라는 말을 들었고, 그때 손님이 돌아간 뒤 둘이서 마루를 닦던 일이 오래 남았습니다. 지금 돌아보면 그 장면은 제 삶에서 서툰 따뜻함을 배운 시간입니다.';
    const writingDraft = await buildPublicationWritingDraft({
      seniorName: '최정훈',
      records: [
        {
          id: 'record_family_writer',
          chapterId: 'family',
          chapterTitle: '결혼과 가족',
          transcriptText,
          recordedAt: new Date('2026-06-07T00:00:00.000Z').toISOString(),
        },
      ],
      chapters: [{ id: 'family', title: '결혼과 가족', order: 4 }],
      draftChapters: [
        {
          chapterId: 'family',
          chapterTitle: '결혼과 가족',
          toneProfile: { name: '이야기책 형태', patterns: ['장면 중심 산문'] },
          paragraphs: [
            {
              text: '기억 조각에는 결혼 첫해 추석, 부산의 작은 전셋집에서 배우자와 양가 가족이 함께한 장면이 남아 있습니다. 상보를 앞에 두고 “집도 배처럼 균형을 잡아야 한다”는 말을 들었고, 손님이 돌아간 뒤 둘이서 마루를 닦던 일이 오래 마음에 머문 것으로 기록되어 있습니다.',
              sourceChunkIds: ['record_family_writer'],
              reliability: 'CONFIRMED',
            },
          ],
        },
      ],
      cover: null,
      photos: [],
      agentTimeoutMs: 1,
    });

    const text = writingDraft.chapters[0].paragraphs[0].text;
    expect(writingDraft.generatedBy).toBe('fallback');
    expect(writingDraft.chapters[0].paragraphs[0].sourceRecordIds).toEqual(['record_family_writer']);
    expect(text).toContain('결혼 첫해 추석');
    expect(text).toContain('집도 배처럼 균형을 잡아야 한다');
    expect(text).not.toMatch(/기억\s*조각|기록에는|기록되어|적혀\s*있|말을\s*들었고|앞에\s*두고|배운\s*시간입니다/);
    expect(writingDraft.revisionFindings[0].category).toBe('repetition');
  });

  it('varies the writing draft rhythm across news, story, and interview tone profiles', async () => {
    const transcriptText = '결혼 첫해 추석 부산의 작은 전셋집에서 배우자와 양가 가족과 함께했던 일이 또렷합니다. 상보를 앞에 두고 "집도 배처럼 균형을 잡아야 한다"라는 말을 들었고, 그때 손님이 돌아간 뒤 둘이서 마루를 닦던 일이 오래 남았습니다. 지금 돌아보면 그 장면은 제 삶에서 서툰 따뜻함을 배운 시간입니다.';
    const buildForTone = async (toneName: string) => buildPublicationWritingDraft({
      seniorName: '최정훈',
      records: [
        {
          id: `record_family_${toneName}`,
          chapterId: 'family',
          chapterTitle: '결혼과 가족',
          transcriptText,
          recordedAt: new Date('2026-06-07T00:00:00.000Z').toISOString(),
        },
      ],
      chapters: [{ id: 'family', title: '결혼과 가족', order: 4 }],
      draftChapters: [
        {
          chapterId: 'family',
          chapterTitle: '결혼과 가족',
          toneProfile: { name: toneName, patterns: [] },
          paragraphs: [],
        },
      ],
      cover: null,
      photos: [],
      agentTimeoutMs: 1,
    });

    const [newsDraft, storyDraft, interviewDraft] = await Promise.all([
      buildForTone('뉴스 기사 형태'),
      buildForTone('이야기책 형태'),
      buildForTone('인터뷰 형태'),
    ]);
    const texts = [
      newsDraft.chapters[0].paragraphs[0].text,
      storyDraft.chapters[0].paragraphs[0].text,
      interviewDraft.chapters[0].paragraphs[0].text,
    ];

    expect(new Set(texts).size).toBe(3);
    expect(texts.every((text) => text.includes('집도 배처럼 균형을 잡아야 한다'))).toBe(true);
    for (const text of texts) {
      expect(text).not.toMatch(/기억\s*조각|기록에는|기록되어|적혀\s*있|말을\s*들었고|앞에\s*두고|배운\s*시간입니다/);
    }
  });

  it('rewrites repetitive recall openings in story-tone publication fallback drafts', async () => {
    const writingDraft = await buildPublicationWritingDraft({
      seniorName: '김영자',
      records: [
        {
          id: 'record_story_recall',
          chapterId: 'childhood',
          chapterTitle: '어린 시절',
          transcriptText: '어릴 때를 떠올리면, 나는 아직도 마을 개울가가 먼저 떠올라. 장마가 끝난 여름이었는데, 동네 친구들하고 같이 있었고 고무신이 유난히 눈에 들어왔어. 그때 "해 지기 전에만 들어오너라"라는 말을 들었거나 마음속으로 오래 붙잡고 있었는데, 이상하게 그 말이 아직도 남아 있어. 물살에 고무신을 띄워 보내던 놀이는 대단한 일은 아니어도 그 순간의 해방감은 몸이 먼저 기억하는 것 같아.',
          recordedAt: new Date('2026-06-07T00:00:00.000Z').toISOString(),
        },
        {
          id: 'record_story_photo_recall',
          chapterId: 'childhood',
          chapterTitle: '어린 시절',
          transcriptText: '"마당의 감나무" 사진을 보면 구례 본가 생각이 제일 먼저 나. 감나무 아래에서 동생들과 찍은 흑백사진 모습인데, 사진을 보고 있으면 그때 공기하고 사람들 표정까지 같이 떠오르는 것 같아. 초등학교 들어가기 전 겨울이었는데, 어머니와 동생들하고 같이 있었고 보리밥 냄비가 유난히 눈에 들어왔어. 그때 "불씨만 살려두면 밥은 된다"라는 말을 들었거나 마음속으로 오래 붙잡고 있었는데, 이상하게 그 말이 아직도 남아 있어.',
          recordedAt: new Date('2026-06-07T00:00:00.000Z').toISOString(),
        },
      ],
      chapters: [{ id: 'childhood', title: '어린 시절', order: 1 }],
      draftChapters: [
        {
          chapterId: 'childhood',
          chapterTitle: '어린 시절',
          toneProfile: { name: '이야기책 형태', patterns: ['따뜻한 서술형'] },
          paragraphs: [],
        },
      ],
      cover: null,
      photos: [],
      agentTimeoutMs: 1,
    });

    const text = writingDraft.chapters[0].paragraphs.map((paragraph) => paragraph.text).join('\n');
    expect(writingDraft.selectedToneProfile?.name).toBe('이야기책 형태');
    expect(text).toContain('마을 개울가');
    expect(text).toContain('고무신');
    expect(text).toContain('마당의 감나무');
    expect(text).toContain('보리밥 냄비');
    expect(text).not.toMatch(/어릴 때를 떠올리면|사진을 보면|먼저 떠올라|유난히 눈에 들어왔어/);
  });

  it('rewrites repetitive recall openings in news-tone publication fallback drafts', async () => {
    const writingDraft = await buildPublicationWritingDraft({
      seniorName: '김영자',
      records: [
        {
          id: 'record_news_recall',
          chapterId: 'childhood',
          chapterTitle: '어린 시절',
          transcriptText: '어릴 때를 떠올리면, 나는 아직도 마을 개울가가 먼저 떠올라. 장마가 끝난 여름이었는데, 동네 친구들하고 같이 있었고 고무신이 유난히 눈에 들어왔어. 그때 "해 지기 전에만 들어오너라"라는 말을 들었거나 마음속으로 오래 붙잡고 있었는데, 이상하게 그 말이 아직도 남아 있어. 물살에 고무신을 띄워 보내던 놀이는 대단한 일은 아니어도 그 순간의 해방감은 몸이 먼저 기억하는 것 같아.',
          recordedAt: new Date('2026-06-07T00:00:00.000Z').toISOString(),
        },
        {
          id: 'record_news_photo_recall',
          chapterId: 'childhood',
          chapterTitle: '어린 시절',
          transcriptText: '"마당의 감나무" 사진을 보면 구례 본가 생각이 제일 먼저 나. 감나무 아래에서 동생들과 찍은 흑백사진 모습인데, 사진을 보고 있으면 그때 공기하고 사람들 표정까지 같이 떠오르는 것 같아. 초등학교 들어가기 전 겨울이었는데, 어머니와 동생들하고 같이 있었고 보리밥 냄비가 유난히 눈에 들어왔어. 그때 "불씨만 살려두면 밥은 된다"라는 말을 들었거나 마음속으로 오래 붙잡고 있었는데, 이상하게 그 말이 아직도 남아 있어. 새벽마다 물을 길어 놓던 일은 대단한 일은 아니어도 그 순간의 따뜻함은 몸이 먼저 기억하는 것 같아.',
          recordedAt: new Date('2026-06-07T00:00:00.000Z').toISOString(),
        },
      ],
      chapters: [{ id: 'childhood', title: '어린 시절', order: 1 }],
      draftChapters: [
        {
          chapterId: 'childhood',
          chapterTitle: '어린 시절',
          toneProfile: { name: '뉴스 기사 형태', patterns: ['객관적인 기사 문장'] },
          paragraphs: [],
        },
      ],
      cover: null,
      photos: [],
      agentTimeoutMs: 1,
    });

    const text = writingDraft.chapters[0].paragraphs.map((paragraph) => paragraph.text).join('\n');
    expect(writingDraft.selectedToneProfile?.name).toBe('뉴스 기사 형태');
    expect(text).toContain('마을 개울가');
    expect(text).toContain('고무신');
    expect(text).toContain('마당의 감나무');
    expect(text).toContain('보리밥 냄비');
    expect(text).not.toMatch(/어릴 때를 떠올리면|사진을 보면|먼저 떠올라|유난히 눈에 들어왔|것 같아|남아 있어/);
  });

  it('keeps photo question answers linked to their photo context for publication', () => {
    const sourceRecords = buildPublicationSourceRecords([
      {
        id: 'photo_answer_1',
        chapterId: 'childhood',
        transcriptText: '이 사진은 온 가족이 함께 밥을 먹던 날의 기억입니다.',
        recordedAt: new Date('2026-06-03T00:00:00.000Z'),
        chapter: { title: '유년기' },
        question: {
          text: '이 사진을 보면 어떤 장면이 떠오르시나요?',
          category: 'photo_questions',
          photoId: 'photo_1',
          photo: {
            id: 'photo_1',
            fileName: 'family-table.jpg',
            metadataJson: JSON.stringify({
              memo: '가족이 모인 식탁',
              capturedDate: '1982-05-01',
              location: '서울',
            }),
            analysisJson: JSON.stringify({ description: '식탁에 둘러앉은 가족 사진' }),
          },
        },
      },
    ]);

    expect(sourceRecords[0]).toMatchObject({
      id: 'photo_answer_1',
      questionText: '이 사진을 보면 어떤 장면이 떠오르시나요?',
      questionCategory: 'photo_questions',
      photoId: 'photo_1',
      photo: {
        id: 'photo_1',
        caption: '가족이 모인 식탁',
        capturedDate: '1982-05-01',
        location: '서울',
      },
    });
  });

  it('uses reader-facing demo photo metadata instead of file names for publication captions', () => {
    const sourceRecords = buildPublicationSourceRecords([
      {
        id: 'demo_photo_answer_1',
        chapterId: 'childhood',
        transcriptText: '감나무 아래에서 동생들과 함께 찍은 사진을 보니 본가 마당이 떠오릅니다.',
        recordedAt: new Date('2026-06-07T00:00:00.000Z'),
        chapter: { title: '유년기' },
        question: {
          text: '이 사진을 보면 어떤 장면이 떠오르시나요?',
          category: 'photo_questions',
          photoId: 'demo_photo_1',
          photo: {
            id: 'demo_photo_1',
            fileName: 'demo_bulk_20260607_001_kim_yeongja_photo_01.png',
            metadataJson: JSON.stringify({
              title: '감나무 아래의 형제들',
              yearLabel: '1952년 무렵',
              place: '구례 본가',
              caption: '감나무 아래에서 동생들과 찍은 흑백사진',
            }),
            analysisJson: JSON.stringify({ description: '' }),
          },
        },
      },
    ]);

    expect(sourceRecords[0].photo).toMatchObject({
      id: 'demo_photo_1',
      caption: '감나무 아래에서 동생들과 찍은 흑백사진',
      capturedDate: '1952년 무렵',
      location: '구례 본가',
    });
    expect(sourceRecords[0].photo?.caption).not.toContain('demo_bulk_20260607_001_kim_yeongja_photo_01.png');
  });

  it('instructs publication agent to write photo-led records as news-style prose', () => {
    expect(PUBLICATION_MANIFEST_SYSTEM_PROMPT).toContain('# Photo-Led Records');
    expect(PUBLICATION_MANIFEST_SYSTEM_PROMPT).toContain('questionCategory "photo_questions"');
    expect(PUBLICATION_MANIFEST_SYSTEM_PROMPT).toContain('human-interest article');
    expect(PUBLICATION_MANIFEST_SYSTEM_PROMPT).toContain('headline-like chapter title');
    expect(PUBLICATION_MANIFEST_SYSTEM_PROMPT).toContain('기록에 따르면');
    expect(PUBLICATION_MANIFEST_SYSTEM_PROMPT).toContain('article prose');
  });

  it('defines a paid-book quality checklist for publication planning', () => {
    expect(PUBLICATION_QUALITY_CHECKLIST).toHaveLength(8);
    expect(PUBLICATION_QUALITY_CHECKLIST.map((item) => item.id)).toEqual(expect.arrayContaining([
      'minimum-source-volume',
      'chapter-episode-density',
      'scene-specificity',
      'elder-voice',
      'photo-memory-link',
      'narrative-arc',
      'repetition-control',
      'family-review-readiness',
    ]));
    expect(PUBLICATION_QUALITY_CHECKLIST.some((item) => item.requirement.includes('20-30p'))).toBe(true);
    expect(PUBLICATION_QUALITY_CHECKLIST.some((item) => item.requirement.includes('사진 질문 5-10개'))).toBe(true);
    expect(PUBLICATION_QUALITY_CHECKLIST.some((item) => item.requirement.includes('2-4개'))).toBe(true);
    expect(PUBLICATION_MANIFEST_SYSTEM_PROMPT).toContain('# Commercial Quality Checklist');
    expect(PUBLICATION_MANIFEST_SYSTEM_PROMPT).toContain('AI가 쓴 일반문');
    expect(PUBLICATION_MANIFEST_SYSTEM_PROMPT).toContain('missingSections for follow-up questions');
    expect(PUBLICATION_MANIFEST_SYSTEM_PROMPT).toContain('"closing"');
    expect(PUBLICATION_MANIFEST_SYSTEM_PROMPT).toContain('Do not print cover.analysis tone labels');
    expect(PUBLICATION_MANIFEST_SYSTEM_PROMPT).toContain('If writingDraft is provided');
    expect(PUBLICATION_WRITING_DRAFT_SYSTEM_PROMPT).toContain('PublicationWritingDraft JSON object');
    expect(PUBLICATION_WRITING_DRAFT_SYSTEM_PROMPT).toContain('sourceRecordIds');
    expect(PUBLICATION_WRITING_DRAFT_SYSTEM_PROMPT).toContain('기억 조각에는');
    expect(PUBLICATION_WRITING_DRAFT_SYSTEM_PROMPT).toContain('인터뷰 형태');
  });

  it('builds an editorial plan before publication manifest generation', async () => {
    const plan = await buildPublicationEditorialPlan({
      seniorName: '김영자',
      records: [
        {
          id: 'record_childhood_table',
          chapterId: 'childhood',
          chapterTitle: '유년기',
          transcriptText: '1982년 서울 집 식탁에서 어머니와 아버지, 형제들이 함께 밥을 먹던 날이 가장 따뜻하게 기억납니다. 그날 어머니에게 고마운 마음이 컸습니다.',
          questionText: '이 사진을 보면 어떤 장면이 떠오르시나요?',
          questionCategory: 'photo_questions',
          photoId: 'photo_table',
          photo: {
            id: 'photo_table',
            caption: '가족이 모인 식탁',
            capturedDate: '1982-05-01',
            location: '서울',
          },
          recordedAt: new Date('2026-06-03T00:00:00.000Z').toISOString(),
        },
        {
          id: 'record_childhood_market',
          chapterId: 'childhood',
          chapterTitle: '유년기',
          transcriptText: '어릴 적 시장 골목에서 친구와 뛰어놀던 날들이 기억납니다. 집으로 돌아오면 가족이 기다리고 있어서 행복했습니다.',
          recordedAt: new Date('2026-06-03T00:00:00.000Z').toISOString(),
        },
        {
          id: 'record_childhood_school',
          chapterId: 'childhood',
          chapterTitle: '유년기',
          transcriptText: '학교 운동장에서 선생님께 칭찬을 듣고 하루 종일 기뻤던 기억이 있습니다.',
          recordedAt: new Date('2026-06-03T00:00:00.000Z').toISOString(),
        },
        {
          id: 'record_youth_short',
          chapterId: 'youth',
          chapterTitle: '청소년기',
          transcriptText: '학교 생각이 납니다.',
          recordedAt: new Date('2026-06-03T00:00:00.000Z').toISOString(),
        },
      ],
      chapters: [
        { id: 'childhood', title: '유년기', order: 1 },
        { id: 'youth', title: '청소년기', order: 2 },
        { id: 'work', title: '일과 가족', order: 3 },
      ],
      draftChapters: [
        {
          chapterId: 'childhood',
          chapterTitle: '유년기',
          toneProfile: { name: '뉴스 기사 형태', patterns: ['간결한 리드', '사실 중심'] },
          paragraphs: [],
        },
      ],
      cover: null,
      photos: [
        {
          id: 'photo_table',
          fileKey: 'photos/family-table.png',
          mimeType: 'image/png',
          caption: '가족이 모인 식탁',
          capturedDate: '1982-05-01',
          location: '서울',
        },
      ],
    });

    expect(plan.targetProduct).toBe('paid_family_book');
    expect(plan.generatedBy).toBe('fallback');
    expect(plan.readiness).toBe('needs_more_records');
    expect(plan.selectedToneProfile).toMatchObject({ name: '뉴스 기사 형태' });
    expect(plan.strongChapters).toContain('childhood');
    expect(plan.weakChapters).toContain('work');
    expect(plan.sourceSummary).toMatchObject({
      sourceRecordCount: 4,
      photoCount: 1,
      photoLedRecordCount: 1,
      strongChapterCount: 1,
      weakChapterCount: 1,
    });

    const childhoodPlan = plan.chapterPlans.find((chapter) => chapter.chapterId === 'childhood');
    expect(childhoodPlan).toMatchObject({
      strength: 'strong',
      recommendedRole: 'anchor_chapter',
      recordCount: 3,
      photoLedRecordCount: 1,
    });
    expect(plan.directQuoteCandidates.some((quote) => quote.sourceRecordId === 'record_childhood_table')).toBe(true);
    expect(plan.photoStoryPlacements).toContainEqual(expect.objectContaining({
      photoId: 'photo_table',
      sourceRecordId: 'record_childhood_table',
      chapterId: 'childhood',
      caption: '가족이 모인 식탁',
      location: '서울',
    }));
    expect(plan.checklistFindings).toContainEqual(expect.objectContaining({
      checklistItemId: 'minimum-source-volume',
      status: 'needs_work',
    }));
    expect(plan.followUpQuestions.some((question) => question.includes('사진'))).toBe(true);
    expect(PUBLICATION_EDITORIAL_PLAN_SYSTEM_PROMPT).toContain('EditorialPlan JSON object');
    expect(PUBLICATION_EDITORIAL_PLAN_SYSTEM_PROMPT).toContain('photoStoryPlacements');
  });

  it('uses the editorial plan when building the publication manifest', async () => {
    const input = {
      seniorName: '김영자',
      records: [
        {
          id: 'record_childhood_home',
          chapterId: 'childhood',
          chapterTitle: '유년기',
          transcriptText: '1982년 서울 집에서 어머니와 가족이 함께 모였던 날이 따뜻하게 기억납니다. 그날 고마운 마음이 오래 남았습니다.',
          recordedAt: new Date('2026-06-03T00:00:00.000Z').toISOString(),
        },
      ],
      chapters: [{ id: 'childhood', title: '유년기', order: 1 }],
      draftChapters: [],
      cover: null,
      photos: [],
    };

    const editorialPlan = await buildPublicationEditorialPlan(input);
    const manifest = await buildPublicationManifest({ ...input, editorialPlan });

    expect(PUBLICATION_MANIFEST_SYSTEM_PROMPT).toContain('If editorialPlan is provided');
    expect(PUBLICATION_MANIFEST_SYSTEM_PROMPT).toContain('photoStoryPlacements');
    expect(manifest.editorialNote).toBe(editorialPlan.editorialThesis);
    expect(manifest.chapters[0].missingSections).toEqual(expect.arrayContaining(
      editorialPlan.chapterPlans[0].followUpQuestions,
    ));
    expect(manifest.chapters[0].openingQuote).toBe(editorialPlan.chapterPlans[0].quoteCandidates[0].text);
    expect(manifest.closing.body).toContain('이 책이 가족 곁에서 오래 머물며');
    expect(manifest.closing.body).toContain('유년기의 기억은');
    expect(manifest.closing.body).not.toContain('유년기은');
    expect(manifest.closing.body).not.toContain('유료 가족 기록집');
    expect(manifest.closing.body).not.toContain('장 흐름');
    expect(manifest.closing.body).not.toContain('설계할 수 있습니다');
  });

  it('uses natural fallback closing subjects for reader-facing chapter titles', async () => {
    const input = {
      seniorName: '김영자',
      records: [
        {
          id: 'record_work_family',
          chapterId: 'work_family',
          chapterTitle: '일과 가족',
          transcriptText: '가게 일을 마치고 집으로 돌아오면 가족과 함께 저녁을 먹던 시간이 가장 든든했습니다.',
          recordedAt: new Date('2026-06-07T00:00:00.000Z').toISOString(),
        },
      ],
      chapters: [{ id: 'work_family', title: '일과 가족', order: 1 }],
      draftChapters: [],
      cover: null,
      photos: [],
    };

    const editorialPlan = await buildPublicationEditorialPlan(input);
    const manifest = await buildPublicationManifest({ ...input, editorialPlan });

    expect(manifest.closing.body).toContain('일과 가족의 시간은');
    expect(manifest.closing.body).not.toContain('일과 가족은');
    expect(manifest.closing.body).not.toContain('유료 가족 기록집');
    expect(manifest.closing.body).not.toContain('유료 기록집');
    expect(manifest.closing.body).not.toContain('장 흐름');
    expect(manifest.closing.body).not.toContain('설계할 수 있습니다');
    expect(manifest.closing.body).not.toContain('보강해야 합니다');
    expect(manifest.closing.body).not.toContain('현재 기록');

    const html = await renderPublicationHtml(manifest, 'A5');
    for (const term of [
      '유료 가족 기록집',
      '유료 기록집',
      '장 흐름',
      '설계할 수 있습니다',
      '보강해야 합니다',
      '현재 기록',
      '출처',
      '검증',
      'sourceRecordIds',
      'reliability',
      'hallucination',
      '환각 방지',
    ]) {
      expect(html).not.toContain(term);
    }
  });

  it('keeps cover tone labels out of reader-facing publication copy', async () => {
    const manifest = await buildPublicationManifest({
      seniorName: '김영자',
      records: [
        {
          id: 'record_childhood_tone_label',
          chapterId: 'childhood',
          chapterTitle: '유년기',
          transcriptText: '어머니와 가족에게 고마웠던 따뜻한 어린 시절 기억입니다.',
          recordedAt: new Date('2026-06-07T00:00:00.000Z').toISOString(),
        },
      ],
      chapters: [{ id: 'childhood', title: '유년기', order: 1 }],
      draftChapters: [],
      cover: {
        palette: 'warm_archive',
        template: 'letterpress',
        font: 'NotoSansKR',
        analysisJson: JSON.stringify({ tone: '담백하고 따뜻한 구어체' }),
      },
      photos: [],
      agentTimeoutMs: 1,
    });

    expect(manifest.subtitle).toBe('가족의 기억으로 엮은 생애 기록');
    expect(manifest.cover.subtitle).toBe('기억을 따라 엮은 한 권의 기록');
    expect(manifest.subtitle).not.toContain('담백하고 따뜻한 구어체');
    expect(manifest.cover.subtitle).not.toContain('담백하고 따뜻한 구어체');
    expect(manifest.closing.body).not.toBe(
      '이야기는 이곳에 잠시 매듭지어집니다. 함께 나눈 기억은 앞으로도 가족 곁에서 오래 머물 것입니다.',
    );
    expect(manifest.closing.body).not.toContain('현재 기록');
    expect(manifest.closing.body).not.toContain('유료 가족 기록집');
    expect(manifest.closing.body).not.toContain('장 흐름');
    expect(manifest.closing.body).not.toContain('설계할 수 있습니다');

    const html = await renderPublicationHtml(manifest, 'A5');
    expect(html).toContain('가족의 기억으로 엮은 생애 기록');
    expect(html).toContain('기억을 따라 엮은 한 권의 기록');
    expect(html).not.toContain('담백하고 따뜻한 구어체');
    expect(html).not.toContain('유료 가족 기록집');
    expect(html).not.toContain('장 흐름');
    expect(html).not.toContain('설계할 수 있습니다');
  });

  it('accepts a reader-facing closing note from the publication agent response', async () => {
    const agentManifest = {
      title: '김영자의 장면들',
      subtitle: '식탁과 골목에 남은 마음',
      cover: {
        title: '김영자의 장면들',
        subtitle: '식탁과 골목에 남은 마음',
        dedication: '서로의 안부를 묻는 마음으로 이 책을 가족에게 바칩니다.',
        backCoverBlurb: '가족이 함께 간직해 온 장면들을 한 권의 이야기로 엮었습니다.',
      },
      designPlan: {
        mood: 'quiet_blue',
        coverComposition: 'quiet_band',
        chapterOpenerStyle: 'minimal_rule',
        photoTreatment: 'gallery_grid',
        pacing: 'compact',
        ornamentLevel: 'none',
      },
      chapters: [
        {
          chapterId: 'childhood',
          title: '식탁에 남은 하루',
          subtitle: '어머니와 가족이 함께 있던 저녁',
          openingQuote: '고마운 마음이 오래 남았습니다.',
          paragraphs: [
            {
              text: '기억 조각에는 1982년 서울 집에서 어머니와 가족이 함께 밥을 먹던 장면이 남아 있습니다. 그날의 따뜻함이 기록되어 있습니다.',
              sourceRecordIds: ['record_agent_closing'],
              reliability: 'CONFIRMED',
            },
          ],
          missingSections: [],
        },
      ],
      closing: {
        title: '다시 안부를 묻는 마음',
        body: '식탁에 남은 하루는 가족이 서로를 기억하는 방식으로 이어졌습니다. 이 기록이 다음 대화의 조용한 시작이 되기를 바랍니다.',
      },
    };
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        expect(req.url).toBe('/chat/completions');
        expect(body).toContain('record_agent_closing');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          id: 'chatcmpl-publication-test',
          object: 'chat.completion',
          created: 0,
          model: 'gpt-4o-mini',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: JSON.stringify(agentManifest),
              },
              finish_reason: 'stop',
            },
          ],
        }));
      });
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('mock server did not bind a TCP port');

    process.env.ALLOW_OPENAI_IN_TESTS = 'true';
    process.env.FACTCHAT_API_KEY = 'test-factchat-key';
    process.env.FACTCHAT_BASE_URL = `http://127.0.0.1:${address.port}`;
    process.env.FACTCHAT_WRITING_MODEL = 'gpt-4o-mini';

    try {
      const manifest = await buildPublicationManifest({
        seniorName: '김영자',
        records: [
          {
            id: 'record_agent_closing',
            chapterId: 'childhood',
            chapterTitle: '유년기',
            transcriptText: '1982년 서울 집에서 어머니와 가족이 함께 밥을 먹던 날이 따뜻하게 기억납니다.',
            recordedAt: new Date('2026-06-07T00:00:00.000Z').toISOString(),
          },
        ],
        chapters: [{ id: 'childhood', title: '유년기', order: 1 }],
        draftChapters: [],
        cover: null,
        photos: [],
        editorialPlan: await buildPublicationEditorialPlan({
          seniorName: '김영자',
          records: [],
          chapters: [{ id: 'childhood', title: '유년기', order: 1 }],
          draftChapters: [],
          cover: null,
          photos: [],
          agentTimeoutMs: 1,
        }),
        writingDraft: {
          version: 1,
          generatedAt: new Date('2026-06-07T00:00:00.000Z').toISOString(),
          seniorName: '김영자',
          selectedToneProfile: { name: '이야기책 형태', patterns: [] },
          styleSummary: '원천 기록을 책 문단으로 먼저 다듬었습니다.',
          chapters: [
            {
              chapterId: 'childhood',
              chapterTitle: '유년기',
              paragraphs: [
                {
                  text: '1982년 서울 집에서 어머니와 가족이 함께 밥을 먹던 날은 따뜻하게 남아 있습니다.',
                  sourceRecordIds: ['record_agent_closing'],
                  role: 'lead',
                },
              ],
            },
          ],
          revisionFindings: [
            {
              category: 'repetition',
              severity: 'needs_work',
              note: '자료 요약식 문장을 산문 문장으로 교체했습니다.',
            },
          ],
          generatedBy: 'fallback',
        },
        agentTimeoutMs: 5_000,
      });

      expect(manifest.generatedAt).toBeTruthy();
      expect(manifest.provenance.generatedBy).toBe('agent');
      expect(manifest.closing).toEqual(agentManifest.closing);
      expect(manifest.closing.body).not.toContain('sourceRecordIds');
      expect(manifest.closing.body).not.toContain('담백하고 따뜻한 구어체');
      expect(manifest.chapters[0].paragraphs[0].text).toBe(
        '1982년 서울 집에서 어머니와 가족이 함께 밥을 먹던 날은 따뜻하게 남아 있습니다.',
      );
      expect(manifest.chapters[0].paragraphs[0].text).not.toBe(agentManifest.chapters[0].paragraphs[0].text);
      expect(manifest.chapters[0].paragraphs[0].text).not.toMatch(/기억\s*조각|기록되어|적혀\s*있/);
    } finally {
      delete process.env.ALLOW_OPENAI_IN_TESTS;
      process.env.FACTCHAT_API_KEY = '';
      process.env.FACTCHAT_BASE_URL = 'https://factchat-cloud.mindlogic.ai/v1/gateway';
      process.env.FACTCHAT_WRITING_MODEL = '';
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it('fails a strict publication preview job without fallback when the external agents cannot produce a draft', async () => {
    await prisma.interviewRecord.create({
      data: {
        userId: 'local_senior',
        chapterId: 'childhood',
        audioFileKey: 'audio/editorial-plan.raw',
        transcriptText: '1982년 서울 집에서 어머니와 가족이 함께 밥을 먹던 날이 따뜻하게 기억납니다. 그날 고마운 마음이 오래 남았습니다.',
      },
    });

    const started = await startLocalPublicationPreviewJob({
      seniorId: 'local_senior',
      requestedById: 'local_guardian',
      format: 'A5',
      usageContext: { userId: 'local_guardian', role: 'guardian' },
    });

    const failed = await waitForPublicationPreviewJob(started.id, 'failed');
    expect(failed.stage).toBe('done');
    expect(failed.attemptCount).toBe(2);
    expect(failed.errorCode).toBe('config_missing');
    expect(await prisma.publicationDraftCache.count({ where: { generatedBy: 'agent' } })).toBe(0);
    await expect(generateLocalPublicationDraft({
      seniorId: 'local_senior',
      format: 'A5',
      agentTimeoutMs: 1,
    })).rejects.toThrow('Publication editorial plan agent is not configured');
  });

  it('keeps retrying recoverable publication preview agent failures until an agent draft is ready', async () => {
    const record = await prisma.interviewRecord.create({
      data: {
        userId: 'local_senior',
        chapterId: 'childhood',
        audioFileKey: 'audio/publication-retry.raw',
        transcriptText: '1982년 서울 집에서 어머니와 가족이 함께 밥을 먹던 날이 따뜻하게 기억납니다. 그날 고마운 마음이 오래 남았습니다.',
        recordedAt: new Date('2026-06-07T00:00:00.000Z'),
      },
    });
    let providerCallCount = 0;
    const server = http.createServer((req, res) => {
      req.on('data', () => {});
      req.on('end', () => {
        providerCallCount += 1;
        if (providerCallCount === 1) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            id: 'chatcmpl-empty-editorial-plan',
            object: 'chat.completion',
            created: 0,
            model: 'gpt-4o-mini',
            choices: [{ index: 0, message: { role: 'assistant', content: '' }, finish_reason: 'stop' }],
          }));
          return;
        }
        const content = providerCallCount === 2
          ? {
            version: 1,
            generatedAt: new Date('2026-06-07T02:00:00.000Z').toISOString(),
            seniorName: '김영자',
            targetProduct: 'paid_family_book',
            readiness: 'needs_more_records',
            coreTheme: '가족의 식탁과 오래 남은 마음',
            editorialThesis: '가족의 식탁에 남은 장면을 중심으로 기록집을 구성합니다.',
            selectedToneProfile: null,
            sourceSummary: {
              sourceRecordCount: 1,
              chapterCount: 1,
              photoCount: 0,
              photoLedRecordCount: 0,
              strongChapterCount: 1,
              weakChapterCount: 0,
              sceneSpecificRecordCount: 1,
            },
            chapterPlans: [
              {
                chapterId: record.chapterId,
                chapterTitle: '유년기',
                strength: 'strong',
                recommendedRole: 'anchor_chapter',
                editorialFocus: '어머니와 가족이 함께 있던 식탁의 기억',
                sourceRecordIds: [record.id],
                quoteCandidates: [{ text: '그날 고마운 마음이 오래 남았습니다.', sourceRecordId: record.id }],
                photoPlacements: [],
                followUpQuestions: [],
                checklistRisks: [],
              },
            ],
            strongChapters: [record.chapterId],
            weakChapters: [],
            directQuoteCandidates: [{ text: '그날 고마운 마음이 오래 남았습니다.', sourceRecordId: record.id, chapterId: record.chapterId }],
            photoStoryPlacements: [],
            checklistFindings: [],
            followUpQuestions: [],
            nextActions: ['가족 검수에서 사실관계를 확인합니다.'],
          }
          : providerCallCount === 3
            ? {
              version: 1,
              generatedAt: new Date('2026-06-07T02:00:00.000Z').toISOString(),
              seniorName: '김영자',
              selectedToneProfile: null,
              styleSummary: '기록집 작성 에이전트가 실제 기록을 바탕으로 초안을 작성했습니다.',
              chapters: [
                {
                  chapterId: record.chapterId,
                  chapterTitle: '유년기',
                  paragraphs: [
                    {
                      text: '1982년 서울 집에서 어머니와 가족이 함께 밥을 먹던 날이 따뜻하게 기억납니다.',
                      sourceRecordIds: [record.id],
                      role: 'lead',
                    },
                  ],
                },
              ],
              revisionFindings: [{ category: 'tone', severity: 'info', note: '에이전트 초안을 사용했습니다.' }],
            }
            : {
              title: '김영자의 이야기',
              subtitle: '가족의 식탁과 오래 남은 마음',
              cover: {
                title: '김영자의 이야기',
                subtitle: '가족의 식탁과 오래 남은 마음',
                dedication: '서로의 안부를 묻는 마음으로 이 책을 가족에게 바칩니다.',
                backCoverBlurb: '가족이 함께 간직해 온 장면들을 한 권의 이야기로 엮었습니다.',
              },
              designPlan: {
                mood: 'warm_archive',
                coverComposition: 'quiet_band',
                chapterOpenerStyle: 'minimal_rule',
                photoTreatment: 'gallery_grid',
                pacing: 'compact',
                ornamentLevel: 'none',
              },
              chapters: [
                {
                  chapterId: record.chapterId,
                  title: '식탁에 남은 하루',
                  subtitle: '어머니와 가족이 함께 있던 저녁',
                  openingQuote: '그날 고마운 마음이 오래 남았습니다.',
                  paragraphs: [
                    {
                      text: '1982년 서울 집에서 어머니와 가족이 함께 밥을 먹던 날이 따뜻하게 기억납니다.',
                      sourceRecordIds: [record.id],
                      reliability: 'CONFIRMED',
                    },
                  ],
                  missingSections: [],
                },
              ],
              closing: {
                title: '다시 안부를 묻는 마음',
                body: '식탁에 남은 하루는 가족이 서로를 기억하는 방식으로 이어졌습니다.',
              },
            };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          id: `chatcmpl-publication-retry-${providerCallCount}`,
          object: 'chat.completion',
          created: 0,
          model: 'gpt-4o-mini',
          choices: [{ index: 0, message: { role: 'assistant', content: JSON.stringify(content) }, finish_reason: 'stop' }],
        }));
      });
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('mock server did not bind a TCP port');

    process.env.ALLOW_OPENAI_IN_TESTS = 'true';
    process.env.FACTCHAT_API_KEY = 'test-factchat-key';
    process.env.FACTCHAT_BASE_URL = `http://127.0.0.1:${address.port}`;
    process.env.FACTCHAT_WRITING_MODEL = 'gpt-4o-mini';

    try {
      const started = await startLocalPublicationPreviewJob({
        seniorId: 'local_senior',
        requestedById: 'local_guardian',
        format: 'A5',
        usageContext: { userId: 'local_guardian', role: 'guardian' },
      });
      const ready = await waitForPublicationPreviewJob(started.id, 'ready');
      expect(ready.attemptCount).toBe(2);
      expect(providerCallCount).toBe(4);
      const cache = await prisma.publicationDraftCache.findUnique({ where: { id: ready.draftCacheId ?? '' } });
      expect(cache?.generatedBy).toBe('agent');
      expect(cache?.html).toContain('김영자의 이야기');
    } finally {
      delete process.env.ALLOW_OPENAI_IN_TESTS;
      process.env.FACTCHAT_API_KEY = '';
      process.env.FACTCHAT_BASE_URL = 'https://factchat-cloud.mindlogic.ai/v1/gateway';
      process.env.FACTCHAT_WRITING_MODEL = '';
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it('caches publication preview output so repeated preview and final generation do not call the writer again', async () => {
    const record = await prisma.interviewRecord.create({
      data: {
        userId: 'local_senior',
        chapterId: 'childhood',
        audioFileKey: 'audio/publication-cache.raw',
        transcriptText: '1982년 서울 집에서 어머니와 가족이 함께 밥을 먹던 날이 따뜻하게 기억납니다. 그날 고마운 마음이 오래 남았습니다.',
        recordedAt: new Date('2026-06-07T00:00:00.000Z'),
      },
    });
    const cover = await prisma.coverDesign.create({
      data: {
        userId: 'local_senior',
        palette: 'warm_archive',
        template: 'letterpress',
        font: '명조체',
        analysisJson: '{}',
        confirmedAt: new Date('2026-06-07T01:00:00.000Z'),
      },
    });

    let providerCallCount = 0;
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        providerCallCount += 1;
        const providerStep = ((providerCallCount - 1) % 3) + 1;
        expect(req.url).toBe('/chat/completions');
        expect(body).toContain('max_completion_tokens');
        const content = providerStep === 1
          ? {
            readiness: 'needs_family_review',
            coreTheme: '가족의 식탁과 오래 남은 고마움',
            editorialThesis: '1982년 서울 집의 식탁 장면을 중심으로 가족의 마음을 엮습니다.',
            chapterPlans: [
              {
                chapterId: record.chapterId,
                strength: 'strong',
                recommendedRole: 'anchor_chapter',
                editorialFocus: '가족이 함께 밥을 먹던 날의 따뜻함',
                sourceRecordIds: [record.id],
                quoteCandidates: [
                  {
                    text: '그날 고마운 마음이 오래 남았습니다.',
                    sourceRecordId: record.id,
                  },
                ],
                followUpQuestions: [],
                checklistRisks: [],
              },
            ],
            followUpQuestions: [],
            nextActions: ['가족 검수에서 사실관계를 확인합니다.'],
          }
          : providerStep === 2
            ? {
              version: 1,
              generatedAt: new Date('2026-06-07T02:00:00.000Z').toISOString(),
              seniorName: '김영자',
              selectedToneProfile: null,
              styleSummary: '기록집 작성 에이전트가 실제 기록을 바탕으로 초안을 작성했습니다.',
              chapters: [
                {
                  chapterId: record.chapterId,
                  chapterTitle: '유년기',
                  paragraphs: [
                    {
                      text: '1982년 서울 집에서 어머니와 가족이 함께 밥을 먹던 날이 따뜻하게 기억납니다.',
                      sourceRecordIds: [record.id],
                      role: 'lead',
                    },
                  ],
                },
              ],
              revisionFindings: [
                {
                  category: 'tone',
                  severity: 'info',
                  note: '에이전트 초안을 사용했습니다.',
                },
              ],
            }
            : {
              title: '김영자의 이야기',
              subtitle: '가족의 식탁과 오래 남은 마음',
              cover: {
                title: '김영자의 이야기',
                subtitle: '가족의 식탁과 오래 남은 마음',
                dedication: '서로의 안부를 묻는 마음으로 이 책을 가족에게 바칩니다.',
                backCoverBlurb: '가족이 함께 간직해 온 장면들을 한 권의 이야기로 엮었습니다.',
              },
              designPlan: {
                mood: 'warm_archive',
                coverComposition: 'quiet_band',
                chapterOpenerStyle: 'minimal_rule',
                photoTreatment: 'gallery_grid',
                pacing: 'compact',
                ornamentLevel: 'none',
              },
              chapters: [
                {
                  chapterId: record.chapterId,
                  title: '식탁에 남은 하루',
                  subtitle: '어머니와 가족이 함께 있던 저녁',
                  openingQuote: '그날 고마운 마음이 오래 남았습니다.',
                  paragraphs: [
                    {
                      text: '1982년 서울 집에서 어머니와 가족이 함께 밥을 먹던 날이 따뜻하게 기억납니다.',
                      sourceRecordIds: [record.id],
                      reliability: 'CONFIRMED',
                    },
                  ],
                  missingSections: [],
                },
              ],
              closing: {
                title: '다시 안부를 묻는 마음',
                body: '식탁에 남은 하루는 가족이 서로를 기억하는 방식으로 이어졌습니다.',
              },
            };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          id: `chatcmpl-publication-cache-${providerCallCount}`,
          object: 'chat.completion',
          created: 0,
          model: 'gpt-4o-mini',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: JSON.stringify(content) },
              finish_reason: 'stop',
            },
          ],
        }));
      });
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('mock server did not bind a TCP port');

    process.env.ALLOW_OPENAI_IN_TESTS = 'true';
    process.env.FACTCHAT_API_KEY = 'test-factchat-key';
    process.env.FACTCHAT_BASE_URL = `http://127.0.0.1:${address.port}`;
    process.env.FACTCHAT_WRITING_MODEL = 'gpt-4o-mini';

    try {
      const preview = await generateLocalPublicationDraft({
        seniorId: 'local_senior',
        coverDesignId: cover.id,
        format: 'A5',
        generationMode: 'preview',
      });
      expect(providerCallCount).toBe(3);
      expect(preview.cacheStatus).toBe('generated');
      expect(preview.writingDraft.generatedBy).toBe('agent');
      expect(preview.draftCacheId).toEqual(expect.any(String));
      expect(preview.html).toContain('김영자의 이야기');

      const repeatedPreview = await generateLocalPublicationDraft({
        seniorId: 'local_senior',
        coverDesignId: cover.id,
        format: 'A5',
        generationMode: 'preview',
      });
      expect(providerCallCount).toBe(3);
      expect(repeatedPreview.cacheStatus).toBe('hit');
      expect(repeatedPreview.draftCacheId).toBe(preview.draftCacheId);

      const cachedJob = await startLocalPublicationPreviewJob({
        seniorId: 'local_senior',
        requestedById: 'local_guardian',
        coverDesignId: cover.id,
        format: 'A5',
        usageContext: { userId: 'local_guardian', role: 'guardian' },
      });
      expect(providerCallCount).toBe(3);
      expect(cachedJob.status).toBe('ready');
      expect(cachedJob.cacheStatus).toBe('hit');
      expect(cachedJob.draftCacheId).toBe(preview.draftCacheId);
      expect(cachedJob.draft?.html).toContain('김영자의 이야기');

      const firstPrint = await generateLocalPrintPdf({
        seniorId: 'local_senior',
        coverDesignId: cover.id,
        format: 'A5',
        usageContext: { userId: 'local_guardian', role: 'guardian' },
      });
      expect(providerCallCount).toBe(3);
      expect(firstPrint.cacheStatus).toBe('hit');
      expect(firstPrint.draftCacheId).toBe(preview.draftCacheId);

      const cachedPreview = await generateLocalPublicationDraft({
        seniorId: 'local_senior',
        coverDesignId: cover.id,
        format: 'A5',
        generationMode: 'preview',
      });
      expect(providerCallCount).toBe(3);
      expect(cachedPreview.cacheStatus).toBe('hit');
      expect(cachedPreview.draftCacheId).toBe(preview.draftCacheId);

      const secondPrint = await generateLocalPrintPdf({
        seniorId: 'local_senior',
        coverDesignId: cover.id,
        format: 'A5',
        usageContext: { userId: 'local_guardian', role: 'guardian' },
      });
      expect(providerCallCount).toBe(3);
      expect(secondPrint.cacheStatus).toBe('hit');
      expect(secondPrint.draftCacheId).toBe(preview.draftCacheId);

      const auditLogs = await prisma.aiProxyAuditLog.findMany({
        where: {
          endpoint: {
            in: ['publication_editorial_plan', 'publication_writing_draft', 'publication_manifest'],
          },
          outcome: 'success',
        },
        orderBy: { createdAt: 'asc' },
      });
      expect(auditLogs).toHaveLength(0);

      await prisma.interviewRecord.create({
        data: {
          userId: 'local_senior',
          chapterId: 'childhood',
          audioFileKey: 'audio/publication-cache-new-answer.raw',
          transcriptText: '새로 추가된 답변은 어머니와 다시 밥상을 차리던 기억을 담고 있습니다.',
          recordedAt: new Date('2026-06-08T00:00:00.000Z'),
        },
      });
      const stalePreviewJob = await startLocalPublicationPreviewJob({
        seniorId: 'local_senior',
        requestedById: 'local_guardian',
        coverDesignId: cover.id,
        format: 'A5',
        usageContext: { userId: 'local_guardian', role: 'guardian' },
      });
      expect(providerCallCount).toBe(3);
      expect(stalePreviewJob.status).toBe('ready');
      expect(stalePreviewJob.isStale).toBe(true);
      expect(stalePreviewJob.draftCacheId).toBe(preview.draftCacheId);
      expect(stalePreviewJob.draftSourceHash).toBe(preview.sourceHash);
      expect(stalePreviewJob.sourceHash).not.toBe(preview.sourceHash);

      const updatingJob = await startLocalPublicationPreviewJob({
        seniorId: 'local_senior',
        requestedById: 'local_guardian',
        coverDesignId: cover.id,
        forceRefresh: true,
        format: 'A5',
        usageContext: { userId: 'local_guardian', role: 'guardian' },
      });
      const readyUpdatedJob = await waitForPublicationPreviewJob(updatingJob.id, 'ready');
      expect(providerCallCount).toBe(6);
      const updatedCache = await prisma.publicationDraftCache.findUnique({ where: { id: readyUpdatedJob.draftCacheId ?? '' } });
      expect(updatedCache?.generatedBy).toBe('agent');
      expect(updatedCache?.sourceHash).toBe(stalePreviewJob.sourceHash);
    } finally {
      delete process.env.ALLOW_OPENAI_IN_TESTS;
      process.env.FACTCHAT_API_KEY = '';
      process.env.FACTCHAT_BASE_URL = 'https://factchat-cloud.mindlogic.ai/v1/gateway';
      process.env.FACTCHAT_WRITING_MODEL = '';
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it('renders photo question answers as photo story blocks instead of standalone gallery plates', async () => {
    const fileKey = 'photos/publication-photo-story-test.png';
    const filePath = resolveLocalFileKey(fileKey);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(
      filePath,
      Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=', 'base64'),
    );

    const manifest = await buildPublicationManifest({
      seniorName: '김영자',
      records: [
        {
          id: 'photo_answer_1',
          chapterId: 'childhood',
          chapterTitle: '유년기',
          transcriptText: '사진 속 식탁에는 온 가족이 둘러앉아 밥을 먹던 날의 기억이 남아 있습니다.',
          questionText: '이 사진을 보면 어떤 장면이 떠오르시나요?',
          questionCategory: 'photo_questions',
          photoId: 'photo_story_1',
          photo: {
            id: 'photo_story_1',
            caption: '가족이 모인 식탁',
            capturedDate: '1982-05-01',
            location: '서울',
          },
          recordedAt: new Date('2026-06-03T00:00:00.000Z').toISOString(),
        },
      ],
      chapters: [{ id: 'childhood', title: '유년기', order: 1 }],
      draftChapters: [],
      cover: null,
      photos: [
        {
          id: 'photo_story_1',
          fileKey,
          mimeType: 'image/png',
          caption: '가족이 모인 식탁',
          capturedDate: '1982-05-01',
          location: '서울',
        },
      ],
    });

    const html = await renderPublicationHtml(manifest, 'A5');
    expect(html).toContain('photo-story-section');
    expect(html).toContain('사진이 들려준 이야기');
    expect(html).toContain('가족이 모인 식탁');
    expect(html).toContain('사진 속 식탁에는 온 가족이 둘러앉아 밥을 먹던 날의 기억이 남아 있습니다.');
    expect(html).not.toContain('<article class="photo-plate">');
  });

  it('replaces internal QA photo captions in reader-facing publication html', async () => {
    const fileKey = 'photos/publication-caption-sanitizer-test.png';
    const filePath = resolveLocalFileKey(fileKey);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(
      filePath,
      Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=', 'base64'),
    );

    const manifest = await buildPublicationManifest({
      seniorName: '김영자',
      records: [
        {
          id: 'photo_answer_qa_caption',
          chapterId: 'childhood',
          chapterTitle: '유년기',
          transcriptText: '사진을 보며 가족이 함께 모였던 하루를 떠올렸습니다.',
          questionText: '이 사진을 보면 어떤 장면이 떠오르시나요?',
          questionCategory: 'photo_questions',
          photoId: 'photo_story_dirty_caption',
          photo: {
            id: 'photo_story_dirty_caption',
            caption: 'QA 합성 사진 - 레이아웃 검증용',
            capturedDate: '1982-05-01',
            location: '서울',
          },
          recordedAt: new Date('2026-06-03T00:00:00.000Z').toISOString(),
        },
      ],
      chapters: [{ id: 'childhood', title: '유년기', order: 1 }],
      draftChapters: [],
      cover: null,
      photos: [
        {
          id: 'photo_story_dirty_caption',
          fileKey,
          mimeType: 'image/png',
          caption: 'QA 합성 사진 - 레이아웃 검증용',
          capturedDate: '1982-05-01',
          location: '서울',
        },
        {
          id: 'photo_plate_dirty_caption',
          fileKey,
          mimeType: 'image/png',
          caption: '테스트 샘플 데이터',
          capturedDate: '1984-01-01',
          location: '부산',
        },
        {
          id: 'photo_plate_filename_caption',
          fileKey,
          mimeType: 'image/png',
          caption: 'demo_bulk_20260607_001_kim_yeongja_photo_01.png',
          capturedDate: '1952년 무렵',
          location: '구례 본가',
        },
      ],
    });

    const html = await renderPublicationHtml(manifest, 'A5');
    expect(html).toContain('photo-story-section');
    expect(html).toContain('<article class="photo-plate">');
    expect(html).toContain('가족 사진');
    expect(html).not.toContain('QA 합성 사진');
    expect(html).not.toContain('레이아웃 검증용');
    expect(html).not.toContain('테스트 샘플 데이터');
    expect(html).not.toContain('demo_bulk_20260607_001_kim_yeongja_photo_01.png');
  });

  it('renders distinct reader-facing CSS hooks for publication design plans', async () => {
    const createManifest = (designPlan: PublicationManifest['designPlan']): PublicationManifest => ({
      version: 1,
      generatedAt: new Date('2026-06-07T00:00:00.000Z').toISOString(),
      title: '김영자의 이야기',
      subtitle: '가족의 기억으로 엮은 생애 기록',
      authorName: '김영자',
      seasonLabel: 'Dearlog 가족 기록집',
      design: {
        palette: designPlan.mood,
        template: designPlan.coverComposition,
        font: 'NotoSansKR',
        accentColor: designPlan.mood === 'quiet_blue'
          ? '#647D9A'
          : designPlan.mood === 'classic_ink'
            ? '#2F3437'
            : '#9B6F4E',
        paperColor: designPlan.mood === 'quiet_blue' ? '#F3F6F8' : '#F7F5EF',
        inkColor: designPlan.mood === 'classic_ink' ? '#202020' : '#2B2723',
      },
      designPlan,
      cover: {
        kicker: 'DEARLOG FAMILY BOOK',
        title: '김영자의 이야기',
        subtitle: '기억을 따라 엮은 한 권의 기록',
        dedication: '가족이 함께 남긴 기억을 바탕으로 구성했습니다.',
        backCoverBlurb: '김영자님의 이야기를 가족의 마음으로 엮었습니다.',
      },
      editorialNote: 'internal only',
      chapters: [
        {
          chapterId: 'childhood',
          title: '유년기',
          subtitle: '기억을 따라 이어지는 이야기',
          openingQuote: '그 시절의 마음이 오래 남았습니다.',
          paragraphs: [
            {
              id: 'paragraph_1',
              text: '어머니와 가족에게 고마웠던 따뜻한 어린 시절 기억입니다.',
              sourceRecordIds: ['record_childhood_1'],
              reliability: 'CONFIRMED',
            },
          ],
          missingSections: [],
          sourceRecords: [
            {
              id: 'record_childhood_1',
              chapterId: 'childhood',
              chapterTitle: '유년기',
              transcriptText: '어머니와 가족에게 고마웠던 따뜻한 어린 시절 기억입니다.',
              recordedAt: new Date('2026-06-07T00:00:00.000Z').toISOString(),
            },
          ],
        },
      ],
      photoPlates: [],
      closing: {
        title: '마지막으로',
        body: '함께 나눈 기억은 앞으로도 가족 곁에서 오래 머물 것입니다.',
      },
      provenance: {
        sourceRecordCount: 1,
        sourceRecordIds: ['record_childhood_1'],
        hallucinationGuard: ['internal only'],
        generatedBy: 'fallback',
      },
    });

    const quietHtml = await renderPublicationHtml(createManifest({
      mood: 'quiet_blue',
      coverComposition: 'quiet_band',
      chapterOpenerStyle: 'minimal_rule',
      photoTreatment: 'album_stack',
      pacing: 'compact',
      ornamentLevel: 'none',
    }), 'A5');
    const classicHtml = await renderPublicationHtml(createManifest({
      mood: 'classic_ink',
      coverComposition: 'centered_letter',
      chapterOpenerStyle: 'numbered_classic',
      photoTreatment: 'single_plate',
      pacing: 'spacious',
      ornamentLevel: 'decorative',
    }), 'A5');

    expect(quietHtml).toContain(
      '<body class="mood-quiet_blue cover-composition-quiet_band chapter-style-minimal_rule photo-treatment-album_stack pacing-compact ornament-none">',
    );
    expect(quietHtml).toContain('body.mood-quiet_blue .title-page');
    expect(quietHtml).toContain('body.cover-composition-quiet_band .cover::after');
    expect(quietHtml).toContain('word-break: keep-all;');
    expect(quietHtml).toContain('body.chapter-style-minimal_rule .chapter-opener');
    expect(quietHtml).toContain('body.photo-treatment-album_stack .photo-story');

    expect(classicHtml).toContain(
      '<body class="mood-classic_ink cover-composition-centered_letter chapter-style-numbered_classic photo-treatment-single_plate pacing-spacious ornament-decorative">',
    );
    expect(classicHtml).toContain('body.mood-classic_ink .title-page');
    expect(classicHtml).toContain('body.cover-composition-centered_letter .cover h1');
    expect(classicHtml).toContain('body.chapter-style-numbered_classic .chapter-opener::before');
    expect(classicHtml).toContain('data-chapter-number="01"');
    expect(classicHtml).toContain('body.photo-treatment-single_plate .photo-story');

    for (const html of [quietHtml, classicHtml]) {
      const htmlWithoutFontData = html.replace(/data:font\/truetype;base64,[^']+/g, 'data:font/truetype;base64,');
      for (const term of ['sourceRecordIds', 'reliability', 'hallucination', '환각 방지', 'CONFIRMED', '담백하고 따뜻한 구어체']) {
        expect(htmlWithoutFontData).not.toContain(term);
      }
    }
  });

  it('renders reader-facing publication html and pdf without internal verification metadata', async () => {
    const manifest = await buildPublicationManifest({
      seniorName: '김영자',
      records: [
        {
          id: 'record_childhood_1',
          chapterId: 'childhood',
          chapterTitle: '유년기',
          transcriptText: '어머니와 가족에게 고마웠던 따뜻한 어린 시절 기억입니다.',
          recordedAt: new Date('2026-06-03T00:00:00.000Z').toISOString(),
        },
      ],
      chapters: [{ id: 'childhood', title: '유년기', order: 1 }],
      draftChapters: [
        {
          chapterId: 'childhood',
          chapterTitle: '유년기',
          toneProfile: { name: '뉴스 기사 형태', patterns: ['기사체', '객관적 사실 중심'] },
          paragraphs: [
            {
              text: '어머니와 가족에게 고마웠던 따뜻한 어린 시절 기억입니다.',
              sourceChunkIds: ['record_childhood_1'],
              reliability: 'UNVERIFIED',
              uncertaintyNote: '불확실성 메모',
            },
          ],
          missingSections: ['더 채울 기억: 어린 시절 친구 이야기를 더 물어보기'],
        },
      ],
      cover: null,
      photos: [],
    });
    const internalManifest: PublicationManifest = {
      ...manifest,
      subtitle: '출처 답변 1개 · 생성 방식 fallback',
      cover: {
        ...manifest.cover,
        subtitle: '1개의 출처 확인 문단',
        dedication: '원문 답변을 바탕으로 구성했습니다.',
        backCoverBlurb: '출처 답변 1개 · 생성 방식 fallback · hallucination guard',
      },
      editorialNote: '이 PDF는 원본 답변 ID와 연결된 문단만 본문으로 배치합니다.',
      chapters: manifest.chapters.map((chapter) => ({
        ...chapter,
        subtitle: '1개의 출처 확인 문단',
        missingSections: ['더 채울 기억: 어린 시절 친구 이야기를 더 물어보기'],
        paragraphs: chapter.paragraphs.map((paragraph) => ({
          ...paragraph,
          reliability: 'CONFIRMED',
          editorNote: '불확실성 메모',
        })),
      })),
      closing: {
        title: '마지막으로',
        body: 'missingSections에 더 채울 기억을 남깁니다.',
      },
      provenance: {
        sourceRecordCount: 1,
        sourceRecordIds: ['record_childhood_1'],
        hallucinationGuard: ['환각 방지 규칙: sourceRecordIds 없는 문단 금지'],
        generatedBy: 'fallback',
      },
    };

    expect(internalManifest.provenance.sourceRecordIds).toContain('record_childhood_1');
    expect(internalManifest.chapters[0].paragraphs[0].sourceRecordIds).toContain('record_childhood_1');
    expect(manifest.designPlan).toMatchObject({
      coverComposition: 'quiet_band',
      chapterOpenerStyle: 'minimal_rule',
      pacing: 'compact',
      ornamentLevel: 'none',
    });

    const html = await renderPublicationHtml(internalManifest, 'A5');
    const htmlWithoutFontData = html.replace(/data:font\/truetype;base64,[^']+/g, 'data:font/truetype;base64,');
    const forbiddenHtmlTerms = [
      '기록 출처',
      '이 장의 기록 출처',
      '출처 답변',
      '출처 확인',
      '생성 방식',
      'CONFIRMED',
      'ESTIMATED',
      'UNVERIFIED',
      '더 채울 기억',
      'sourceRecordIds',
      'sourceRecords',
      'sourceChunkIds',
      'source-',
      'reliability',
      'editorNote',
      'editorialNote',
      '불확실성 메모',
      '원문 답변을 바탕으로 구성했습니다.',
      'missingSections',
      'hallucination',
      '환각 방지',
      '담백하고 따뜻한 구어체',
      '유료 가족 기록집',
      '장 흐름',
      '설계할 수 있습니다',
    ];
    for (const term of forbiddenHtmlTerms) {
      expect(htmlWithoutFontData).not.toContain(term);
    }
    expect(htmlWithoutFontData.toLowerCase()).not.toContain('source');
    expect(html).toContain('cover-composition-quiet_band');
    expect(html).toContain('chapter-style-minimal_rule');
    expect(html).toContain('pacing-compact');
    expect(html).toContain('어머니와 가족에게 고마웠던 따뜻한 어린 시절 기억입니다.');
    expect(html).toContain('김영자의 이야기');

    const pdfBytes = await renderHtmlToPdf(html);
    const pdfText = Buffer.from(pdfBytes).toString('latin1');
    expect(pdfText.startsWith('%PDF-')).toBe(true);
    for (const term of ['CONFIRMED', 'UNVERIFIED', 'sourceRecordIds', 'hallucination', 'reliability']) {
      expect(pdfText).not.toContain(term);
    }
  });

  it('generates and confirms a cover, then creates a local publication request', async () => {
    const record = await prisma.interviewRecord.create({
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

    let providerCallCount = 0;
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        providerCallCount += 1;
        expect(req.url).toBe('/chat/completions');
        expect(body).toContain('max_completion_tokens');
        const content = providerCallCount === 1
          ? {
            readiness: 'needs_family_review',
            coreTheme: '어머니와 가족에게 남은 고마움',
            editorialThesis: '어린 시절의 따뜻한 기억을 중심으로 기록집을 엮습니다.',
            chapterPlans: [
              {
                chapterId: record.chapterId,
                strength: 'strong',
                recommendedRole: 'anchor_chapter',
                editorialFocus: '어머니와 가족에게 고마웠던 어린 시절',
                sourceRecordIds: [record.id],
                quoteCandidates: [
                  {
                    text: '어머니와 가족에게 고마웠던 따뜻한 어린 시절 기억입니다.',
                    sourceRecordId: record.id,
                  },
                ],
                followUpQuestions: [],
                checklistRisks: [],
              },
            ],
            followUpQuestions: [],
            nextActions: ['가족 검수에서 사실관계를 확인합니다.'],
          }
          : providerCallCount === 2
            ? {
              version: 1,
              generatedAt: new Date('2026-06-07T02:30:00.000Z').toISOString(),
              seniorName: '김영자',
              selectedToneProfile: null,
              styleSummary: '기록집 작성 에이전트가 실제 기록을 바탕으로 초안을 작성했습니다.',
              chapters: [
                {
                  chapterId: record.chapterId,
                  chapterTitle: '유년기',
                  paragraphs: [
                    {
                      text: '어머니와 가족에게 고마웠던 따뜻한 어린 시절 기억입니다.',
                      sourceRecordIds: [record.id],
                      role: 'lead',
                    },
                  ],
                },
              ],
              revisionFindings: [
                {
                  category: 'tone',
                  severity: 'info',
                  note: '에이전트 초안을 사용했습니다.',
                },
              ],
            }
            : {
              title: '김영자의 이야기',
              subtitle: '어린 시절에 남은 고마움',
              cover: {
                title: '김영자의 이야기',
                subtitle: '어린 시절에 남은 고마움',
                dedication: '서로의 안부를 묻는 마음으로 이 책을 가족에게 바칩니다.',
                backCoverBlurb: '가족이 함께 간직해 온 장면들을 한 권의 이야기로 엮었습니다.',
              },
              designPlan: {
                mood: 'warm_archive',
                coverComposition: 'quiet_band',
                chapterOpenerStyle: 'minimal_rule',
                photoTreatment: 'gallery_grid',
                pacing: 'compact',
                ornamentLevel: 'none',
              },
              chapters: [
                {
                  chapterId: record.chapterId,
                  title: '어린 시절의 고마움',
                  subtitle: '어머니와 가족에게 남은 마음',
                  openingQuote: '어머니와 가족에게 고마웠던 따뜻한 어린 시절 기억입니다.',
                  paragraphs: [
                    {
                      text: '어머니와 가족에게 고마웠던 따뜻한 어린 시절 기억입니다.',
                      sourceRecordIds: [record.id],
                      reliability: 'CONFIRMED',
                    },
                  ],
                  missingSections: [],
                },
              ],
              closing: {
                title: '다시 안부를 묻는 마음',
                body: '어린 시절의 고마움은 가족이 서로를 기억하는 방식으로 이어졌습니다.',
              },
            };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          id: `chatcmpl-publication-request-${providerCallCount}`,
          object: 'chat.completion',
          created: 0,
          model: 'gpt-4o-mini',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: JSON.stringify(content) },
              finish_reason: 'stop',
            },
          ],
        }));
      });
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('mock server did not bind a TCP port');

    process.env.ALLOW_OPENAI_IN_TESTS = 'true';
    process.env.FACTCHAT_API_KEY = 'test-factchat-key';
    process.env.FACTCHAT_BASE_URL = `http://127.0.0.1:${address.port}`;
    process.env.FACTCHAT_WRITING_MODEL = 'gpt-4o-mini';

    const publication = await prisma.publicationRequest.create({
      data: {
        userId: 'local_senior',
        requestedById: 'local_guardian',
        coverDesignId: cover.id,
        format: 'A5',
        status: 'generating',
      },
    });
    try {
      const printResult = await generateLocalPrintPdf({ seniorId: 'local_senior', coverDesignId: cover.id, format: 'A5' });
      const updated = await prisma.publicationRequest.update({
        where: { id: publication.id },
        data: {
          status: 'ready',
          pdfFileKey: printResult.pdfFileKey,
          draftCacheId: printResult.draftCacheId,
        },
      });

      expect(providerCallCount).toBe(3);
      expect(printResult.cacheStatus).toBe('generated');
      expect(updated.status).toBe('ready');
      expect(updated.pdfFileKey).toMatch(/^pdfs\//);
      expect(updated.draftCacheId).toEqual(expect.any(String));

      const pdfBytes = await fs.readFile(resolveLocalFileKey(updated.pdfFileKey!));
      const pdfText = pdfBytes.toString('latin1');
      expect(pdfText.startsWith('%PDF-')).toBe(true);
      expect(pdfText).toContain('/Producer (Skia/PDF');
      expect(pdfText).toContain('/MediaBox [0 0 420 594.95996]');
      expect(pdfBytes.byteLength).toBeGreaterThan(10_000);
    } finally {
      delete process.env.ALLOW_OPENAI_IN_TESTS;
      process.env.FACTCHAT_API_KEY = '';
      process.env.FACTCHAT_BASE_URL = 'https://factchat-cloud.mindlogic.ai/v1/gateway';
      process.env.FACTCHAT_WRITING_MODEL = '';
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
