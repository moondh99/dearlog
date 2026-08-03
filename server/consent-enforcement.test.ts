// @vitest-environment node
import os from 'node:os';
import path from 'node:path';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { FIXED_CHAPTERS, MIN_ANSWERS_PER_CHAPTER } from './domain/constants';

// 목적별 동의가 소비 지점에서 실제로 걸리는지 확인한다.
// 예전에는 5종 동의가 운영에서 생성되지 않는 Memory 테이블에 있어 집행 대상 자체가 없었고,
// 화면에서만 가려지고 API 응답에는 본문이 그대로 남는 경우가 있었다.

let prisma: typeof import('./db').prisma;
let initLocalDatabase: typeof import('./prisma/init').initLocalDatabase;
let prepareLocalPublicationInput: typeof import('./publication').prepareLocalPublicationInput;
let createApp: typeof import('./app').createApp;
let app: any;

const SENIOR = 'consent_senior';
const GUARDIAN = 'consent_guardian';

async function createRecord(overrides: Record<string, unknown> = {}) {
  return prisma.interviewRecord.create({
    data: {
      userId: SENIOR,
      chapterId: 'childhood',
      audioFileKey: `audio/consent-${Math.round(performance.now() * 1000)}.webm`,
      transcriptText: '아이들과 강가에서 물장구치던 여름이 생생합니다.',
      recordedAt: new Date('2026-06-01T00:00:00.000Z'),
      ...overrides,
    },
  });
}

beforeAll(async () => {
  process.env.DATABASE_URL = `file:${path.join(os.tmpdir(), `dearlog-consent-${Date.now()}.db`)}`;
  process.env.FACTCHAT_API_KEY = '';
  process.env.OPENAI_API_KEY = '';

  ({ prisma } = await import('./db'));
  ({ initLocalDatabase } = await import('./prisma/init'));
  ({ prepareLocalPublicationInput } = await import('./publication'));
  ({ createApp } = await import('./app'));
  await initLocalDatabase();
  // InterviewRecord.chapterId 는 Chapter 를 참조하므로 먼저 챕터를 만들어 둔다.
  for (const chapter of FIXED_CHAPTERS) {
    await prisma.chapter.upsert({
      where: { id: chapter.id },
      update: {},
      create: { ...chapter, minAnswerCount: MIN_ANSWERS_PER_CHAPTER },
    });
  }
  app = createApp();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  process.env.ALLOW_DEV_AUTH_HEADERS = 'true';
  await prisma.freeSpeechRecord.deleteMany({});
  await prisma.interviewRecord.deleteMany({});
  await prisma.photo.deleteMany({});
  await prisma.legacyVault.deleteMany({});
  await prisma.guardianSeniorLink.deleteMany({});

  await prisma.user.upsert({
    where: { id: SENIOR },
    update: {},
    create: { id: SENIOR, role: 'senior', name: '부모님', phoneNumber: '01055550001' },
  });
  await prisma.user.upsert({
    where: { id: GUARDIAN },
    update: {},
    create: { id: GUARDIAN, role: 'guardian', name: '자녀', phoneNumber: '01055550002' },
  });
  await prisma.guardianSeniorLink.create({ data: { guardianId: GUARDIAN, seniorId: SENIOR } });
});

function asGuardian(url: string) {
  return request(app).get(url).set('x-user-id', GUARDIAN).set('x-user-role', 'guardian');
}

function asSenior(url: string) {
  return request(app).get(url).set('x-user-id', SENIOR).set('x-user-role', 'senior');
}

describe('가족열람', () => {
  it('철회하면 보호자 응답에서 본문과 음성이 함께 빠진다', async () => {
    await createRecord({ familyRead: false });

    const res = await asGuardian('/api/interview-records');

    expect(res.status).toBe(200);
    expect(res.body.records).toHaveLength(1);
    expect(res.body.records[0].transcriptText).not.toContain('물장구');
    // 본문만 가리고 음성을 남기면 그대로 들을 수 있다.
    expect(res.body.records[0].audioUrl).toBeNull();
    expect(res.body.records[0].aiSummary).toBeNull();
  });

  it('부모님 본인은 철회한 기록도 계속 볼 수 있다', async () => {
    await createRecord({ familyRead: false });

    const res = await asSenior('/api/interview-records');

    expect(res.status).toBe(200);
    // 본인이 못 보면 동의를 되돌릴 수도 없다.
    expect(res.body.records[0].transcriptText).toContain('물장구');
  });

  it('허용 상태면 보호자도 본문을 본다', async () => {
    await createRecord();

    const res = await asGuardian('/api/interview-records');

    expect(res.body.records[0].transcriptText).toContain('물장구');
  });
});

describe('사후공개', () => {
  it('유산 전수 후에도 철회한 기록은 보호자에게 열리지 않는다', async () => {
    await createRecord({ posthumous: false });
    await prisma.legacyVault.create({
      data: { seniorId: SENIOR, isVaultSetup: true, deathVerificationStatus: 'released' },
    });

    const res = await asGuardian('/api/interview-records');

    expect(res.body.records[0].transcriptText).not.toContain('물장구');
  });

  it('사후공개를 허용한 기록은 전수 후 열린다', async () => {
    await createRecord({ posthumous: true });
    await prisma.legacyVault.create({
      data: { seniorId: SENIOR, isVaultSetup: true, deathVerificationStatus: 'released' },
    });

    const res = await asGuardian('/api/interview-records');

    expect(res.body.records[0].transcriptText).toContain('물장구');
  });
});

describe('민감정보', () => {
  it('철회하면 출판 입력에서 빠진다', async () => {
    const kept = await createRecord({ sensitive: true, transcriptText: '남는 이야기' });
    await createRecord({ sensitive: false, transcriptText: '민감한 이야기' });

    const input = await prepareLocalPublicationInput({ seniorId: SENIOR, format: 'A5' } as any);
    const ids = input.records.map((record: { id: string }) => record.id);

    // 책은 AI가 쓰므로, 출판 입력에 남으면 외부 제공자로 나간다.
    expect(ids).toEqual([kept.id]);
  });

  it('출판 동의만 철회해도 출판 입력에서 빠진다', async () => {
    const kept = await createRecord({ publish: true });
    await createRecord({ publish: false });

    const input = await prepareLocalPublicationInput({ seniorId: SENIOR, format: 'A5' } as any);

    expect(input.records.map((record: { id: string }) => record.id)).toEqual([kept.id]);
  });
});

describe('자유 발화 사본', () => {
  it('원본의 가족열람 철회가 사본에도 적용된다', async () => {
    const source = await createRecord({ familyRead: false });
    await prisma.freeSpeechRecord.create({
      data: {
        userId: SENIOR,
        chapterId: source.chapterId,
        audioFileKey: source.audioFileKey,
        transcriptText: source.transcriptText,
        recordedAt: source.recordedAt,
        interviewRecordId: source.id,
      },
    });

    const res = await asGuardian('/api/free-speech');

    expect(res.status).toBe(200);
    expect(res.body.records).toHaveLength(1);
    // 사본에 동의를 따로 두면 한쪽만 철회되는 우회로가 생긴다.
    expect(res.body.records[0].transcriptText).not.toContain('물장구');
    expect(res.body.records[0].audioUrl).toBeNull();
  });

  it('원본을 되찾지 못한 예전 사본은 가린다', async () => {
    await prisma.freeSpeechRecord.create({
      data: {
        userId: SENIOR,
        chapterId: 'childhood',
        audioFileKey: 'audio/orphan.webm',
        transcriptText: '원본을 알 수 없는 옛 기록입니다.',
        recordedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    });

    const res = await asGuardian('/api/free-speech');

    // 동의를 확인할 수 없으면 보여주지 않는 쪽이 안전하다.
    expect(res.body.records[0].transcriptText).not.toContain('원본을 알 수 없는');
  });
});

describe('동의 저장', () => {
  it('PATCH로 5종을 각각 저장한다', async () => {
    const record = await createRecord();

    const res = await request(app)
      .patch(`/api/interview-records/${record.id}`)
      .set('x-user-id', SENIOR)
      .set('x-user-role', 'senior')
      .send({ publish: false, chatbot: false, familyRead: false, posthumous: false, sensitive: false });

    expect(res.status).toBe(200);
    const saved = await prisma.interviewRecord.findUnique({ where: { id: record.id } });
    expect(saved).toMatchObject({
      publish: false,
      chatbot: false,
      familyRead: false,
      posthumous: false,
      sensitive: false,
    });
  });

  it('기본값은 모두 허용이다', async () => {
    const record = await createRecord();
    expect(record).toMatchObject({
      publish: true,
      chatbot: true,
      familyRead: true,
      posthumous: true,
      sensitive: true,
    });
  });
});

describe('사진 동의', () => {
  async function createPhoto(overrides: Record<string, unknown> = {}) {
    return prisma.photo.create({
      data: {
        userId: SENIOR,
        fileKey: `photos/p-${Math.round(performance.now() * 1000)}.jpg`,
        fileName: 'family.jpg',
        mimeType: 'image/jpeg',
        ...overrides,
      },
    });
  }

  it('기본값은 모두 허용이다', async () => {
    const photo = await createPhoto();
    expect(photo).toMatchObject({ publish: true, familyRead: true, posthumous: true, sensitive: true });
  });

  it('출판을 철회하면 책에 들어가지 않는다', async () => {
    const kept = await createPhoto({ publish: true });
    await createPhoto({ publish: false });

    const input = await prepareLocalPublicationInput({ seniorId: SENIOR, format: 'A5' } as any);

    // 예전에는 모든 사진이 무조건 책에 들어갔다.
    expect(input.photos.map((photo: { id: string }) => photo.id)).toEqual([kept.id]);
  });

  it('민감정보를 철회하면 책에 들어가지 않는다', async () => {
    const kept = await createPhoto({ sensitive: true });
    await createPhoto({ sensitive: false });

    const input = await prepareLocalPublicationInput({ seniorId: SENIOR, format: 'A5' } as any);

    expect(input.photos.map((photo: { id: string }) => photo.id)).toEqual([kept.id]);
  });

  it('가족열람을 철회하면 보호자 목록에서 빠진다', async () => {
    const visible = await createPhoto({ familyRead: true });
    await createPhoto({ familyRead: false });

    const res = await asGuardian('/api/photos');

    expect(res.status).toBe(200);
    // 사진은 URL 하나만 남아도 그대로 보이므로 목록에서 아예 뺀다.
    expect(res.body.photos.map((photo: { id: string }) => photo.id)).toEqual([visible.id]);
  });

  it('부모님 본인은 철회한 사진도 계속 본다', async () => {
    await createPhoto({ familyRead: false });

    const res = await asSenior('/api/photos');

    expect(res.body.photos).toHaveLength(1);
  });

  it('사후공개를 철회하면 유산 전수 후에도 보호자에게 열리지 않는다', async () => {
    await createPhoto({ posthumous: false });
    await prisma.legacyVault.create({
      data: { seniorId: SENIOR, isVaultSetup: true, deathVerificationStatus: 'released' },
    });

    const res = await asGuardian('/api/photos');

    expect(res.body.photos).toHaveLength(0);
  });

  it('PATCH로 사진 동의를 저장한다', async () => {
    const photo = await createPhoto();

    const res = await request(app)
      .patch(`/api/photos/${photo.id}`)
      .set('x-user-id', SENIOR)
      .set('x-user-role', 'senior')
      .send({ publish: false, familyRead: false, posthumous: false, sensitive: false });

    expect(res.status).toBe(200);
    const saved = await prisma.photo.findUnique({ where: { id: photo.id } });
    expect(saved).toMatchObject({ publish: false, familyRead: false, posthumous: false, sensitive: false });
  });
});
