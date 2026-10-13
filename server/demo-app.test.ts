import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

let demo: Express;
let restricted: Express;
let root: string;

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'dearlog-demo-test-'));
  process.env.DATABASE_URL = `file:${path.join(root, 'demo.db')}`;
  process.env.ALLOW_DEV_AUTH_HEADERS = 'false';
  const { config } = await import('./config');
  config.dataDir = path.join(root, 'data');
  config.storageDir = path.join(root, 'storage');
  const { createDemoApp } = await import('./demo-app');
  const { createApp } = await import('./app');
  demo = await createDemoApp({ distDir: path.join(root, 'no-dist') });
  restricted = createApp({ sampleInquiryOnly: true });
});

afterAll(async () => {
  const { prisma } = await import('./db');
  await prisma.$disconnect();
  await fs.rm(root, { recursive: true, force: true });
});

describe('demo server', () => {
  it('starts a seeded fictional family session for either role', async () => {
    for (const [role, id] of [['parent', 'demo_senior'], ['child', 'demo_guardian']] as const) {
      const res = await request(demo).post('/api/demo/session').send({ role });
      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe(id);
      expect(res.body.authToken).toBeTruthy();
    }
    expect((await request(demo).post('/api/demo/session').send({ role: 'admin' })).status).toBe(400);
  });

  it('lets the demo guardian read the seeded records and write a new question', async () => {
    const { authToken } = (await request(demo).post('/api/demo/session').send({ role: 'child' })).body;
    const auth = { Authorization: `Bearer ${authToken}` };
    const records = await request(demo).get('/api/interview-records?seniorId=demo_senior').set(auth);
    expect(records.status).toBe(200);
    expect(records.body.records.length).toBeGreaterThanOrEqual(8);
    const write = await request(demo).post('/api/questions').set(auth)
      .send({ seniorId: 'demo_senior', text: '가장 좋아하는 계절은 언제인가요?', chapterId: 'hobbies' });
    expect(write.status).toBeLessThan(300);
  });

  it('seeds three fictional photos that the guardian can open', async () => {
    const { authToken } = (await request(demo).post('/api/demo/session').send({ role: 'child' })).body;
    const auth = { Authorization: `Bearer ${authToken}` };
    const { body } = await request(demo).get('/api/photos?seniorId=demo_senior').set(auth);
    expect(body.photos).toHaveLength(3);
    const file = await request(demo).get(`/api/files/${body.photos[0].fileKey ?? body.photos[0].url.replace(/^.*\/api\/files\//, '').split('?')[0]}`).set(auth);
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toContain('image/png');
  });

  it('answers bad input and missing files with 400/404 instead of a server error', async () => {
    const { authToken } = (await request(demo).post('/api/demo/session').send({ role: 'child' })).body;
    const auth = { Authorization: `Bearer ${authToken}` };
    const noChapter = await request(demo).post('/api/interview-records').set(auth)
      .send({ userId: 'demo_senior', transcriptText: '챕터 없이 보낸 답변' });
    expect(noChapter.status).toBe(400);
    const gone = await request(demo).get('/api/files/audio/demo-record-1.txt').set(auth);
    expect(gone.status).toBe(404);
  });

  it('does not loosen the restricted production app, and its tokens do not cross over', async () => {
    const { authToken } = (await request(demo).post('/api/demo/session').send({ role: 'child' })).body;
    const res = await request(restricted).post('/api/questions').set('Authorization', `Bearer ${authToken}`)
      .send({ seniorId: 'demo_senior', text: 'x', chapterId: 'hobbies' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('SAMPLE_INQUIRY_ONLY');
  });

  it('points to the demo build when no screen has been built yet', async () => {
    const res = await request(demo).get('/demo').set('Accept', 'text/html');
    expect(res.status).toBe(503);
    expect(res.text).toContain('demo:build');
  });
});

describe('demo safety guards', () => {
  it('refuses to start against a non-demo database path', async () => {
    const { config } = await import('./config');
    const saved = { url: process.env.DATABASE_URL, dir: config.dataDir };
    process.env.DATABASE_URL = 'file:../data/dearlog.db';
    config.dataDir = path.join(root, '..', 'server', 'data');
    const { createDemoApp } = await import('./demo-app');
    await expect(createDemoApp({ distDir: root })).rejects.toThrow('데모 전용');
    process.env.DATABASE_URL = saved.url;
    config.dataDir = saved.dir;
  });
});
