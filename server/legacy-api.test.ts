// @vitest-environment node
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { COMMON_QUESTIONS, FIXED_CHAPTERS, MIN_ANSWERS_PER_CHAPTER } from './domain/constants';

let prisma: typeof import('./db').prisma;
let initLocalDatabase: typeof import('./prisma/init').initLocalDatabase;
let storageDir: typeof import('./storage').storageDir;
let resetAIClientsForTests: typeof import('./ai-clients').resetAIClientsForTests;
let createApp: typeof import('./app').createApp;
let app: any;

beforeAll(async () => {
  process.env.DATABASE_URL = `file:${path.join(os.tmpdir(), `dearlog-legacy-${Date.now()}.db`)}`;
  process.env.FACTCHAT_API_KEY = '';
  process.env.FACTCHAT_BASE_URL = 'https://factchat-cloud.mindlogic.ai/v1/gateway';
  process.env.FACTCHAT_CHAT_MODEL = 'gpt-5-mini';
  process.env.FACTCHAT_VISION_MODEL = '';
  process.env.OPENAI_API_KEY = '';
  process.env.AI_PROXY_RATE_LIMIT_PER_MINUTE = '2';
  process.env.AI_PROXY_UNIT_LIMIT_PER_MINUTE = '100000';
  process.env.AI_PROXY_AUDIT_RETENTION_DAYS = '7';
  process.env.AI_PROXY_ALERT_ERROR_RATE_PERCENT = '25';
  process.env.AI_PROXY_ALERT_RATE_LIMITED_COUNT = '1';
  process.env.AI_PROXY_ALERT_MIN_REQUESTS = '2';
  process.env.AI_PROXY_ALERT_WINDOW_MINUTES = '60';
  process.env.AI_PROXY_ALERT_NOTIFICATIONS_ENABLED = 'false';
  process.env.AI_PROXY_ALERT_NOTIFICATION_USER_IDS = '';
  process.env.AI_PROXY_ALERT_NOTIFICATION_COOLDOWN_MINUTES = '30';
  process.env.AI_PROXY_ALERT_RUNBOOK_URL = '/docs/ai-proxy-ops-runbook.md';
  process.env.AI_PROXY_DASHBOARD_ENABLED = 'true';
  process.env.AI_PROXY_DASHBOARD_TOKEN = '';
  process.env.INVITATION_TTL_DAYS = '14';
  process.env.TWILIO_ACCOUNT_SID = '';
  process.env.TWILIO_AUTH_TOKEN = '';
  process.env.TWILIO_FROM_NUMBER = '';

  ({ prisma } = await import('./db'));
  ({ initLocalDatabase } = await import('./prisma/init'));
  ({ storageDir } = await import('./storage'));
  ({ resetAIClientsForTests } = await import('./ai-clients'));
  ({ createApp } = await import('./app'));
  await initLocalDatabase();
  app = createApp();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  process.env.ALLOW_DEV_AUTH_HEADERS = 'true';
  process.env.FACTCHAT_API_KEY = '';
  process.env.FACTCHAT_BASE_URL = 'https://factchat-cloud.mindlogic.ai/v1/gateway';
  process.env.FACTCHAT_CHAT_MODEL = 'gpt-5-mini';
  process.env.FACTCHAT_VISION_MODEL = '';
  process.env.OPENAI_API_KEY = '';
  process.env.AI_PROXY_AUDIT_RETENTION_DAYS = '7';
  process.env.AI_PROXY_ALERT_ERROR_RATE_PERCENT = '25';
  process.env.AI_PROXY_ALERT_RATE_LIMITED_COUNT = '1';
  process.env.AI_PROXY_ALERT_MIN_REQUESTS = '2';
  process.env.AI_PROXY_ALERT_WINDOW_MINUTES = '60';
  process.env.AI_PROXY_ALERT_NOTIFICATIONS_ENABLED = 'false';
  process.env.AI_PROXY_ALERT_NOTIFICATION_USER_IDS = '';
  process.env.AI_PROXY_ALERT_NOTIFICATION_COOLDOWN_MINUTES = '30';
  process.env.AI_PROXY_ALERT_RUNBOOK_URL = '/docs/ai-proxy-ops-runbook.md';
  process.env.AI_PROXY_DASHBOARD_ENABLED = 'true';
  process.env.AI_PROXY_DASHBOARD_TOKEN = '';
  process.env.INVITATION_TTL_DAYS = '14';
  resetAIClientsForTests();
  await prisma.aiProxyAuditLog.deleteMany();
  await prisma.autobiographyDraft.deleteMany();
  await prisma.publicationRequest.deleteMany();
  await prisma.coverDesign.deleteMany();
  await prisma.calendarEvent.deleteMany();
  await prisma.memoryVectorEntry.deleteMany();
  await prisma.memoryConsentSettings.deleteMany();
  await prisma.memoryTag.deleteMany();
  await prisma.memory.deleteMany();
  await prisma.photo.deleteMany();
  await prisma.question.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.freeSpeechRecord.deleteMany();
  await prisma.interviewRecord.deleteMany();
  await prisma.interviewSession.deleteMany();
  await prisma.interviewSchedule.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.guardianSeniorLink.deleteMany();
  await prisma.legacyVault.deleteMany();
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

  // Create test users
  await prisma.user.create({
    data: { id: 'test_senior', name: '김영자', role: 'senior', phoneNumber: '+821012345678' }
  });
  await prisma.user.create({
    data: { id: 'test_guardian', name: '보호자', role: 'guardian', phoneNumber: '+821087654321' }
  });
  await prisma.guardianSeniorLink.create({
    data: { guardianId: 'test_guardian', seniorId: 'test_senior' }
  });
});

describe('Digital Legacy Vault API', () => {
  const mockVaultData = {
    seniorId: 'test_senior',
    encryptedMemories: '{"data":"encrypted_memories_data"}',
    encryptedAutobiography: '{"data":"encrypted_autobiography_data"}',
    serverShare: '{"share":"share_b_data"}',
    institutionShare: '{"share":"share_c_data"}'
  };

  it('GET /api/legacy/vault returns isVaultSetup: false if not configured', async () => {
    const res = await request(app)
      .get('/api/legacy/vault')
      .set('x-user-id', 'test_senior')
      .set('x-user-role', 'senior');

    expect(res.status).toBe(200);
    expect(res.body.vault.isVaultSetup).toBe(false);
  });

  it('POST /api/legacy/vault creates vault successfully', async () => {
    const res = await request(app)
      .post('/api/legacy/vault')
      .set('x-user-id', 'test_senior')
      .set('x-user-role', 'senior')
      .send(mockVaultData);

    expect(res.status).toBe(201);
    expect(res.body.vault.isVaultSetup).toBe(true);
    expect(res.body.vault.deathVerificationStatus).toBe('alive');
    expect(res.body.vault.isDeceased).toBe(false);
    expect(res.body.vault.serverShareReleased).toBe(false);
    expect(res.body.vault.institutionShareReleased).toBe(false);

    // Verify DB entry directly
    const dbVault = await prisma.legacyVault.findUnique({
      where: { seniorId: 'test_senior' }
    });
    expect(dbVault).toBeDefined();
    expect(dbVault?.encryptedMemories).toBe(mockVaultData.encryptedMemories);
    expect(dbVault?.serverShare).toBe(mockVaultData.serverShare);
  });

  it('GET /api/legacy/vault returns vault config once created', async () => {
    // Setup vault first
    await prisma.legacyVault.create({
      data: {
        seniorId: 'test_senior',
        isVaultSetup: true,
        encryptedMemories: mockVaultData.encryptedMemories,
        encryptedAutobiography: mockVaultData.encryptedAutobiography,
        serverShare: mockVaultData.serverShare,
        institutionShare: mockVaultData.institutionShare,
        deathVerificationStatus: 'alive'
      }
    });

    const res = await request(app)
      .get('/api/legacy/vault')
      .set('x-user-id', 'test_senior')
      .set('x-user-role', 'senior');

    expect(res.status).toBe(200);
    expect(res.body.vault.isVaultSetup).toBe(true);
    expect(res.body.vault.encryptedMemories).toBe(mockVaultData.encryptedMemories);
    expect(res.body.vault.encryptedAutobiography).toBe(mockVaultData.encryptedAutobiography);
  });

  it('POST /api/legacy/trigger-death shifts vault state to pending_verification and creates notification', async () => {
    // Create vault
    await prisma.legacyVault.create({
      data: {
        seniorId: 'test_senior',
        isVaultSetup: true,
        encryptedMemories: mockVaultData.encryptedMemories,
        serverShare: mockVaultData.serverShare,
        institutionShare: mockVaultData.institutionShare,
        deathVerificationStatus: 'alive'
      }
    });

    // Senior is not allowed to trigger
    const failRes = await request(app)
      .post('/api/legacy/trigger-death')
      .set('x-user-id', 'test_senior')
      .set('x-user-role', 'senior')
      .send({ seniorId: 'test_senior' });
    expect(failRes.status).toBe(403);

    // Guardian triggers successfully
    const res = await request(app)
      .post('/api/legacy/trigger-death')
      .set('x-user-id', 'test_guardian')
      .set('x-user-role', 'guardian')
      .send({ seniorId: 'test_senior' });

    expect(res.status).toBe(200);
    expect(res.body.vault.deathVerificationStatus).toBe('pending_verification');
    expect(res.body.vault.isDeceased).toBe(true);

    // 신고 대상인 어르신 본인이 알림을 받아야 한다. 예전에는 신고한 보호자에게만 만들어서
    // 살아 계신 어르신이 아무 통보도 받지 못했다.
    const notification = await prisma.notification.findFirst({
      where: { userId: 'test_senior', type: 'legacy_death_triggered' }
    });
    expect(notification).toBeTruthy();
    expect(notification?.relatedUserId).toBe('test_senior');
  });

  it('POST /api/legacy/trigger-death refuses to restart a pending review', async () => {
    await prisma.legacyVault.create({
      data: {
        seniorId: 'test_senior',
        isVaultSetup: true,
        deathVerificationStatus: 'pending_verification',
        isDeceased: true,
        deathTriggeredById: 'test_guardian_2',
        deathTriggeredAt: new Date(),
      }
    });

    // 다시 신고하면 신고자가 바뀌어 "신고한 사람은 승인 못 한다" 제한을 우회할 수 있다.
    const res = await request(app)
      .post('/api/legacy/trigger-death')
      .set('x-user-id', 'test_guardian')
      .set('x-user-role', 'guardian')
      .send({ seniorId: 'test_senior' });

    expect(res.status).toBe(400);
    const vault = await prisma.legacyVault.findUnique({ where: { seniorId: 'test_senior' } });
    expect(vault?.deathTriggeredById).toBe('test_guardian_2');
  });

  it('POST /api/legacy/approve-death sets state to released and updates release flags', async () => {
    await prisma.legacyVault.create({
      data: {
        seniorId: 'test_senior',
        isVaultSetup: true,
        encryptedMemories: mockVaultData.encryptedMemories,
        serverShare: mockVaultData.serverShare,
        institutionShare: mockVaultData.institutionShare,
        deathVerificationStatus: 'pending_verification',
        isDeceased: true,
        deathTriggeredById: 'test_guardian',
        // 유예 기간이 이미 지난 신고. 연결된 보호자가 한 명뿐이라 신고자 본인이 승인한다.
        deathTriggeredAt: new Date(Date.now() - 100 * 60 * 60 * 1000),
      }
    });

    // Guardian approves
    const res = await request(app)
      .post('/api/legacy/approve-death')
      .set('x-user-id', 'test_guardian')
      .set('x-user-role', 'guardian')
      .send({ seniorId: 'test_senior' });

    expect(res.status).toBe(200);
    expect(res.body.vault.deathVerificationStatus).toBe('released');
    expect(res.body.vault.serverShareReleased).toBe(true);
    expect(res.body.vault.institutionShareReleased).toBe(true);

    const notification = await prisma.notification.findFirst({
      where: { userId: 'test_guardian', type: 'legacy_released' }
    });
    expect(notification).toBeTruthy();
  });

  describe('사망 심사 견제', () => {
    async function createPendingVault(overrides: Record<string, unknown> = {}) {
      return prisma.legacyVault.create({
        data: {
          seniorId: 'test_senior',
          isVaultSetup: true,
          encryptedMemories: mockVaultData.encryptedMemories,
          serverShare: mockVaultData.serverShare,
          institutionShare: mockVaultData.institutionShare,
          deathVerificationStatus: 'pending_verification',
          isDeceased: true,
          deathTriggeredById: 'test_guardian',
          deathTriggeredAt: new Date(Date.now() - 100 * 60 * 60 * 1000),
          ...overrides,
        },
      });
    }

    async function addSecondGuardian() {
      await prisma.user.create({
        data: { id: 'test_guardian_2', name: '둘째', role: 'guardian', phoneNumber: '+821099998888' },
      });
      await prisma.guardianSeniorLink.create({
        data: { guardianId: 'test_guardian_2', seniorId: 'test_senior' },
      });
    }

    function approveAs(userId: string) {
      return request(app)
        .post('/api/legacy/approve-death')
        .set('x-user-id', userId)
        .set('x-user-role', 'guardian')
        .send({ seniorId: 'test_senior' });
    }

    it('신고한 보호자는 자기 신고를 승인할 수 없다', async () => {
      await addSecondGuardian();
      await createPendingVault();

      // 혼자 신고하고 혼자 승인하면 확인 절차가 아니라 버튼 두 개다.
      const res = await approveAs('test_guardian');

      expect(res.status).toBe(403);
      const vault = await prisma.legacyVault.findUnique({ where: { seniorId: 'test_senior' } });
      expect(vault?.deathVerificationStatus).toBe('pending_verification');
    });

    it('다른 보호자는 승인할 수 있다', async () => {
      await addSecondGuardian();
      await createPendingVault();

      const res = await approveAs('test_guardian_2');

      expect(res.status).toBe(200);
      expect(res.body.vault.deathVerificationStatus).toBe('released');
    });

    it('유예 기간이 남아 있으면 승인할 수 없다', async () => {
      await addSecondGuardian();
      await createPendingVault({ deathTriggeredAt: new Date() });

      const res = await approveAs('test_guardian_2');

      // 유예가 없으면 어르신에게 알림이 가도 취소할 새가 없다.
      expect(res.status).toBe(403);
      expect(res.body.error).toContain('유예');
    });

    it('신고 시각이 없는 예전 행도 유예를 처음부터 기다린다', async () => {
      await addSecondGuardian();
      await createPendingVault({ deathTriggeredById: null, deathTriggeredAt: null });

      const res = await approveAs('test_guardian_2');

      expect(res.status).toBe(403);
    });

    it('어르신 본인이 사망 신고를 취소하면 금고가 다시 잠긴다', async () => {
      await createPendingVault({ deathTriggeredAt: new Date() });

      const res = await request(app)
        .post('/api/legacy/cancel-death')
        .set('x-user-id', 'test_senior')
        .set('x-user-role', 'senior')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.vault.deathVerificationStatus).toBe('alive');
      expect(res.body.vault.isDeceased).toBe(false);

      const vault = await prisma.legacyVault.findUnique({ where: { seniorId: 'test_senior' } });
      // 신고자가 남아 있으면 다음 신고에서 승인 제한이 엉뚱한 사람에게 걸린다.
      expect(vault?.deathTriggeredById).toBeNull();
      expect(vault?.deathTriggeredAt).toBeNull();
    });

    it('취소한 뒤에는 조각을 내주지 않는다', async () => {
      await createPendingVault({ deathTriggeredAt: new Date() });
      const cancelled = await request(app)
        .post('/api/legacy/cancel-death')
        .set('x-user-id', 'test_senior')
        .set('x-user-role', 'senior')
        .send({});
      expect(cancelled.status).toBe(200);

      const res = await request(app)
        .get('/api/legacy/shares')
        .query({ seniorId: 'test_senior' })
        .set('x-user-id', 'test_guardian')
        .set('x-user-role', 'guardian');

      expect(res.status).toBe(403);
    });

    it('심사 화면이 신고자와 남은 유예를 볼 수 있다', async () => {
      await createPendingVault({ deathTriggeredAt: new Date() });

      const res = await request(app)
        .get('/api/legacy/vault')
        .query({ seniorId: 'test_senior' })
        .set('x-user-id', 'test_guardian')
        .set('x-user-role', 'guardian');

      expect(res.status).toBe(200);
      // 이게 없으면 화면은 승인 버튼을 열어 두고 서버 403 을 받아야만 이유를 알 수 있다.
      expect(res.body.vault.deathTriggeredById).toBe('test_guardian');
      expect(res.body.vault.deathTriggeredAt).toBeTruthy();
      expect(res.body.vault.deathReviewRemainingMs).toBeGreaterThan(0);
    });

    it('심사 중이 아니면 남은 유예를 0으로 준다', async () => {
      // deathReviewRemainingMs 는 신고 시각이 없으면 유예 전체를 돌려준다. 그대로 흘리면
      // 살아 계신 어르신의 금고에도 "72시간 뒤에 승인할 수 있습니다"가 뜬다.
      await prisma.legacyVault.create({
        data: { seniorId: 'test_senior', isVaultSetup: true, deathVerificationStatus: 'alive' },
      });

      const res = await request(app)
        .get('/api/legacy/vault')
        .query({ seniorId: 'test_senior' })
        .set('x-user-id', 'test_guardian')
        .set('x-user-role', 'guardian');

      expect(res.status).toBe(200);
      expect(res.body.vault.deathReviewRemainingMs).toBe(0);
    });
  });

  it('POST /api/legacy/approve-death requires pending verification state', async () => {
    await prisma.legacyVault.create({
      data: {
        seniorId: 'test_senior',
        isVaultSetup: true,
        deathVerificationStatus: 'alive',
        isDeceased: false
      }
    });

    const res = await request(app)
      .post('/api/legacy/approve-death')
      .set('x-user-id', 'test_guardian')
      .set('x-user-role', 'guardian')
      .send({ seniorId: 'test_senior' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('사망 심사 대기 상태');
  });

  it('GET /api/legacy/shares isolates secret keys unless death is approved (released)', async () => {
    await prisma.legacyVault.create({
      data: {
        seniorId: 'test_senior',
        isVaultSetup: true,
        encryptedMemories: mockVaultData.encryptedMemories,
        serverShare: mockVaultData.serverShare,
        institutionShare: mockVaultData.institutionShare,
        deathVerificationStatus: 'alive'
      }
    });

    // 1. Alive status - returns 403 Forbidden
    const res1 = await request(app)
      .get('/api/legacy/shares')
      .query({ seniorId: 'test_senior' })
      .set('x-user-id', 'test_guardian')
      .set('x-user-role', 'guardian');
    expect(res1.status).toBe(403);
    expect(res1.body.error).toContain('사망 심사가 완료되지 않아');

    // Update to pending_verification
    await prisma.legacyVault.update({
      where: { seniorId: 'test_senior' },
      data: { deathVerificationStatus: 'pending_verification', isDeceased: true }
    });

    // 2. Pending verification - returns 403 Forbidden
    const res2 = await request(app)
      .get('/api/legacy/shares')
      .query({ seniorId: 'test_senior' })
      .set('x-user-id', 'test_guardian')
      .set('x-user-role', 'guardian');
    expect(res2.status).toBe(403);

    // Update to released
    await prisma.legacyVault.update({
      where: { seniorId: 'test_senior' },
      data: {
        deathVerificationStatus: 'released',
        serverShareReleased: true,
        institutionShareReleased: true
      }
    });

    // 3. Released - succeeds to get shares
    const res3 = await request(app)
      .get('/api/legacy/shares')
      .query({ seniorId: 'test_senior' })
      .set('x-user-id', 'test_guardian')
      .set('x-user-role', 'guardian');
    expect(res3.status).toBe(200);
    expect(res3.body.serverShare).toBe(mockVaultData.serverShare);
    expect(res3.body.institutionShare).toBe(mockVaultData.institutionShare);
  });

  it('protects memory transcripts by masking them if vault is active but not released', async () => {
    // Create interview record
    await prisma.interviewRecord.create({
      data: {
        id: 'rec_1',
        userId: 'test_senior',
        chapterId: 'childhood',
        audioFileKey: 'audio/test.raw',
        transcriptText: '나의 소중한 비공개 일기 본문'
      }
    });

    // 1. Vault not configured - unmasked transcript
    const res1 = await request(app)
      .get('/api/interview-records')
      .query({ seniorId: 'test_senior' })
      .set('x-user-id', 'test_senior')
      .set('x-user-role', 'senior');

    expect(res1.status).toBe(200);
    expect(res1.body.records).toHaveLength(1);
    expect(res1.body.records[0].transcriptText).toBe('나의 소중한 비공개 일기 본문');

    // 2. Vault configured and active, but senior is alive - masked transcript
    await prisma.legacyVault.create({
      data: {
        seniorId: 'test_senior',
        isVaultSetup: true,
        deathVerificationStatus: 'alive'
      }
    });

    const res2 = await request(app)
      .get('/api/interview-records')
      .query({ seniorId: 'test_senior' })
      .set('x-user-id', 'test_senior')
      .set('x-user-role', 'senior');

    expect(res2.status).toBe(200);
    expect(res2.body.records[0].transcriptText).toBe('[유산 암호화 설정으로 잠겨 있습니다. 사후 전수 시에만 해독할 수 있습니다.]');

    // 3. Vault status updated to released - unmasked transcript returned (since family can now decrypt using shares)
    await prisma.legacyVault.update({
      where: { seniorId: 'test_senior' },
      data: { deathVerificationStatus: 'released' }
    });

    const res3 = await request(app)
      .get('/api/interview-records')
      .query({ seniorId: 'test_senior' })
      .set('x-user-id', 'test_guardian')
      .set('x-user-role', 'guardian');

    expect(res3.status).toBe(200);
    expect(res3.body.records[0].transcriptText).toBe('나의 소중한 비공개 일기 본문');
  });

  it('adds audioUrl only for existing playable interview audio files', async () => {
    const playableFileName = 'test-playable-interview.webm';
    const playableFilePath = path.join(storageDir('audio'), playableFileName);
    await fs.mkdir(storageDir('audio'), { recursive: true });
    await fs.writeFile(playableFilePath, Buffer.from('webm audio'));

    try {
      await prisma.interviewRecord.createMany({
        data: [
          {
            id: 'rec_playable_audio',
            userId: 'test_senior',
            chapterId: 'childhood',
            audioFileKey: `audio/${playableFileName}`,
            transcriptText: '실제 음성 파일이 있는 기록',
          },
          {
            id: 'rec_text_placeholder',
            userId: 'test_senior',
            chapterId: 'childhood',
            audioFileKey: 'audio/manual-entry.txt',
            transcriptText: '수동 텍스트 기록',
          },
          {
            id: 'rec_missing_audio',
            userId: 'test_senior',
            chapterId: 'childhood',
            audioFileKey: 'audio/missing-interview.webm',
            transcriptText: '파일이 없는 음성 기록',
          },
        ],
      });

      const res = await request(app)
        .get('/api/interview-records')
        .query({ seniorId: 'test_senior' })
        .set('x-user-id', 'test_senior')
        .set('x-user-role', 'senior');

      expect(res.status).toBe(200);
      const recordsById = new Map<string, any>(res.body.records.map((record: any) => [record.id, record]));
      expect(recordsById.get('rec_playable_audio')?.audioUrl).toMatch(/^\/api\/files\/audio\/test-playable-interview\.webm\?token=/);
      expect(recordsById.get('rec_text_placeholder')?.audioUrl).toBeNull();
      expect(recordsById.get('rec_missing_audio')?.audioUrl).toBeNull();

      await prisma.legacyVault.create({
        data: {
          seniorId: 'test_senior',
          isVaultSetup: true,
          deathVerificationStatus: 'alive',
        },
      });

      const maskedRes = await request(app)
        .get('/api/interview-records')
        .query({ seniorId: 'test_senior' })
        .set('x-user-id', 'test_senior')
        .set('x-user-role', 'senior');

      expect(maskedRes.status).toBe(200);
      const maskedRecord = maskedRes.body.records.find((record: any) => record.id === 'rec_playable_audio');
      expect(maskedRecord.transcriptText).toBe('[유산 암호화 설정으로 잠겨 있습니다. 사후 전수 시에만 해독할 수 있습니다.]');
      expect(maskedRecord.audioUrl).toBeNull();
    } finally {
      await fs.rm(playableFilePath, { force: true });
    }
  });

  it('POST /api/legacy/reset deletes vault config', async () => {
    await prisma.legacyVault.create({
      data: {
        seniorId: 'test_senior',
        isVaultSetup: true,
        deathVerificationStatus: 'released'
      }
    });

    const res = await request(app)
      .post('/api/legacy/reset')
      .set('x-user-id', 'test_senior')
      .set('x-user-role', 'senior')
      .send({ seniorId: 'test_senior' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const vault = await prisma.legacyVault.findUnique({
      where: { seniorId: 'test_senior' }
    });
    expect(vault).toBeNull();
  });

  describe('POST /api/auth/phone validation', () => {
    it('succeeds in signup when phone is new', async () => {
      const res = await request(app)
        .post('/api/auth/phone')
        .send({ phoneNumber: '01055554444', name: '홍길동', isLogin: false, birthDate: '1997-07-04' });

      expect(res.status).toBe(201);
      expect(res.body.user.name).toBe('홍길동');
      expect(res.body.user.birthDate).toBe('1997-07-04');
      expect(res.body.authToken).toEqual(expect.any(String));
      expect(res.body.isNew).toBe(true);
    });

    it('fails signup when phone number already exists', async () => {
      // test_guardian phone is '+821087654321' (normalized to '821087654321')
      // Let's create a user with 01011112222
      await prisma.user.create({
        data: { name: '이순신', role: 'guardian', phoneNumber: '01011112222' }
      });

      const res = await request(app)
        .post('/api/auth/phone')
        .send({ phoneNumber: '01011112222', name: '강감찬', isLogin: false });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('이미 가입된 휴대폰 번호입니다');
    });

    it('succeeds login when phone and name match existing user', async () => {
      await prisma.user.create({
        data: { name: '김유신', role: 'guardian', phoneNumber: '01033334444' }
      });

      const res = await request(app)
        .post('/api/auth/phone')
        .send({ phoneNumber: '01033334444', name: '김유신', isLogin: true });

      expect(res.status).toBe(200);
      expect(res.body.user.name).toBe('김유신');
      expect(res.body.authToken).toEqual(expect.any(String));
      expect(res.body.isNew).toBe(false);
    });

    it('fails login when phone exists but name does not match', async () => {
      await prisma.user.create({
        data: { name: '김유신', role: 'guardian', phoneNumber: '01033334444' }
      });

      const res = await request(app)
        .post('/api/auth/phone')
        .send({ phoneNumber: '01033334444', name: '이순신', isLogin: true });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('이름이 일치하지 않습니다');
    });

    it('fails login when phone does not exist', async () => {
      const res = await request(app)
        .post('/api/auth/phone')
        .send({ phoneNumber: '01099999999', name: '홍길동', isLogin: true });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('가입되지 않은 휴대폰 번호입니다');
    });

    it('falls back to find-or-create when isLogin is undefined for legacy clients', async () => {
      // Existing
      await prisma.user.create({
        data: { name: '김유신', role: 'guardian', phoneNumber: '01033334444' }
      });

      const resExisting = await request(app)
        .post('/api/auth/phone')
        .send({ phoneNumber: '01033334444' }); // no name, no isLogin

      expect(resExisting.status).toBe(200);
      expect(resExisting.body.user.name).toBe('김유신');
      expect(resExisting.body.authToken).toEqual(expect.any(String));

      // New
      const resNew = await request(app)
        .post('/api/auth/phone')
        .send({ phoneNumber: '01077778888', name: '신규자' }); // no isLogin

      expect(resNew.status).toBe(201);
      expect(resNew.body.user.name).toBe('신규자');
      expect(resNew.body.authToken).toEqual(expect.any(String));
    });
  });

  describe('Bearer auth boundary', () => {
    it('accepts a server-issued bearer token when development headers are disabled', async () => {
      process.env.ALLOW_DEV_AUTH_HEADERS = 'false';

      const login = await request(app)
        .post('/api/auth/phone')
        .send({ phoneNumber: '01055553333', name: '토큰사용자', isLogin: false });

      expect(login.status).toBe(201);
      expect(login.body.authToken).toEqual(expect.any(String));

      const res = await request(app)
        .get('/api/family-members')
        .set('Authorization', `Bearer ${login.body.authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.members.some((member: { id: string }) => member.id === login.body.user.id)).toBe(true);
    });

    it('rejects forged x-user headers when development headers are disabled', async () => {
      process.env.ALLOW_DEV_AUTH_HEADERS = 'false';

      const res = await request(app)
        .get('/api/legacy/vault')
        .set('x-user-id', 'test_senior')
        .set('x-user-role', 'senior');

      expect(res.status).toBe(403);
    });

    it('requires self-authentication before profile mutations', async () => {
      const login = await request(app)
        .post('/api/auth/phone')
        .send({ phoneNumber: '01055552222', name: '자기계정', isLogin: false });

      const otherUser = await prisma.user.create({
        data: { name: '다른 계정', role: 'guardian', phoneNumber: '01055550000' }
      });

      const res = await request(app)
        .patch(`/api/auth/users/${otherUser.id}/profile`)
        .set('Authorization', `Bearer ${login.body.authToken}`)
        .send({
          role: 'guardian',
          name: '탈취 시도',
          preferredName: '보호자',
          relationship: '자녀'
        });

      expect(res.status).toBe(403);
    });

    it('allows self-authenticated role and profile updates with refreshed tokens', async () => {
      const login = await request(app)
        .post('/api/auth/phone')
        .send({ phoneNumber: '01055556666', name: '역할변경', isLogin: false });

      const roleRes = await request(app)
        .patch(`/api/auth/users/${login.body.user.id}/role`)
        .set('Authorization', `Bearer ${login.body.authToken}`)
        .send({ role: 'senior' });

      expect(roleRes.status).toBe(200);
      expect(roleRes.body.user.role).toBe('senior');
      expect(roleRes.body.authToken).toEqual(expect.any(String));
      expect(roleRes.body.authToken).not.toBe(login.body.authToken);

      const profileRes = await request(app)
        .patch(`/api/auth/users/${login.body.user.id}/profile`)
        .set('Authorization', `Bearer ${roleRes.body.authToken}`)
        .send({
          role: 'senior',
          name: '김토큰',
          preferredName: '어르신',
          birthDate: '1955-03-02',
          birthDecade: '1950년대'
        });

      expect(profileRes.status).toBe(200);
      expect(profileRes.body.user.seniorName).toBe('김토큰');
      expect(profileRes.body.user.birthDate).toBe('1955-03-02');
      expect(profileRes.body.authToken).toEqual(expect.any(String));
    });
  });

  describe('POST /api/invitations', () => {
    it('creates invitation and sets guardianName on senior user', async () => {
      const profileImageUrl = 'data:image/png;base64,aGVsbG8=';
      const recordSpaceCoverUrl = 'data:image/jpeg;base64,d29ybGQ=';
      const recordSpaceName = '아버지의 생애일기';
      const occupation = '교사';
      const hometown = '강원도 춘천';
      const schoolHistory = '춘천고등학교';
      // test_guardian is logged in with id 'test_guardian' and name '보호자'
      const res = await request(app)
        .post('/api/invitations')
        .set('x-user-id', 'test_guardian')
        .set('x-user-role', 'guardian')
        .send({
          seniorName: '아버지',
          birthDate: '1952-03-12',
          relationship: '아버지',
          recordSpaceName,
          profileImageUrl,
          recordSpaceCoverUrl,
          hasCurrentJob: false,
          occupation,
          hometown,
          schoolHistory,
        });

      expect(res.status).toBe(201);
      expect(res.body.invitation).toBeDefined();

      const seniorId = res.body.invitation.seniorId;
      const senior = await prisma.user.findUnique({
        where: { id: seniorId }
      });
      expect(senior).toBeDefined();
      expect(senior?.name).toBe('아버지');
      expect(senior?.guardianName).toBe('보호자'); // Must match the guardian's name!
      expect(senior?.birthDate).toBe('1952-03-12');
      expect(senior?.recordSpaceName).toBe(recordSpaceName);
      expect(senior?.profileImageUrl).toBe(profileImageUrl);
      expect(senior?.recordSpaceCoverUrl).toBe(recordSpaceCoverUrl);
      expect(senior?.hasCurrentJob).toBe(false);
      expect(senior?.occupation).toBe(occupation);
      expect(senior?.hometown).toBe(hometown);
      expect(senior?.schoolHistory).toBe(schoolHistory);
      expect(res.body.invitation.status).toBe('active');
      expect(res.body.invitation.expiresAt).toBeTruthy();
      const link = await prisma.guardianSeniorLink.findUnique({
        where: { guardianId_seniorId: { guardianId: 'test_guardian', seniorId } },
      });
      expect(link?.relationship).toBe('아버지');

      const familyRes = await request(app)
        .get('/api/family-members')
        .set('x-user-id', 'test_guardian')
        .set('x-user-role', 'guardian');
      const seniorMember = familyRes.body.members.find((member: any) => member.id === seniorId);
      expect(seniorMember.relationship).toBe('아버지');
      expect(seniorMember.birthDate).toBe('1952-03-12');
      expect(seniorMember.recordSpaceName).toBe(recordSpaceName);
      expect(seniorMember.profileImageUrl).toBe(profileImageUrl);
      expect(seniorMember.recordSpaceCoverUrl).toBe(recordSpaceCoverUrl);
      expect(seniorMember.hasCurrentJob).toBe(false);
      expect(seniorMember.occupation).toBe(occupation);
      expect(seniorMember.hometown).toBe(hometown);
      expect(seniorMember.schoolHistory).toBe(schoolHistory);
    });

    it('expires, rotates, and revokes invitation links', async () => {
      process.env.INVITATION_TTL_DAYS = '3';

      const createRes = await request(app)
        .post('/api/invitations')
        .set('x-user-id', 'test_guardian')
        .set('x-user-role', 'guardian')
        .send({ seniorId: 'test_senior' });

      expect(createRes.status).toBe(201);
      const invitation = createRes.body.invitation;
      const originalToken = invitation.token;
      expect(invitation.status).toBe('active');
      expect(new Date(invitation.expiresAt).getTime()).toBeGreaterThan(Date.now());

      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { expiresAt: new Date(Date.now() - 60 * 1000) },
      });

      const expiredLogin = await request(app)
        .post('/api/auth/token-login')
        .send({ token: originalToken });
      expect(expiredLogin.status).toBe(410);
      expect(expiredLogin.body.error).toContain('만료');

      const rotateRes = await request(app)
        .post(`/api/invitations/${invitation.id}/rotate`)
        .set('x-user-id', 'test_guardian')
        .set('x-user-role', 'guardian');

      expect(rotateRes.status).toBe(200);
      expect(rotateRes.body.invitation.status).toBe('active');
      expect(rotateRes.body.invitation.token).not.toBe(originalToken);

      const oldTokenLogin = await request(app)
        .post('/api/auth/token-login')
        .send({ token: originalToken });
      expect(oldTokenLogin.status).toBe(404);

      const loginRes = await request(app)
        .post('/api/auth/token-login')
        .send({ token: rotateRes.body.invitation.token });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.user.id).toBe('test_senior');

      const usedInvitation = await prisma.invitation.findUnique({ where: { id: invitation.id } });
      expect(usedInvitation?.usedAt).toBeTruthy();

      const revokeRes = await request(app)
        .delete(`/api/invitations/${invitation.id}`)
        .set('x-user-id', 'test_guardian')
        .set('x-user-role', 'guardian');
      expect(revokeRes.status).toBe(200);
      expect(revokeRes.body.invitation.status).toBe('revoked');
      expect(revokeRes.body.invitation.token).toBeNull();

      const revokedLogin = await request(app)
        .post('/api/auth/token-login')
        .send({ token: rotateRes.body.invitation.token });
      expect(revokedLogin.status).toBe(410);
      expect(revokedLogin.body.error).toContain('폐기');
    });

    it('shows invitation lifecycle metadata in family members', async () => {
      const createRes = await request(app)
        .post('/api/invitations')
        .set('x-user-id', 'test_guardian')
        .set('x-user-role', 'guardian')
        .send({ seniorId: 'test_senior' });

      expect(createRes.status).toBe(201);

      const res = await request(app)
        .get('/api/family-members')
        .set('x-user-id', 'test_guardian')
        .set('x-user-role', 'guardian');

      expect(res.status).toBe(200);
      const seniorMember = res.body.members.find((member: any) => member.id === 'test_senior');
      expect(seniorMember.invitationId).toBe(createRes.body.invitation.id);
      expect(seniorMember.invitationStatus).toBe('active');
      expect(seniorMember.invitationExpiresAt).toBeTruthy();
      expect(seniorMember.token).toBe(createRes.body.invitation.token);
    });
  });

  describe('AI proxy API', () => {
    it('validates chat completion payloads before contacting the provider', async () => {
      const res = await request(app)
        .post('/api/ai/chat-completions')
        .set('x-user-id', 'test_guardian')
        .set('x-user-role', 'guardian')
        .send({ model: 'gpt-4o-mini' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('model과 messages');

      const log = await prisma.aiProxyAuditLog.findFirst({
        where: { endpoint: 'chat_completions', outcome: 'invalid_request' },
      });
      expect(log?.userId).toBe('test_guardian');
      expect(log?.statusCode).toBe(400);
    });

    it('validates embedding payloads before contacting the provider', async () => {
      const res = await request(app)
        .post('/api/ai/embeddings')
        .set('x-user-id', 'test_guardian')
        .set('x-user-role', 'guardian')
        .send({ model: 'text-embedding-3-small' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('model과 input');

      const log = await prisma.aiProxyAuditLog.findFirst({
        where: { endpoint: 'embeddings', outcome: 'invalid_request' },
      });
      expect(log?.userId).toBe('test_guardian');
      expect(log?.statusCode).toBe(400);
    });

    it('validates speech payloads before contacting the provider', async () => {
      const res = await request(app)
        .post('/api/audio/speech')
        .set('x-user-id', 'test_senior')
        .set('x-user-role', 'senior')
        .send({ text: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('질문 문장');

      const log = await prisma.aiProxyAuditLog.findFirst({
        where: { endpoint: 'speech', outcome: 'invalid_request' },
      });
      expect(log?.userId).toBe('test_senior');
      expect(log?.statusCode).toBe(400);
    });

    it('records config errors without exposing browser API keys', async () => {
      const res = await request(app)
        .post('/api/ai/chat-completions')
        .set('x-user-id', 'test_guardian')
        .set('x-user-role', 'guardian')
        .send({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: '안녕하세요' }],
        });

      expect(res.status).toBe(503);

      const log = await prisma.aiProxyAuditLog.findFirst({
        where: { endpoint: 'chat_completions', outcome: 'config_error' },
      });
      expect(log?.model).toBe('gpt-5-mini');
      expect(log?.estimatedUnits).toBeGreaterThan(0);
      expect(log?.errorMessage).toContain('FACTCHAT_API_KEY');
    });

    it('keeps embeddings on the OpenAI key path', async () => {
      const res = await request(app)
        .post('/api/ai/embeddings')
        .set('x-user-id', 'test_guardian')
        .set('x-user-role', 'guardian')
        .send({
          model: 'text-embedding-3-small',
          input: '기억 검색',
        });

      expect(res.status).toBe(503);

      const log = await prisma.aiProxyAuditLog.findFirst({
        where: { endpoint: 'embeddings', outcome: 'config_error' },
      });
      expect(log?.model).toBe('text-embedding-3-small');
      expect(log?.estimatedUnits).toBeGreaterThan(0);
      expect(log?.errorMessage).toContain('OPENAI_API_KEY');
    });

    it('keeps question speech generation on the OpenAI key path', async () => {
      const res = await request(app)
        .post('/api/audio/speech')
        .set('x-user-id', 'test_senior')
        .set('x-user-role', 'senior')
        .send({
          text: '어머니, 어린 시절 집 마당에서 가장 기억나는 장면은 무엇인가요?',
        });

      expect(res.status).toBe(503);

      const log = await prisma.aiProxyAuditLog.findFirst({
        where: { endpoint: 'speech', outcome: 'config_error' },
      });
      expect(log?.model).toBe('gpt-4o-mini-tts');
      expect(log?.estimatedUnits).toBeGreaterThan(0);
      expect(log?.errorMessage).toContain('OPENAI_API_KEY');
    });

    it('rate limits valid AI proxy requests before provider access', async () => {
      const rateUserId = `rate_guardian_${Date.now()}`;
      await prisma.user.create({
        data: { id: rateUserId, name: '요청 제한 보호자', role: 'guardian', phoneNumber: '01077770000' },
      });
      await prisma.guardianSeniorLink.create({
        data: { guardianId: rateUserId, seniorId: 'test_senior' },
      });

      const body = {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: '짧은 질문입니다.' }],
      };
      const first = await request(app)
        .post('/api/ai/chat-completions')
        .set('x-user-id', rateUserId)
        .set('x-user-role', 'guardian')
        .send(body);
      const second = await request(app)
        .post('/api/ai/chat-completions')
        .set('x-user-id', rateUserId)
        .set('x-user-role', 'guardian')
        .send(body);
      const third = await request(app)
        .post('/api/ai/chat-completions')
        .set('x-user-id', rateUserId)
        .set('x-user-role', 'guardian')
        .send(body);

      expect(first.status).toBe(503);
      expect(second.status).toBe(503);
      expect(third.status).toBe(429);
      expect(third.header['retry-after']).toBeDefined();

      const logs = await prisma.aiProxyAuditLog.findMany({
        where: { userId: rateUserId, endpoint: 'chat_completions' },
        orderBy: { createdAt: 'asc' },
      });
      expect(logs.map((log) => log.outcome)).toEqual(['config_error', 'config_error', 'rate_limited']);
    });

    it('summarizes AI proxy audit logs, emits alerts, and prunes old entries', async () => {
      const now = new Date();
      await prisma.aiProxyAuditLog.createMany({
        data: [
          {
            id: 'old_ai_proxy_log',
            userId: 'test_guardian',
            role: 'guardian',
            endpoint: 'chat_completions',
            model: 'gpt-4o-mini',
            outcome: 'success',
            statusCode: 200,
            estimatedUnits: 10,
            latencyMs: 50,
            createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
          },
          {
            id: 'success_ai_proxy_log',
            userId: 'test_guardian',
            role: 'guardian',
            endpoint: 'chat_completions',
            model: 'gpt-4o-mini',
            outcome: 'success',
            statusCode: 200,
            estimatedUnits: 40,
            latencyMs: 80,
            createdAt: new Date(now.getTime() - 5 * 60 * 1000),
          },
          {
            id: 'provider_ai_proxy_log',
            userId: 'test_guardian',
            role: 'guardian',
            endpoint: 'chat_completions',
            model: 'gpt-4o-mini',
            outcome: 'provider_error',
            statusCode: 502,
            estimatedUnits: 55,
            latencyMs: 120,
            providerStatus: 500,
            providerCode: 'server_error',
            errorMessage: 'provider failed',
            createdAt: new Date(now.getTime() - 4 * 60 * 1000),
          },
          {
            id: 'rate_limited_ai_proxy_log',
            userId: 'test_guardian',
            role: 'guardian',
            endpoint: 'embeddings',
            model: 'text-embedding-3-small',
            outcome: 'rate_limited',
            statusCode: 429,
            estimatedUnits: 15,
            latencyMs: 10,
            errorMessage: 'limit',
            createdAt: new Date(now.getTime() - 3 * 60 * 1000),
          },
        ],
      });

      const res = await request(app)
        .get('/api/ai/audit-summary')
        .query({ windowMinutes: 60 })
        .set('x-user-id', 'test_guardian')
        .set('x-user-role', 'guardian');

      expect(res.status).toBe(200);
      expect(res.body.totals.requests).toBe(3);
      expect(res.body.totals.providerError).toBe(1);
      expect(res.body.totals.rateLimited).toBe(1);
      expect(res.body.byEndpoint.map((row: any) => row.endpoint).sort()).toEqual(['chat_completions', 'embeddings']);
      expect(res.body.alerts.map((alert: any) => alert.type)).toEqual(
        expect.arrayContaining(['error_rate', 'provider_error', 'rate_limited'])
      );
      expect(res.body.alertRouting.enabled).toBe(false);
      expect(res.body.alertRouting.runbookUrl).toBe('/docs/ai-proxy-ops-runbook.md');
      expect(res.body.retention.days).toBe(7);
      expect(res.body.retention.deletedOldLogs).toBe(1);

      const oldLog = await prisma.aiProxyAuditLog.findUnique({ where: { id: 'old_ai_proxy_log' } });
      expect(oldLog).toBeNull();
    });

    it('requires dashboard availability and optional dashboard token', async () => {
      process.env.AI_PROXY_DASHBOARD_TOKEN = 'ops-token';

      const forbidden = await request(app)
        .get('/api/ai/audit-summary')
        .set('x-user-id', 'test_guardian')
        .set('x-user-role', 'guardian');
      expect(forbidden.status).toBe(403);

      const allowed = await request(app)
        .get('/api/ai/audit-summary')
        .set('x-user-id', 'test_guardian')
        .set('x-user-role', 'guardian')
        .set('x-ai-proxy-dashboard-token', 'ops-token');
      expect(allowed.status).toBe(200);

      process.env.AI_PROXY_DASHBOARD_ENABLED = 'false';
      const disabled = await request(app)
        .get('/api/ai/audit-summary')
        .set('x-user-id', 'test_guardian')
        .set('x-user-role', 'guardian')
        .set('x-ai-proxy-dashboard-token', 'ops-token');
      expect(disabled.status).toBe(404);
    });

    it('routes AI proxy alerts to configured operators and respects cooldown', async () => {
      process.env.AI_PROXY_ALERT_NOTIFICATIONS_ENABLED = 'true';
      process.env.AI_PROXY_ALERT_NOTIFICATION_USER_IDS = 'test_guardian';
      process.env.AI_PROXY_ALERT_NOTIFICATION_COOLDOWN_MINUTES = '30';
      process.env.AI_PROXY_ALERT_RUNBOOK_URL = 'https://ops.example.test/ai-proxy-runbook';
      await prisma.user.create({
        data: { id: 'ai_alert_caller', name: 'AI 호출자', role: 'guardian', phoneNumber: '01099990000' },
      });

      const body = { model: 'gpt-4o-mini', messages: [{ role: 'user', content: '안녕하세요' }] };
      const first = await request(app)
        .post('/api/ai/chat-completions')
        .set('x-user-id', 'ai_alert_caller')
        .set('x-user-role', 'guardian')
        .send(body);

      expect(first.status).toBe(503);

      const notification = await prisma.notification.findFirst({
        where: { userId: 'test_guardian', type: 'ai_proxy_alert' },
      });
      expect(notification).toBeTruthy();
      expect(notification?.title).toContain('AI 프록시');
      const metadata = JSON.parse(notification?.metadataJson ?? '{}');
      expect(metadata.alertTypes).toEqual(expect.arrayContaining(['config_error']));
      expect(metadata.runbookUrl).toBe('https://ops.example.test/ai-proxy-runbook');
      expect(metadata.totals.configError).toBe(1);

      const second = await request(app)
        .post('/api/ai/chat-completions')
        .set('x-user-id', 'ai_alert_caller')
        .set('x-user-role', 'guardian')
        .send(body);
      expect(second.status).toBe(503);
      expect(await prisma.notification.count({ where: { userId: 'test_guardian', type: 'ai_proxy_alert' } })).toBe(1);
    });
  });

  describe('ownership guards', () => {
    async function createOtherFamily() {
      await prisma.user.create({
        data: { id: 'other_senior', name: '다른 부모님', role: 'senior', phoneNumber: '01022223333' }
      });
      await prisma.user.create({
        data: { id: 'other_guardian', name: '다른 보호자', role: 'guardian', phoneNumber: '01044445555' }
      });
      await prisma.guardianSeniorLink.create({
        data: { guardianId: 'other_guardian', seniorId: 'other_senior' }
      });
    }

    it('filters family questions to guardians linked to the requested senior', async () => {
      await createOtherFamily();
      await prisma.question.create({
        data: {
          id: 'q_linked',
          category: 'guardian_questions',
          text: '연결된 가족 질문',
          seniorId: 'test_senior',
          createdById: 'test_guardian',
        },
      });
      await prisma.question.create({
        data: {
          id: 'q_other',
          category: 'guardian_questions',
          text: '다른 가족 질문',
          seniorId: 'other_senior',
          createdById: 'other_guardian',
        },
      });

      const res = await request(app)
        .get('/api/family-questions')
        .query({ seniorId: 'test_senior' })
        .set('x-user-id', 'test_guardian')
        .set('x-user-role', 'guardian');

      expect(res.status).toBe(200);
      expect(res.body.questions.map((q: any) => q.id)).toEqual(['q_linked']);
    });

    it('separates questions for two seniors managed by the same guardian', async () => {
      await prisma.user.create({
        data: { id: 'second_senior', name: '두 번째 부모님', role: 'senior', phoneNumber: '01066667777' }
      });
      await prisma.guardianSeniorLink.create({
        data: { guardianId: 'test_guardian', seniorId: 'second_senior' }
      });
      await prisma.question.create({
        data: {
          id: 'q_first_senior',
          category: 'guardian_questions',
          text: '첫 번째 부모님 질문',
          seniorId: 'test_senior',
          createdById: 'test_guardian',
        },
      });
      await prisma.question.create({
        data: {
          id: 'q_second_senior',
          category: 'guardian_questions',
          text: '두 번째 부모님 질문',
          seniorId: 'second_senior',
          createdById: 'test_guardian',
        },
      });

      const firstRes = await request(app)
        .get('/api/family-questions')
        .query({ seniorId: 'test_senior' })
        .set('x-user-id', 'test_guardian')
        .set('x-user-role', 'guardian');
      const secondRes = await request(app)
        .get('/api/family-questions')
        .query({ seniorId: 'second_senior' })
        .set('x-user-id', 'test_guardian')
        .set('x-user-role', 'guardian');

      expect(firstRes.status).toBe(200);
      expect(firstRes.body.questions.map((q: any) => q.id)).toEqual(['q_first_senior']);
      expect(secondRes.status).toBe(200);
      expect(secondRes.body.questions.map((q: any) => q.id)).toEqual(['q_second_senior']);
    });

    it('blocks unrelated guardians from mutating family questions', async () => {
      await createOtherFamily();
      await prisma.question.create({
        data: {
          id: 'q_owned',
          category: 'guardian_questions',
          text: '우리 가족 질문',
          seniorId: 'test_senior',
          createdById: 'test_guardian',
        },
      });

      const patchRes = await request(app)
        .patch('/api/questions/q_owned')
        .set('x-user-id', 'other_guardian')
        .set('x-user-role', 'guardian')
        .send({ text: '몰래 수정' });
      expect(patchRes.status).toBe(403);

      const deleteRes = await request(app)
        .delete('/api/questions/q_owned')
        .set('x-user-id', 'other_guardian')
        .set('x-user-role', 'guardian');
      expect(deleteRes.status).toBe(403);

      const question = await prisma.question.findUnique({ where: { id: 'q_owned' } });
      expect(question?.text).toBe('우리 가족 질문');
    });

    it('validates memory consent statuses and preserves untouched purposes on partial patch', async () => {
      await prisma.memory.create({
        data: {
          id: 'memory_consent_partial',
          userId: 'test_senior',
          topic: '부분 동의 변경',
          originalTranscript: '원문',
          cleanedTranscript: '정리본',
          publishVersion: '출판본',
          consentSettings: {
            create: {
              publish: 'granted',
              familyRead: 'granted',
              chatbot: 'granted',
              posthumous: 'revoked',
              sensitive: 'granted',
            },
          },
        },
      });

      const headers = { 'x-user-id': 'test_senior', 'x-user-role': 'senior' };
      const invalidResponse = await request(app)
        .patch('/api/memories/memory_consent_partial')
        .set(headers)
        .send({ consentSettings: { 챗봇: 'unknown' } });
      expect(invalidResponse.status).toBe(400);

      const response = await request(app)
        .patch('/api/memories/memory_consent_partial')
        .set(headers)
        .send({ consentSettings: { 가족열람: 'needs_review' } });
      expect(response.status).toBe(200);
      expect(response.body.memory.consentSettings).toEqual({
        출판: 'granted',
        가족열람: 'needs_review',
        챗봇: 'granted',
        사후공개: 'revoked',
        민감정보: 'granted',
      });
    });

    it('applies memory stop-use consent, privacy, and vector removal atomically', async () => {
      await prisma.memory.create({
        data: {
          id: 'memory_stop_use',
          userId: 'test_senior',
          topic: '활용 중지 기억',
          originalTranscript: '원문',
          cleanedTranscript: '정리본',
          publishVersion: '출판본',
          privacy: 'family',
          consentSettings: {
            create: {
              publish: 'granted',
              familyRead: 'granted',
              chatbot: 'needs_review',
              posthumous: 'granted',
              sensitive: 'granted',
            },
          },
          vectorEntry: {
            create: {
              embeddingJson: '[0.1,0.2]',
              text: '활용 중지 기억 정리본',
            },
          },
        },
      });

      const stoppedConsents = {
        출판: 'revoked',
        가족열람: 'revoked',
        챗봇: 'revoked',
        사후공개: 'revoked',
        민감정보: 'revoked',
      };
      const response = await request(app)
        .patch('/api/memories/memory_stop_use')
        .set('x-user-id', 'test_senior')
        .set('x-user-role', 'senior')
        .send({
          privacy: 'private',
          consentSettings: stoppedConsents,
          embedding: null,
        });

      expect(response.status).toBe(200);
      expect(response.body.memory).toMatchObject({
        privacy: 'private',
        consentSettings: stoppedConsents,
        embedding: null,
      });
      expect(await prisma.memoryVectorEntry.findUnique({
        where: { memoryId: 'memory_stop_use' },
      })).toBeNull();
    });

    it('blocks unrelated users from mutating senior-owned resources', async () => {
      await createOtherFamily();
      await prisma.memory.create({
        data: {
          id: 'mem_owned',
          userId: 'test_senior',
          topic: '가족 여행',
          originalTranscript: '원문',
          cleanedTranscript: '정리본',
          publishVersion: '출판본',
        },
      });
      await prisma.photo.create({
        data: {
          id: 'photo_owned',
          userId: 'test_senior',
          fileKey: 'photos/test.png',
          fileName: 'test.png',
          mimeType: 'image/png',
        },
      });
      await prisma.interviewSession.create({
        data: {
          id: 'session_owned',
          seniorId: 'test_senior',
          chapterId: 'childhood',
          mode: 'photo',
        },
      });
      await prisma.interviewRecord.create({
        data: {
          id: 'record_owned',
          userId: 'test_senior',
          chapterId: 'childhood',
          sessionId: 'session_owned',
          audioFileKey: 'audio/test.raw',
          transcriptText: '인터뷰 원문',
        },
      });
      await prisma.calendarEvent.create({
        data: {
          id: 'event_owned',
          userId: 'test_senior',
          eventType: '생일',
          eventDate: '2026-06-01',
        },
      });

      const headers = { 'x-user-id': 'other_guardian', 'x-user-role': 'guardian' };
      expect((await request(app).patch('/api/memories/mem_owned').set(headers).send({ privacy: 'family' })).status).toBe(403);
      expect((await request(app).delete('/api/photos/photo_owned').set(headers)).status).toBe(403);
      expect((await request(app).patch('/api/interview-sessions/session_owned/pause').set(headers)).status).toBe(403);
      expect((await request(app).patch('/api/interview-records/record_owned').set(headers).send({ publish: false })).status).toBe(403);
      expect((await request(app).delete('/api/calendar-events/event_owned').set(headers)).status).toBe(403);
      expect((await request(app).get('/api/progress/test_senior').set(headers)).status).toBe(403);
    });

    it('guards local file delivery by owner and short-lived signed URLs', async () => {
      await createOtherFamily();
      await Promise.all([
        fs.writeFile(path.join(storageDir('photos'), 'owned-photo.png'), Buffer.from('owned photo')),
        fs.writeFile(path.join(storageDir('audio'), 'owned-audio.raw'), Buffer.from('owned audio')),
        fs.writeFile(path.join(storageDir('pdfs'), 'owned-book.pdf'), Buffer.from('%PDF-1.4\nowned pdf')),
        fs.writeFile(path.join(storageDir('photos'), 'orphan-photo.png'), Buffer.from('orphan photo')),
      ]);
      await prisma.photo.create({
        data: {
          id: 'file_photo_owned',
          userId: 'test_senior',
          fileKey: 'photos/owned-photo.png',
          fileName: 'owned-photo.png',
          mimeType: 'image/png',
        },
      });
      await prisma.interviewRecord.create({
        data: {
          id: 'file_audio_owned',
          userId: 'test_senior',
          chapterId: 'childhood',
          audioFileKey: 'audio/owned-audio.raw',
          transcriptText: '파일 접근 테스트',
        },
      });
      await prisma.publicationRequest.create({
        data: {
          id: 'file_pdf_owned',
          userId: 'test_senior',
          requestedById: 'test_guardian',
          status: 'ready',
          pdfFileKey: 'pdfs/owned-book.pdf',
        },
      });

      const ownerHeaders = { 'x-user-id': 'test_guardian', 'x-user-role': 'guardian' };
      const otherHeaders = { 'x-user-id': 'other_guardian', 'x-user-role': 'guardian' };

      const photosRes = await request(app)
        .get('/api/photos')
        .set(ownerHeaders);
      expect(photosRes.status).toBe(200);
      const photoUrl = photosRes.body.photos.find((photo: any) => photo.id === 'file_photo_owned').url;
      expect(photoUrl).toMatch(/^\/api\/files\/photos\/owned-photo\.png\?token=/);

      expect((await request(app).get(photoUrl)).status).toBe(200);
      expect((await request(app).get(photoUrl.replace('owned-photo.png', 'orphan-photo.png'))).status).toBe(403);
      expect((await request(app).get('/api/files/photos/owned-photo.png').set(ownerHeaders)).status).toBe(200);
      expect((await request(app).get('/api/files/audio/owned-audio.raw').set(ownerHeaders)).status).toBe(200);
      expect((await request(app).get('/api/files/pdfs/owned-book.pdf').set(ownerHeaders)).status).toBe(200);
      expect((await request(app).get('/api/files/photos/owned-photo.png').set(otherHeaders)).status).toBe(403);
      expect((await request(app).get('/api/files/audio/owned-audio.raw').set(otherHeaders)).status).toBe(403);
      expect((await request(app).get('/api/files/pdfs/owned-book.pdf').set(otherHeaders)).status).toBe(403);
      expect((await request(app).get('/api/files/photos/orphan-photo.png').set(ownerHeaders)).status).toBe(404);
    });

    it('blocks unrelated guardians from confirming cover designs and requesting publications', async () => {
      await createOtherFamily();
      await prisma.coverDesign.create({
        data: {
          id: 'cover_owned',
          userId: 'test_senior',
          palette: 'warm_archive',
          template: 'photo_plate',
          font: '명조체',
        },
      });

      const headers = { 'x-user-id': 'other_guardian', 'x-user-role': 'guardian' };
      const confirmRes = await request(app)
        .patch('/api/cover-designs/cover_owned/confirm')
        .set(headers);
      expect(confirmRes.status).toBe(403);

      const cover = await prisma.coverDesign.findUnique({ where: { id: 'cover_owned' } });
      expect(cover?.confirmedAt).toBeNull();

      const publicationRes = await request(app)
        .post('/api/publication-requests')
        .set(headers)
        .send({ seniorId: 'test_senior', format: 'A5' });
      expect(publicationRes.status).toBe(403);
      expect(await prisma.publicationRequest.count()).toBe(0);
    });

    it('blocks unrelated guardians from legacy vault operations', async () => {
      await createOtherFamily();
      await prisma.legacyVault.create({
        data: {
          seniorId: 'test_senior',
          isVaultSetup: true,
          encryptedMemories: '{"data":"owned"}',
          encryptedAutobiography: '{"data":"book"}',
          serverShare: '{"share":"server"}',
          institutionShare: '{"share":"institution"}',
          deathVerificationStatus: 'released',
          isDeceased: true,
          serverShareReleased: true,
          institutionShareReleased: true,
        },
      });

      const headers = { 'x-user-id': 'other_guardian', 'x-user-role': 'guardian' };
      expect((await request(app).get('/api/legacy/vault').query({ seniorId: 'test_senior' }).set(headers)).status).toBe(403);
      expect((await request(app).post('/api/legacy/vault').set(headers).send({ seniorId: 'test_senior', encryptedMemories: '{}' })).status).toBe(403);
      expect((await request(app).post('/api/legacy/trigger-death').set(headers).send({ seniorId: 'test_senior' })).status).toBe(403);
      expect((await request(app).post('/api/legacy/approve-death').set(headers).send({ seniorId: 'test_senior' })).status).toBe(403);
      expect((await request(app).get('/api/legacy/shares').query({ seniorId: 'test_senior' }).set(headers)).status).toBe(403);
      expect((await request(app).post('/api/legacy/reset').set(headers).send({ seniorId: 'test_senior' })).status).toBe(403);

      const vault = await prisma.legacyVault.findUnique({ where: { seniorId: 'test_senior' } });
      expect(vault?.encryptedMemories).toBe('{"data":"owned"}');
    });
  });
});
