// @vitest-environment node
import os from 'node:os';
import path from 'node:path';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './app';

let prisma: typeof import('./db').prisma;
let initLocalDatabase: typeof import('./prisma/init').initLocalDatabase;
let app: any;

beforeAll(async () => {
  process.env.DATABASE_URL = `file:${path.join(os.tmpdir(), `dearlog-legacy-${Date.now()}.db`)}`;
  process.env.OPENAI_API_KEY = '';
  process.env.TWILIO_ACCOUNT_SID = '';
  process.env.TWILIO_AUTH_TOKEN = '';
  process.env.TWILIO_FROM_NUMBER = '';

  ({ prisma } = await import('./db'));
  ({ initLocalDatabase } = await import('./prisma/init'));
  await initLocalDatabase();
  app = createApp();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.notification.deleteMany();
  await prisma.interviewRecord.deleteMany();
  await prisma.guardianSeniorLink.deleteMany();
  await prisma.legacyVault.deleteMany();
  await prisma.user.deleteMany();

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

    // Check notification
    const notification = await prisma.notification.findFirst({
      where: { userId: 'test_guardian', type: 'legacy_death_triggered' }
    });
    expect(notification).toBeTruthy();
    expect(notification?.relatedUserId).toBe('test_senior');
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
        isDeceased: true
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
});
