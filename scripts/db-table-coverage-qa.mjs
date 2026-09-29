#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = path.join(rootDir, 'server/data/dearlog.db');
const API_URL = process.env.DB_COVERAGE_API_URL || process.env.PILOT_QA_API_URL || 'http://localhost:8787';

const targetTables = [
  'CoverDesign',
  'InterviewSchedule',
  'InterviewSession',
  'Notification',
  'PushSubscription',
  'free_speech_db',
  'Memory',
  'MemoryTag',
  'MemoryConsentSettings',
  'MemoryVectorEntry',
  'LegacyVault',
  'CalendarEvent',
  'InterviewRecord',
];

function sqlite(sql) {
  return execFileSync('sqlite3', [dbPath, sql], { encoding: 'utf8' }).trim();
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function readCount(tableName) {
  return Number(sqlite(`SELECT count(*) FROM "${tableName}";`) || 0);
}

function readCounts() {
  return Object.fromEntries(targetTables.map((table) => [table, readCount(table)]));
}

async function api(pathname, options = {}) {
  const response = await fetch(`${API_URL}${pathname}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${pathname} failed: ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}

function authHeaders(authToken) {
  return { Authorization: `Bearer ${authToken}` };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertDelta(before, after, tableName, expectedMinimum) {
  const delta = after[tableName] - before[tableName];
  assert(
    delta >= expectedMinimum,
    `${tableName} expected +${expectedMinimum} or more, got ${delta} (${before[tableName]} -> ${after[tableName]})`,
  );
  return delta;
}

async function main() {
  await api('/api/health');

  const runId = `${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
  const digits = String(Date.now()).slice(-8);
  const guardianPhone = `010${digits}`;
  const guardianName = `DBQA자녀_${runId}`;
  const seniorName = `DBQA부모_${runId}`;
  const memoryId = `dbqa_memory_${runId}`;

  const before = readCounts();
  console.log('[before]', before);

  const signup = await api('/api/auth/phone', {
    method: 'POST',
    body: JSON.stringify({
      phoneNumber: guardianPhone,
      name: guardianName,
      isLogin: false,
      birthDate: '1990-01-02',
    }),
  });
  const guardian = signup.user;
  assert(guardian?.id && signup.authToken, 'guardian signup did not return user/authToken');

  const invitationResponse = await api('/api/invitations', {
    method: 'POST',
    headers: authHeaders(signup.authToken),
    body: JSON.stringify({
      seniorName,
      relationship: '부모님',
      recordSpaceName: `${seniorName} 기록공간`,
      birthDate: '1952-03-12',
      hometown: '서울',
      schoolHistory: '국민학교',
      occupation: '교사',
      hasCurrentJob: false,
    }),
  });

  const tokenLogin = await api('/api/auth/token-login', {
    method: 'POST',
    body: JSON.stringify({ token: invitationResponse.invitation.token }),
  });
  const senior = tokenLogin.user;
  assert(senior?.id && tokenLogin.authToken, 'senior token-login did not return user/authToken');
  console.log('[setup]', { guardianId: guardian.id, seniorId: senior.id, runId });

  const guardianAuth = authHeaders(signup.authToken);
  const seniorAuth = authHeaders(tokenLogin.authToken);

  const pushEndpoint = `https://push.example.invalid/dearlog-dbqa/${encodeURIComponent(runId)}`;
  await api('/api/push-subscriptions', {
    method: 'POST',
    headers: guardianAuth,
    body: JSON.stringify({
      userId: guardian.id,
      endpoint: pushEndpoint,
      keys: {
        p256dh: Buffer.from(`p256dh-${runId}`).toString('base64url'),
        auth: Buffer.from(`auth-${runId}`).toString('base64url'),
      },
    }),
  });

  const cover = await api('/api/cover-designs/generate', {
    method: 'POST',
    headers: guardianAuth,
    body: JSON.stringify({ seniorId: senior.id }),
  });
  assert(cover.coverDesign?.id, 'cover design was not created');
  await api(`/api/cover-designs/${cover.coverDesign.id}/confirm`, {
    method: 'PATCH',
    headers: guardianAuth,
  });

  const schedule = await api('/api/interview-schedules', {
    method: 'POST',
    headers: guardianAuth,
    body: JSON.stringify({
      seniorId: senior.id,
      scheduledAt: new Date(Date.now() + 60 * 60_000).toISOString(),
      timezone: 'Asia/Seoul',
    }),
  });
  assert(schedule.schedule?.id, 'interview schedule was not created');

  const callNow = await api(`/api/interview-schedules/${schedule.schedule.id}/call-now`, {
    method: 'POST',
    headers: guardianAuth,
  });
  assert(callNow.session?.id, 'app call did not create interview session');

  await api(`/api/interview-sessions/${callNow.session.id}/accept`, {
    method: 'PATCH',
    headers: seniorAuth,
  });
  await api(`/api/interview-sessions/${callNow.session.id}/end`, {
    method: 'PATCH',
    headers: seniorAuth,
    body: JSON.stringify({ status: 'ended' }),
  });

  await api('/api/nudges', {
    method: 'POST',
    headers: guardianAuth,
    body: JSON.stringify({ seniorId: senior.id }),
  });

  await api('/api/interview-records', {
    method: 'POST',
    headers: seniorAuth,
    body: JSON.stringify({
      chapterId: 'childhood',
      transcriptText: '조용한 오후에 파란 의자 옆에서 숫자를 천천히 세며 오래 쉬었습니다. 바람 소리만 들렸습니다.',
      mode: 'voice',
      source: 'db_table_coverage_qa',
      audioFileKey: 'audio/manual-entry.txt',
      publish: true,
      chatbot: true,
    }),
  });

  await api('/api/memories', {
    method: 'POST',
    headers: guardianAuth,
    body: JSON.stringify({
      seniorId: senior.id,
      id: memoryId,
      date: new Date().toISOString(),
      topic: 'DB 적재 QA 기억',
      originalTranscript: '어린 시절 마당에서 가족과 함께 보낸 오후를 떠올렸습니다.',
      cleanedTranscript: '어린 시절 마당에서 가족과 함께 보낸 오후가 오래 기억에 남아 있습니다.',
      publishVersion: '마당에서 함께 보낸 오후는 가족의 따뜻함을 떠올리게 하는 장면입니다.',
      tags: {
        people: ['가족'],
        places: ['마당'],
        emotions: ['따뜻함'],
        timePeriod: '어린 시절',
      },
      privacy: 'family',
      confidenceLabel: '확인됨',
      contradictions: [],
      consentSettings: {
        출판: 'granted',
        가족열람: 'granted',
        챗봇: 'granted',
        사후공개: 'granted',
        민감정보: 'granted',
      },
      embedding: [0.11, 0.22, 0.33, 0.44],
    }),
  });

  await api('/api/calendar-events', {
    method: 'POST',
    headers: guardianAuth,
    body: JSON.stringify({
      seniorId: senior.id,
      eventType: '생일',
      eventDate: '2026-06-03',
      relatedPersons: ['가족'],
      recipientId: 'family-group',
    }),
  });

  // 금고는 부모님만 연다(서버가 보호자 호출을 거절한다).
  await api('/api/legacy/vault', {
    method: 'POST',
    headers: seniorAuth,
    body: JSON.stringify({
      encryptedMemories: JSON.stringify({ runId, memoryId }),
      encryptedAutobiography: JSON.stringify({ title: 'DB QA 자서전' }),
      serverShare: JSON.stringify({ x: 2, y: `server-${runId}` }),
      institutionShare: JSON.stringify({ x: 3, y: `institution-${runId}` }),
    }),
  });
  await api('/api/legacy/trigger-death', {
    method: 'POST',
    headers: guardianAuth,
    body: JSON.stringify({ seniorId: senior.id }),
  });

  // 사망 신고는 유예(LEGACY_DEATH_REVIEW_HOURS, 기본 72시간)가 지나야 승인된다. 이 QA가
  // 사흘을 기다릴 수는 없고, 서버의 유예를 0으로 낮추면 같은 서버의 실제 가족 보호도 함께
  // 사라진다. 그래서 서버 설정은 그대로 두고, 이번 실행이 만든 QA 부모님의 금고 행에 한해
  // 신고 시각을 유예보다 앞으로 옮긴다. 연결된 보호자가 한 명뿐이라 신고한 보호자가
  // 유예 뒤에 직접 승인할 수 있다(두 명 이상이면 다른 보호자가 승인해야 한다).
  const pending = await api(`/api/legacy/vault?seniorId=${encodeURIComponent(senior.id)}`, {
    headers: guardianAuth,
  });
  assert(
    pending.vault?.deathVerificationStatus === 'pending_verification',
    `death report did not start a review: ${pending.vault?.deathVerificationStatus}`,
  );
  const remainingMs = Number(pending.vault.deathReviewRemainingMs ?? 0);
  if (remainingMs > 0) {
    // Prisma 는 SQLite DateTime 을 epoch 밀리초 정수로 저장한다.
    const triggeredMs = new Date(pending.vault.deathTriggeredAt).getTime();
    assert(Number.isFinite(triggeredMs), `death report has no trigger time: ${pending.vault.deathTriggeredAt}`);
    const backdatedMs = triggeredMs - remainingMs - 60_000;
    sqlite(`UPDATE "LegacyVault" SET deathTriggeredAt = ${backdatedMs} WHERE seniorId = ${sqlString(senior.id)};`);
  }

  await api('/api/legacy/approve-death', {
    method: 'POST',
    headers: guardianAuth,
    body: JSON.stringify({ seniorId: senior.id }),
  });

  const after = readCounts();
  console.log('[after]', after);

  const deltas = {
    CoverDesign: assertDelta(before, after, 'CoverDesign', 1),
    InterviewSchedule: assertDelta(before, after, 'InterviewSchedule', 1),
    InterviewSession: assertDelta(before, after, 'InterviewSession', 1),
    Notification: assertDelta(before, after, 'Notification', 4),
    PushSubscription: assertDelta(before, after, 'PushSubscription', 1),
    free_speech_db: assertDelta(before, after, 'free_speech_db', 1),
    Memory: assertDelta(before, after, 'Memory', 1),
    MemoryTag: assertDelta(before, after, 'MemoryTag', 4),
    MemoryConsentSettings: assertDelta(before, after, 'MemoryConsentSettings', 1),
    MemoryVectorEntry: assertDelta(before, after, 'MemoryVectorEntry', 1),
    LegacyVault: assertDelta(before, after, 'LegacyVault', 1),
    CalendarEvent: assertDelta(before, after, 'CalendarEvent', 1),
    InterviewRecord: assertDelta(before, after, 'InterviewRecord', 1),
  };

  const coverConfirmedAt = sqlite(`SELECT confirmedAt IS NOT NULL FROM "CoverDesign" WHERE id = ${sqlString(cover.coverDesign.id)};`);
  const sessionStatus = sqlite(`SELECT status FROM "InterviewSession" WHERE id = ${sqlString(callNow.session.id)};`);
  const scheduleStatus = sqlite(`SELECT status FROM "InterviewSchedule" WHERE id = ${sqlString(schedule.schedule.id)};`);
  const vaultStatus = sqlite(`SELECT deathVerificationStatus || '|' || serverShareReleased || '|' || institutionShareReleased FROM "LegacyVault" WHERE seniorId = ${sqlString(senior.id)};`);
  const memorySupportRows = sqlite(`
    SELECT
      (SELECT count(*) FROM "MemoryTag" WHERE memoryId = ${sqlString(memoryId)}) || '|' ||
      (SELECT count(*) FROM "MemoryConsentSettings" WHERE memoryId = ${sqlString(memoryId)}) || '|' ||
      (SELECT count(*) FROM "MemoryVectorEntry" WHERE memoryId = ${sqlString(memoryId)});
  `);

  assert(coverConfirmedAt === '1', 'cover design was not confirmed');
  assert(sessionStatus === 'ended', `interview session status should be ended, got ${sessionStatus}`);
  assert(['app_call_ready', 'app_call_sent'].includes(scheduleStatus), `unexpected schedule status: ${scheduleStatus}`);
  assert(vaultStatus === 'released|1|1', `legacy vault was not released correctly: ${vaultStatus}`);
  assert(memorySupportRows === '4|1|1', `memory support rows mismatch: ${memorySupportRows}`);

  console.log('[verified]', {
    deltas,
    coverConfirmedAt: true,
    sessionStatus,
    scheduleStatus,
    vaultStatus,
    memorySupportRows,
  });
  console.log('DB table coverage QA finished successfully.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
