// @vitest-environment node
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

let app: Express;
let prisma: typeof import('./db').prisma;
let createApp: typeof import('./app').createApp;
let issueAuthToken: typeof import('./auth').issueAuthToken;
let lastTestSmsTo: typeof import('./sms').lastTestSmsTo;
let fixtureDir: string;
let storageRoot: string;
let guardianToken: string;
let seniorToken: string;
let strangerToken: string;
const SENIOR = 'restricted_fixture_senior';
const GUARDIAN = 'restricted_fixture_guardian';
const STRANGER = 'restricted_fixture_stranger';
const INVITE = 'synthetic-existing-invitation-token';
const fakeAudio = Buffer.from('synthetic fixture bytes; never uploaded to production');

// 기존 계정 로그인도 휴대폰 인증을 거친다. 인증은 메모리 상태라 DB 스냅샷에는 남지 않는다.
async function verifyLogin(phoneNumber: string) {
  expect((await request(app).post('/api/auth/otp/request').send({ phoneNumber, purpose: 'login' })).status).toBe(200);
  const code = /(\d{6})/.exec(lastTestSmsTo(phoneNumber) ?? '')?.[1];
  const verified = await request(app).post('/api/auth/otp/verify').send({ phoneNumber, purpose: 'login', code });
  expect(verified.status).toBe(200);
  return verified.body.verificationToken as string;
}

async function snapshot() {
  const tables = await prisma.$queryRawUnsafe<Array<{ name: string }>>("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  const rows: Record<string, unknown> = {};
  for (const { name } of tables) {
    rows[name] = await prisma.$queryRawUnsafe(`SELECT * FROM "${name.replaceAll('"', '""')}" ORDER BY rowid`);
  }
  const files: Record<string, string> = {};
  for (const kind of ['audio', 'photos', 'pdfs']) {
    for (const name of (await fs.readdir(path.join(storageRoot, kind))).sort()) {
      files[`${kind}/${name}`] = (await fs.readFile(path.join(storageRoot, kind, name))).toString('base64');
    }
  }
  return JSON.stringify({ rows, files }, (_, value) => typeof value === 'bigint' ? value.toString() : value);
}

beforeAll(async () => {
  fixtureDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dearlog-restricted-test-'));
  process.env.DATABASE_URL = `file:${path.join(fixtureDir, 'fixture.db')}`;
  process.env.ALLOW_DEV_AUTH_HEADERS = 'false';
  process.env.OPENAI_API_KEY = '';
  process.env.FACTCHAT_API_KEY = '';
  process.env.SMS_PROVIDER = 'test';
  const { config } = await import('./config');
  storageRoot = path.join(fixtureDir, 'storage');
  config.storageDir = storageRoot;
  config.dataDir = path.join(fixtureDir, 'data');
  ({ prisma } = await import('./db'));
  ({ lastTestSmsTo } = await import('./sms'));
  const { initLocalDatabase } = await import('./prisma/init');
  await initLocalDatabase();
  await prisma.user.createMany({ data: [
    { id: SENIOR, role: 'senior', name: '합성 부모', phoneNumber: '01000001001' },
    { id: GUARDIAN, role: 'guardian', name: '합성 가족', phoneNumber: '01000001002' },
    { id: STRANGER, role: 'guardian', name: '다른 합성 가족', phoneNumber: '01000001003' },
  ] });
  await prisma.guardianSeniorLink.create({ data: { guardianId: GUARDIAN, seniorId: SENIOR } });
  await prisma.chapter.upsert({ where: { id: 'childhood' }, update: {}, create: { id: 'childhood', order: 1, title: '합성 유년기', slug: 'synthetic-childhood' } });
  await fs.writeFile(path.join(storageRoot, 'audio/existing.webm'), fakeAudio);
  await fs.writeFile(path.join(storageRoot, 'photos/existing.png'), Buffer.from('synthetic photo bytes'));
  await prisma.interviewRecord.create({ data: { id: 'existing-record', userId: SENIOR, chapterId: 'childhood', audioFileKey: 'audio/existing.webm', transcriptText: '합성 기존 인터뷰 원문', aiSummary: '합성 기존 인터뷰 정리' } });
  await prisma.memory.create({ data: { id: 'existing-memory', userId: SENIOR, topic: '합성 기억', originalTranscript: '합성 원문', cleanedTranscript: '합성 정리', publishVersion: '합성 기록' } });
  await prisma.photo.create({ data: { id: 'existing-photo', userId: SENIOR, fileKey: 'photos/existing.png', fileName: 'existing.png', mimeType: 'image/png' } });
  await prisma.autobiographyDraft.create({ data: { userId: SENIOR, narrativesJson: '[{"chapterId":"childhood","content":"합성 기존 자서전"}]' } });
  await prisma.invitation.create({ data: { seniorId: SENIOR, guardianId: GUARDIAN, token: INVITE, expiresAt: new Date(Date.now() + 86400000) } });
  await prisma.publicationPreviewJob.create({ data: { id: 'existing-running-job', userId: SENIOR, requestedById: GUARDIAN, sourceHash: 'synthetic-source', status: 'running' } });
  await prisma.publicationPreviewJob.createMany({ data: [
    { id: 'existing-queued-job', userId: SENIOR, requestedById: GUARDIAN, sourceHash: 'synthetic-queued', status: 'queued' },
    { id: 'existing-retryable-job', userId: SENIOR, requestedById: GUARDIAN, sourceHash: 'synthetic-retry', status: 'failed', errorCode: 'status_500', attemptCount: 1 },
  ] });
  ({ issueAuthToken } = await import('./auth'));
  guardianToken = issueAuthToken({ id: GUARDIAN, role: 'guardian' });
  seniorToken = issueAuthToken({ id: SENIOR, role: 'senior' });
  strangerToken = issueAuthToken({ id: STRANGER, role: 'guardian' });
  ({ createApp } = await import('./app'));
  app = createApp(); // Default must match the restricted production startup.
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('External calls forbidden in restriction tests'))));
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await prisma?.$disconnect();
  if (fixtureDir) await fs.rm(fixtureDir, { recursive: true, force: true });
});

const blockedWrites: Array<[string, string]> = [
  ['post', '/api/invitations'], ['post', '/api/invitations/old/rotate'],
  ['post', '/api/auth/token-login'], ['patch', `/api/auth/users/${GUARDIAN}/role`], ['patch', `/api/auth/users/${GUARDIAN}/profile`],
  ['post', '/api/uploads/audio'], ['post', '/api/uploads/photos'], ['post', '/api/audio/transcriptions'], ['post', '/api/audio/speech'],
  ['post', '/api/ai/chat-completions'], ['post', '/api/ai/embeddings'],
  ['post', '/api/questions'], ['post', '/api/memories'], ['patch', '/api/memories/existing-memory'], ['delete', '/api/memories/existing-memory'],
  ['post', '/api/interview-records'], ['patch', '/api/interview-records/existing-record'], ['patch', '/api/interview-records/bulk-consent'],
  ['patch', '/api/photos/existing-photo'], ['delete', '/api/photos/existing-photo'],
  ['post', '/api/interview-sessions'], ['patch', '/api/interview-sessions/old/accept'], ['post', '/api/app-calls'],
  ['post', '/api/interview-schedules'], ['post', '/api/interview-schedules/old/call-now'],
  ['post', '/api/autobiography/draft'], ['delete', '/api/autobiography/draft'],
  ['post', '/api/cover-designs/generate'], ['post', '/api/publication-requests'], ['post', '/api/publication-preview-jobs'],
  ['post', '/api/legacy/vault'], ['post', '/api/legacy/trigger-death'], ['post', '/api/legacy/approve-death'],
  ['post', '/api/legacy/cancel-death'], ['post', '/api/legacy/reset'],
  ['post', '/api/calendar-events'], ['post', '/api/push-subscriptions'], ['delete', '/api/push-subscriptions'],
  ['patch', '/api/notifications/old/read'], ['post', '/api/nudges'], ['delete', '/api/invitations/old'],
  ['put', '/api/unknown-intake'], ['post', '/API/UPLOADS/AUDIO/'],
];

function expectRestricted(response: request.Response) {
  expect(response.status).toBe(403);
  expect(response.body.code).toBe('SAMPLE_INQUIRY_ONLY');
  expect(response.headers['cache-control']).toBe('no-store');
}

describe('sample and inquiry restriction', () => {
  it('publishes the actual default server mode without reopening intake', async () => {
    const res = await request(app).get('/api/service-status');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ mode: 'sample-inquiry', intakeOpen: false });
    await new Promise(resolve => setTimeout(resolve, 20));
    expect((await prisma.publicationPreviewJob.findUnique({ where: { id: 'existing-running-job' } }))?.status).toBe('running');
  });

  it('blocks all write categories, including authenticated clients, before any state change', async () => {
    const before = await snapshot();
    for (const [method, url] of blockedWrites) {
      const req = request(app)[method as 'post'](url).set('Authorization', `Bearer ${guardianToken}`);
      expectRestricted(await req.send({ token: INVITE, userId: SENIOR, transcriptText: 'blocked synthetic input' }));
    }
    expect(await snapshot()).toBe(before);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('blocks signup and legacy find-or-create before even reading a candidate account', async () => {
    const before = await snapshot();
    for (const isLogin of [undefined, false, 'true', 'false', 1, null]) {
      expectRestricted(await request(app).post('/api/auth/phone').send({ phoneNumber: '01000001999', name: '합성 신규', ...(isLogin === undefined ? {} : { isLogin }) }));
    }
    expectRestricted(await request(app).post('/api/auth/phone').send({ phoneNumber: '01000001002' }));
    expect(await snapshot()).toBe(before);
  });

  it('retains explicit existing login and its original name check without creating accounts', async () => {
    const before = await snapshot();
    const login = await request(app).post('/api/auth/phone').send({ phoneNumber: '01000001002', name: '합성 가족', isLogin: true, verificationToken: await verifyLogin('01000001002') });
    expect(login.status).toBe(200);
    expect(login.body.user.id).toBe(GUARDIAN);
    expect(login.body.isNew).toBe(false);
    expect(login.body.authToken).toBeTruthy();
    expect((await request(app).post('/api/auth/phone').send({ phoneNumber: '01000001002', name: '다른 이름', isLogin: true, verificationToken: await verifyLogin('01000001002') })).status).toBe(400);
    // 가입되지 않은 번호는 인증번호 단계에서 막힌다. 문자도 나가지 않고 계정도 만들어지지 않는다.
    expect((await request(app).post('/api/auth/otp/request').send({ phoneNumber: '01000001999', purpose: 'login' })).status).toBe(404);
    expect((await request(app).post('/api/auth/otp/request').send({ phoneNumber: '01000001999', purpose: 'signup' })).status).toBe(403);
    expect(await snapshot()).toBe(before);
  });

  it('rejects multipart before multer writes a file and preserves already issued invitations', async () => {
    const before = await snapshot();
    for (const [kind, field] of [['audio', 'audio'], ['photos', 'photo']]) {
      expectRestricted(await request(app).post(`/api/uploads/${kind}`).set('Authorization', `Bearer ${seniorToken}`).attach(field, Buffer.from('blocked synthetic bytes'), { filename: 'fictional.png', contentType: 'image/png' }));
    }
    expectRestricted(await request(app).post('/api/auth/token-login').send({ token: INVITE }));
    expect((await prisma.invitation.findUnique({ where: { token: INVITE } }))?.usedAt).toBeNull();
    expect(await snapshot()).toBe(before);
  });

  it('blocks GET preview generation, HEAD variants and audit pruning without touching rows', async () => {
    const before = await snapshot();
    for (const url of ['/api/publication-preview?forceRefresh=true', '/api/ai/audit-summary', '/API/PUBLICATION-PREVIEW/']) {
      expectRestricted(await request(app).get(url).set('Authorization', `Bearer ${guardianToken}`));
      expect((await request(app).head(url)).status).toBe(403);
    }
    expect(await snapshot()).toBe(before);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps existing record, photo, draft, file and job reads available to their authorized family', async () => {
    const before = await snapshot();
    for (const url of ['/api/family-members', '/api/interview-records', '/api/memories', '/api/photos', '/api/autobiography/draft', '/api/publication-preview-jobs/existing-running-job']) {
      const res = await request(app).get(url).set('Authorization', `Bearer ${guardianToken}`);
      expect(res.status, url).toBe(200);
    }
    const records = await request(app).get('/api/interview-records').set('Authorization', `Bearer ${seniorToken}`);
    expect(records.body.records[0].transcriptText).toBe('합성 기존 인터뷰 원문');
    const audio = await request(app).get('/api/files/audio/existing.webm').set('Authorization', `Bearer ${seniorToken}`);
    expect(audio.status).toBe(200);
    expect(audio.body).toEqual(fakeAudio);
    expect(await snapshot()).toBe(before);
  });

  it('reads queued and failed preview jobs without resuming or retrying AI work', async () => {
    const before = await snapshot();
    for (const [id, status] of [['existing-queued-job', 'queued'], ['existing-retryable-job', 'failed']]) {
      const res = await request(app).get(`/api/publication-preview-jobs/${id}`).set('Authorization', `Bearer ${guardianToken}`);
      expect(res.status).toBe(200);
      expect(res.body.job.status).toBe(status);
    }
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(await snapshot()).toBe(before);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('allows the existing own-account fallback read without creating a self-family link', async () => {
    const before = await snapshot();
    const res = await request(app).get('/api/memories').set('Authorization', `Bearer ${strangerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.memories).toEqual([]);
    expect(await snapshot()).toBe(before);
    expect(await prisma.guardianSeniorLink.findFirst({ where: { guardianId: STRANGER } })).toBeNull();
  });

  it('continues denying unauthenticated, spoofed-header and unrelated-family reads', async () => {
    for (const url of ['/api/interview-records', '/api/memories', '/api/photos', '/api/autobiography/draft', '/api/files/audio/existing.webm']) {
      expect((await request(app).get(url)).status, url).toBe(403);
      expect((await request(app).get(url).set('x-user-id', SENIOR).set('x-user-role', 'senior')).status, url).toBe(403);
      expect((await request(app).get(`${url}?seniorId=${SENIOR}`).set('Authorization', `Bearer ${strangerToken}`)).status, url).toBe(403);
    }
  });
});
