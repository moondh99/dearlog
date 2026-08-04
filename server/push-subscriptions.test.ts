// @vitest-environment node
import os from 'node:os';
import path from 'node:path';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

// 구독 행의 주인을 확인한다.
// 예전에는 upsert 의 update 에 userId 가 없어서, 한 기기를 두 사람이 번갈아 쓰면
// endpoint 가 같아 나중에 등록한 사람이 아니라 처음 등록한 사람의 알림이 계속 갔다.
// 해지 경로도 아예 없어서 브라우저 구독을 끊어도 서버에는 죽은 행이 남았다.

let prisma: typeof import('./db').prisma;
let initLocalDatabase: typeof import('./prisma/init').initLocalDatabase;
let createApp: typeof import('./app').createApp;
let app: any;

const SENIOR = 'push_senior';
const GUARDIAN = 'push_guardian';
const ENDPOINT = 'https://push.example.test/subscriptions/shared-device';

function subscribeAs(userId: string, role: 'senior' | 'guardian', endpoint = ENDPOINT) {
  return request(app)
    .post('/api/push-subscriptions')
    .set('x-user-id', userId)
    .set('x-user-role', role)
    .send({ endpoint, keys: { p256dh: `p256dh_${userId}`, auth: `auth_${userId}` } });
}

function unsubscribeAs(userId: string, role: 'senior' | 'guardian', endpoint = ENDPOINT) {
  return request(app)
    .delete('/api/push-subscriptions')
    .set('x-user-id', userId)
    .set('x-user-role', role)
    .send({ endpoint });
}

beforeAll(async () => {
  process.env.DATABASE_URL = `file:${path.join(os.tmpdir(), `dearlog-push-${Date.now()}.db`)}`;
  process.env.FACTCHAT_API_KEY = '';
  process.env.OPENAI_API_KEY = '';

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
  await prisma.pushSubscription.deleteMany({});
  await prisma.user.upsert({
    where: { id: SENIOR },
    update: {},
    create: { id: SENIOR, role: 'senior', name: '부모님', phoneNumber: '01055570001' },
  });
  await prisma.user.upsert({
    where: { id: GUARDIAN },
    update: {},
    create: { id: GUARDIAN, role: 'guardian', name: '자녀', phoneNumber: '01055570002' },
  });
});

describe('push subscriptions', () => {
  it('moves an existing endpoint to whoever registers it last', async () => {
    expect((await subscribeAs(SENIOR, 'senior')).status).toBe(201);
    expect((await subscribeAs(GUARDIAN, 'guardian')).status).toBe(201);

    const rows = await prisma.pushSubscription.findMany({ where: { endpoint: ENDPOINT } });
    expect(rows).toHaveLength(1);
    // 지금 이 기기를 쓰는 사람은 보호자다. 부모님 알림이 여기로 오면 안 된다.
    expect(rows[0].userId).toBe(GUARDIAN);
    expect(rows[0].p256dh).toBe(`p256dh_${GUARDIAN}`);
  });

  it('ignores the userId in the request body', async () => {
    await request(app)
      .post('/api/push-subscriptions')
      .set('x-user-id', GUARDIAN)
      .set('x-user-role', 'guardian')
      .send({ endpoint: ENDPOINT, keys: { p256dh: 'p', auth: 'a' }, userId: SENIOR })
      .expect(201);

    const row = await prisma.pushSubscription.findUnique({ where: { endpoint: ENDPOINT } });
    expect(row!.userId).toBe(GUARDIAN);
  });

  it('deletes the row when the device turns push off', async () => {
    await subscribeAs(GUARDIAN, 'guardian');

    const res = await unsubscribeAs(GUARDIAN, 'guardian');
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(1);
    expect(await prisma.pushSubscription.count({ where: { endpoint: ENDPOINT } })).toBe(0);
  });

  it('does not let one user delete another user subscription', async () => {
    await subscribeAs(GUARDIAN, 'guardian');

    const res = await unsubscribeAs(SENIOR, 'senior');
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(0);
    expect(await prisma.pushSubscription.count({ where: { endpoint: ENDPOINT } })).toBe(1);
  });

  it('rejects an unsubscribe without an endpoint', async () => {
    const res = await request(app)
      .delete('/api/push-subscriptions')
      .set('x-user-id', GUARDIAN)
      .set('x-user-role', 'guardian')
      .send({});
    expect(res.status).toBe(400);
  });
});
