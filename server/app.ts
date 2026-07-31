import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import {
  getFactChatClient,
  getOpenAIClient,
  normalizeFactChatChatCompletionInput,
} from './ai-clients';
import { attachLocalUser, assertGuardianCanAccessSenior, issueAuthToken, requireRole } from './auth';
import { sendAppInterviewCall } from './app-call';
import { config } from './config';
import { prisma } from './db';
import { buildCoverDecisionCandidates, decideCoverDesign } from './domain/cover-agent';
import { isFreeSpeech } from './domain/free-speech';
import { analyzePhotoAndCreateQuestions } from './domain/photo-agent';
import {
  generateLocalPrintPdf,
  getLocalPublicationPreviewJob,
  resetRunningPublicationPreviewJobs,
  startLocalPublicationPreviewJob,
} from './publication';
import { sendWebPush } from './push';
import { audioUpload, isAllowedPhotoMimeType, photoUpload, resolveLocalFileKey } from './storage';

function normalizePhoneNumber(value: unknown) {
  return String(value ?? '').replace(/[^\d]/g, '');
}

function normalizeBirthDate(value: unknown) {
  const birthDate = String(value ?? '').trim();
  if (!birthDate) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return undefined;
  return birthDate;
}

function normalizeOptionalImageUrl(value: unknown) {
  const imageUrl = String(value ?? '').trim();
  if (!imageUrl) return null;
  if (imageUrl.length > 2_500_000) return undefined;
  if (/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(imageUrl)) return imageUrl;
  try {
    const parsed = new URL(imageUrl);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return imageUrl;
  } catch {
    return undefined;
  }
  return undefined;
}

function normalizeOptionalText(value: unknown, maxLength = 80) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (text.length > maxLength) return undefined;
  return text;
}

function normalizeToneProfile(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const name = normalizeOptionalText(record.name, 40);
  if (!name) return null;
  const patterns = Array.isArray(record.patterns)
    ? record.patterns
      .map((pattern) => normalizeOptionalText(pattern, 80))
      .filter((pattern): pattern is string => Boolean(pattern))
      .slice(0, 8)
    : [];
  return { name, patterns };
}

function normalizeToneProfileFromQuery(query: express.Request['query']) {
  const name = normalizeOptionalText(query.toneName, 40);
  if (!name) return null;
  const rawPatterns = Array.isArray(query.tonePattern)
    ? query.tonePattern
    : query.tonePattern
      ? [query.tonePattern]
      : [];
  const patterns = rawPatterns
    .map((pattern) => normalizeOptionalText(pattern, 80))
    .filter((pattern): pattern is string => Boolean(pattern))
    .slice(0, 8);
  return { name, patterns };
}

function normalizeOptionalBoolean(value: unknown) {
  if (value === undefined) return null;
  if (value === null || value === '') return null;
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function serializeUser(user: {
  id: string;
  name: string;
  phoneNumber: string | null;
  role: string;
  birthDate?: string | null;
  birthDecade?: string | null;
  preferredName?: string | null;
  seniorName?: string | null;
  seniorBirthDecade?: string | null;
  seniorPreferredName?: string | null;
  guardianName?: string | null;
  guardianRelationship?: string | null;
  guardianPreferredName?: string | null;
  profileImageUrl?: string | null;
  recordSpaceName?: string | null;
  recordSpaceCoverUrl?: string | null;
  hasCurrentJob?: boolean | null;
  occupation?: string | null;
  hometown?: string | null;
  schoolHistory?: string | null;
}) {
  return {
    id: user.id,
    name: user.name,
    phoneNumber: user.phoneNumber,
    role: user.role,
    birthDate: user.birthDate ?? null,
    birthDecade: user.birthDecade ?? null,
    preferredName: user.preferredName ?? null,
    seniorName: user.seniorName ?? user.name ?? null,
    seniorBirthDecade: user.seniorBirthDecade ?? user.birthDecade ?? null,
    seniorPreferredName: user.seniorPreferredName ?? user.preferredName ?? null,
    guardianName: user.guardianName ?? null,
    guardianRelationship: user.guardianRelationship ?? null,
    guardianPreferredName: user.guardianPreferredName ?? null,
    profileImageUrl: user.profileImageUrl ?? null,
    recordSpaceName: user.recordSpaceName ?? null,
    recordSpaceCoverUrl: user.recordSpaceCoverUrl ?? null,
    hasCurrentJob: user.hasCurrentJob ?? null,
    occupation: user.occupation ?? null,
    hometown: user.hometown ?? null,
    schoolHistory: user.schoolHistory ?? null,
  };
}

function authRoleForUser(user: { role: string }) {
  return user.role === 'senior' ? 'senior' : 'guardian';
}

function serializeAuthResponse(user: Parameters<typeof serializeUser>[0]) {
  return {
    user: serializeUser(user),
    authToken: issueAuthToken({ id: user.id, role: authRoleForUser(user) }),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

function boundedInvitationTtlDays() {
  return Math.max(1, boundedPositiveInt(Number(process.env.INVITATION_TTL_DAYS ?? config.invitation.ttlDays), 14, 365));
}

function createInvitationExpiry(now = new Date()) {
  return new Date(now.getTime() + boundedInvitationTtlDays() * DAY_MS);
}

function getInvitationStatus(invitation: {
  expiresAt?: Date | null;
  revokedAt?: Date | null;
  usedAt?: Date | null;
}, now = new Date()) {
  if (invitation.revokedAt) return 'revoked';
  if (invitation.expiresAt && invitation.expiresAt.getTime() <= now.getTime()) return 'expired';
  if (invitation.usedAt) return 'used';
  return 'active';
}

function serializeInvitation(invitation: {
  id: string;
  token: string;
  guardianId: string;
  seniorId: string;
  expiresAt?: Date | null;
  revokedAt?: Date | null;
  usedAt?: Date | null;
  createdAt: Date;
  updatedAt?: Date | null;
}, options: { includeInactiveToken?: boolean } = {}) {
  const status = getInvitationStatus(invitation);
  return {
    id: invitation.id,
    token: status === 'active' || options.includeInactiveToken ? invitation.token : null,
    guardianId: invitation.guardianId,
    seniorId: invitation.seniorId,
    status,
    expiresAt: invitation.expiresAt ?? null,
    revokedAt: invitation.revokedAt ?? null,
    usedAt: invitation.usedAt ?? null,
    createdAt: invitation.createdAt,
    updatedAt: invitation.updatedAt ?? invitation.createdAt,
  };
}

type LocalFileKind = 'audio' | 'photos' | 'pdfs';
type LocalFileAccess = {
  kind: LocalFileKind;
  seniorId: string;
  fileName?: string | null;
  mimeType?: string | null;
};

function fileAccessTokenTtlSeconds() {
  return Math.max(60, boundedPositiveInt(Number(process.env.FILE_ACCESS_TOKEN_TTL_SECONDS ?? config.fileAccess.tokenTtlSeconds), 10 * 60, 60 * 60));
}

function fileAccessSecret() {
  if (config.auth.tokenSecret) return config.auth.tokenSecret;
  throw httpError('AUTH_TOKEN_SECRET이 설정되지 않았습니다.', 503);
}

function parseLocalFileKey(fileKey: string): { kind: LocalFileKind; fileName: string } {
  const [kind, ...parts] = fileKey.split('/');
  if ((kind !== 'audio' && kind !== 'photos' && kind !== 'pdfs') || parts.length === 0) {
    throw httpError('파일을 찾을 수 없습니다.', 404);
  }
  return { kind, fileName: path.basename(parts.join('/')) };
}

function signLocalFileAccessToken(fileKey: string, ownerId?: string) {
  const payload = Buffer.from(JSON.stringify({
    fileKey,
    // 아직 DB 레코드가 없는 갓 업로드된 파일은 소유자를 토큰에 담아 확인합니다.
    ...(ownerId ? { own: ownerId } : {}),
    exp: Math.floor(Date.now() / 1000) + fileAccessTokenTtlSeconds(),
  })).toString('base64url');
  const signature = crypto
    .createHmac('sha256', fileAccessSecret())
    .update(payload)
    .digest('base64url');
  return `${payload}.${signature}`;
}

function verifyLocalFileAccessToken(token: unknown, fileKey: string) {
  if (typeof token !== 'string') return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;

  const expectedSignature = crypto
    .createHmac('sha256', fileAccessSecret())
    .update(payload)
    .digest('base64url');
  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return false;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { fileKey?: unknown; exp?: unknown };
    return parsed.fileKey === fileKey
      && typeof parsed.exp === 'number'
      && parsed.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

// 업로드 직후 파일은 아직 InterviewRecord/FreeSpeechRecord가 없어 DB로 소유권을 확인할 수 없습니다.
// 업로드 응답에 담아 준 토큰의 소유자와 요청자가 같은지로 대신 확인합니다.
function verifyLocalFileUploadToken(token: unknown, fileKey: string, userId: string) {
  if (!verifyLocalFileAccessToken(token, fileKey)) return false;
  try {
    const payload = String(token).split('.')[0];
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { own?: unknown };
    return parsed.own === userId;
  } catch {
    return false;
  }
}

function buildLocalFileUrl(fileKey: string) {
  const encodedKey = fileKey.split('/').map(encodeURIComponent).join('/');
  const token = encodeURIComponent(signLocalFileAccessToken(fileKey));
  return `/api/files/${encodedKey}?token=${token}`;
}

function isPlayableAudioFileKey(fileKey: unknown): fileKey is string {
  return typeof fileKey === 'string'
    && /^audio\/[^/]+\.(webm|mp3|m4a|wav|ogg|aac)$/i.test(fileKey.trim());
}

async function buildPlayableAudioUrl(fileKey: unknown) {
  if (!isPlayableAudioFileKey(fileKey)) return null;
  const normalizedFileKey = fileKey.trim();
  try {
    await fs.access(resolveLocalFileKey(normalizedFileKey));
    return buildLocalFileUrl(normalizedFileKey);
  } catch {
    return null;
  }
}

function serializeNotification(notification: {
  id: string;
  type: string;
  title: string;
  body: string;
  status: string;
  createdAt: Date;
  readAt: Date | null;
  metadataJson?: string | null;
}) {
  let metadata: Record<string, unknown> = {};
  try {
    metadata = notification.metadataJson ? JSON.parse(notification.metadataJson) : {};
  } catch {
    metadata = {};
  }
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    status: notification.status,
    createdAt: notification.createdAt,
    readAt: notification.readAt,
    metadata,
  };
}

const MEMORY_CONSENT_STATUS_VALUES = new Set(['granted', 'revoked', 'needs_review']);
const MEMORY_CONSENT_KEYS = ['출판', '가족열람', '챗봇', '사후공개', '민감정보'] as const;
type MemoryConsentKey = typeof MEMORY_CONSENT_KEYS[number];
type MemoryConsentSettingsInput = Partial<Record<MemoryConsentKey, string>>;

function validateMemoryConsentSettings(value: unknown): MemoryConsentSettingsInput | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw httpError('기억 동의 설정은 객체여야 합니다.', 400);
  }

  const input = value as Record<string, unknown>;
  const unknownKeys = Object.keys(input).filter(
    (key) => !MEMORY_CONSENT_KEYS.includes(key as MemoryConsentKey)
  );
  if (unknownKeys.length > 0) {
    throw httpError(`지원하지 않는 기억 동의 목적입니다: ${unknownKeys.join(', ')}`, 400);
  }

  return MEMORY_CONSENT_KEYS.reduce<MemoryConsentSettingsInput>((settings, key) => {
    const status = input[key];
    if (status === undefined) return settings;
    if (typeof status !== 'string' || !MEMORY_CONSENT_STATUS_VALUES.has(status)) {
      throw httpError(`${key} 동의 상태가 올바르지 않습니다.`, 400);
    }
    settings[key] = status;
    return settings;
  }, {});
}

function mapMemoryToResponse(m: any) {
  const people = (m.tags || []).filter((t: any) => t.category === 'people').map((t: any) => t.value);
  const places = (m.tags || []).filter((t: any) => t.category === 'places').map((t: any) => t.value);
  const emotions = (m.tags || []).filter((t: any) => t.category === 'emotions').map((t: any) => t.value);
  const timePeriodTag = (m.tags || []).find((t: any) => t.category === 'timePeriod');
  const timePeriod = timePeriodTag ? timePeriodTag.value : '';

  let contradictions: string[] = [];
  try {
    if (m.contradictions) {
      contradictions = JSON.parse(m.contradictions);
    }
  } catch (e) {
    // ignore
  }

  const consentSettings = m.consentSettings ? {
    출판: m.consentSettings.publish,
    가족열람: m.consentSettings.familyRead,
    챗봇: m.consentSettings.chatbot,
    사후공개: m.consentSettings.posthumous,
    민감정보: m.consentSettings.sensitive
  } : {
    출판: 'granted',
    가족열람: 'granted',
    챗봇: 'granted',
    사후공개: 'granted',
    민감정보: 'granted'
  };

  const consent = {
    status: (consentSettings.가족열람 === 'granted' && m.privacy !== 'private') ? 'granted' : 'revoked',
    accessTier: m.privacy === 'public' ? '전체 가족' : (m.privacy === 'family' ? '지정 가족' : '본인만'),
    designatedFamilyIds: [],
    lastModified: m.date ? new Date(m.date).toISOString() : new Date().toISOString()
  };

  let embedding: number[] | null = null;
  if (m.vectorEntry && m.vectorEntry.embeddingJson) {
    try {
      embedding = JSON.parse(m.vectorEntry.embeddingJson);
    } catch (e) {
      // ignore
    }
  }

  return {
    id: m.id,
    date: m.date ? new Date(m.date).toISOString() : new Date().toISOString(),
    topic: m.topic,
    originalTranscript: m.originalTranscript,
    cleanedTranscript: m.cleanedTranscript,
    publishVersion: m.publishVersion,
    privacy: m.privacy,
    confidenceLabel: m.confidenceLabel,
    contradictions,
    tags: {
      people,
      places,
      emotions,
      timePeriod
    },
    consent,
    consentSettings,
    embedding
  };
}

function mapPhotoToResponse(p: any) {
  let analysis: any = null;
  if (p.analysisJson) {
    try {
      analysis = JSON.parse(p.analysisJson);
    } catch (e) {
      // ignore
    }
  }
  let metadata = {};
  if (p.metadataJson) {
    try {
      metadata = JSON.parse(p.metadataJson);
    } catch (e) {
      // ignore
    }
  }
  let linkedMemoryIds: string[] = [];
  if (p.linkedMemoryIds) {
    try {
      linkedMemoryIds = JSON.parse(p.linkedMemoryIds);
    } catch (e) {
      // ignore
    }
  }

  const suggestedQuestions = Array.isArray(analysis?.questions)
    ? analysis.questions.filter((q: unknown): q is string => typeof q === 'string' && q.trim().length > 0)
    : [];
  let registeredQuestions: string[] = [];
  if (p.questions) {
    registeredQuestions = p.questions
      .map((q: any) => q.text)
      .filter((q: unknown): q is string => typeof q === 'string' && q.trim().length > 0);
  }
  const generatedQuestions = Array.from(new Set([...suggestedQuestions, ...registeredQuestions]));

  return {
    id: p.id,
    url: buildLocalFileUrl(p.fileKey),
    uploadedAt: p.uploadedAt ? p.uploadedAt.toISOString() : new Date().toISOString(),
    analysis,
    metadata,
    linkedMemoryIds,
    fileKey: p.fileKey,
    fileName: p.fileName,
    mimeType: p.mimeType,
    metadataJson: p.metadataJson,
    analysisJson: p.analysisJson,
    generatedQuestions,
    registeredQuestions
  };
}

function mapQuestionToResponse(q: any) {
  const photoUrl = q.photo?.fileKey ? buildLocalFileUrl(q.photo.fileKey) : null;
  return {
    id: q.id,
    seniorId: q.seniorId ?? null,
    questionText: q.text,
    text: q.text,
    category: q.category,
    chapterId: q.chapterId ?? null,
    photoId: q.photoId ?? null,
    photoUrl,
    submittedBy: q.createdById || '',
    anonymous: q.anonymous,
    priority: q.priority,
    status: q.status,
    createdAt: q.createdAt ? q.createdAt.toISOString() : new Date().toISOString(),
    answeredAt: q.answeredAt ? q.answeredAt.toISOString() : null,
    answerMemoryId: q.answerMemoryId
  };
}

function mapAutobiographyDraftToResponse(d: any) {
  let currentStructure = null;
  if (d.structureJson) {
    try {
      currentStructure = JSON.parse(d.structureJson);
    } catch (e) {
      // ignore
    }
  }
  let narratives = [];
  if (d.narrativesJson) {
    try {
      narratives = JSON.parse(d.narrativesJson);
    } catch (e) {
      // ignore
    }
  }

  return {
    currentStructure,
    narratives,
    lastGenerated: d.lastGenerated ? d.lastGenerated.toISOString() : null
  };
}

async function resolveGuardianSeniorId(guardianId: string, requestedSeniorId?: string) {
  if (requestedSeniorId) {
    await assertGuardianCanAccessSenior(guardianId, requestedSeniorId);
    return requestedSeniorId;
  }

  const existingLink = await prisma.guardianSeniorLink.findFirst({
    where: { guardianId },
    orderBy: { createdAt: 'desc' },
  });
  if (existingLink) return existingLink.seniorId;

  // 링크가 없으면 자기 계정만 기록 공간으로 연결합니다.
  // 예전에는 DB에서 가장 최근 시니어를 찾아 자동 연결했지만, 그 경로로 아무 보호자나
  // 남의 가족 기록에 접근하고 초대 토큰까지 발급받을 수 있었기 때문에 제거했습니다.
  // 다른 가족의 시니어는 반드시 초대 플로우를 통해서만 연결됩니다.
  const selfUser = await prisma.user.findUnique({ where: { id: guardianId } });
  if (selfUser) {
    await prisma.guardianSeniorLink.upsert({
      where: { guardianId_seniorId: { guardianId, seniorId: selfUser.id } },
      update: {},
      create: { guardianId, seniorId: selfUser.id },
    });
    return selfUser.id;
  }

  throw httpError('연결된 기록 공간이 없습니다. 초대를 통해 부모님과 연결해 주세요.', 404);
}

async function ensureSelfGuardianSeniorLink(userId: string) {
  // 넷플릭스 프로필처럼 하나의 번호 계정으로 보호자/시니어를 모두 쓸 수 있게 자기 자신을 연결해 둡니다.
  await prisma.guardianSeniorLink.upsert({
    where: { guardianId_seniorId: { guardianId: userId, seniorId: userId } },
    update: {},
    create: { guardianId: userId, seniorId: userId },
  });
}

type RequestUser = NonNullable<express.Request['user']>;
type AiProxyEndpoint = 'chat_completions' | 'embeddings' | 'speech';
type AiProxyOutcome = 'success' | 'invalid_request' | 'rate_limited' | 'config_error' | 'provider_error';
type AiProxyRateBucket = {
  windowStartedAt: number;
  requests: number;
  units: number;
};
type AiProxyDashboardAlert = {
  type: 'error_rate' | 'rate_limited' | 'config_error' | 'provider_error';
  severity: 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
};
type AiProxyAlertRoutingResult = {
  enabled: boolean;
  alerts: AiProxyDashboardAlert[];
  recipients: string[];
  notified: number;
  skipped: string[];
};

let lastAiProxyAuditPruneAt = 0;

function httpError(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode });
}

function pickOpenAIOptions(body: Record<string, unknown>, allowedKeys: string[]) {
  return allowedKeys.reduce<Record<string, unknown>>((picked, key) => {
    if (body[key] !== undefined) picked[key] = body[key];
    return picked;
  }, {});
}

function positiveInt(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function boundedPositiveInt(value: unknown, fallback: number, max: number) {
  const parsed = positiveInt(Number(value), fallback);
  return Math.min(parsed, max);
}

function aiProxyAuditRetentionDays() {
  return positiveInt(Number(process.env.AI_PROXY_AUDIT_RETENTION_DAYS ?? config.aiProxy.auditRetentionDays), 30);
}

function aiProxyAlertErrorRatePercent() {
  return positiveInt(Number(process.env.AI_PROXY_ALERT_ERROR_RATE_PERCENT ?? config.aiProxy.alertErrorRatePercent), 25);
}

function aiProxyAlertRateLimitedCount() {
  return positiveInt(Number(process.env.AI_PROXY_ALERT_RATE_LIMITED_COUNT ?? config.aiProxy.alertRateLimitedCount), 10);
}

function aiProxyAlertMinRequests() {
  return positiveInt(Number(process.env.AI_PROXY_ALERT_MIN_REQUESTS ?? config.aiProxy.alertMinRequests), 5);
}

function aiProxyAlertWindowMinutes() {
  return boundedPositiveInt(process.env.AI_PROXY_ALERT_WINDOW_MINUTES ?? config.aiProxy.alertWindowMinutes, 60, 24 * 60);
}

function aiProxyAlertNotificationsEnabled() {
  if (process.env.AI_PROXY_ALERT_NOTIFICATIONS_ENABLED === 'true') return true;
  if (process.env.AI_PROXY_ALERT_NOTIFICATIONS_ENABLED === 'false') return false;
  return config.aiProxy.alertNotificationsEnabled;
}

function aiProxyAlertNotificationCooldownMinutes() {
  return boundedPositiveInt(
    process.env.AI_PROXY_ALERT_NOTIFICATION_COOLDOWN_MINUTES ?? config.aiProxy.alertNotificationCooldownMinutes,
    30,
    24 * 60
  );
}

function aiProxyAlertNotificationUserIds() {
  const raw = process.env.AI_PROXY_ALERT_NOTIFICATION_USER_IDS ?? config.aiProxy.alertNotificationUserIds;
  return Array.from(new Set(
    raw
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
  ));
}

function aiProxyAlertRunbookUrl() {
  return process.env.AI_PROXY_ALERT_RUNBOOK_URL ?? config.aiProxy.alertRunbookUrl;
}

function aiProxyDashboardEnabled() {
  if (process.env.AI_PROXY_DASHBOARD_ENABLED === 'true') return true;
  if (process.env.AI_PROXY_DASHBOARD_ENABLED === 'false') return false;
  return config.aiProxy.dashboardEnabled;
}

function aiProxyDashboardToken() {
  return process.env.AI_PROXY_DASHBOARD_TOKEN ?? config.aiProxy.dashboardToken;
}

function estimateAiProxyUnits(endpoint: AiProxyEndpoint, body: Record<string, unknown>) {
  if (endpoint === 'chat_completions') {
    const messageChars = Array.isArray(body.messages)
      ? body.messages.reduce((total, message) => total + JSON.stringify(message).length, 0)
      : 0;
    const outputLimit = Number(body.max_completion_tokens ?? body.max_tokens);
    const requestedOutput = Number.isFinite(outputLimit) ? outputLimit * 4 : 0;
    return Math.ceil((messageChars + requestedOutput) / 4);
  }

  if (endpoint === 'speech') {
    const input = typeof body.input === 'string'
      ? body.input
      : typeof body.text === 'string'
        ? body.text
        : '';
    return Math.ceil(input.length / 4);
  }

  const input = body.input;
  const inputChars = typeof input === 'string'
    ? input.length
    : Array.isArray(input)
      ? input.reduce((total, item) => total + (typeof item === 'string' ? item.length : 0), 0)
      : 0;
  return Math.ceil(inputChars / 4);
}

// 로그인 시도 제한. 전화번호와 이름만 맞으면 30일 토큰이 나오므로, 최소한 대입 속도는 늦춘다.
// 프로세스 메모리 기반이라 재시작하면 초기화되고 다중 인스턴스에서 공유되지 않는다.
// ponytail: 단일 인스턴스 가정. 인스턴스를 늘리면 공유 저장소(예: Redis)로 옮긴다.
const authAttemptBuckets = new Map<string, { windowStartedAt: number; attempts: number }>();

function checkAuthAttemptLimit(key: string, limit: number) {
  const now = Date.now();
  const windowMs = positiveInt(Number(process.env.AUTH_ATTEMPT_WINDOW_MS ?? 600_000), 600_000);

  let bucket = authAttemptBuckets.get(key);
  if (!bucket || now - bucket.windowStartedAt >= windowMs) {
    bucket = { windowStartedAt: now, attempts: 0 };
    authAttemptBuckets.set(key, bucket);
  }

  // 버킷이 무한정 쌓이지 않도록 만료된 항목을 함께 정리한다.
  if (authAttemptBuckets.size > 5000) {
    for (const [k, v] of authAttemptBuckets) {
      if (now - v.windowStartedAt >= windowMs) authAttemptBuckets.delete(k);
    }
  }

  bucket.attempts += 1;
  const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - bucket.windowStartedAt)) / 1000));
  return { allowed: bucket.attempts <= limit, retryAfterSeconds };
}

function checkAiProxyRateLimit(
  buckets: Map<string, AiProxyRateBucket>,
  user: RequestUser,
  endpoint: AiProxyEndpoint,
  units: number
) {
  const now = Date.now();
  const windowMs = 60_000;
  const requestLimit = positiveInt(Number(process.env.AI_PROXY_RATE_LIMIT_PER_MINUTE ?? config.aiProxy.requestLimitPerMinute), 60);
  const unitLimit = positiveInt(Number(process.env.AI_PROXY_UNIT_LIMIT_PER_MINUTE ?? config.aiProxy.unitLimitPerMinute), 200000);
  const key = `${user.id}:${endpoint}`;
  let bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStartedAt >= windowMs) {
    bucket = { windowStartedAt: now, requests: 0, units: 0 };
    buckets.set(key, bucket);
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - bucket.windowStartedAt)) / 1000));
  if (bucket.requests + 1 > requestLimit || bucket.units + units > unitLimit) {
    return { allowed: false, retryAfterSeconds };
  }

  bucket.requests += 1;
  bucket.units += units;
  return { allowed: true, retryAfterSeconds: 0 };
}

function aiProviderTelemetry(error: unknown) {
  const source = error as {
    status?: unknown;
    code?: unknown;
    type?: unknown;
    message?: unknown;
    statusCode?: unknown;
  };
  const providerStatus = typeof source?.status === 'number'
    ? source.status
    : typeof source?.statusCode === 'number'
      ? source.statusCode
      : undefined;
  const providerCode = typeof source?.code === 'string'
    ? source.code
    : typeof source?.type === 'string'
      ? source.type
      : undefined;
  const message = error instanceof Error
    ? error.message
    : typeof source?.message === 'string'
      ? source.message
      : 'AI provider request failed';

  return {
    providerStatus,
    providerCode,
    message: message.slice(0, 500),
  };
}

const INTERVIEW_TTS_VOICES = new Set([
  'alloy',
  'ash',
  'ballad',
  'coral',
  'echo',
  'fable',
  'nova',
  'onyx',
  'sage',
  'shimmer',
  'verse',
  'marin',
  'cedar',
]);
const INTERVIEW_TTS_FORMATS = new Set(['mp3', 'wav', 'opus', 'aac']);
const DEFAULT_INTERVIEW_TTS_INSTRUCTIONS = [
  'Speak Korean like a warm human interviewer calling an older parent.',
  'Use a gentle, unhurried pace with natural pauses and soft intonation.',
  'Sound caring and conversational, not like an announcement, navigation system, or customer-service bot.',
].join(' ');

async function recordAiProxyAuditLog(input: {
  user: RequestUser;
  endpoint: AiProxyEndpoint;
  model?: string;
  outcome: AiProxyOutcome;
  statusCode: number;
  estimatedUnits: number;
  latencyMs: number;
  providerStatus?: number;
  providerCode?: string;
  errorMessage?: string;
}) {
  try {
    await prisma.aiProxyAuditLog.create({
      data: {
        userId: input.user.id,
        role: input.user.role,
        endpoint: input.endpoint,
        model: input.model,
        outcome: input.outcome,
        statusCode: input.statusCode,
        estimatedUnits: input.estimatedUnits,
        latencyMs: input.latencyMs,
        providerStatus: input.providerStatus,
        providerCode: input.providerCode,
        errorMessage: input.errorMessage?.slice(0, 500),
      },
    });
    await maybePruneAiProxyAuditLogs();
    if (input.outcome === 'rate_limited' || input.outcome === 'config_error' || input.outcome === 'provider_error') {
      await routeAiProxyAlertNotifications().catch((error) => {
        console.warn('AI proxy alert notification routing failed:', error);
      });
    }
  } catch (error) {
    console.warn('AI proxy audit logging failed:', error);
  }
}

async function pruneAiProxyAuditLogs(now = new Date()) {
  const retentionDays = aiProxyAuditRetentionDays();
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const result = await prisma.aiProxyAuditLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return { retentionDays, cutoff, deletedOldLogs: result.count };
}

async function maybePruneAiProxyAuditLogs() {
  const now = Date.now();
  if (now - lastAiProxyAuditPruneAt < 60 * 60 * 1000) return;
  lastAiProxyAuditPruneAt = now;
  try {
    await pruneAiProxyAuditLogs(new Date(now));
  } catch (error) {
    console.warn('AI proxy audit retention cleanup failed:', error);
  }
}

function assertAiProxyDashboardAccess(req: express.Request) {
  if (!aiProxyDashboardEnabled()) {
    throw httpError('AI 프록시 대시보드가 비활성화되어 있습니다.', 404);
  }
  const expectedToken = aiProxyDashboardToken();
  if (!expectedToken) return;

  const providedToken = req.header('x-ai-proxy-dashboard-token') ?? '';
  const provided = Buffer.from(providedToken);
  const expected = Buffer.from(expectedToken);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    throw httpError('AI 프록시 대시보드 접근 권한이 없습니다.', 403);
  }
}

function summarizeAiProxyAuditLogs(logs: Array<{
  id: string;
  userId: string;
  role: string;
  endpoint: string;
  model: string | null;
  outcome: string;
  statusCode: number;
  estimatedUnits: number;
  latencyMs: number;
  providerStatus: number | null;
  providerCode: string | null;
  errorMessage: string | null;
  createdAt: Date;
}>) {
  const totals = {
    requests: logs.length,
    success: 0,
    invalidRequest: 0,
    rateLimited: 0,
    configError: 0,
    providerError: 0,
    estimatedUnits: 0,
    avgLatencyMs: 0,
    errorRatePercent: 0,
  };
  let totalLatencyMs = 0;
  const byEndpoint = new Map<string, {
    endpoint: string;
    requests: number;
    success: number;
    errors: number;
    rateLimited: number;
    estimatedUnits: number;
    avgLatencyMs: number;
    totalLatencyMs: number;
  }>();
  const byUser = new Map<string, {
    userId: string;
    role: string;
    requests: number;
    estimatedUnits: number;
    errors: number;
    rateLimited: number;
    lastSeenAt: Date;
  }>();

  for (const log of logs) {
    totals.estimatedUnits += log.estimatedUnits;
    totalLatencyMs += log.latencyMs;
    if (log.outcome === 'success') totals.success += 1;
    if (log.outcome === 'invalid_request') totals.invalidRequest += 1;
    if (log.outcome === 'rate_limited') totals.rateLimited += 1;
    if (log.outcome === 'config_error') totals.configError += 1;
    if (log.outcome === 'provider_error') totals.providerError += 1;

    const endpoint = byEndpoint.get(log.endpoint) ?? {
      endpoint: log.endpoint,
      requests: 0,
      success: 0,
      errors: 0,
      rateLimited: 0,
      estimatedUnits: 0,
      avgLatencyMs: 0,
      totalLatencyMs: 0,
    };
    endpoint.requests += 1;
    endpoint.estimatedUnits += log.estimatedUnits;
    endpoint.totalLatencyMs += log.latencyMs;
    if (log.outcome === 'success') endpoint.success += 1;
    if (log.outcome === 'rate_limited') endpoint.rateLimited += 1;
    if (log.outcome === 'config_error' || log.outcome === 'provider_error') endpoint.errors += 1;
    byEndpoint.set(log.endpoint, endpoint);

    const user = byUser.get(log.userId) ?? {
      userId: log.userId,
      role: log.role,
      requests: 0,
      estimatedUnits: 0,
      errors: 0,
      rateLimited: 0,
      lastSeenAt: log.createdAt,
    };
    user.requests += 1;
    user.estimatedUnits += log.estimatedUnits;
    if (log.outcome === 'rate_limited') user.rateLimited += 1;
    if (log.outcome === 'config_error' || log.outcome === 'provider_error') user.errors += 1;
    if (log.createdAt > user.lastSeenAt) user.lastSeenAt = log.createdAt;
    byUser.set(log.userId, user);
  }

  const errorCount = totals.configError + totals.providerError;
  totals.avgLatencyMs = totals.requests ? Math.round(totalLatencyMs / totals.requests) : 0;
  totals.errorRatePercent = totals.requests ? Math.round((errorCount / totals.requests) * 1000) / 10 : 0;

  const endpointRows = Array.from(byEndpoint.values()).map((row) => ({
    endpoint: row.endpoint,
    requests: row.requests,
    success: row.success,
    errors: row.errors,
    rateLimited: row.rateLimited,
    estimatedUnits: row.estimatedUnits,
    avgLatencyMs: row.requests ? Math.round(row.totalLatencyMs / row.requests) : 0,
  })).sort((a, b) => b.requests - a.requests);

  const userRows = Array.from(byUser.values())
    .sort((a, b) => b.estimatedUnits - a.estimatedUnits || b.requests - a.requests)
    .map((row) => ({
      ...row,
      lastSeenAt: row.lastSeenAt.toISOString(),
    }));

  const recentErrors = logs
    .filter((log) => log.outcome === 'rate_limited' || log.outcome === 'config_error' || log.outcome === 'provider_error')
    .slice(0, 10)
    .map((log) => ({
      id: log.id,
      createdAt: log.createdAt.toISOString(),
      userId: log.userId,
      endpoint: log.endpoint,
      outcome: log.outcome,
      statusCode: log.statusCode,
      providerStatus: log.providerStatus,
      providerCode: log.providerCode,
      errorMessage: log.errorMessage,
    }));

  return { totals, byEndpoint: endpointRows, byUser: userRows, recentErrors };
}

function buildAiProxyDashboardAlerts(summary: ReturnType<typeof summarizeAiProxyAuditLogs>) {
  const alerts: AiProxyDashboardAlert[] = [];
  const errorRateThreshold = aiProxyAlertErrorRatePercent();
  const minRequests = aiProxyAlertMinRequests();
  const rateLimitedThreshold = aiProxyAlertRateLimitedCount();

  if (summary.totals.requests >= minRequests && summary.totals.errorRatePercent >= errorRateThreshold) {
    alerts.push({
      type: 'error_rate',
      severity: 'critical',
      message: `AI provider/config error rate is ${summary.totals.errorRatePercent}% in the selected window.`,
      value: summary.totals.errorRatePercent,
      threshold: errorRateThreshold,
    });
  }
  if (summary.totals.rateLimited >= rateLimitedThreshold) {
    alerts.push({
      type: 'rate_limited',
      severity: 'warning',
      message: `AI proxy rate-limited ${summary.totals.rateLimited} requests in the selected window.`,
      value: summary.totals.rateLimited,
      threshold: rateLimitedThreshold,
    });
  }
  if (summary.totals.configError > 0) {
    alerts.push({
      type: 'config_error',
      severity: 'critical',
      message: 'AI proxy configuration errors were recorded.',
      value: summary.totals.configError,
      threshold: 0,
    });
  }
  if (summary.totals.providerError > 0) {
    alerts.push({
      type: 'provider_error',
      severity: 'warning',
      message: 'AI provider errors were recorded.',
      value: summary.totals.providerError,
      threshold: 0,
    });
  }
  return alerts;
}

async function resolveAiProxyAlertNotificationRecipients() {
  const configuredIds = aiProxyAlertNotificationUserIds();
  if (configuredIds.length === 0) return [];

  const users = await prisma.user.findMany({
    where: {
      id: { in: configuredIds },
      role: 'guardian',
    },
    select: { id: true },
  });
  return users.map((user) => user.id);
}

function parseAiProxyAlertTypes(metadataJson: string | null) {
  try {
    const parsed = metadataJson ? JSON.parse(metadataJson) : {};
    return Array.isArray(parsed.alertTypes)
      ? parsed.alertTypes.map(String)
      : [];
  } catch {
    return [];
  }
}

async function hasRecentAiProxyAlertNotification(userId: string, alertTypes: string[], since: Date) {
  const recent = await prisma.notification.findMany({
    where: {
      userId,
      type: 'ai_proxy_alert',
      createdAt: { gte: since },
    },
    select: { metadataJson: true },
  });

  return recent.some((notification) => {
    const recentAlertTypes = parseAiProxyAlertTypes(notification.metadataJson);
    return recentAlertTypes.some((type) => alertTypes.includes(type));
  });
}

function aiProxyAlertNotificationBody(alerts: AiProxyDashboardAlert[], summary: ReturnType<typeof summarizeAiProxyAuditLogs>) {
  const criticalCount = alerts.filter((alert) => alert.severity === 'critical').length;
  const prefix = criticalCount > 0 ? '긴급 점검 필요' : '주의 점검 필요';
  return `${prefix}: 최근 ${summary.totals.requests}건 중 오류율 ${summary.totals.errorRatePercent}%, 제한 ${summary.totals.rateLimited}건입니다.`;
}

async function routeAiProxyAlertNotifications(now = new Date()): Promise<AiProxyAlertRoutingResult> {
  const result: AiProxyAlertRoutingResult = {
    enabled: aiProxyAlertNotificationsEnabled(),
    alerts: [],
    recipients: [],
    notified: 0,
    skipped: [],
  };

  if (!result.enabled) {
    result.skipped.push('disabled');
    return result;
  }

  const windowMinutes = aiProxyAlertWindowMinutes();
  const from = new Date(now.getTime() - windowMinutes * 60 * 1000);
  const logs = await prisma.aiProxyAuditLog.findMany({
    where: { createdAt: { gte: from } },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });
  const summary = summarizeAiProxyAuditLogs(logs);
  const alerts = buildAiProxyDashboardAlerts(summary);
  result.alerts = alerts;

  if (alerts.length === 0) {
    result.skipped.push('no_alerts');
    return result;
  }

  const recipients = await resolveAiProxyAlertNotificationRecipients();
  result.recipients = recipients;
  if (recipients.length === 0) {
    result.skipped.push('no_recipients');
    return result;
  }

  const alertTypes = alerts.map((alert) => alert.type);
  const cooldownStartedAt = new Date(now.getTime() - aiProxyAlertNotificationCooldownMinutes() * 60 * 1000);
  const topSeverity = alerts.some((alert) => alert.severity === 'critical') ? 'critical' : 'warning';

  for (const userId of recipients) {
    if (await hasRecentAiProxyAlertNotification(userId, alertTypes, cooldownStartedAt)) {
      result.skipped.push(`cooldown:${userId}`);
      continue;
    }

    const pushResult = await sendWebPush(userId, {
      type: 'ai_proxy_alert',
      title: topSeverity === 'critical' ? 'AI 프록시 긴급 점검' : 'AI 프록시 운영 주의',
      body: aiProxyAlertNotificationBody(alerts, summary),
      url: '/child/mypage',
      alertTypes,
      severity: topSeverity,
      windowMinutes,
      runbookUrl: aiProxyAlertRunbookUrl(),
      totals: summary.totals,
      recentErrors: summary.recentErrors.slice(0, 3),
    });
    result.notified += pushResult.notification ? 1 : 0;
  }

  return result;
}

async function assertCurrentUserCanAccessSenior(user: RequestUser, seniorId: string) {
  if (user.role === 'senior') {
    if (user.id !== seniorId) {
      throw httpError('권한이 없습니다.', 403);
    }
    return;
  }
  await assertGuardianCanAccessSenior(user.id, seniorId);
}

async function assertCurrentUserCanAccessQuestion(user: RequestUser, questionId: string) {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { photo: true },
  });
  if (!question) {
    throw httpError('질문을 찾을 수 없습니다.', 404);
  }

  if (question.category === 'common_questions') {
    if (user.role !== 'senior') {
      throw httpError('공통 질문은 부모님만 답변 상태를 변경할 수 있습니다.', 403);
    }
    return question;
  }

  if (question.seniorId) {
    await assertCurrentUserCanAccessSenior(user, question.seniorId);
    return question;
  }

  if (question.photo?.userId) {
    await assertCurrentUserCanAccessSenior(user, question.photo.userId);
    return question;
  }

  if (question.createdById) {
    if (user.role === 'guardian') {
      if (question.createdById !== user.id) {
        throw httpError('권한이 없습니다.', 403);
      }
      return question;
    }

    const link = await prisma.guardianSeniorLink.findUnique({
      where: { guardianId_seniorId: { guardianId: question.createdById, seniorId: user.id } },
    });
    if (!link) {
      throw httpError('권한이 없습니다.', 403);
    }
    return question;
  }

  throw httpError('권한이 없습니다.', 403);
}

async function assertCurrentUserCanAccessCoverDesign(user: RequestUser, coverDesignId: string) {
  const coverDesign = await prisma.coverDesign.findUnique({
    where: { id: coverDesignId },
    select: { id: true, userId: true },
  });
  if (!coverDesign) {
    throw httpError('표지 디자인을 찾을 수 없습니다.', 404);
  }
  await assertCurrentUserCanAccessSenior(user, coverDesign.userId);
  return coverDesign;
}

async function resolveLocalFileAccess(fileKey: string): Promise<LocalFileAccess> {
  const { kind } = parseLocalFileKey(fileKey);

  if (kind === 'photos') {
    const photo = await prisma.photo.findFirst({
      where: { fileKey },
      select: { userId: true, fileName: true, mimeType: true },
    });
    if (!photo) throw httpError('파일을 찾을 수 없습니다.', 404);
    return {
      kind,
      seniorId: photo.userId,
      fileName: photo.fileName,
      mimeType: photo.mimeType,
    };
  }

  if (kind === 'audio') {
    const record = await prisma.interviewRecord.findFirst({
      where: { audioFileKey: fileKey },
      select: { userId: true },
    });
    if (record) return { kind, seniorId: record.userId };

    const freeSpeech = await prisma.freeSpeechRecord.findFirst({
      where: { audioFileKey: fileKey },
      select: { userId: true },
    });
    if (freeSpeech) return { kind, seniorId: freeSpeech.userId };

    throw httpError('파일을 찾을 수 없습니다.', 404);
  }

  const publication = await prisma.publicationRequest.findFirst({
    where: { pdfFileKey: fileKey },
    select: { userId: true, id: true },
  });
  if (!publication) throw httpError('파일을 찾을 수 없습니다.', 404);
  return {
    kind,
    seniorId: publication.userId,
    fileName: `dearlog-${publication.id}.pdf`,
    mimeType: 'application/pdf',
  };
}

async function assertCurrentUserCanAccessLocalFile(user: RequestUser, fileKey: string) {
  const access = await resolveLocalFileAccess(fileKey);
  await assertCurrentUserCanAccessSenior(user, access.seniorId);
  return access;
}

export function createApp() {
  void resetRunningPublicationPreviewJobs().catch((error) => {
    console.warn('Publication preview job recovery failed:', error);
  });

  const app = express();
  const distDir = path.join(config.serverDir, '..', 'dist');
  const aiProxyRateBuckets = new Map<string, AiProxyRateBucket>();
  app.use((req, res, next) => {
    // 로컬 앱은 Vite(:3000)와 API(:8787)가 다른 origin이라 Web Push/업로드 API 호출에 CORS 허용이 필요합니다.
    const origin = req.header('origin');
    if (origin && /^(https?|capacitor|ionic):\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Vary', 'Origin');
    }
    res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, x-user-id, x-user-role');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });
  app.use(express.json({ limit: '10mb' }));
  app.use(attachLocalUser);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, storage: config.storageDir });
  });

  app.get('/api/me', (req, res) => {
    res.json({ user: req.user ?? null });
  });

  app.get('/api/ai/audit-summary', requireRole('guardian'), async (req, res, next) => {
    try {
      assertAiProxyDashboardAccess(req);
      const now = new Date();
      const windowMinutes = boundedPositiveInt(req.query.windowMinutes, 60, 24 * 60);
      const userLimit = boundedPositiveInt(req.query.userLimit, 5, 25);
      const retention = await pruneAiProxyAuditLogs(now);
      const from = new Date(now.getTime() - windowMinutes * 60 * 1000);
      const logs = await prisma.aiProxyAuditLog.findMany({
        where: { createdAt: { gte: from } },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      });
      const summary = summarizeAiProxyAuditLogs(logs);
      const alerts = buildAiProxyDashboardAlerts(summary);

      res.json({
        window: {
          from: from.toISOString(),
          to: now.toISOString(),
          minutes: windowMinutes,
        },
        totals: summary.totals,
        byEndpoint: summary.byEndpoint,
        byUser: summary.byUser.slice(0, userLimit),
        recentErrors: summary.recentErrors,
        alerts,
        alertThresholds: {
          errorRatePercent: aiProxyAlertErrorRatePercent(),
          rateLimitedCount: aiProxyAlertRateLimitedCount(),
          minRequests: aiProxyAlertMinRequests(),
        },
        alertRouting: {
          enabled: aiProxyAlertNotificationsEnabled(),
          windowMinutes: aiProxyAlertWindowMinutes(),
          cooldownMinutes: aiProxyAlertNotificationCooldownMinutes(),
          recipientCount: aiProxyAlertNotificationUserIds().length,
          runbookUrl: aiProxyAlertRunbookUrl(),
        },
        retention: {
          days: retention.retentionDays,
          cutoff: retention.cutoff.toISOString(),
          deletedOldLogs: retention.deletedOldLogs,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/ai/chat-completions', requireRole('senior', 'guardian'), async (req, res, next) => {
    const startedAt = Date.now();
    const endpoint: AiProxyEndpoint = 'chat_completions';
    const user = req.user!;
    let estimatedUnits = 0;
    let providerModel: string | undefined;
    try {
      const body = req.body as Record<string, unknown>;
      if (typeof body.model !== 'string' || !Array.isArray(body.messages)) {
        await recordAiProxyAuditLog({
          user,
          endpoint,
          outcome: 'invalid_request',
          statusCode: 400,
          estimatedUnits: 0,
          latencyMs: Date.now() - startedAt,
          errorMessage: 'model과 messages가 필요합니다.',
        });
        res.status(400).json({ error: 'model과 messages가 필요합니다.' });
        return;
      }
      if (body.stream === true) {
        await recordAiProxyAuditLog({
          user,
          endpoint,
          model: body.model,
          outcome: 'invalid_request',
          statusCode: 400,
          estimatedUnits: 0,
          latencyMs: Date.now() - startedAt,
          errorMessage: '스트리밍 응답은 지원하지 않습니다.',
        });
        res.status(400).json({ error: '스트리밍 응답은 지원하지 않습니다.' });
        return;
      }

      const factChatPurpose = body.purpose === 'writing' || body.purpose === 'vision'
        ? body.purpose
        : 'chat';
      const providerInput = normalizeFactChatChatCompletionInput({
        model: body.model,
        messages: body.messages as any,
        ...pickOpenAIOptions(body, [
          'temperature',
          'max_tokens',
          'max_completion_tokens',
          'response_format',
          'top_p',
          'presence_penalty',
          'frequency_penalty',
          'seed',
          'tools',
          'tool_choice',
          'reasoning_effort',
        ]),
      }, factChatPurpose);
      providerModel = String(providerInput.model);
      estimatedUnits = estimateAiProxyUnits(endpoint, providerInput);

      const rateLimit = checkAiProxyRateLimit(aiProxyRateBuckets, user, endpoint, estimatedUnits);
      if (!rateLimit.allowed) {
        await recordAiProxyAuditLog({
          user,
          endpoint,
          model: providerModel,
          outcome: 'rate_limited',
          statusCode: 429,
          estimatedUnits,
          latencyMs: Date.now() - startedAt,
          errorMessage: 'AI 프록시 요청 한도를 초과했습니다.',
        });
        res.header('Retry-After', String(rateLimit.retryAfterSeconds));
        res.status(429).json({ error: 'AI 요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.' });
        return;
      }

      const client = getFactChatClient();
      const response = await client.chat.completions.create(providerInput as any);
      await recordAiProxyAuditLog({
        user,
        endpoint,
        model: providerModel,
        outcome: 'success',
        statusCode: 200,
        estimatedUnits,
        latencyMs: Date.now() - startedAt,
      });
      res.json(response);
    } catch (error) {
      const statusCode = typeof error === 'object' && error && 'statusCode' in error
        ? Number((error as { statusCode?: number }).statusCode)
        : 502;
      const outcome: AiProxyOutcome = statusCode === 503 ? 'config_error' : 'provider_error';
      const telemetry = aiProviderTelemetry(error);
      await recordAiProxyAuditLog({
        user,
        endpoint,
        model: providerModel ?? (typeof req.body?.model === 'string' ? req.body.model : undefined),
        outcome,
        statusCode: Number.isFinite(statusCode) ? statusCode : 502,
        estimatedUnits,
        latencyMs: Date.now() - startedAt,
        providerStatus: telemetry.providerStatus,
        providerCode: telemetry.providerCode,
        errorMessage: telemetry.message,
      });
      if (outcome === 'config_error') {
        next(error);
        return;
      }
      console.warn('AI provider chat completion failed:', {
        userId: user.id,
        providerStatus: telemetry.providerStatus,
        providerCode: telemetry.providerCode,
      });
      res.status(502).json({ error: 'AI 제공자 요청에 실패했습니다.' });
    }
  });

  app.post('/api/ai/embeddings', requireRole('senior', 'guardian'), async (req, res, next) => {
    const startedAt = Date.now();
    const endpoint: AiProxyEndpoint = 'embeddings';
    const user = req.user!;
    let estimatedUnits = 0;
    try {
      const body = req.body as Record<string, unknown>;
      const validInput = typeof body.input === 'string' || (Array.isArray(body.input) && body.input.every((item) => typeof item === 'string'));
      if (typeof body.model !== 'string' || !validInput) {
        await recordAiProxyAuditLog({
          user,
          endpoint,
          outcome: 'invalid_request',
          statusCode: 400,
          estimatedUnits: 0,
          latencyMs: Date.now() - startedAt,
          errorMessage: 'model과 input이 필요합니다.',
        });
        res.status(400).json({ error: 'model과 input이 필요합니다.' });
        return;
      }

      estimatedUnits = estimateAiProxyUnits(endpoint, body);
      const rateLimit = checkAiProxyRateLimit(aiProxyRateBuckets, user, endpoint, estimatedUnits);
      if (!rateLimit.allowed) {
        await recordAiProxyAuditLog({
          user,
          endpoint,
          model: body.model,
          outcome: 'rate_limited',
          statusCode: 429,
          estimatedUnits,
          latencyMs: Date.now() - startedAt,
          errorMessage: 'AI 프록시 요청 한도를 초과했습니다.',
        });
        res.header('Retry-After', String(rateLimit.retryAfterSeconds));
        res.status(429).json({ error: 'AI 요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.' });
        return;
      }

      const client = getOpenAIClient();
      const response = await client.embeddings.create({
        model: body.model,
        input: body.input as any,
        ...pickOpenAIOptions(body, ['dimensions', 'encoding_format', 'user']),
      } as any);
      await recordAiProxyAuditLog({
        user,
        endpoint,
        model: body.model,
        outcome: 'success',
        statusCode: 200,
        estimatedUnits,
        latencyMs: Date.now() - startedAt,
      });
      res.json(response);
    } catch (error) {
      const statusCode = typeof error === 'object' && error && 'statusCode' in error
        ? Number((error as { statusCode?: number }).statusCode)
        : 502;
      const outcome: AiProxyOutcome = statusCode === 503 ? 'config_error' : 'provider_error';
      const telemetry = aiProviderTelemetry(error);
      await recordAiProxyAuditLog({
        user,
        endpoint,
        model: typeof req.body?.model === 'string' ? req.body.model : undefined,
        outcome,
        statusCode: Number.isFinite(statusCode) ? statusCode : 502,
        estimatedUnits,
        latencyMs: Date.now() - startedAt,
        providerStatus: telemetry.providerStatus,
        providerCode: telemetry.providerCode,
        errorMessage: telemetry.message,
      });
      if (outcome === 'config_error') {
        next(error);
        return;
      }
      console.warn('AI provider embedding request failed:', {
        userId: user.id,
        providerStatus: telemetry.providerStatus,
        providerCode: telemetry.providerCode,
      });
      res.status(502).json({ error: 'AI 제공자 요청에 실패했습니다.' });
    }
  });

  app.post('/api/auth/phone', async (req, res, next) => {
    try {
      const phoneNumber = normalizePhoneNumber(req.body.phoneNumber);
      if (!/^01[016789]\d{7,8}$/.test(phoneNumber)) {
        res.status(400).json({ error: '휴대폰 번호를 다시 확인해 주세요.' });
        return;
      }

      // 전화번호별과 발신 IP별로 각각 제한한다. 번호 하나를 노리는 대입과
      // 여러 번호를 훑는 대입이 서로 다른 형태라 한쪽만 막으면 뚫린다.
      // IP 한도를 번호 한도보다 훨씬 높게 둔다. 한 가족이 같은 공유기를 쓰거나
      // 통신사 NAT 뒤에 있으면 정상 사용자도 같은 IP로 몰리기 때문이다.
      // 특정 번호를 노린 대입은 번호 한도가 막는다.
      const attemptChecks = [
        checkAuthAttemptLimit(`phone:${phoneNumber}`, positiveInt(Number(process.env.AUTH_ATTEMPT_LIMIT_PER_PHONE ?? 10), 10)),
        checkAuthAttemptLimit(`ip:${req.ip ?? 'unknown'}`, positiveInt(Number(process.env.AUTH_ATTEMPT_LIMIT_PER_IP ?? 100), 100)),
      ];
      const blocked = attemptChecks.find((check) => !check.allowed);
      if (blocked) {
        res.setHeader('Retry-After', String(blocked.retryAfterSeconds));
        res.status(429).json({ error: '로그인 시도가 너무 잦습니다. 잠시 후 다시 시도해 주세요.' });
        return;
      }

      const isLogin = req.body.isLogin !== undefined ? !!req.body.isLogin : undefined;
      const name = req.body.name ? String(req.body.name).trim() : '';
      const birthDate = normalizeBirthDate(req.body.birthDate);
      if (birthDate === undefined) {
        res.status(400).json({ error: '생년월일은 YYYY-MM-DD 형식으로 입력해 주세요.' });
        return;
      }

      const existing = await prisma.user.findUnique({ where: { phoneNumber } });

      if (isLogin === undefined) {
        // Legacy find-or-create behavior
        if (existing) {
          res.json({ ...serializeAuthResponse(existing), isNew: false });
          return;
        }
        const user = await prisma.user.create({
          data: {
            phoneNumber,
            role: 'guardian',
            name: name || '보호자',
            birthDate,
            preferredName: '보호자',
            guardianName: name || '보호자',
            guardianPreferredName: '보호자',
          },
        });
        res.status(201).json({ ...serializeAuthResponse(user), isNew: true });
        return;
      }

      if (isLogin) {
        if (!existing) {
          res.status(404).json({ error: '가입되지 않은 휴대폰 번호입니다. 회원가입을 진행해 주세요.' });
          return;
        }
        if (!name) {
          res.status(400).json({ error: '이름을 입력해 주세요.' });
          return;
        }
        if (existing.name.trim() !== name) {
          res.status(400).json({ error: '이름이 일치하지 않습니다. 다시 입력해 주세요.' });
          return;
        }
        res.json({ ...serializeAuthResponse(existing), isNew: false });
      } else {
        // Signup
        if (existing) {
          res.status(400).json({ error: '이미 가입된 휴대폰 번호입니다. 로그인해 주세요.' });
          return;
        }
        if (!name) {
          res.status(400).json({ error: '이름을 입력해 주세요.' });
          return;
        }
        const user = await prisma.user.create({
          data: {
            phoneNumber,
            role: 'guardian',
            name,
            birthDate,
            preferredName: '보호자',
            guardianName: name,
            guardianPreferredName: '보호자',
          },
        });
        res.status(201).json({ ...serializeAuthResponse(user), isNew: true });
      }
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/invitations', requireRole('guardian'), async (req, res, next) => {
    try {
      const guardianId = req.user!.id;
      const guardian = await prisma.user.findUnique({ where: { id: guardianId } });
      const guardianName = guardian?.name || '자녀';
      const body = req.body ?? {};
      const seniorName = body.seniorName ? String(body.seniorName).trim() : null;
      const requestedSeniorId = body.seniorId ? String(body.seniorId).trim() : null;
      const profileImageUrl = normalizeOptionalImageUrl(body.profileImageUrl);
      const recordSpaceCoverUrl = normalizeOptionalImageUrl(body.recordSpaceCoverUrl);
      const recordSpaceName = normalizeOptionalText(body.recordSpaceName, 80);
      const relationship = normalizeOptionalText(body.relationship, 24);
      const hasCurrentJobProvided = Object.prototype.hasOwnProperty.call(body, 'hasCurrentJob');
      const hasCurrentJob = normalizeOptionalBoolean(body.hasCurrentJob);
      const occupation = normalizeOptionalText(body.occupation, 120);
      const hometown = normalizeOptionalText(body.hometown, 120);
      const schoolHistory = normalizeOptionalText(body.schoolHistory, 160);
      const birthDateProvided = Object.prototype.hasOwnProperty.call(body, 'birthDate');
      const birthDate = normalizeBirthDate(body.birthDate);
      if (profileImageUrl === undefined || recordSpaceCoverUrl === undefined) {
        res.status(400).json({ error: '이미지는 JPG, PNG, WebP 형식의 URL 또는 data URL이어야 합니다.' });
        return;
      }
      if (recordSpaceName === undefined || relationship === undefined || occupation === undefined || hometown === undefined || schoolHistory === undefined) {
        res.status(400).json({ error: '기록 공간 이름, 관계, 생활 정보는 너무 길게 입력할 수 없습니다.' });
        return;
      }
      if (hasCurrentJob === undefined) {
        res.status(400).json({ error: '현재 직업 유무 값이 올바르지 않습니다.' });
        return;
      }
      if (birthDate === undefined) {
        res.status(400).json({ error: '생년월일은 YYYY-MM-DD 형식이어야 합니다.' });
        return;
      }
      const seniorAssetData = {
        ...(profileImageUrl ? { profileImageUrl } : {}),
        ...(recordSpaceName ? { recordSpaceName } : {}),
        ...(recordSpaceCoverUrl ? { recordSpaceCoverUrl } : {}),
        ...(birthDateProvided ? { birthDate } : {}),
        ...(hasCurrentJobProvided ? { hasCurrentJob } : {}),
        ...(occupation ? { occupation } : {}),
        ...(hometown ? { hometown } : {}),
        ...(schoolHistory ? { schoolHistory } : {}),
      };
      let seniorId: string;

      if (requestedSeniorId) {
        await assertGuardianCanAccessSenior(guardianId, requestedSeniorId);
        const senior = await prisma.user.findUnique({ where: { id: requestedSeniorId } });
        if (!senior || senior.role !== 'senior') {
          res.status(404).json({ error: '초대할 부모님 계정을 찾을 수 없습니다.' });
          return;
        }
        seniorId = requestedSeniorId;
      } else if (seniorName) {
        // If a specific seniorName is provided, we ALWAYS create a new senior and link them.
        const senior = await prisma.user.create({
          data: {
            name: seniorName,
            role: 'senior',
            preferredName: seniorName,
            seniorName: seniorName,
            seniorPreferredName: seniorName,
            guardianName: guardianName,
            ...seniorAssetData,
          }
        });
        seniorId = senior.id;
        await prisma.guardianSeniorLink.create({
          data: { guardianId, seniorId, ...(relationship ? { relationship } : {}) }
        });
      } else {
        // Fallback/Default initial flow when no name is provided
        const existingLink = await prisma.guardianSeniorLink.findFirst({
          where: { guardianId }
        });

        if (existingLink) {
          // 초대받은 시니어 계정이 데이터베이스에 실제 존재하는지 교차 검증합니다.
          const seniorExists = await prisma.user.findUnique({
            where: { id: existingLink.seniorId }
          });
          if (seniorExists) {
            seniorId = existingLink.seniorId;
          } else {
            // 기존 링크가 끊어지거나 없는 시니어를 가리키고 있다면(Orphaned Link), 링크를 제거하고 새로 생성합니다.
            await prisma.guardianSeniorLink.delete({
              where: { id: existingLink.id }
            });
            const senior = await prisma.user.create({
              data: {
                name: '어르신',
                role: 'senior',
                preferredName: '어르신',
                seniorName: '어르신',
                seniorPreferredName: '어르신',
                guardianName: guardianName,
                ...seniorAssetData,
              }
            });
            seniorId = senior.id;
            await prisma.guardianSeniorLink.create({
              data: { guardianId, seniorId, ...(relationship ? { relationship } : {}) }
            });
          }
        } else {
          const senior = await prisma.user.create({
            data: {
              name: '어르신',
              role: 'senior',
              preferredName: '어르신',
              seniorName: '어르신',
              seniorPreferredName: '어르신',
              guardianName: guardianName,
              ...seniorAssetData,
            }
          });
          seniorId = senior.id;
          await prisma.guardianSeniorLink.create({
            data: { guardianId, seniorId, ...(relationship ? { relationship } : {}) }
          });
        }
      }

      if (Object.keys(seniorAssetData).length > 0) {
        await prisma.user.update({
          where: { id: seniorId },
          data: seniorAssetData,
        });
      }
      if (relationship) {
        await prisma.guardianSeniorLink.update({
          where: { guardianId_seniorId: { guardianId, seniorId } },
          data: { relationship },
        });
      }

      const token = crypto.randomUUID().replace(/-/g, '');
      const expiresAt = createInvitationExpiry();
      const invitation = await prisma.invitation.upsert({
        where: { seniorId },
        update: { token, guardianId, expiresAt, revokedAt: null, usedAt: null },
        create: { token, guardianId, seniorId, expiresAt }
      });

      res.status(201).json({ invitation: serializeInvitation(invitation) });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/invitations/:id/rotate', requireRole('guardian'), async (req, res, next) => {
    try {
      const guardianId = req.user!.id;
      const invitation = await prisma.invitation.findUnique({
        where: { id: req.params.id },
      });

      if (!invitation) {
        res.status(404).json({ error: '초대 링크를 찾을 수 없습니다.' });
        return;
      }

      await assertGuardianCanAccessSenior(guardianId, invitation.seniorId);

      const updated = await prisma.invitation.update({
        where: { id: invitation.id },
        data: {
          token: crypto.randomUUID().replace(/-/g, ''),
          guardianId,
          expiresAt: createInvitationExpiry(),
          revokedAt: null,
          usedAt: null,
        },
      });

      res.json({ invitation: serializeInvitation(updated) });
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/invitations/:id', requireRole('guardian'), async (req, res, next) => {
    try {
      const guardianId = req.user!.id;
      const invitation = await prisma.invitation.findUnique({
        where: { id: req.params.id },
      });

      if (!invitation) {
        res.status(404).json({ error: '초대 링크를 찾을 수 없습니다.' });
        return;
      }

      await assertGuardianCanAccessSenior(guardianId, invitation.seniorId);

      const updated = await prisma.invitation.update({
        where: { id: invitation.id },
        data: { revokedAt: new Date() },
      });

      res.json({ invitation: serializeInvitation(updated) });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/family-members', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const currentUserId = req.user!.id;
      const currentUserRole = req.user!.role;

      let seniorIds: string[] = [];
      let guardianIds: string[] = [];
      const seniorRelationshipMap = new Map<string, string>();

      if (currentUserRole === 'senior') {
        seniorIds = [currentUserId];
        const links = await prisma.guardianSeniorLink.findMany({
          where: { seniorId: currentUserId }
        });
        guardianIds = links.map(l => l.guardianId);
      } else {
        const links = await prisma.guardianSeniorLink.findMany({
          where: { guardianId: currentUserId }
        });
        seniorIds = links.map(l => l.seniorId);
        links.forEach(l => {
          if (l.relationship) seniorRelationshipMap.set(l.seniorId, l.relationship);
        });
        guardianIds = [currentUserId];

        if (seniorIds.length > 0) {
          const siblingLinks = await prisma.guardianSeniorLink.findMany({
            where: { seniorId: { in: seniorIds } }
          });
          siblingLinks.forEach(l => {
            if (!guardianIds.includes(l.guardianId)) {
              guardianIds.push(l.guardianId);
            }
          });
        }
      }

      const allUserIds = Array.from(new Set([...seniorIds, ...guardianIds]));
      const users = await prisma.user.findMany({
        where: { id: { in: allUserIds } },
        select: {
          id: true,
          name: true,
          role: true,
          guardianRelationship: true,
          birthDate: true,
          birthDecade: true,
          profileImageUrl: true,
          recordSpaceName: true,
          recordSpaceCoverUrl: true,
          hasCurrentJob: true,
          occupation: true,
          hometown: true,
          schoolHistory: true,
        }
      });

      const invitations = await prisma.invitation.findMany({
        where: { seniorId: { in: seniorIds } }
      });
      const invitationMap = new Map(invitations.map(i => [i.seniorId, serializeInvitation(i)]));

      const members = users.map(u => {
        const isParent = u.role === 'senior';
        const invitation = isParent ? invitationMap.get(u.id) ?? null : null;
        return {
          id: u.id,
          name: u.name,
          role: isParent ? 'parent' as const : 'child' as const,
          relationship: isParent ? (seniorRelationshipMap.get(u.id) || '부모님') : (u.guardianRelationship || '자녀'),
          isMe: u.id === currentUserId,
          birthDate: u.birthDate ?? null,
          profileImageUrl: u.profileImageUrl ?? null,
          recordSpaceName: u.recordSpaceName ?? null,
          recordSpaceCoverUrl: u.recordSpaceCoverUrl ?? null,
          hasCurrentJob: u.hasCurrentJob ?? null,
          occupation: u.occupation ?? null,
          hometown: u.hometown ?? null,
          schoolHistory: u.schoolHistory ?? null,
          token: invitation?.token ?? null,
          invitation,
          invitationId: invitation?.id ?? null,
          invitationStatus: invitation?.status ?? null,
          invitationExpiresAt: invitation?.expiresAt ?? null,
          invitationRevokedAt: invitation?.revokedAt ?? null,
          invitationUsedAt: invitation?.usedAt ?? null,
          hasRegistered: isParent ? (u.birthDecade !== null && u.birthDecade !== '') : false,
        };
      });

      res.json({ members });
    } catch (error) {
      next(error);
    }
  });


  app.post('/api/auth/token-login', async (req, res, next) => {
    try {
      const { token } = req.body;
      if (!token) {
        res.status(400).json({ error: '토큰이 필요합니다.' });
        return;
      }

      const invitation = await prisma.invitation.findUnique({
        where: { token }
      });

      if (!invitation) {
        res.status(404).json({ error: '유효하지 않은 초대 링크입니다.' });
        return;
      }

      const invitationStatus = getInvitationStatus(invitation);
      if (invitationStatus === 'revoked') {
        res.status(410).json({ error: '폐기된 초대 링크입니다. 보호자에게 새 링크를 요청해 주세요.' });
        return;
      }
      if (invitationStatus === 'expired') {
        res.status(410).json({ error: '만료된 초대 링크입니다. 보호자에게 새 링크를 요청해 주세요.' });
        return;
      }
      if (invitationStatus === 'used') {
        res.status(410).json({ error: '이미 사용된 초대 링크입니다. 보호자에게 새 링크를 요청해 주세요.' });
        return;
      }

      const senior = await prisma.user.findUnique({
        where: { id: invitation.seniorId }
      });

      if (!senior) {
        res.status(404).json({ error: '초대받은 계정을 찾을 수 없습니다.' });
        return;
      }

      const link = await prisma.guardianSeniorLink.findFirst({
        where: { seniorId: senior.id },
        include: { guardian: true }
      });
      const guardianName = link?.guardian?.name || '자녀';

      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { usedAt: new Date() },
      });

      res.json({ ...serializeAuthResponse({ ...senior, guardianName }) });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/auth/users/:id/role', async (req, res, next) => {
    try {
      if (!req.user || req.user.id !== req.params.id) {
        res.status(403).json({ error: '권한이 없습니다.' });
        return;
      }
      const role = req.body.role === 'guardian' ? 'guardian' : req.body.role === 'senior' ? 'senior' : null;
      if (!role) {
        res.status(400).json({ error: '역할을 다시 선택해 주세요.' });
        return;
      }
      const current = await prisma.user.findUnique({ where: { id: req.params.id } });
      if (!current) {
        res.status(404).json({ error: '계정을 찾을 수 없습니다.' });
        return;
      }
      const defaultName = role === 'guardian' ? '보호자' : '어르신';
      const user = await prisma.user.update({
        where: { id: req.params.id },
        data: {
          role,
          name: current.name.startsWith('사용자 ') ? defaultName : current.name,
          preferredName: current.preferredName ?? defaultName,
          ...(role === 'guardian'
            ? { guardianName: current.guardianName ?? '', guardianPreferredName: current.guardianPreferredName ?? '보호자' }
            : { seniorName: current.seniorName ?? current.name, seniorPreferredName: current.seniorPreferredName ?? '어르신' }),
        },
      });
      await ensureSelfGuardianSeniorLink(user.id);
      res.json(serializeAuthResponse(user));
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/auth/users/:id/profile', async (req, res, next) => {
    try {
      if (!req.user || req.user.id !== req.params.id) {
        res.status(403).json({ error: '권한이 없습니다.' });
        return;
      }
      const name = String(req.body.name ?? '').trim();
      const preferredName = String(req.body.preferredName ?? '').trim();
      if (!name || !preferredName) {
        res.status(400).json({ error: '이름과 선호 호칭을 입력해 주세요.' });
        return;
      }
      const role = req.body.role === 'guardian' ? 'guardian' : 'senior';
      const relationship = String(req.body.relationship ?? '').trim();
      const birthDateProvided = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'birthDate');
      const birthDate = normalizeBirthDate(req.body.birthDate);
      if (birthDate === undefined) {
        res.status(400).json({ error: '생년월일은 YYYY-MM-DD 형식으로 입력해 주세요.' });
        return;
      }
      const birthDateData = birthDateProvided ? { birthDate } : {};
      if (role === 'guardian' && !relationship) {
        res.status(400).json({ error: '어르신과의 관계를 입력해 주세요.' });
        return;
      }
      const user = await prisma.user.update({
        where: { id: req.params.id },
        data: role === 'guardian'
          ? {
              role,
              name,
              ...birthDateData,
              preferredName,
              guardianName: name,
              guardianRelationship: relationship,
              guardianPreferredName: preferredName,
            }
          : {
              role,
              name,
              ...birthDateData,
              preferredName,
              birthDecade: String(req.body.birthDecade ?? '1950년대'),
              seniorName: name,
              seniorBirthDecade: String(req.body.birthDecade ?? '1950년대'),
              seniorPreferredName: preferredName,
            },
      });
      await ensureSelfGuardianSeniorLink(user.id);
      res.json(serializeAuthResponse(user));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/push-public-key', (_req, res) => {
    res.json({ publicKey: config.vapid.publicKey });
  });

  app.get('/api/chapters', async (_req, res, next) => {
    try {
      res.json({ chapters: await prisma.chapter.findMany({ orderBy: { order: 'asc' } }) });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/questions', async (req, res, next) => {
    try {
      const category = req.query.category?.toString();
      const chapterId = req.query.chapterId?.toString();
      const seniorId = req.user
        ? req.user.role === 'senior'
          ? req.user.id
          : await resolveGuardianSeniorId(req.user.id, req.query.seniorId?.toString())
        : null;

      if (category && category !== 'common_questions' && !seniorId) {
        res.status(403).json({ error: '권한이 없습니다.' });
        return;
      }

      const where = category
        ? {
            category,
            ...(chapterId ? { chapterId } : {}),
            ...(category !== 'common_questions' ? { seniorId } : {}),
          }
        : {
            ...(chapterId ? { chapterId } : {}),
            OR: [
              { category: 'common_questions' },
              ...(seniorId ? [{ seniorId }] : []),
            ],
          };

      const questions = await prisma.question.findMany({
        where,
        include: { photo: true },
        orderBy: { createdAt: 'asc' },
      });
      res.json({ questions: questions.map(mapQuestionToResponse) });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/questions', requireRole('guardian'), async (req, res, next) => {
    try {
      const { text, chapterId, category, photoId } = req.body;
      const trimmedText = String(text ?? '').trim();
      if (!trimmedText) {
        res.status(400).json({ error: '질문 내용을 입력해 주세요.' });
        return;
      }
      let seniorId = await resolveGuardianSeniorId(req.user!.id, req.body.seniorId ? String(req.body.seniorId) : undefined);
      let resolvedCategory = 'guardian_questions';
      let resolvedChapterId = chapterId || 'messages';
      let resolvedPhotoId: string | undefined;

      if (category === 'photo_questions') {
        const photo = photoId
          ? await prisma.photo.findUnique({ where: { id: String(photoId) }, select: { id: true, userId: true } })
          : null;
        if (!photo) {
          res.status(404).json({ error: '사진을 찾을 수 없습니다.' });
          return;
        }
        await assertCurrentUserCanAccessSenior(req.user!, photo.userId);
        if (req.body.seniorId && String(req.body.seniorId) !== photo.userId) {
          res.status(400).json({ error: '사진과 질문 대상 부모님이 일치하지 않습니다.' });
          return;
        }
        seniorId = photo.userId;
        resolvedCategory = 'photo_questions';
        resolvedChapterId = chapterId || 'childhood';
        resolvedPhotoId = photo.id;
      }
      // Fallback to 'messages' chapter if not provided, to ensure the question appears on the parent's select view
      const question = await prisma.question.create({
        data: {
          text: trimmedText,
          chapterId: resolvedChapterId,
          seniorId,
          category: resolvedCategory,
          ...(resolvedPhotoId ? { photoId: resolvedPhotoId } : {}),
          createdById: req.user!.id,
        },
        include: { photo: true },
      });
      res.status(201).json({ question: mapQuestionToResponse(question) });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/uploads/photos', requireRole('guardian'), photoUpload.single('photo'), async (req, res, next) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: '사진 파일이 필요합니다.' });
        return;
      }
      const seniorId = await resolveGuardianSeniorId(req.user!.id, req.body.seniorId ? String(req.body.seniorId) : undefined);
      const fileKey = `photos/${path.basename(req.file.filename)}`;
      const capturedDate = String(req.body.capturedDate ?? '').trim();
      const photoLocation = String(req.body.location ?? '').trim();
      const memo = String(req.body.memo ?? '').trim();
      const linkedQuestion = String(req.body.linkedQuestion ?? '').trim();
      const result = await analyzePhotoAndCreateQuestions({
        filePath: req.file.path,
        mimeType: req.file.mimetype,
        chapterId: req.body.chapterId,
      }, {
        userId: req.user!.id,
        role: req.user!.role,
      });
      const photo = await prisma.photo.create({
        data: {
          userId: seniorId,
          fileKey,
          fileName: req.file.originalname,
          mimeType: req.file.mimetype,
          metadataJson: JSON.stringify({
            size: req.file.size,
            ...(capturedDate ? { capturedDate } : {}),
            ...(photoLocation ? { location: photoLocation } : {}),
            ...(memo ? { memo } : {}),
            ...(linkedQuestion ? { linkedQuestion } : {}),
          }),
          analysisJson: JSON.stringify({
            ...result.analysis,
            questions: [
              ...(linkedQuestion ? [linkedQuestion] : []),
              ...result.questions,
            ],
          }),
        },
      });
      const suggestions = [
        ...(linkedQuestion ? [linkedQuestion] : []),
        ...result.questions,
      ].filter((text, index, all) => text && all.indexOf(text) === index);
      res.status(201).json({
        photo: mapPhotoToResponse(photo),
        questions: suggestions.map((questionText) => ({
          text: questionText,
          questionText,
          category: 'photo_question_suggestions',
          chapterId: req.body.chapterId || 'childhood',
          photoId: photo.id,
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/uploads/audio', requireRole('senior', 'guardian'), audioUpload.single('audio'), async (req, res, next) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: '음성 파일이 필요합니다.' });
        return;
      }
      const fileKey = `audio/${path.basename(req.file.filename)}`;
      res.status(201).json({
        fileKey,
        uploadToken: signLocalFileAccessToken(fileKey, req.user!.id),
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/audio/speech', requireRole('senior', 'guardian'), async (req, res, next) => {
    const startedAt = Date.now();
    const endpoint: AiProxyEndpoint = 'speech';
    const user = req.user!;
    let estimatedUnits = 0;
    const model = String(process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts');
    const requestedVoice = String(req.body?.voice ?? process.env.OPENAI_TTS_VOICE ?? 'marin').trim();
    const voice = INTERVIEW_TTS_VOICES.has(requestedVoice) ? requestedVoice : 'marin';
    const requestedFormat = String(req.body?.responseFormat ?? req.body?.response_format ?? 'mp3').trim();
    const responseFormat = INTERVIEW_TTS_FORMATS.has(requestedFormat) ? requestedFormat : 'mp3';

    try {
      const text = String(req.body?.text ?? req.body?.input ?? '').trim();
      if (!text || text.length > 800) {
        await recordAiProxyAuditLog({
          user,
          endpoint,
          model,
          outcome: 'invalid_request',
          statusCode: 400,
          estimatedUnits: 0,
          latencyMs: Date.now() - startedAt,
          errorMessage: 'text가 필요하며 800자 이하여야 합니다.',
        });
        res.status(400).json({ error: '읽을 질문 문장이 필요합니다.' });
        return;
      }

      estimatedUnits = estimateAiProxyUnits(endpoint, { input: text });
      const rateLimit = checkAiProxyRateLimit(aiProxyRateBuckets, user, endpoint, estimatedUnits);
      if (!rateLimit.allowed) {
        await recordAiProxyAuditLog({
          user,
          endpoint,
          model,
          outcome: 'rate_limited',
          statusCode: 429,
          estimatedUnits,
          latencyMs: Date.now() - startedAt,
          errorMessage: 'AI 프록시 요청 한도를 초과했습니다.',
        });
        res.header('Retry-After', String(rateLimit.retryAfterSeconds));
        res.status(429).json({ error: 'AI 음성 생성 요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.' });
        return;
      }

      const instructions = typeof req.body?.instructions === 'string' && req.body.instructions.trim()
        ? req.body.instructions.trim().slice(0, 1000)
        : DEFAULT_INTERVIEW_TTS_INSTRUCTIONS;
      const client = getOpenAIClient();
      const speech = await client.audio.speech.create({
        model,
        voice: voice as any,
        input: text,
        instructions,
        response_format: responseFormat as any,
      });
      const buffer = Buffer.from(await speech.arrayBuffer());

      await recordAiProxyAuditLog({
        user,
        endpoint,
        model,
        outcome: 'success',
        statusCode: 200,
        estimatedUnits,
        latencyMs: Date.now() - startedAt,
      });

      res.header('Cache-Control', 'private, max-age=3600');
      res.type(responseFormat === 'mp3' ? 'audio/mpeg' : `audio/${responseFormat}`);
      res.send(buffer);
    } catch (error) {
      const statusCode = typeof error === 'object' && error && 'statusCode' in error
        ? Number((error as { statusCode?: number }).statusCode)
        : 502;
      const outcome: AiProxyOutcome = statusCode === 503 ? 'config_error' : 'provider_error';
      const telemetry = aiProviderTelemetry(error);
      await recordAiProxyAuditLog({
        user,
        endpoint,
        model,
        outcome,
        statusCode: Number.isFinite(statusCode) ? statusCode : 502,
        estimatedUnits,
        latencyMs: Date.now() - startedAt,
        providerStatus: telemetry.providerStatus,
        providerCode: telemetry.providerCode,
        errorMessage: telemetry.message,
      });
      if (outcome === 'config_error') {
        next(error);
        return;
      }
      console.warn('AI provider speech generation failed:', {
        userId: user.id,
        providerStatus: telemetry.providerStatus,
        providerCode: telemetry.providerCode,
      });
      res.status(502).json({ error: 'AI 음성 생성에 실패했습니다.' });
    }
  });

  app.post('/api/audio/transcriptions', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const fileKey = String(req.body.fileKey ?? '');
      const parsed = parseLocalFileKey(fileKey);
      if (parsed.kind !== 'audio') {
        res.status(400).json({ error: '음성 파일만 텍스트로 변환할 수 있습니다.' });
        return;
      }

      // 예전에는 fileKey만 있으면 남의 음성 파일도 그대로 받아쓰기 할 수 있었습니다.
      // 방금 올린 파일은 업로드 토큰으로, 이미 저장된 파일은 DB 소유권으로 확인합니다.
      if (!verifyLocalFileUploadToken(req.body.uploadToken, fileKey, req.user!.id)) {
        await assertCurrentUserCanAccessLocalFile(req.user!, fileKey);
      }

      const filePath = resolveLocalFileKey(fileKey);
      await fs.access(filePath);

      const client = getOpenAIClient();
      const transcription = await client.audio.transcriptions.create({
        file: createReadStream(filePath) as any,
        model: process.env.OPENAI_TRANSCRIBE_MODEL || 'whisper-1',
        language: 'ko',
      });
      const text = typeof transcription.text === 'string' ? transcription.text.trim() : '';
      if (!text) {
        res.status(422).json({ error: '음성에서 텍스트를 인식하지 못했습니다. 직접 입력으로 저장해 주세요.' });
        return;
      }

      res.json({ fileKey, text });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/interview-schedules', requireRole('guardian'), async (req, res, next) => {
    try {
      const seniorId = await resolveGuardianSeniorId(req.user!.id, req.body.seniorId ? String(req.body.seniorId) : undefined);
      const schedule = await prisma.interviewSchedule.create({
        data: {
          seniorId,
          guardianId: req.user!.id,
          scheduledAt: new Date(req.body.scheduledAt),
          timezone: req.body.timezone ?? 'Asia/Seoul',
        },
      });
      res.status(201).json({ schedule });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/interview-schedules', requireRole('guardian'), async (req, res, next) => {
    try {
      const schedules = await prisma.interviewSchedule.findMany({
        where: { guardianId: req.user!.id },
        orderBy: { scheduledAt: 'asc' },
      });
      res.json({ schedules });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/interview-schedules/:id/call-now', requireRole('guardian'), async (req, res, next) => {
    try {
      const schedule = await prisma.interviewSchedule.findUnique({ where: { id: req.params.id } });
      if (!schedule || schedule.guardianId !== req.user!.id) {
        res.status(404).json({ error: '스케줄을 찾을 수 없습니다.' });
        return;
      }
      const result = await sendAppInterviewCall({
        seniorId: schedule.seniorId,
        guardianId: req.user!.id,
        scheduleId: schedule.id,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/app-calls', requireRole('guardian'), async (req, res, next) => {
    try {
      const seniorId = await resolveGuardianSeniorId(req.user!.id, req.body.seniorId ? String(req.body.seniorId) : undefined);
      const result = await sendAppInterviewCall({
        seniorId,
        guardianId: req.user!.id,
        chapterId: req.body.chapterId,
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/interview-sessions', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const seniorId = req.user!.role === 'senior'
        ? req.user!.id
        : await resolveGuardianSeniorId(req.user!.id, req.body.seniorId ? String(req.body.seniorId) : undefined);
      const firstChapter = await prisma.chapter.findFirst({ orderBy: { order: 'asc' } });
      const session = await prisma.interviewSession.create({
        data: {
          seniorId,
          chapterId: req.body.chapterId ?? firstChapter?.id ?? 'childhood',
          mode: req.body.mode ?? 'photo',
          currentQuestionId: req.body.currentQuestionId,
        },
      });
      res.status(201).json({ session });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/interview-sessions/:id/pause', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const existing = await prisma.interviewSession.findUnique({ where: { id: req.params.id } });
      if (!existing) {
        res.status(404).json({ error: '인터뷰 세션을 찾을 수 없습니다.' });
        return;
      }
      await assertCurrentUserCanAccessSenior(req.user!, existing.seniorId);
      const session = await prisma.interviewSession.update({
        where: { id: req.params.id },
        data: { status: 'paused', pausedAt: new Date() },
      });
      res.json({ session });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/interview-sessions/:id/accept', requireRole('senior'), async (req, res, next) => {
    try {
      const existing = await prisma.interviewSession.findUnique({ where: { id: req.params.id } });
      if (!existing) {
        res.status(404).json({ error: '인터뷰 세션을 찾을 수 없습니다.' });
        return;
      }
      await assertCurrentUserCanAccessSenior(req.user!, existing.seniorId);
      const session = await prisma.interviewSession.update({
        where: { id: req.params.id },
        data: { status: 'active' },
      });
      res.json({ session });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/interview-sessions/:id/end', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const existing = await prisma.interviewSession.findUnique({ where: { id: req.params.id } });
      if (!existing) {
        res.status(404).json({ error: '인터뷰 세션을 찾을 수 없습니다.' });
        return;
      }
      await assertCurrentUserCanAccessSenior(req.user!, existing.seniorId);
      const session = await prisma.interviewSession.update({
        where: { id: req.params.id },
        data: { status: req.body.status === 'missed' ? 'missed' : 'ended', endedAt: new Date() },
      });
      res.json({ session });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/interview-records', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const userId = req.user!.role === 'senior'
        ? req.user!.id
        : await resolveGuardianSeniorId(req.user!.id, req.body.userId ? String(req.body.userId) : undefined);
      const question = req.body.questionId
        ? await assertCurrentUserCanAccessQuestion(req.user!, String(req.body.questionId))
        : null;
      if (question?.seniorId && question.seniorId !== userId) {
        res.status(400).json({ error: '답변 대상과 질문 대상 부모님이 일치하지 않습니다.' });
        return;
      }
      if (req.body.sessionId) {
        const session = await prisma.interviewSession.findUnique({ where: { id: String(req.body.sessionId) } });
        if (!session) {
          res.status(404).json({ error: '인터뷰 세션을 찾을 수 없습니다.' });
          return;
        }
        await assertCurrentUserCanAccessSenior(req.user!, session.seniorId);
        if (session.seniorId !== userId) {
          res.status(400).json({ error: '답변 대상과 인터뷰 세션의 부모님이 일치하지 않습니다.' });
          return;
        }
      }
      const record = await prisma.interviewRecord.create({
        data: {
          userId,
          chapterId: req.body.chapterId,
          questionId: req.body.questionId,
          sessionId: req.body.sessionId,
          audioFileKey: req.body.audioFileKey ?? 'audio/manual-entry.txt',
          transcriptText: String(req.body.transcriptText ?? ''),
          aiSummary: req.body.aiSummary ? String(req.body.aiSummary) : undefined,
          mode: req.body.mode ?? 'photo',
          source: req.body.source ?? 'app',
          publish: req.body.publish !== undefined ? Boolean(req.body.publish) : undefined,
          chatbot: req.body.chatbot !== undefined ? Boolean(req.body.chatbot) : undefined,
        },
      });

      if (isFreeSpeech({ questionText: question?.text, transcriptText: record.transcriptText })) {
        await prisma.freeSpeechRecord.create({
          data: {
            userId: record.userId,
            chapterId: record.chapterId,
            sessionId: record.sessionId,
            audioFileKey: record.audioFileKey,
            transcriptText: record.transcriptText,
            recordedAt: record.recordedAt,
          },
        });
      }

      if (question && question.category !== 'common_questions') {
        await prisma.question.update({
          where: { id: question.id },
          data: {
            status: 'answered',
            answeredAt: record.recordedAt,
            answerRecordId: record.id,
          },
        });
      }

      res.status(201).json({ record });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/interview-records/:id', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const existing = await prisma.interviewRecord.findUnique({ where: { id: req.params.id } });
      if (!existing) {
        res.status(404).json({ error: '인터뷰 기록을 찾을 수 없습니다.' });
        return;
      }
      await assertCurrentUserCanAccessSenior(req.user!, existing.userId);
      const reviewStatus = req.body.reviewStatus !== undefined ? String(req.body.reviewStatus) : undefined;
      if (reviewStatus && !['pending', 'applied', 'revision_requested'].includes(reviewStatus)) {
        res.status(400).json({ error: '지원하지 않는 검수 상태입니다.' });
        return;
      }
      const record = await prisma.interviewRecord.update({
        where: { id: req.params.id },
        data: {
          ...(req.body.transcriptText !== undefined ? { transcriptText: String(req.body.transcriptText) } : {}),
          ...(req.body.aiSummary !== undefined ? { aiSummary: req.body.aiSummary ? String(req.body.aiSummary) : null } : {}),
          ...(req.body.publish !== undefined ? { publish: Boolean(req.body.publish) } : {}),
          ...(req.body.chatbot !== undefined ? { chatbot: Boolean(req.body.chatbot) } : {}),
          ...(reviewStatus ? { reviewStatus } : {}),
          ...(reviewStatus === 'applied' && req.body.reviewedAt === undefined ? { reviewedAt: new Date() } : {}),
          ...(reviewStatus && reviewStatus !== 'applied' && req.body.reviewedAt === undefined ? { reviewedAt: null } : {}),
          ...(req.body.reviewedAt !== undefined ? { reviewedAt: req.body.reviewedAt ? new Date(String(req.body.reviewedAt)) : null } : {}),
          ...(req.body.reviewRequestText !== undefined ? { reviewRequestText: req.body.reviewRequestText ? String(req.body.reviewRequestText) : null } : {}),
        },
      });
      res.json({ record });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/interview-records/bulk-consent', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const { ids, publish, chatbot } = req.body;
      if (!Array.isArray(ids)) {
        res.status(400).json({ error: 'ids는 배열이어야 합니다.' });
        return;
      }
      const records = await prisma.interviewRecord.findMany({
        where: { id: { in: ids.map(String) } },
        select: { id: true, userId: true },
      });
      if (records.length !== ids.length) {
        res.status(404).json({ error: '일부 인터뷰 기록을 찾을 수 없습니다.' });
        return;
      }
      for (const record of records) {
        await assertCurrentUserCanAccessSenior(req.user!, record.userId);
      }
      await prisma.interviewRecord.updateMany({
        where: { id: { in: ids.map(String) } },
        data: {
          ...(publish !== undefined ? { publish: Boolean(publish) } : {}),
          ...(chatbot !== undefined ? { chatbot: Boolean(chatbot) } : {}),
        },
      });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/calendar-events', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const userId = req.user!.role === 'senior'
        ? req.user!.id
        : await resolveGuardianSeniorId(req.user!.id, req.query.seniorId?.toString());
      const events = await prisma.calendarEvent.findMany({
        where: { userId },
        orderBy: { eventDate: 'asc' },
      });
      const mappedEvents = events.map(e => ({
        eventId: e.id,
        eventType: e.eventType,
        eventDate: e.eventDate,
        relatedPersons: JSON.parse(e.relatedPersons || '[]'),
        recipientId: e.recipientId
      }));
      res.json({ events: mappedEvents });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/calendar-events', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const userId = req.user!.role === 'senior'
        ? req.user!.id
        : await resolveGuardianSeniorId(req.user!.id, req.body.seniorId?.toString());
      const { eventType, eventDate, relatedPersons, recipientId } = req.body;
      const event = await prisma.calendarEvent.create({
        data: {
          userId,
          eventType: String(eventType),
          eventDate: String(eventDate),
          relatedPersons: relatedPersons ? JSON.stringify(relatedPersons) : '[]',
          recipientId: recipientId || 'family-group',
        },
      });
      res.status(201).json({
        event: {
          eventId: event.id,
          eventType: event.eventType,
          eventDate: event.eventDate,
          relatedPersons: JSON.parse(event.relatedPersons || '[]'),
          recipientId: event.recipientId
        }
      });
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/calendar-events/:id', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const event = await prisma.calendarEvent.findUnique({
        where: { id: req.params.id }
      });
      if (!event) {
        res.status(404).json({ error: '이벤트를 찾을 수 없습니다.' });
        return;
      }
      await assertCurrentUserCanAccessSenior(req.user!, event.userId);
      await prisma.calendarEvent.delete({
        where: { id: req.params.id }
      });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/progress', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const seniorId = req.user!.role === 'senior'
        ? req.user!.id
        : await resolveGuardianSeniorId(req.user!.id, req.query.seniorId?.toString());
      const chapters = await prisma.chapter.findMany({ orderBy: { order: 'asc' } });
      const rows = await Promise.all(chapters.map(async (chapter) => {
        const count = await prisma.interviewRecord.count({ where: { userId: seniorId, chapterId: chapter.id } });
        return { chapter, count, complete: count >= chapter.minAnswerCount };
      }));
      const total = rows.reduce((sum, row) => sum + row.count, 0);
      const emoji = total >= 90 ? '🌳' : total >= 45 ? '🌿' : total >= 15 ? '🌱' : '🌰';
      res.json({ progress: rows, totalRecords: total, character: emoji, seniorId });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/progress/:seniorId', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      await assertCurrentUserCanAccessSenior(req.user!, req.params.seniorId);
      const chapters = await prisma.chapter.findMany({ orderBy: { order: 'asc' } });
      const rows = await Promise.all(chapters.map(async (chapter) => {
        const count = await prisma.interviewRecord.count({ where: { userId: req.params.seniorId, chapterId: chapter.id } });
        return { chapter, count, complete: count >= chapter.minAnswerCount };
      }));
      const total = rows.reduce((sum, row) => sum + row.count, 0);
      const emoji = total >= 90 ? '🌳' : total >= 45 ? '🌿' : total >= 15 ? '🌱' : '🌰';
      res.json({ progress: rows, totalRecords: total, character: emoji });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/free-speech', requireRole('guardian'), async (req, res, next) => {
    try {
      const seniorId = await resolveGuardianSeniorId(req.user!.id, req.query.seniorId?.toString());
      const records = await prisma.freeSpeechRecord.findMany({
        where: { userId: seniorId },
        orderBy: { recordedAt: 'desc' },
        include: { chapter: true },
      });
      
      const vault = await prisma.legacyVault.findUnique({
        where: { seniorId }
      });
      
      const isMasked = vault && vault.isVaultSetup && vault.deathVerificationStatus !== 'released';
      
      const filteredRecords = records.map(record => {
        const audioUrl = buildLocalFileUrl(record.audioFileKey);
        if (isMasked) {
          return {
            ...record,
            transcriptText: "[유산 암호화 설정으로 잠겨 있습니다. 사후 전수 시에만 해독할 수 있습니다.]",
            audioUrl,
          };
        }
        return { ...record, audioUrl };
      });
      
      res.json({ records: filteredRecords });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/push-subscriptions', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const keys = req.body.keys ?? {};
      // 구독 소유자는 반드시 인증된 사용자입니다. 예전에는 req.body.userId를 그대로 믿어서
      // 누구나 남의 사용자 ID로 자기 엔드포인트를 등록하고 그 사람의 알림을 대신 받을 수 있었습니다.
      const subscription = await prisma.pushSubscription.upsert({
        where: { endpoint: req.body.endpoint },
        update: {
          p256dh: keys.p256dh,
          auth: keys.auth,
          userAgent: req.header('user-agent') ?? '',
        },
        create: {
          userId: req.user!.id,
          endpoint: req.body.endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          userAgent: req.header('user-agent') ?? '',
        },
      });
      res.status(201).json({ subscription });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/notifications', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const limit = Math.min(Number(req.query.limit ?? 20) || 20, 50);
      const notifications = await prisma.notification.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      const unreadCount = await prisma.notification.count({
        where: { userId: req.user!.id, status: 'unread' },
      });
      res.json({ notifications: notifications.map(serializeNotification), unreadCount });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/notifications/:id/read', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const notification = await prisma.notification.findFirst({
        where: { id: req.params.id, userId: req.user!.id },
      });
      if (!notification) {
        res.status(404).json({ error: '알림을 찾을 수 없습니다.' });
        return;
      }
      const updated = await prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'read', readAt: notification.readAt ?? new Date() },
      });
      res.json({ notification: serializeNotification(updated) });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/nudges', requireRole('guardian'), async (req, res, next) => {
    try {
      const seniorId = await resolveGuardianSeniorId(req.user!.id, req.body.seniorId ? String(req.body.seniorId) : undefined);
      const result = await sendWebPush(seniorId, {
        type: 'nudge',
        title: 'Dearlog에서 기다리고 있어요',
        body: '가족이 오늘의 이야기를 조금 더 듣고 싶어 합니다.',
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/cover-designs/generate', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const seniorId = req.user!.role === 'senior'
        ? req.user!.id
        : await resolveGuardianSeniorId(req.user!.id, req.body.seniorId ? String(req.body.seniorId) : undefined);
      // 출판 동의를 철회한 기록은 표지 분석에도 넘기지 않습니다.
      // 여기를 거르지 않으면 책에서 빠진 이야기가 AI 제공자에게는 그대로 전송됩니다.
      const records = await prisma.interviewRecord.findMany({ where: { userId: seniorId, publish: true } });
      const decision = await decideCoverDesign(records.map((record) => record.transcriptText), {
        userId: req.user!.id,
        role: req.user!.role,
      });
      const requestedCount = Math.max(1, Math.min(3, Number(req.body.count) || 1));
      const decisions = buildCoverDecisionCandidates(decision, requestedCount);
      const candidates = await Promise.all(decisions.map(async (candidate) => {
        const coverDesign = await prisma.coverDesign.create({
          data: {
            userId: seniorId,
            palette: candidate.palette,
            template: candidate.template,
            font: candidate.font,
            analysisJson: JSON.stringify(candidate.analysis),
          },
        });
        return { coverDesign, analysis: candidate.analysis };
      }));
      res.status(201).json({
        coverDesign: candidates[0].coverDesign,
        analysis: candidates[0].analysis,
        coverDesigns: candidates.map((candidate) => candidate.coverDesign),
        candidates,
      });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/cover-designs/:id/confirm', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      await assertCurrentUserCanAccessCoverDesign(req.user!, req.params.id);
      const coverDesign = await prisma.coverDesign.update({
        where: { id: req.params.id },
        data: { confirmedAt: new Date() },
      });
      res.json({ coverDesign });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/publication-requests', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const seniorId = req.user!.role === 'senior'
        ? req.user!.id
        : await resolveGuardianSeniorId(req.user!.id, req.body.seniorId ? String(req.body.seniorId) : undefined);
      const cover = await prisma.coverDesign.findFirst({
        where: { userId: seniorId, confirmedAt: { not: null } },
        orderBy: { confirmedAt: 'desc' },
      });
      const request = await prisma.publicationRequest.create({
        data: {
          userId: seniorId,
          requestedById: req.user!.id,
          coverDesignId: cover?.id,
          format: req.body.format === 'B5' ? 'B5' : 'A5',
          status: 'generating',
        },
      });
      const result = await generateLocalPrintPdf({
        seniorId,
        coverDesignId: cover?.id,
        format: request.format as 'A5' | 'B5',
        toneProfileOverride: normalizeToneProfile(req.body.toneProfile),
        usageContext: {
          userId: req.user!.id,
          role: req.user!.role,
        },
      });
      const updated = await prisma.publicationRequest.update({
        where: { id: request.id },
        data: {
          status: 'ready',
          pdfFileKey: result.pdfFileKey,
          draftCacheId: result.draftCacheId,
        },
      });
      res.status(201).json({
        publicationRequest: updated,
        cacheStatus: result.cacheStatus,
        sourceHash: result.sourceHash,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/publication-preview-jobs', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const seniorId = req.user!.role === 'senior'
        ? req.user!.id
        : await resolveGuardianSeniorId(req.user!.id, req.body.seniorId ? String(req.body.seniorId) : undefined);
      const cover = await prisma.coverDesign.findFirst({
        where: { userId: seniorId, confirmedAt: { not: null } },
        orderBy: { confirmedAt: 'desc' },
      });
      const job = await startLocalPublicationPreviewJob({
        seniorId,
        requestedById: req.user!.id,
        coverDesignId: cover?.id,
        forceRefresh: req.body.forceRefresh === true,
        format: req.body.format === 'B5' ? 'B5' : 'A5',
        toneProfileOverride: normalizeToneProfile(req.body.toneProfile),
        usageContext: {
          userId: req.user!.id,
          role: req.user!.role,
        },
      });
      res.header('Cache-Control', 'no-store');
      res.status(job.status === 'ready' ? 200 : 202).json({
        job,
        ...(job.draft ? {
          html: job.draft.html,
          editorialPlan: job.draft.editorialPlan,
          writingDraft: job.draft.writingDraft,
          manifest: job.draft.manifest,
          cacheStatus: job.cacheStatus,
          draftCacheId: job.draftCacheId,
          sourceHash: job.sourceHash,
        } : {}),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/publication-preview-jobs/:id', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const existing = await prisma.publicationPreviewJob.findUnique({
        where: { id: req.params.id },
        select: { userId: true },
      });
      if (!existing) {
        res.status(404).json({ error: '기록집 미리보기 작업을 찾을 수 없습니다.' });
        return;
      }
      await assertCurrentUserCanAccessSenior(req.user!, existing.userId);
      const job = await getLocalPublicationPreviewJob(req.params.id);
      if (!job) {
        res.status(404).json({ error: '기록집 미리보기 작업을 찾을 수 없습니다.' });
        return;
      }
      res.header('Cache-Control', 'no-store');
      res.json({
        job,
        ...(job.draft ? {
          html: job.draft.html,
          editorialPlan: job.draft.editorialPlan,
          writingDraft: job.draft.writingDraft,
          manifest: job.draft.manifest,
          cacheStatus: job.cacheStatus,
          draftCacheId: job.draftCacheId,
          sourceHash: job.sourceHash,
        } : {}),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/publication-preview', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const seniorId = req.user!.role === 'senior'
        ? req.user!.id
        : await resolveGuardianSeniorId(req.user!.id, req.query.seniorId?.toString());
      const cover = await prisma.coverDesign.findFirst({
        where: { userId: seniorId, confirmedAt: { not: null } },
        orderBy: { confirmedAt: 'desc' },
      });
      const job = await startLocalPublicationPreviewJob({
        seniorId,
        requestedById: req.user!.id,
        coverDesignId: cover?.id,
        forceRefresh: req.query.forceRefresh === 'true',
        format: req.query.format === 'B5' ? 'B5' : 'A5',
        toneProfileOverride: normalizeToneProfileFromQuery(req.query),
        usageContext: {
          userId: req.user!.id,
          role: req.user!.role,
        },
      });
      res.header('Cache-Control', 'no-store');
      if (job.status !== 'ready' || !job.draft) {
        res.status(202).json({ job });
        return;
      }
      res.json({
        job,
        html: job.draft.html,
        editorialPlan: job.draft.editorialPlan,
        writingDraft: job.draft.writingDraft,
        manifest: job.draft.manifest,
        cacheStatus: job.cacheStatus,
        draftCacheId: job.draftCacheId,
        sourceHash: job.sourceHash,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/interview-records', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const seniorId = req.user!.role === 'senior'
        ? req.user!.id
        : await resolveGuardianSeniorId(req.user!.id, req.query.seniorId?.toString());
        
      const records = await prisma.interviewRecord.findMany({
        where: { userId: seniorId },
        orderBy: { recordedAt: 'desc' },
        include: { chapter: true, question: true }
      });
      
      const vault = await prisma.legacyVault.findUnique({
        where: { seniorId }
      });
      
      const isMasked = vault && vault.isVaultSetup && vault.deathVerificationStatus !== 'released';
      
      const filteredRecords = await Promise.all(records.map(async record => {
        const audioUrl = isMasked ? null : await buildPlayableAudioUrl(record.audioFileKey);
        if (isMasked) {
          return {
            ...record,
            transcriptText: "[유산 암호화 설정으로 잠겨 있습니다. 사후 전수 시에만 해독할 수 있습니다.]",
            audioUrl,
          };
        }
        return { ...record, audioUrl };
      }));
      
      res.json({ records: filteredRecords });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/memories', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const seniorId = req.user!.role === 'senior'
        ? req.user!.id
        : await resolveGuardianSeniorId(req.user!.id, req.query.seniorId?.toString());

      const memories = await prisma.memory.findMany({
        where: { userId: seniorId },
        include: { tags: true, consentSettings: true, vectorEntry: true },
        orderBy: { date: 'desc' }
      });

      const vault = await prisma.legacyVault.findUnique({
        where: { seniorId }
      });

      const isMasked = vault && vault.isVaultSetup && vault.deathVerificationStatus !== 'released';

      const isGuardianRequest = req.user!.role === 'guardian';

      const mappedMemories = memories.map(m => {
        const baseMemory = mapMemoryToResponse(m);
        if (isMasked) {
          return {
            ...baseMemory,
            topic: "[유산 암호화 설정으로 잠겨 있습니다. 사후 전수 시에만 해독할 수 있습니다.]",
            originalTranscript: "[유산 암호화 설정으로 잠겨 있습니다. 사후 전수 시에만 해독할 수 있습니다.]",
            cleanedTranscript: "[유산 암호화 설정으로 잠겨 있습니다. 사후 전수 시에만 해독할 수 있습니다.]",
            publishVersion: "[유산 암호화 설정으로 잠겨 있습니다. 사후 전수 시에만 해독할 수 있습니다.]",
            embedding: null
          };
        }

        // 가족열람을 철회한 기억은 본문을 가족에게 보내지 않습니다. 예전에는 동의 상태만
        // 'revoked'로 표시하고 originalTranscript와 embedding은 그대로 내려보내서,
        // 화면에서만 가려지고 API 응답에는 전문이 남아 있었습니다.
        // 부모님 본인은 자기 기억을 계속 볼 수 있어야 하므로 보호자 요청에만 적용합니다.
        if (isGuardianRequest && baseMemory.consent?.status === 'revoked') {
          return {
            ...baseMemory,
            originalTranscript: '',
            cleanedTranscript: '',
            publishVersion: '',
            embedding: null,
            familyReadRevoked: true,
          };
        }

        // 챗봇 활용을 철회하면 임베딩 사본도 함께 내려보내지 않습니다.
        if (baseMemory.consentSettings?.챗봇 === 'revoked') {
          return { ...baseMemory, embedding: null };
        }

        return baseMemory;
      });

      res.json({ memories: mappedMemories });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/memories', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const {
        id,
        date,
        topic,
        originalTranscript,
        cleanedTranscript,
        publishVersion,
        tags,
        privacy,
        confidenceLabel,
        contradictions,
        consentSettings: requestedConsentSettings,
        embedding
      } = req.body;
      const consentSettings = validateMemoryConsentSettings(requestedConsentSettings);

      const seniorId = req.user!.role === 'senior'
        ? req.user!.id
        : await resolveGuardianSeniorId(req.user!.id, req.body.seniorId);

      const parsedContradictions = contradictions ? JSON.stringify(contradictions) : "[]";

      const memory = await prisma.$transaction(async (tx) => {
        const created = await tx.memory.create({
          data: {
            id: id || undefined,
            userId: seniorId,
            date: date ? new Date(date) : undefined,
            topic,
            originalTranscript,
            cleanedTranscript,
            publishVersion,
            privacy: privacy || 'private',
            confidenceLabel: confidenceLabel || '확인됨',
            contradictions: parsedContradictions,
            tags: tags ? {
              create: [
                ...(tags.people || []).map((v: string) => ({ category: 'people', value: v })),
                ...(tags.places || []).map((v: string) => ({ category: 'places', value: v })),
                ...(tags.emotions || []).map((v: string) => ({ category: 'emotions', value: v })),
                ...(tags.timePeriod ? [{ category: 'timePeriod', value: tags.timePeriod }] : [])
              ]
            } : undefined,
            consentSettings: consentSettings ? {
              create: {
                publish: consentSettings.출판 || 'granted',
                familyRead: consentSettings.가족열람 || 'granted',
                chatbot: consentSettings.챗봇 || 'granted',
                posthumous: consentSettings.사후공개 || 'granted',
                sensitive: consentSettings.민감정보 || 'granted'
              }
            } : {
              create: {
                publish: 'granted',
                familyRead: 'granted',
                chatbot: 'granted',
                posthumous: 'granted',
                sensitive: 'granted'
              }
            }
          },
          include: {
            tags: true,
            consentSettings: true,
            vectorEntry: true
          }
        });

        if (embedding) {
          await tx.memoryVectorEntry.create({
            data: {
              memoryId: created.id,
              embeddingJson: JSON.stringify(embedding),
              text: `${topic}\n${cleanedTranscript}`
            }
          });
        }

        return created;
      });

      const finalMemory = await prisma.memory.findUnique({
        where: { id: memory.id },
        include: { tags: true, consentSettings: true, vectorEntry: true }
      });

      res.status(201).json({ memory: finalMemory ? mapMemoryToResponse(finalMemory) : null });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/memories/:id', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const existing = await prisma.memory.findUnique({
        where: { id: req.params.id },
        select: { userId: true },
      });
      if (!existing) {
        res.status(404).json({ error: '기억을 찾을 수 없습니다.' });
        return;
      }
      await assertCurrentUserCanAccessSenior(req.user!, existing.userId);
      const {
        privacy,
        publishVersion,
        confidenceLabel,
        contradictions,
        consentSettings: requestedConsentSettings,
        embedding
      } = req.body;
      const consentSettings = validateMemoryConsentSettings(requestedConsentSettings);

      const parsedContradictions = contradictions ? JSON.stringify(contradictions) : undefined;

      await prisma.$transaction(async (tx) => {
        const memory = await tx.memory.update({
          where: { id: req.params.id },
          data: {
            privacy: privacy || undefined,
            publishVersion: publishVersion || undefined,
            confidenceLabel: confidenceLabel || undefined,
            contradictions: parsedContradictions,
            consentSettings: consentSettings ? {
              upsert: {
                create: {
                  publish: consentSettings.출판 || 'granted',
                  familyRead: consentSettings.가족열람 || 'granted',
                  chatbot: consentSettings.챗봇 || 'granted',
                  posthumous: consentSettings.사후공개 || 'granted',
                  sensitive: consentSettings.민감정보 || 'granted'
                },
                update: {
                  publish: consentSettings.출판 || undefined,
                  familyRead: consentSettings.가족열람 || undefined,
                  chatbot: consentSettings.챗봇 || undefined,
                  posthumous: consentSettings.사후공개 || undefined,
                  sensitive: consentSettings.민감정보 || undefined
                }
              }
            } : undefined
          }
        });

        if (embedding !== undefined) {
          if (embedding === null) {
            await tx.memoryVectorEntry.deleteMany({
              where: { memoryId: req.params.id }
            });
          } else {
            await tx.memoryVectorEntry.upsert({
              where: { memoryId: req.params.id },
              create: {
                memoryId: req.params.id,
                embeddingJson: JSON.stringify(embedding),
                text: `${memory.topic}\n${memory.cleanedTranscript}`
              },
              update: {
                embeddingJson: JSON.stringify(embedding),
                text: `${memory.topic}\n${memory.cleanedTranscript}`
              }
            });
          }
        }
      });

      const finalMemory = await prisma.memory.findUnique({
        where: { id: req.params.id },
        include: { tags: true, consentSettings: true, vectorEntry: true }
      });

      res.json({ memory: finalMemory ? mapMemoryToResponse(finalMemory) : null });
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/memories/:id', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const existing = await prisma.memory.findUnique({
        where: { id: req.params.id },
        select: { userId: true },
      });
      if (!existing) {
        res.status(404).json({ error: '기억을 찾을 수 없습니다.' });
        return;
      }
      await assertCurrentUserCanAccessSenior(req.user!, existing.userId);
      await prisma.memory.delete({
        where: { id: req.params.id }
      });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  // --- Photo Endpoints ---
  app.get('/api/photos', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const seniorId = req.user!.role === 'senior'
        ? req.user!.id
        : await resolveGuardianSeniorId(req.user!.id, req.query.seniorId?.toString());

      const photos = await prisma.photo.findMany({
        where: { userId: seniorId },
        include: { questions: true },
        orderBy: { uploadedAt: 'desc' }
      });

      res.json({ photos: photos.map(mapPhotoToResponse) });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/photos/:id', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const { linkedMemoryIds } = req.body;
      const parsedLinkedMemoryIds = linkedMemoryIds ? JSON.stringify(linkedMemoryIds) : undefined;
      const existing = await prisma.photo.findUnique({
        where: { id: req.params.id },
        select: { userId: true },
      });
      if (!existing) {
        res.status(404).json({ error: '사진을 찾을 수 없습니다.' });
        return;
      }
      await assertCurrentUserCanAccessSenior(req.user!, existing.userId);

      if (Array.isArray(linkedMemoryIds) && linkedMemoryIds.length > 0) {
        const linkedMemories = await prisma.memory.findMany({
          where: { id: { in: linkedMemoryIds.map(String) } },
          select: { id: true, userId: true },
        });
        if (linkedMemories.length !== linkedMemoryIds.length || linkedMemories.some((m) => m.userId !== existing.userId)) {
          res.status(400).json({ error: '사진과 같은 부모님의 기억만 연결할 수 있습니다.' });
          return;
        }
      }

      const photo = await prisma.photo.update({
        where: { id: req.params.id },
        data: {
          linkedMemoryIds: parsedLinkedMemoryIds
        }
      });

      res.json({ photo: mapPhotoToResponse(photo) });
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/photos/:id', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const existing = await prisma.photo.findUnique({
        where: { id: req.params.id },
        select: { userId: true },
      });
      if (!existing) {
        res.status(404).json({ error: '사진을 찾을 수 없습니다.' });
        return;
      }
      await assertCurrentUserCanAccessSenior(req.user!, existing.userId);
      await prisma.photo.delete({
        where: { id: req.params.id }
      });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  // --- Family Question Endpoints ---
  app.get('/api/family-questions', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const seniorId = req.user!.role === 'senior'
        ? req.user!.id
        : await resolveGuardianSeniorId(req.user!.id, req.query.seniorId?.toString());

      const questions = await prisma.question.findMany({
        where: {
          category: { in: ['guardian_questions', 'family_question', 'photo_questions'] },
          seniorId,
        },
        include: { photo: true },
        orderBy: { createdAt: 'desc' }
      });

      res.json({ questions: questions.map(mapQuestionToResponse) });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/questions/:id', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const { text, priority, status, anonymous, answerMemoryId } = req.body;
      const existing = await assertCurrentUserCanAccessQuestion(req.user!, req.params.id);

      // 공통 질문은 seniorId가 없어 모든 가족이 같은 행을 공유한다. 답변 상태 외에
      // 질문 내용이나 우선순위를 고치면 다른 가족의 화면까지 바뀐다.
      // DELETE는 이미 같은 이유로 막혀 있었는데 PATCH만 빠져 있었다.
      if (existing.category === 'common_questions' && (text !== undefined || priority !== undefined)) {
        res.status(403).json({ error: '공통 질문의 내용은 수정할 수 없습니다.' });
        return;
      }

      if (answerMemoryId) {
        const memory = await prisma.memory.findUnique({
          where: { id: String(answerMemoryId) },
          select: { userId: true },
        });
        if (!memory) {
          res.status(404).json({ error: '답변 기억을 찾을 수 없습니다.' });
          return;
        }
        await assertCurrentUserCanAccessSenior(req.user!, memory.userId);
        if (existing.seniorId && memory.userId !== existing.seniorId) {
          res.status(400).json({ error: '질문 대상 부모님의 답변 기억만 연결할 수 있습니다.' });
          return;
        }
      }

      const question = await prisma.question.update({
        where: { id: req.params.id },
        data: {
          text: text !== undefined ? String(text).trim() : undefined,
          priority: priority || undefined,
          status: status || undefined,
          anonymous: anonymous !== undefined ? Boolean(anonymous) : undefined,
          answerMemoryId: answerMemoryId !== undefined ? answerMemoryId : undefined,
          answeredAt: status === 'answered' ? new Date() : undefined
        },
        include: { photo: true },
      });

      res.json({ question: mapQuestionToResponse(question) });
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/questions/:id', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const existing = await assertCurrentUserCanAccessQuestion(req.user!, req.params.id);
      if (existing.category === 'common_questions') {
        res.status(403).json({ error: '공통 질문은 삭제할 수 없습니다.' });
        return;
      }
      await prisma.question.delete({
        where: { id: req.params.id }
      });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  // --- Autobiography Draft Endpoints ---
  app.get('/api/autobiography/draft', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const seniorId = req.user!.role === 'senior'
        ? req.user!.id
        : await resolveGuardianSeniorId(req.user!.id, req.query.seniorId?.toString());

      const draft = await prisma.autobiographyDraft.findUnique({
        where: { userId: seniorId }
      });

      res.json({ draft: draft ? mapAutobiographyDraftToResponse(draft) : null });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/autobiography/draft', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const { structure, narratives } = req.body;
      const seniorId = req.user!.role === 'senior'
        ? req.user!.id
        : await resolveGuardianSeniorId(req.user!.id, req.body.seniorId);

      const draft = await prisma.autobiographyDraft.upsert({
        where: { userId: seniorId },
        create: {
          userId: seniorId,
          structureJson: structure ? JSON.stringify(structure) : '{}',
          narrativesJson: narratives ? JSON.stringify(narratives) : '[]',
          lastGenerated: new Date()
        },
        update: {
          structureJson: structure ? JSON.stringify(structure) : undefined,
          narrativesJson: narratives ? JSON.stringify(narratives) : undefined,
          lastGenerated: new Date()
        }
      });

      res.status(201).json({ draft: mapAutobiographyDraftToResponse(draft) });
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/autobiography/draft', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const seniorId = req.user!.role === 'senior'
        ? req.user!.id
        : await resolveGuardianSeniorId(req.user!.id, req.body.seniorId);

      await prisma.autobiographyDraft.deleteMany({
        where: { userId: seniorId }
      });

      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/legacy/vault', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const seniorId = req.user!.role === 'senior'
        ? req.user!.id
        : await resolveGuardianSeniorId(req.user!.id, req.body.seniorId ? String(req.body.seniorId) : undefined);
        
      const {
        encryptedMemories,
        encryptedAutobiography,
        serverShare,
        institutionShare
      } = req.body;
      
      const vault = await prisma.legacyVault.upsert({
        where: { seniorId },
        update: {
          isVaultSetup: true,
          encryptedMemories,
          encryptedAutobiography,
          serverShare,
          institutionShare,
          isDeceased: false,
          deathVerificationStatus: 'alive',
          serverShareReleased: false,
          institutionShareReleased: false,
          updatedAt: new Date()
        },
        create: {
          seniorId,
          isVaultSetup: true,
          encryptedMemories,
          encryptedAutobiography,
          serverShare,
          institutionShare,
          isDeceased: false,
          deathVerificationStatus: 'alive',
          serverShareReleased: false,
          institutionShareReleased: false,
        }
      });
      
      res.status(201).json({
        vault: {
          id: vault.id,
          seniorId: vault.seniorId,
          isVaultSetup: vault.isVaultSetup,
          deathVerificationStatus: vault.deathVerificationStatus,
          isDeceased: vault.isDeceased,
          serverShareReleased: vault.serverShareReleased,
          institutionShareReleased: vault.institutionShareReleased,
          createdAt: vault.createdAt,
          updatedAt: vault.updatedAt
        }
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/legacy/vault', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const seniorId = req.user!.role === 'senior'
        ? req.user!.id
        : await resolveGuardianSeniorId(req.user!.id, req.query.seniorId?.toString());
        
      const vault = await prisma.legacyVault.findUnique({
        where: { seniorId }
      });
      
      if (!vault) {
        res.json({ vault: { isVaultSetup: false } });
        return;
      }
      
      res.json({
        vault: {
          id: vault.id,
          seniorId: vault.seniorId,
          isVaultSetup: vault.isVaultSetup,
          deathVerificationStatus: vault.deathVerificationStatus,
          isDeceased: vault.isDeceased,
          serverShareReleased: vault.serverShareReleased,
          institutionShareReleased: vault.institutionShareReleased,
          encryptedMemories: vault.encryptedMemories,
          encryptedAutobiography: vault.encryptedAutobiography,
          createdAt: vault.createdAt,
          updatedAt: vault.updatedAt
        }
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/legacy/trigger-death', requireRole('guardian'), async (req, res, next) => {
    try {
      const seniorId = await resolveGuardianSeniorId(req.user!.id, req.body.seniorId ? String(req.body.seniorId) : undefined);
      
      const vault = await prisma.legacyVault.findUnique({
        where: { seniorId }
      });
      
      if (!vault || !vault.isVaultSetup) {
        res.status(400).json({ error: '유산 금고가 아직 개설되지 않았습니다.' });
        return;
      }

      const updatedVault = await prisma.legacyVault.update({
        where: { seniorId },
        data: {
          isDeceased: true,
          deathVerificationStatus: 'pending_verification',
          updatedAt: new Date()
        }
      });
      
      const notification = await prisma.notification.create({
        data: {
          userId: req.user!.id,
          relatedUserId: seniorId,
          type: 'legacy_death_triggered',
          title: '디지털 유산 전수 심사 개시',
          body: '어르신의 디지털 유산 전수를 위한 사망 심사가 시작되었습니다. 승인 후 데이터를 복원할 수 있습니다.',
          metadataJson: JSON.stringify({ seniorId })
        }
      });
      
      res.json({
        vault: {
          id: updatedVault.id,
          seniorId: updatedVault.seniorId,
          isVaultSetup: updatedVault.isVaultSetup,
          deathVerificationStatus: updatedVault.deathVerificationStatus,
          isDeceased: updatedVault.isDeceased,
          serverShareReleased: updatedVault.serverShareReleased,
          institutionShareReleased: updatedVault.institutionShareReleased
        },
        notification
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/legacy/approve-death', requireRole('guardian'), async (req, res, next) => {
    try {
      const seniorId = await resolveGuardianSeniorId(req.user!.id, req.body.seniorId ? String(req.body.seniorId) : undefined);
      
      const vault = await prisma.legacyVault.findUnique({
        where: { seniorId }
      });
      
      if (!vault || !vault.isVaultSetup) {
        res.status(400).json({ error: '유산 금고가 아직 개설되지 않았습니다.' });
        return;
      }

      if (!vault.isDeceased || vault.deathVerificationStatus !== 'pending_verification') {
        res.status(400).json({ error: '사망 심사 대기 상태에서만 승인할 수 있습니다.' });
        return;
      }
      
      const updatedVault = await prisma.legacyVault.update({
        where: { seniorId },
        data: {
          deathVerificationStatus: 'released',
          serverShareReleased: true,
          institutionShareReleased: true,
          updatedAt: new Date()
        }
      });
      
      const notification = await prisma.notification.create({
        data: {
          userId: req.user!.id,
          relatedUserId: seniorId,
          type: 'legacy_released',
          title: '디지털 유산 상속 준비 완료',
          body: '사망 심사가 최종 승인되었습니다. 가족 보관 키 조각과 승인된 기관 키 조각을 결합하여 유산을 복원하세요.',
          metadataJson: JSON.stringify({ seniorId })
        }
      });
      
      res.json({
        vault: {
          id: updatedVault.id,
          seniorId: updatedVault.seniorId,
          isVaultSetup: updatedVault.isVaultSetup,
          deathVerificationStatus: updatedVault.deathVerificationStatus,
          isDeceased: updatedVault.isDeceased,
          serverShareReleased: updatedVault.serverShareReleased,
          institutionShareReleased: updatedVault.institutionShareReleased
        },
        notification
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/legacy/shares', requireRole('guardian'), async (req, res, next) => {
    try {
      const seniorId = await resolveGuardianSeniorId(req.user!.id, req.query.seniorId?.toString());
      
      const vault = await prisma.legacyVault.findUnique({
        where: { seniorId }
      });
      
      if (!vault) {
        res.status(404).json({ error: '유산 금고를 찾을 수 없습니다.' });
        return;
      }
      
      if (vault.deathVerificationStatus !== 'released') {
        res.status(403).json({ error: '사망 심사가 완료되지 않아 키 조각을 릴리즈할 수 없습니다.' });
        return;
      }
      
      res.json({
        serverShare: vault.serverShare,
        institutionShare: vault.institutionShare
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/legacy/reset', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const seniorId = req.user!.role === 'senior'
        ? req.user!.id
        : await resolveGuardianSeniorId(req.user!.id, req.body.seniorId ? String(req.body.seniorId) : undefined);
        
      await prisma.legacyVault.deleteMany({
        where: { seniorId }
      });
      
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/files/*', async (req, res, next) => {
    try {
      const fileKey = req.params[0];
      parseLocalFileKey(fileKey);
      const hasValidFileToken = verifyLocalFileAccessToken(req.query.token, fileKey);
      const access = hasValidFileToken
        ? await resolveLocalFileAccess(fileKey)
        : req.user
          ? await assertCurrentUserCanAccessLocalFile(req.user, fileKey)
          : null;

      if (!access) {
        res.status(403).json({ error: '권한이 없습니다.' });
        return;
      }

      const filePath = resolveLocalFileKey(fileKey);
      await fs.access(filePath);
      res.header('Cache-Control', 'private, max-age=300');
      // 사진의 mimeType은 업로드 당시 클라이언트가 보낸 값이라 그대로 신뢰하지 않습니다.
      // 예전 데이터에 text/html 같은 값이 남아 있어도 같은 오리진에서 실행되지 않도록 막습니다.
      if (access.mimeType && (access.kind !== 'photos' || isAllowedPhotoMimeType(access.mimeType))) {
        res.type(access.mimeType);
      } else if (access.kind === 'photos') {
        res.type('application/octet-stream');
      }
      res.header('X-Content-Type-Options', 'nosniff');
      res.sendFile(filePath);
    } catch (error) {
      next(error);
    }
  });

  app.use(express.static(distDir));
  app.get('*', async (_req, res, next) => {
    try {
      // 사용자 테스트 배포에서는 Express가 빌드된 SPA와 API를 같은 HTTPS origin에서 제공합니다.
      await fs.access(path.join(distDir, 'index.html'));
      res.sendFile(path.join(distDir, 'index.html'));
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const rawStatusCode = typeof error === 'object' && error && 'statusCode' in error
      ? Number((error as { statusCode?: number }).statusCode)
      : NaN;
    // statusCode가 명시적으로 붙은 오류(httpError)만 우리가 쓴 메시지다.
    // 그 외에는 메시지를 내보내지 않는다. 예전에는 잘못된 id 하나로 Prisma가 던진
    // 예외 전문이 그대로 응답에 실려 테이블·컬럼·제약 이름이 노출됐다.
    const isExplicitHttpError = Number.isFinite(rawStatusCode);
    if (!isExplicitHttpError) {
      console.error('[dearlog] unhandled request error:', error);
    }
    res.status(isExplicitHttpError ? rawStatusCode : 500).json({
      error: isExplicitHttpError && error instanceof Error
        ? error.message
        : '서버 오류가 발생했습니다.',
    });
  });

  return app;
}
