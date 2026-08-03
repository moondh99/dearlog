// @vitest-environment node
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { FIXED_CHAPTERS, MIN_ANSWERS_PER_CHAPTER } from './domain/constants';

// 출판 파이프라인이 실패를 실패로 끝내는지 확인한다.
// 예전에는 PDF 생성이 터져도 publicationRequest 가 generating 으로 남아 영원히 진행 중처럼 보였고,
// 미리보기 job 은 복구 가능 오류로 분류되기만 하면 재시도 상한이 걸리지 않아 무한히 재시도했다.

// 이 파일은 실패 경로만 본다. 어쩌다 렌더까지 가더라도 Chrome 을 띄우지 않도록 막아 둔다.
vi.mock('./publication-html', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./publication-html')>();
  return {
    ...actual,
    renderHtmlToPdf: async () => {
      throw new Error('Chrome 렌더링에 실패했습니다.');
    },
  };
});

let prisma: typeof import('./db').prisma;
let initLocalDatabase: typeof import('./prisma/init').initLocalDatabase;
let startLocalPublicationPreviewJob: typeof import('./publication').startLocalPublicationPreviewJob;
let getLocalPublicationPreviewJob: typeof import('./publication').getLocalPublicationPreviewJob;
let createApp: typeof import('./app').createApp;
let app: any;

const SENIOR = 'failstate_senior';
const GUARDIAN = 'failstate_guardian';
const TRANSCRIPT = '1982년 서울 집에서 어머니와 가족이 함께 밥을 먹던 날이 따뜻하게 기억납니다. 그날 고마운 마음이 오래 남았습니다.';

// 상한이 없으면 여기서 멈추지 않는다. 무한 루프를 기다리지 않도록 폴링에 마감을 둔다.
async function waitForJobStatus(jobId: string, status: string, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const job = await prisma.publicationPreviewJob.findUnique({ where: { id: jobId } });
    if (job?.status === status) return job;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  const latest = await prisma.publicationPreviewJob.findUnique({ where: { id: jobId } });
  throw new Error(`미리보기 job ${jobId} 이 ${status} 에 도달하지 못했습니다: ${JSON.stringify(latest)}`);
}

beforeAll(async () => {
  process.env.DATABASE_URL = `file:${path.join(os.tmpdir(), `dearlog-failstate-${Date.now()}.db`)}`;
  process.env.FACTCHAT_API_KEY = '';
  process.env.OPENAI_API_KEY = '';

  ({ prisma } = await import('./db'));
  ({ initLocalDatabase } = await import('./prisma/init'));
  ({ startLocalPublicationPreviewJob, getLocalPublicationPreviewJob } = await import('./publication'));
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
  await prisma.publicationRequest.deleteMany({});
  await prisma.publicationPreviewJob.deleteMany({});
  await prisma.publicationDraftCache.deleteMany({});
  await prisma.interviewRecord.deleteMany({});
  await prisma.guardianSeniorLink.deleteMany({});

  await prisma.user.upsert({
    where: { id: SENIOR },
    update: {},
    create: { id: SENIOR, role: 'senior', name: '부모님', phoneNumber: '01066660001' },
  });
  await prisma.user.upsert({
    where: { id: GUARDIAN },
    update: {},
    create: { id: GUARDIAN, role: 'guardian', name: '자녀', phoneNumber: '01066660002' },
  });
  await prisma.guardianSeniorLink.create({ data: { guardianId: GUARDIAN, seniorId: SENIOR } });
  await prisma.interviewRecord.create({
    data: {
      userId: SENIOR,
      chapterId: 'childhood',
      audioFileKey: `audio/failstate-${Date.now()}.webm`,
      transcriptText: TRANSCRIPT,
      recordedAt: new Date('2026-06-07T00:00:00.000Z'),
    },
  });
});

describe('출판 요청 실패 상태', () => {
  it('PDF 생성이 실패하면 generating 이 아니라 failed 로 끝난다', async () => {
    // 키가 없으면 generateLocalPrintPdf 가 던진다. 어느 단계에서 던지든 요청은 실패로 끝나야 한다.
    const res = await request(app)
      .post('/api/publication-requests')
      .set('x-user-id', SENIOR)
      .set('x-user-role', 'senior')
      .send({ format: 'A5' });

    // 클라이언트는 여전히 에러 응답을 받아야 한다.
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.error).toBeTruthy();

    const rows = await prisma.publicationRequest.findMany({ where: { userId: SENIOR } });
    expect(rows).toHaveLength(1);
    // generating 으로 남으면 UI 가 진행 중과 실패를 구분하지 못하고 사용자는 무한정 기다린다.
    expect(rows[0].status).toBe('failed');
    expect(rows[0].pdfFileKey).toBeNull();
  });
});

describe('미리보기 job 재시도 상한', () => {
  it('복구 가능 오류가 계속 반복돼도 유한한 시도 안에 failed 로 끝난다', async () => {
    let providerCallCount = 0;
    // 항상 빈 응답을 돌려주면 empty_content 로 끝나고, 이 코드는 복구 가능으로 분류된다.
    const server = http.createServer((req, res) => {
      req.on('data', () => {});
      req.on('end', () => {
        providerCallCount += 1;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          id: 'chatcmpl-empty',
          object: 'chat.completion',
          created: 0,
          model: 'gpt-4o-mini',
          choices: [{ index: 0, message: { role: 'assistant', content: '' }, finish_reason: 'stop' }],
        }));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as { port: number };

    process.env.ALLOW_OPENAI_IN_TESTS = 'true';
    process.env.FACTCHAT_API_KEY = 'test-key';
    process.env.FACTCHAT_BASE_URL = `http://127.0.0.1:${address.port}`;
    process.env.FACTCHAT_WRITING_MODEL = 'gpt-4o-mini';
    // 지연이 0이면 재시도가 한 호출 스택 안에서 도는 무한 루프가 되어 테스트가 영영 끝나지 않는다.
    process.env.PUBLICATION_PREVIEW_RETRY_DELAY_MS = '5';

    let jobId = '';
    try {
      const started = await startLocalPublicationPreviewJob({
        seniorId: SENIOR,
        requestedById: GUARDIAN,
        format: 'A5',
        usageContext: { userId: GUARDIAN, role: 'guardian' },
      });
      jobId = started.id;

      const failed = await waitForJobStatus(jobId, 'failed');
      expect(failed.stage).toBe('done');
      expect(failed.errorCode).toBe('empty_content');
      expect(failed.errorMessage).toBeTruthy();
      // 복구 가능 오류에도 상한이 걸려야 한다. 걸리지 않으면 시도 횟수가 계속 늘어난다.
      expect(failed.attemptCount).toBeLessThanOrEqual(6);
      expect(failed.attemptCount).toBeGreaterThan(2);

      // 조회 진입점이 죽은 job 을 되살리면 상한이 사실상 없어진다.
      const callsAfterFailure = providerCallCount;
      const polled = await getLocalPublicationPreviewJob(jobId);
      expect(polled?.status).toBe('failed');
      await new Promise((resolve) => setTimeout(resolve, 150));
      const stillFailed = await prisma.publicationPreviewJob.findUnique({ where: { id: jobId } });
      expect(stillFailed?.status).toBe('failed');
      expect(providerCallCount).toBe(callsAfterFailure);
    } finally {
      // 수정 전이라면 재시도 루프가 아직 돌고 있다. failed 로 못박아 멈춘 뒤 정리한다.
      if (jobId) {
        await prisma.publicationPreviewJob
          .update({ where: { id: jobId }, data: { status: 'failed', finishedAt: new Date() } })
          .catch(() => undefined);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      delete process.env.ALLOW_OPENAI_IN_TESTS;
      delete process.env.PUBLICATION_PREVIEW_RETRY_DELAY_MS;
      process.env.FACTCHAT_API_KEY = '';
      process.env.FACTCHAT_BASE_URL = 'https://factchat-cloud.mindlogic.ai/v1/gateway';
      process.env.FACTCHAT_WRITING_MODEL = '';
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
