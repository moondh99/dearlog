// @vitest-environment node
import os from 'node:os';
import path from 'node:path';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

// 2026-07-31 감사에서 확인된 인증/소유권 결함들의 회귀 테스트다.
// 각 테스트는 수정 전 코드에서 실패해야 한다.

let prisma: typeof import('./db').prisma;
let initLocalDatabase: typeof import('./prisma/init').initLocalDatabase;
let createApp: typeof import('./app').createApp;
let app: any;

const OTHER_FAMILY_SENIOR = 'boundary_other_senior';
const LONELY_GUARDIAN = 'boundary_lonely_guardian';

beforeAll(async () => {
  process.env.DATABASE_URL = `file:${path.join(os.tmpdir(), `dearlog-auth-boundary-${Date.now()}.db`)}`;
  process.env.FACTCHAT_API_KEY = '';
  process.env.OPENAI_API_KEY = '';
  process.env.TWILIO_ACCOUNT_SID = '';
  process.env.TWILIO_AUTH_TOKEN = '';

  ({ prisma } = await import('./db'));
  ({ initLocalDatabase } = await import('./prisma/init'));
  ({ createApp } = await import('./app'));
  await initLocalDatabase();
  app = createApp();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  process.env.ALLOW_DEV_AUTH_HEADERS = 'true';
  await prisma.guardianSeniorLink.deleteMany({});
  await prisma.pushSubscription.deleteMany({});

  // 다른 가족의 부모님. 연결이 없는 보호자보다 나중에 만들어 "가장 최근 시니어"가 되게 한다.
  await prisma.user.upsert({
    where: { id: LONELY_GUARDIAN },
    update: {},
    create: { id: LONELY_GUARDIAN, role: 'guardian', name: '연결없는보호자', phoneNumber: '01000000001' },
  });
  await prisma.user.upsert({
    where: { id: OTHER_FAMILY_SENIOR },
    update: { createdAt: new Date() },
    create: { id: OTHER_FAMILY_SENIOR, role: 'senior', name: '남의집부모님', phoneNumber: '01000000002' },
  });
});

describe('보호자-부모 연결 경계', () => {
  it('연결이 없는 보호자를 DB의 최근 시니어에 자동 연결하지 않는다', async () => {
    // 남의 집 부모님에게 기억을 하나 심어 둔다. 유출되면 이 기억이 보인다.
    await prisma.memory.create({
      data: {
        userId: OTHER_FAMILY_SENIOR,
        topic: '남의 가족 비밀',
        originalTranscript: '유출되면 안 되는 이야기',
        cleanedTranscript: '유출되면 안 되는 이야기',
        publishVersion: '유출되면 안 되는 이야기',
      },
    });

    const res = await request(app)
      .get('/api/memories')
      .set('x-user-id', LONELY_GUARDIAN)
      .set('x-user-role', 'guardian');

    // 자기 자신에게만 연결되므로 응답은 성공하되 비어 있어야 한다.
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('남의 가족 비밀');
    expect(body).not.toContain('유출되면 안 되는 이야기');

    const leakedLink = await prisma.guardianSeniorLink.findFirst({
      where: { guardianId: LONELY_GUARDIAN, seniorId: OTHER_FAMILY_SENIOR },
    });
    expect(leakedLink).toBeNull();
  });

  it('자동 연결이 남의 가족 초대 토큰 발급으로 이어지지 않는다', async () => {
    await request(app)
      .get('/api/progress')
      .set('x-user-id', LONELY_GUARDIAN)
      .set('x-user-role', 'guardian');

    const invitations = await prisma.invitation.findMany({ where: { seniorId: OTHER_FAMILY_SENIOR } });
    expect(invitations).toHaveLength(0);
  });
});

describe('개발용 헤더 우회', () => {
  it('쿼리스트링 userId로는 인증되지 않는다', async () => {
    // <img src="/api/...?userId=피해자"> 만으로 남의 계정이 되던 경로다.
    const res = await request(app).get(`/api/memories?userId=${OTHER_FAMILY_SENIOR}`);
    expect(res.status).toBe(403);
  });

  it('ALLOW_DEV_AUTH_HEADERS가 꺼져 있으면 x-user-* 헤더를 무시한다', async () => {
    process.env.ALLOW_DEV_AUTH_HEADERS = 'false';
    const res = await request(app)
      .get('/api/memories')
      .set('x-user-id', OTHER_FAMILY_SENIOR)
      .set('x-user-role', 'senior');
    expect(res.status).toBe(403);
  });
});

describe('푸시 구독 소유권', () => {
  it('인증 없이 구독을 만들 수 없다', async () => {
    const res = await request(app)
      .post('/api/push-subscriptions')
      .send({ userId: OTHER_FAMILY_SENIOR, endpoint: 'https://attacker.example/ep1', keys: { p256dh: 'a', auth: 'b' } });

    expect(res.status).toBe(403);
    expect(await prisma.pushSubscription.count({ where: { endpoint: 'https://attacker.example/ep1' } })).toBe(0);
  });

  it('body의 userId를 무시하고 인증된 사용자를 소유자로 저장한다', async () => {
    const res = await request(app)
      .post('/api/push-subscriptions')
      .set('x-user-id', LONELY_GUARDIAN)
      .set('x-user-role', 'guardian')
      .send({ userId: OTHER_FAMILY_SENIOR, endpoint: 'https://attacker.example/ep2', keys: { p256dh: 'a', auth: 'b' } });

    expect(res.status).toBe(201);
    const saved = await prisma.pushSubscription.findUnique({ where: { endpoint: 'https://attacker.example/ep2' } });
    expect(saved?.userId).toBe(LONELY_GUARDIAN);
  });
});

describe('음성 파일 받아쓰기 소유권', () => {
  it('업로드 토큰도 소유권도 없으면 남의 fileKey를 변환하지 않는다', async () => {
    const res = await request(app)
      .post('/api/audio/transcriptions')
      .set('x-user-id', LONELY_GUARDIAN)
      .set('x-user-role', 'guardian')
      .send({ fileKey: 'audio/1700000000000_abcdefgh.webm' });

    // OpenAI 호출까지 가면 안 된다. 소유권 확인에서 먼저 막혀야 한다.
    expect([403, 404]).toContain(res.status);
  });
});

describe('사진 업로드 MIME 검증', () => {
  it('SVG는 이미지여도 거절한다', async () => {
    const res = await request(app)
      .post('/api/uploads/photos')
      .set('x-user-id', OTHER_FAMILY_SENIOR)
      .set('x-user-role', 'senior')
      .attach('photo', Buffer.from('<svg onload="alert(1)"></svg>'), {
        filename: 'payload.svg',
        contentType: 'image/svg+xml',
      });

    expect(res.status).not.toBe(201);
  });

  it('확장자는 originalname이 아니라 MIME에서 정한다', async () => {
    const { photoExtensionForMimeType } = await import('./storage');
    // payload.html 을 image/jpeg 로 올려도 .html 로 저장되면 안 된다.
    expect(photoExtensionForMimeType('image/jpeg')).toBe('.jpg');
    expect(photoExtensionForMimeType('text/html')).toBe('.jpg');
  });
});
