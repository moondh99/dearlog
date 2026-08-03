// @vitest-environment node
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { FIXED_CHAPTERS, MIN_ANSWERS_PER_CHAPTER } from './domain/constants';

// 철회의 소급 적용을 확인한다.
// 예전에는 동의를 철회해도 이미 만들어진 PDF가 pdfFileKey 로 계속 열렸다. 소유권만 확인하고
// 동의는 전혀 보지 않았기 때문이다. 그래서 철회는 "앞으로 만들 책"에만 적용됐다.

let prisma: typeof import('./db').prisma;
let initLocalDatabase: typeof import('./prisma/init').initLocalDatabase;
let prepareLocalPublicationInput: typeof import('./publication').prepareLocalPublicationInput;
let storageDir: typeof import('./storage').storageDir;
let createApp: typeof import('./app').createApp;
let app: any;

const SENIOR = 'revocation_senior';
const GUARDIAN = 'revocation_guardian';
// 실제 출판은 몇 초가 걸리므로 책은 항상 철회보다 앞선 시각에 만들어진다.
const BEFORE_REVOCATION = () => new Date(Date.now() - 60_000);

async function createRecord(overrides: Record<string, unknown> = {}) {
  return prisma.interviewRecord.create({
    data: {
      userId: SENIOR,
      chapterId: 'childhood',
      audioFileKey: `audio/revocation-${Math.round(performance.now() * 1000)}.webm`,
      transcriptText: '아이들과 강가에서 물장구치던 여름이 생생합니다.',
      recordedAt: new Date('2026-06-01T00:00:00.000Z'),
      ...overrides,
    },
  });
}

async function createPhoto(overrides: Record<string, unknown> = {}) {
  return prisma.photo.create({
    data: {
      userId: SENIOR,
      fileKey: `photos/revocation-${Math.round(performance.now() * 1000)}.jpg`,
      fileName: 'family.jpg',
      mimeType: 'image/jpeg',
      ...overrides,
    },
  });
}

// 만들어진 책 한 권. PDF 렌더링은 이 게이트와 무관하므로 산출물만 그대로 재현한다.
async function publishBook(createdAt: Date) {
  const fileName = `revocation-${createdAt.getTime()}-${Math.round(performance.now() * 1000)}.pdf`;
  await fs.writeFile(path.join(storageDir('pdfs'), fileName), Buffer.from('%PDF-1.4\nbook'));
  const publication = await prisma.publicationRequest.create({
    data: {
      userId: SENIOR,
      requestedById: GUARDIAN,
      status: 'ready',
      pdfFileKey: `pdfs/${fileName}`,
      createdAt,
    },
  });
  return publication.pdfFileKey!;
}

async function revokePublish(recordId: string) {
  const res = await request(app)
    .patch(`/api/interview-records/${recordId}`)
    .set('x-user-id', SENIOR)
    .set('x-user-role', 'senior')
    .send({ publish: false });
  expect(res.status).toBe(200);
  const saved = await prisma.interviewRecord.findUnique({ where: { id: recordId } });
  return saved!.consentUpdatedAt!;
}

function downloadAsGuardian(fileKey: string) {
  return request(app).get(`/api/files/${fileKey}`).set('x-user-id', GUARDIAN).set('x-user-role', 'guardian');
}

function downloadAsSenior(fileKey: string) {
  return request(app).get(`/api/files/${fileKey}`).set('x-user-id', SENIOR).set('x-user-role', 'senior');
}

beforeAll(async () => {
  process.env.DATABASE_URL = `file:${path.join(os.tmpdir(), `dearlog-revocation-${Date.now()}.db`)}`;
  process.env.FACTCHAT_API_KEY = '';
  process.env.OPENAI_API_KEY = '';

  ({ prisma } = await import('./db'));
  ({ initLocalDatabase } = await import('./prisma/init'));
  ({ prepareLocalPublicationInput } = await import('./publication'));
  ({ storageDir } = await import('./storage'));
  ({ createApp } = await import('./app'));
  await initLocalDatabase();
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
  await prisma.publicationPreviewJob.deleteMany({});
  await prisma.publicationRequest.deleteMany({});
  await prisma.interviewRecord.deleteMany({});
  await prisma.photo.deleteMany({});
  await prisma.guardianSeniorLink.deleteMany({});

  await prisma.user.upsert({
    where: { id: SENIOR },
    // 삭제 표시는 시니어 단위로 계속 남으므로 테스트마다 되돌려 준다.
    update: { publicationContentDeletedAt: null },
    create: { id: SENIOR, role: 'senior', name: '부모님', phoneNumber: '01055560001' },
  });
  await prisma.user.upsert({
    where: { id: GUARDIAN },
    update: {},
    create: { id: GUARDIAN, role: 'guardian', name: '자녀', phoneNumber: '01055560002' },
  });
  await prisma.guardianSeniorLink.create({ data: { guardianId: GUARDIAN, seniorId: SENIOR } });
});

describe('이미 만들어진 PDF', () => {
  it('책을 만든 뒤 출판을 철회하면 가족이 더 이상 내려받지 못한다', async () => {
    const record = await createRecord();
    const fileKey = await publishBook(BEFORE_REVOCATION());
    expect((await downloadAsGuardian(fileKey)).status).toBe(200);

    await revokePublish(record.id);

    const res = await downloadAsGuardian(fileKey);
    // 404 로 막으면 "왜 안 되지"로 끝난다. 다시 만들면 된다는 것을 알 수 있어야 한다.
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('다시 만들어');
  });

  it('철회 후 다시 만든 책은 철회분이 빠지고 내려받을 수 있다', async () => {
    const kept = await createRecord({ transcriptText: '남는 이야기입니다.' });
    const revoked = await createRecord();
    const staleKey = await publishBook(BEFORE_REVOCATION());

    const revokedAt = await revokePublish(revoked.id);
    expect((await downloadAsGuardian(staleKey)).status).toBe(409);

    const input = await prepareLocalPublicationInput({ seniorId: SENIOR, format: 'A5' } as any);
    expect(input.records.map((row: { id: string }) => row.id)).toEqual([kept.id]);

    const freshKey = await publishBook(new Date(revokedAt.getTime() + 1000));
    expect((await downloadAsGuardian(freshKey)).status).toBe(200);
    // 새 책이 나온 뒤에도 철회 전 책은 계속 막혀 있어야 한다.
    expect((await downloadAsGuardian(staleKey)).status).toBe(409);
  });

  it('사진 출판을 철회해도 이미 만든 책을 막는다', async () => {
    const photo = await createPhoto();
    const fileKey = await publishBook(BEFORE_REVOCATION());

    const res = await request(app)
      .patch(`/api/photos/${photo.id}`)
      .set('x-user-id', SENIOR)
      .set('x-user-role', 'senior')
      .send({ publish: false });
    expect(res.status).toBe(200);

    expect((await downloadAsGuardian(fileKey)).status).toBe(409);
  });

  it('부모님 본인은 철회 전에 만든 책도 계속 볼 수 있다', async () => {
    const record = await createRecord();
    const fileKey = await publishBook(BEFORE_REVOCATION());
    await revokePublish(record.id);

    // 자기 이야기를 자기가 못 보게 막을 이유가 없다. 기존 동의 집행도 본인 조회는 열어 두었다.
    expect((await downloadAsSenior(fileKey)).status).toBe(200);
  });

  it('동의와 무관한 본문 수정은 막지 않는다', async () => {
    const record = await createRecord();
    const fileKey = await publishBook(BEFORE_REVOCATION());

    const res = await request(app)
      .patch(`/api/interview-records/${record.id}`)
      .set('x-user-id', SENIOR)
      .set('x-user-role', 'senior')
      .send({ transcriptText: '고쳐 쓴 이야기입니다.' });
    expect(res.status).toBe(200);

    // updatedAt 을 기준으로 삼았다면 여기서 멀쩡한 책이 막혔을 것이다.
    expect((await downloadAsGuardian(fileKey)).status).toBe(200);
  });

  it('허용으로 되돌린 동의는 막지 않는다', async () => {
    const record = await createRecord({ publish: false });
    const fileKey = await publishBook(BEFORE_REVOCATION());

    const res = await request(app)
      .patch(`/api/interview-records/${record.id}`)
      .set('x-user-id', SENIOR)
      .set('x-user-role', 'senior')
      .send({ publish: true });
    expect(res.status).toBe(200);

    expect((await downloadAsGuardian(fileKey)).status).toBe(200);
  });

  it('책에 들어가지 않는 목적만 바꾼 것은 막지 않는다', async () => {
    // 이미 출판을 철회해 둔 기록이라 책에 애초에 들어가지 않았다. 그 기록의 다른 토글을
    // 건드린 것만으로 멀쩡한 책이 막히면 안 된다.
    const record = await createRecord({ publish: false });
    const fileKey = await publishBook(BEFORE_REVOCATION());

    const res = await request(app)
      .patch(`/api/interview-records/${record.id}`)
      .set('x-user-id', SENIOR)
      .set('x-user-role', 'senior')
      .send({ familyRead: false, chatbot: false, posthumous: false });
    expect(res.status).toBe(200);

    expect((await downloadAsGuardian(fileKey)).status).toBe(200);
  });
});

describe('기록·사진 삭제', () => {
  // 삭제는 철회보다 강한 의사 표시다. 그런데 지운 행에는 consentUpdatedAt 이 남지 않아
  // 예전에는 철회는 막히고 삭제는 그대로 열리는 앞뒤가 안 맞는 상태였다.
  function deletePhotoAsSenior(photoId: string) {
    return request(app).delete(`/api/photos/${photoId}`).set('x-user-id', SENIOR).set('x-user-role', 'senior');
  }

  it('책을 만든 뒤 사진을 지우면 가족이 더 이상 내려받지 못한다', async () => {
    const photo = await createPhoto();
    const fileKey = await publishBook(BEFORE_REVOCATION());
    expect((await downloadAsGuardian(fileKey)).status).toBe(200);

    expect((await deletePhotoAsSenior(photo.id)).status).toBe(200);

    const res = await downloadAsGuardian(fileKey);
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('다시 만들어');
  });

  it('책에 애초에 들어가지 않던 사진을 지운 것은 막지 않는다', async () => {
    // 출판을 이미 철회해 둔 사진이라 책에 들어가지 않았다. 지워도 책 내용은 그대로다.
    const photo = await createPhoto({ publish: false });
    const fileKey = await publishBook(BEFORE_REVOCATION());

    expect((await deletePhotoAsSenior(photo.id)).status).toBe(200);

    expect((await downloadAsGuardian(fileKey)).status).toBe(200);
  });

  it('삭제 뒤에 다시 만든 책은 내려받을 수 있다', async () => {
    const photo = await createPhoto();
    const staleKey = await publishBook(BEFORE_REVOCATION());
    expect((await deletePhotoAsSenior(photo.id)).status).toBe(200);
    expect((await downloadAsGuardian(staleKey)).status).toBe(409);

    // 한 번 지웠다고 앞으로 만들 책까지 영영 막히면 안 된다.
    const freshKey = await publishBook(new Date(Date.now() + 1000));
    expect((await downloadAsGuardian(freshKey)).status).toBe(200);
    expect((await downloadAsGuardian(staleKey)).status).toBe(409);
  });
});

describe('미리보기 초안', () => {
  it('철회 전에 만든 미리보기 job 도 같은 게이트를 지난다', async () => {
    const record = await createRecord();
    const job = await prisma.publicationPreviewJob.create({
      data: {
        userId: SENIOR,
        requestedById: GUARDIAN,
        format: 'A5',
        sourceHash: 'stale-source-hash',
        status: 'ready',
        stage: 'done',
        createdAt: BEFORE_REVOCATION(),
      },
    });

    await revokePublish(record.id);

    const res = await request(app)
      .get(`/api/publication-preview-jobs/${job.id}`)
      .set('x-user-id', GUARDIAN)
      .set('x-user-role', 'guardian');

    // 초안 HTML 은 PDF 와 같은 본문을 담고 있다. PDF 만 막으면 여기로 그대로 새어 나간다.
    expect(res.status).toBe(409);
  });
});
