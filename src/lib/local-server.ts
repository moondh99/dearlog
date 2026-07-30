import type { Memory, StoredPhoto, FamilyQuestion, ChapterStructure, ChapterNarrative } from './types';

const isLocalFrontend = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_BASE = import.meta.env.VITE_LOCAL_API_URL ?? (isLocalFrontend ? 'http://localhost:8787' : window.location.origin);

export type LocalAuthUser = {
  id: string;
  name: string;
  phoneNumber: string;
  role: 'pending' | 'senior' | 'guardian';
  birthDate: string | null;
  birthDecade: string | null;
  preferredName: string | null;
  seniorName: string | null;
  seniorBirthDecade: string | null;
  seniorPreferredName: string | null;
  guardianName: string | null;
  guardianRelationship: string | null;
  guardianPreferredName: string | null;
  profileImageUrl?: string | null;
  recordSpaceName?: string | null;
  recordSpaceCoverUrl?: string | null;
  hasCurrentJob?: boolean | null;
  occupation?: string | null;
  hometown?: string | null;
  schoolHistory?: string | null;
};

export type LocalNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  status: 'unread' | 'read' | string;
  createdAt: string;
  readAt: string | null;
  metadata: {
    url?: string;
    sessionId?: string;
    [key: string]: unknown;
  };
};

export type LocalInvitation = {
  id: string;
  token: string | null;
  guardianId: string;
  seniorId: string;
  status: 'active' | 'expired' | 'revoked' | string;
  expiresAt: string | null;
  revokedAt: string | null;
  usedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LocalFamilyMember = {
  id: string;
  name: string;
  role: 'parent' | 'child';
  relationship: string;
  isMe: boolean;
  token?: string | null;
  invitation?: LocalInvitation | null;
  invitationId?: string | null;
  invitationStatus?: string | null;
  invitationExpiresAt?: string | null;
  invitationRevokedAt?: string | null;
  invitationUsedAt?: string | null;
  hasRegistered?: boolean;
  birthDate?: string | null;
  profileImageUrl?: string | null;
  recordSpaceName?: string | null;
  recordSpaceCoverUrl?: string | null;
  hasCurrentJob?: boolean | null;
  occupation?: string | null;
  hometown?: string | null;
  schoolHistory?: string | null;
};

export type CreateParentInvitationInput = {
  seniorName?: string;
  seniorId?: string;
  birthDate?: string | null;
  relationship?: string | null;
  recordSpaceName?: string | null;
  profileImageUrl?: string | null;
  recordSpaceCoverUrl?: string | null;
  hasCurrentJob?: boolean | null;
  occupation?: string | null;
  hometown?: string | null;
  schoolHistory?: string | null;
};

type ApiOptions = RequestInit & {
  userId?: string;
  role?: 'senior' | 'guardian';
};

type StoredAuthContext = {
  userId: string;
  role: 'senior' | 'guardian' | null;
  authToken: string | null;
};

export type LocalAIChatCompletionRequest = Record<string, unknown> & {
  model: string;
  messages: unknown[];
  purpose?: 'chat' | 'vision' | 'writing';
};

export type LocalAIChatCompletionResponse = {
  choices: Array<{
    message: {
      content: string | null;
    };
  }>;
};

export type LocalAIEmbeddingRequest = Record<string, unknown> & {
  model: string;
  input: string | string[];
};

export type LocalAIEmbeddingResponse = {
  data: Array<{
    embedding: number[];
  }>;
};

export type LocalPublicationEditorialPlan = {
  readiness: 'ready_for_paid_book' | 'needs_family_review' | 'needs_more_records' | string;
  coreTheme?: string;
  editorialThesis?: string;
  sourceSummary?: {
    sourceRecordCount?: number;
    chapterCount?: number;
    photoCount?: number;
    photoLedRecordCount?: number;
    strongChapterCount?: number;
    weakChapterCount?: number;
    sceneSpecificRecordCount?: number;
  };
  chapterPlans?: Array<{
    chapterId: string;
    chapterTitle?: string;
    strength?: 'strong' | 'developing' | 'thin' | string;
    recommendedRole?: 'anchor_chapter' | 'supporting_chapter' | 'needs_more_questions' | string;
    editorialFocus?: string;
    followUpQuestions?: string[];
    checklistRisks?: string[];
  }>;
  strongChapters?: string[];
  weakChapters?: string[];
  directQuoteCandidates?: Array<{
    text: string;
    sourceRecordId: string;
    chapterId: string;
  }>;
  photoStoryPlacements?: Array<{
    photoId: string;
    sourceRecordId: string;
    chapterId: string;
    caption?: string;
    placementNote?: string;
  }>;
  checklistFindings?: Array<{
    checklistItemId: string;
    status: 'pass' | 'needs_work' | string;
    note: string;
  }>;
  followUpQuestions?: string[];
  nextActions?: string[];
};

export type LocalPublicationWritingDraft = {
  styleSummary?: string;
  generatedBy?: 'agent' | 'fallback' | string;
  chapters?: Array<{
    chapterId: string;
    chapterTitle?: string;
    paragraphs?: Array<{
      text: string;
      sourceRecordIds?: string[];
      role?: 'lead' | 'scene' | 'reflection' | 'photo_story' | string;
    }>;
  }>;
  revisionFindings?: Array<{
    category: 'repetition' | 'grounding' | 'tone' | 'structure' | string;
    severity: 'info' | 'needs_work' | string;
    note: string;
  }>;
};

export type LocalPublicationToneProfile = {
  name: string;
  patterns?: string[];
};

export type LocalPublicationPreviewJob = {
  id: string;
  status: 'queued' | 'running' | 'ready' | 'failed' | string;
  stage: 'cache_check' | 'editorial_plan' | 'writing_draft' | 'manifest' | 'render' | 'done' | string;
  attemptCount: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  draftCacheId?: string | null;
  draftSourceHash?: string | null;
  isStale?: boolean;
  sourceHash: string;
  cacheStatus?: 'hit' | 'generated' | string | null;
};

export type LocalPublicationPreviewResponse = {
  job?: LocalPublicationPreviewJob;
  html?: string;
  editorialPlan?: LocalPublicationEditorialPlan;
  writingDraft?: LocalPublicationWritingDraft;
  manifest?: unknown;
  cacheStatus?: string;
  draftCacheId?: string | null;
  sourceHash?: string;
};

export type LocalAIProxyAuditSummary = {
  window: {
    from: string;
    to: string;
    minutes: number;
  };
  totals: {
    requests: number;
    success: number;
    invalidRequest: number;
    rateLimited: number;
    configError: number;
    providerError: number;
    estimatedUnits: number;
    avgLatencyMs: number;
    errorRatePercent: number;
  };
  byEndpoint: Array<{
    endpoint: string;
    requests: number;
    success: number;
    errors: number;
    rateLimited: number;
    estimatedUnits: number;
    avgLatencyMs: number;
  }>;
  byUser: Array<{
    userId: string;
    role: string;
    requests: number;
    estimatedUnits: number;
    errors: number;
    rateLimited: number;
    lastSeenAt: string;
  }>;
  recentErrors: Array<{
    id: string;
    createdAt: string;
    userId: string;
    endpoint: string;
    outcome: string;
    statusCode: number;
    providerStatus: number | null;
    providerCode: string | null;
    errorMessage: string | null;
  }>;
  alerts: Array<{
    type: string;
    severity: 'warning' | 'critical';
    message: string;
    value: number;
    threshold: number;
  }>;
  alertThresholds: {
    errorRatePercent: number;
    rateLimitedCount: number;
    minRequests: number;
  };
  alertRouting?: {
    enabled: boolean;
    windowMinutes: number;
    cooldownMinutes: number;
    recipientCount: number;
    runbookUrl: string;
  };
  retention: {
    days: number;
    cutoff: string;
    deletedOldLogs: number;
  };
};

function readStoredAuth(): StoredAuthContext | null {
  if (typeof window === 'undefined') return null;
  try {
    let raw = window.sessionStorage.getItem('dearlog-auth');
    if (!raw) {
      raw = window.localStorage.getItem('dearlog-auth');
    }
    if (raw) {
      const parsed = JSON.parse(raw)?.state;
      if (parsed) {
        const mappedRole = parsed.role === 'parent' ? 'senior' : parsed.role === 'child' ? 'guardian' : parsed.role;
        return {
          userId: parsed.userId ?? (mappedRole === 'senior' ? 'local_senior' : 'local_guardian'),
          role: mappedRole === 'senior' || mappedRole === 'guardian' ? mappedRole : null,
          authToken: typeof parsed.authToken === 'string' ? parsed.authToken : null,
        };
      }
    }
    const legacyRaw = window.localStorage.getItem('dearlog-storage');
    if (legacyRaw) {
      const parsedAuth = JSON.parse(legacyRaw)?.state?.auth;
      if (parsedAuth) {
        const mappedRole = parsedAuth.role === 'parent' ? 'senior' : parsedAuth.role === 'child' ? 'guardian' : parsedAuth.role;
        return {
          userId: parsedAuth.userId ?? (mappedRole === 'senior' ? 'local_senior' : 'local_guardian'),
          role: mappedRole === 'senior' || mappedRole === 'guardian' ? mappedRole : null,
          authToken: typeof parsedAuth.authToken === 'string' ? parsedAuth.authToken : null,
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

function getCurrentUserId(role?: 'senior' | 'guardian') {
  const auth = readStoredAuth();
  return auth?.userId ?? (role === 'senior' ? 'local_senior' : 'local_guardian');
}

function getCurrentSeniorId() {
  const auth = readStoredAuth();
  return auth?.role === 'senior' && auth.userId ? auth.userId : 'local_senior';
}

function getActiveSeniorIdFromLocalStorage(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem('dearlog-child');
    if (raw) {
      const parsed = JSON.parse(raw)?.state;
      if (parsed?.activeSeniorId) return parsed.activeSeniorId;
    }
    return null;
  } catch {
    return null;
  }
}

function pathHasSeniorId(path: string) {
  return /(?:\?|&)seniorId=/.test(path);
}

async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const auth = readStoredAuth();
  if (auth?.authToken) {
    headers.set('Authorization', `Bearer ${auth.authToken}`);
  }
  if (import.meta.env.DEV || import.meta.env.VITE_ALLOW_DEV_AUTH_HEADERS === 'true') {
    headers.set('x-user-id', options.userId ?? getCurrentUserId(options.role));
    if (options.role) headers.set('x-user-role', options.role);
  }

  let targetPath = path;
  let targetOptions = { ...options };

  const isAuthOrInviteAction = path.startsWith('/api/auth') || path.startsWith('/api/ai') || path.startsWith('/api/invitations') || path.startsWith('/api/family-members');

  if (!isAuthOrInviteAction) {
    const auth = readStoredAuth();
    if (auth?.role === 'guardian') {
      const activeSeniorId = getActiveSeniorIdFromLocalStorage();
      if (activeSeniorId) {
        if (options.method === 'GET' || !options.method) {
          if (!pathHasSeniorId(path)) {
            const separator = path.includes('?') ? '&' : '?';
            targetPath = `${path}${separator}seniorId=${encodeURIComponent(activeSeniorId)}`;
          }
        } else if (targetOptions.body instanceof FormData && !targetOptions.body.has('seniorId')) {
          targetOptions.body.set('seniorId', activeSeniorId);
        } else if (options.body && typeof options.body === 'string' && !options.body.includes('seniorId')) {
          try {
            const parsed = JSON.parse(options.body);
            parsed.seniorId = activeSeniorId;
            targetOptions.body = JSON.stringify(parsed);
          } catch (e) {
            // ignore parsing error
          }
        }
      }
    }
  }

  const response = await fetch(`${API_BASE}${targetPath}`, { ...targetOptions, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error ?? '로컬 서버 요청에 실패했습니다.');
  }
  return response.json();
}

export async function synthesizeLocalQuestionSpeech(text: string) {
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  const auth = readStoredAuth();
  if (auth?.authToken) {
    headers.set('Authorization', `Bearer ${auth.authToken}`);
  }
  if (import.meta.env.DEV || import.meta.env.VITE_ALLOW_DEV_AUTH_HEADERS === 'true') {
    headers.set('x-user-id', getCurrentUserId('senior'));
    headers.set('x-user-role', 'senior');
  }

  const response = await fetch(`${API_BASE}/api/audio/speech`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error ?? '질문 음성 생성에 실패했습니다.');
  }
  return response.blob();
}

export function createLocalAIChatCompletion(input: LocalAIChatCompletionRequest) {
  return api<LocalAIChatCompletionResponse>('/api/ai/chat-completions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function createLocalAIEmbedding(input: LocalAIEmbeddingRequest) {
  return api<LocalAIEmbeddingResponse>('/api/ai/embeddings', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function fetchLocalAIProxyAuditSummary(windowMinutes = 60) {
  return api<LocalAIProxyAuditSummary>(`/api/ai/audit-summary?windowMinutes=${encodeURIComponent(String(windowMinutes))}`, {
    role: 'guardian',
  });
}

export function registerLocalPhoneAccount(phoneNumber: string, name?: string, isLogin?: boolean, birthDate?: string) {
  return api<{ user: LocalAuthUser; authToken: string; isNew: boolean }>('/api/auth/phone', {
    method: 'POST',
    body: JSON.stringify({ phoneNumber, name, isLogin, birthDate }),
  });
}

export function updateLocalUserRole(userId: string, role: 'senior' | 'guardian') {
  return api<{ user: LocalAuthUser; authToken: string }>(`/api/auth/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export function updateLocalUserProfile(input: {
  userId: string;
  role: 'senior' | 'guardian';
  name: string;
  birthDate?: string;
  birthDecade?: string;
  preferredName: string;
  relationship?: string;
}) {
  return api<{ user: LocalAuthUser; authToken: string }>(`/api/auth/users/${input.userId}/profile`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function createLocalInterviewSession(chapterId = 'childhood') {
  return api<{ session: { id: string } }>('/api/interview-sessions', {
    method: 'POST',
    role: 'senior',
    body: JSON.stringify({ chapterId, mode: 'photo' }),
  });
}

export function pauseLocalInterviewSession(sessionId: string) {
  return api<{ session: unknown }>(`/api/interview-sessions/${sessionId}/pause`, {
    method: 'PATCH',
    role: 'senior',
  });
}

export function acceptLocalInterviewSession(sessionId: string) {
  return api<{ session: { id: string; status: string } }>(`/api/interview-sessions/${sessionId}/accept`, {
    method: 'PATCH',
    role: 'senior',
  });
}

export function endLocalInterviewSession(sessionId: string) {
  return api<{ session: { id: string; status: string } }>(`/api/interview-sessions/${sessionId}/end`, {
    method: 'PATCH',
    role: 'senior',
    body: JSON.stringify({ status: 'ended' }),
  });
}

export function uploadLocalAudio(file: Blob, fileName = 'dearlog-interview.webm') {
  const form = new FormData();
  form.set('audio', file, fileName);
  return api<{ fileKey: string; mimeType: string; size: number }>('/api/uploads/audio', {
    method: 'POST',
    role: 'senior',
    body: form,
  });
}

export function transcribeLocalAudio(fileKey: string) {
  return api<{ text: string; fileKey: string }>('/api/audio/transcriptions', {
    method: 'POST',
    role: 'senior',
    body: JSON.stringify({ fileKey }),
  });
}

export function saveLocalInterviewRecord(input: {
  chapterId: string;
  sessionId?: string | null;
  questionId?: string | null;
  transcriptText: string;
  aiSummary?: string;
  mode?: string;
  audioFileKey?: string;
  publish?: boolean;
  chatbot?: boolean;
}) {
  return api<{ record: unknown }>('/api/interview-records', {
    method: 'POST',
    role: 'senior',
    body: JSON.stringify({
      userId: getCurrentSeniorId(),
      chapterId: input.chapterId,
      sessionId: input.sessionId,
      questionId: input.questionId,
      transcriptText: input.transcriptText,
      aiSummary: input.aiSummary,
      mode: input.mode ?? 'voice',
      audioFileKey: input.audioFileKey,
      publish: input.publish,
      chatbot: input.chatbot,
    }),
  });
}

export function fetchLocalProgress() {
  return api<{ character: string; totalRecords: number; progress: Array<{ count: number; complete: boolean; chapter: { id: string; title: string; minAnswerCount: number } }> }>('/api/progress', {
    role: 'guardian',
  });
}

export function fetchLocalFreeSpeech() {
  return api<{ records: Array<{ id: string; transcriptText: string; recordedAt: string; chapter: { title: string } }> }>('/api/free-speech', {
    role: 'guardian',
  });
}

export function createLocalSchedule(scheduledAt: string) {
  return api<{ schedule: unknown }>('/api/interview-schedules', {
    method: 'POST',
    role: 'guardian',
    body: JSON.stringify({ scheduledAt, timezone: 'Asia/Seoul' }),
  });
}

export function sendLocalAppCall() {
  return api<{ session: { id: string; status: string }; pushResult: { sent: number; skipped?: string } }>('/api/app-calls', {
    method: 'POST',
    role: 'guardian',
    body: JSON.stringify({}),
  });
}

export function sendLocalNudge() {
  return api<{ notification: unknown; sent: number }>('/api/nudges', {
    method: 'POST',
    role: 'guardian',
    body: JSON.stringify({}),
  });
}

export type PhotoUploadMetadata = {
  capturedDate?: string;
  location?: string;
  memo?: string;
  linkedQuestion?: string;
};

export function uploadLocalPhoto(file: File, chapterId = 'childhood', metadata: PhotoUploadMetadata = {}) {
  const form = new FormData();
  form.set('photo', file);
  form.set('chapterId', chapterId);
  if (metadata.capturedDate) form.set('capturedDate', metadata.capturedDate);
  if (metadata.location) form.set('location', metadata.location);
  if (metadata.memo) form.set('memo', metadata.memo);
  if (metadata.linkedQuestion) form.set('linkedQuestion', metadata.linkedQuestion);
  return api<{ photo: unknown; questions: unknown[] }>('/api/uploads/photos', {
    method: 'POST',
    role: 'guardian',
    body: form,
  });
}

export type LocalCoverDesign = { id: string; palette: string; template: string; font: string };
export type LocalCoverAnalysis = { tone: string; keywords: string[]; reason: string };
export type LocalCoverCandidate = { coverDesign: LocalCoverDesign; analysis: LocalCoverAnalysis };

export function generateLocalCoverDesign(seniorId?: string | null, role: 'senior' | 'guardian' = 'guardian', count = 1) {
  return api<{
    coverDesign: LocalCoverDesign;
    analysis: LocalCoverAnalysis;
    coverDesigns?: LocalCoverDesign[];
    candidates?: LocalCoverCandidate[];
  }>('/api/cover-designs/generate', {
    method: 'POST',
    role,
    body: JSON.stringify({ ...(seniorId ? { seniorId } : {}), count }),
  });
}

export function confirmLocalCoverDesign(id: string, role: 'senior' | 'guardian' = 'guardian') {
  return api<{ coverDesign: unknown }>(`/api/cover-designs/${id}/confirm`, {
    method: 'PATCH',
    role,
  });
}

export function requestLocalPublication(
  format: 'A5' | 'B5' = 'A5',
  seniorId?: string | null,
  role: 'senior' | 'guardian' = 'guardian',
  toneProfile?: LocalPublicationToneProfile | null,
) {
  return api<{
    publicationRequest: { id: string; status: string; pdfFileKey?: string; draftCacheId?: string | null };
    cacheStatus?: string;
    sourceHash?: string;
  }>('/api/publication-requests', {
    method: 'POST',
    role,
    body: JSON.stringify({
      format,
      ...(seniorId ? { seniorId } : {}),
      ...(toneProfile ? { toneProfile } : {}),
    }),
  });
}

export function fetchLocalPublicationPreview(
  format: 'A5' | 'B5' = 'A5',
  seniorId?: string | null,
  role: 'senior' | 'guardian' = 'guardian',
  toneProfile?: LocalPublicationToneProfile | null,
  options?: { forceRefresh?: boolean },
) {
  const params = new URLSearchParams({ format });
  if (seniorId) params.set('seniorId', seniorId);
  if (options?.forceRefresh) params.set('forceRefresh', 'true');
  if (toneProfile?.name) {
    params.set('toneName', toneProfile.name);
    for (const pattern of toneProfile.patterns ?? []) {
      if (pattern) params.append('tonePattern', pattern);
    }
  }
  return api<LocalPublicationPreviewResponse>(`/api/publication-preview?${params.toString()}`, {
    role,
  });
}

export function startLocalPublicationPreviewJob(
  format: 'A5' | 'B5' = 'A5',
  seniorId?: string | null,
  role: 'senior' | 'guardian' = 'guardian',
  toneProfile?: LocalPublicationToneProfile | null,
  options?: { forceRefresh?: boolean },
) {
  return api<LocalPublicationPreviewResponse>('/api/publication-preview-jobs', {
    method: 'POST',
    role,
    body: JSON.stringify({
      format,
      ...(seniorId ? { seniorId } : {}),
      ...(toneProfile ? { toneProfile } : {}),
      ...(options?.forceRefresh ? { forceRefresh: true } : {}),
    }),
  });
}

export function fetchLocalPublicationPreviewJob(
  jobId: string,
  role: 'senior' | 'guardian' = 'guardian',
) {
  return api<LocalPublicationPreviewResponse>(`/api/publication-preview-jobs/${encodeURIComponent(jobId)}`, {
    role,
  });
}

function encodeLocalFileKey(fileKey: string) {
  return fileKey.split('/').map(encodeURIComponent).join('/');
}

export async function fetchLocalFileBlob(fileKey: string) {
  const headers = new Headers();
  const auth = readStoredAuth();
  if (auth?.authToken) {
    headers.set('Authorization', `Bearer ${auth.authToken}`);
  }
  if (import.meta.env.DEV || import.meta.env.VITE_ALLOW_DEV_AUTH_HEADERS === 'true') {
    headers.set('x-user-id', getCurrentUserId(auth?.role ?? undefined));
    if (auth?.role) headers.set('x-user-role', auth.role);
  }

  const response = await fetch(`${API_BASE}/api/files/${encodeLocalFileKey(fileKey)}`, { headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error ?? '파일 다운로드에 실패했습니다.');
  }
  return response.blob();
}

export function fetchLocalVapidPublicKey() {
  return api<{ publicKey: string }>('/api/push-public-key', {
    role: 'guardian',
  });
}

export function fetchLocalNotifications(role: 'senior' | 'guardian' = 'senior') {
  return api<{ notifications: LocalNotification[]; unreadCount: number }>('/api/notifications', {
    role,
  });
}

export function markLocalNotificationRead(id: string, role: 'senior' | 'guardian' = 'senior') {
  return api<{ notification: LocalNotification }>(`/api/notifications/${id}/read`, {
    method: 'PATCH',
    role,
  });
}

export async function registerLocalPushSubscription(vapidPublicKey: string, role: 'senior' | 'guardian' = 'guardian') {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('이 브라우저는 Web Push를 지원하지 않습니다.');
  }
  if (!vapidPublicKey) {
    throw new Error('VAPID_PUBLIC_KEY가 아직 설정되지 않았습니다.');
  }
  const registration = await navigator.serviceWorker.register('/push-sw.js');
  // 서비스워커가 active 상태가 된 뒤 구독해야 실제 브라우저에서 "no active Service Worker"가 나지 않습니다.
  const readyRegistration = await navigator.serviceWorker.ready;
  const subscription = await readyRegistration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: vapidPublicKey,
  });
  return api('/api/push-subscriptions', {
    method: 'POST',
    role,
    body: JSON.stringify({
      ...subscription.toJSON(),
      userId: getCurrentUserId(role),
    }),
  });
}

export function setupLocalLegacyVault(input: {
  encryptedMemories: string;
  encryptedAutobiography: string;
  serverShare: string;
  institutionShare: string;
}) {
  const auth = readStoredAuth();
  const role = auth?.role === 'senior' ? 'senior' : 'guardian';
  return api<{ vault: any }>('/api/legacy/vault', {
    method: 'POST',
    role,
    body: JSON.stringify(input),
  });
}

export function fetchLocalLegacyVault() {
  const auth = readStoredAuth();
  const role = auth?.role === 'senior' ? 'senior' : 'guardian';
  return api<{ vault: any }>('/api/legacy/vault', {
    role,
  });
}

export function triggerLocalDeathVerification() {
  return api<{ vault: any; notification: any }>('/api/legacy/trigger-death', {
    method: 'POST',
    role: 'guardian',
    body: JSON.stringify({}),
  });
}

export function approveLocalDeathVerification() {
  return api<{ vault: any; notification: any }>('/api/legacy/approve-death', {
    method: 'POST',
    role: 'guardian',
    body: JSON.stringify({}),
  });
}

export function fetchLocalLegacyShares() {
  return api<{ serverShare: string; institutionShare: string }>('/api/legacy/shares', {
    role: 'guardian',
  });
}

export function resetLocalLegacyVault() {
  const auth = readStoredAuth();
  const role = auth?.role === 'senior' ? 'senior' : 'guardian';
  return api<{ ok: boolean }>('/api/legacy/reset', {
    method: 'POST',
    role,
    body: JSON.stringify({}),
  });
}

export function fetchLocalInterviewRecords(seniorId?: string | null) {
  const auth = readStoredAuth();
  const role = auth?.role === 'senior' ? 'senior' : 'guardian';
  const params = new URLSearchParams();
  if (seniorId) params.set('seniorId', seniorId);
  const query = params.toString();
  return api<{ records: any[] }>(`/api/interview-records${query ? `?${query}` : ''}`, {
    role,
  });
}

export function fetchLocalChapters() {
  return api<{ chapters: any[] }>('/api/chapters');
}

export function fetchLocalQuestions(chapterId?: string) {
  const query = chapterId ? `?chapterId=${chapterId}` : '';
  return api<{ questions: any[] }>(`/api/questions${query}`);
}

export function createLocalQuestion(text: string, chapterId?: string, seniorId?: string) {
  return api<{ question: any }>('/api/questions', {
    method: 'POST',
    role: 'guardian',
    body: JSON.stringify({ text, chapterId, seniorId }),
  });
}

export function createLocalPhotoQuestion(input: {
  text: string;
  photoId: string;
  chapterId?: string;
  seniorId?: string | null;
}) {
  return api<{ question: any }>('/api/questions', {
    method: 'POST',
    role: 'guardian',
    body: JSON.stringify({
      text: input.text,
      photoId: input.photoId,
      chapterId: input.chapterId,
      seniorId: input.seniorId,
      category: 'photo_questions',
    }),
  });
}

export function fetchLocalMemories(seniorId?: string | null) {
  const auth = readStoredAuth();
  const role = auth?.role === 'senior' ? 'senior' : 'guardian';
  const params = new URLSearchParams();
  if (seniorId) params.set('seniorId', seniorId);
  const query = params.toString();
  return api<{ memories: Memory[] }>(`/api/memories${query ? `?${query}` : ''}`, {
    role,
  });
}

export function saveLocalMemory(memory: any) {
  const auth = readStoredAuth();
  const role = auth?.role === 'senior' ? 'senior' : 'guardian';
  return api<{ memory: Memory }>('/api/memories', {
    method: 'POST',
    role,
    body: JSON.stringify(memory),
  });
}

export function updateLocalMemory(id: string, updates: any) {
  const auth = readStoredAuth();
  const role = auth?.role === 'senior' ? 'senior' : 'guardian';
  return api<{ memory: Memory }>(`/api/memories/${id}`, {
    method: 'PATCH',
    role,
    body: JSON.stringify(updates),
  });
}

export function deleteLocalMemory(id: string) {
  const auth = readStoredAuth();
  const role = auth?.role === 'senior' ? 'senior' : 'guardian';
  return api<{ ok: boolean }>(`/api/memories/${id}`, {
    method: 'DELETE',
    role,
  });
}

export function fetchLocalPhotos() {
  const auth = readStoredAuth();
  const role = auth?.role === 'senior' ? 'senior' : 'guardian';
  return api<{ photos: StoredPhoto[] }>('/api/photos', {
    role,
  });
}

export function updateLocalPhoto(id: string, updates: any) {
  const auth = readStoredAuth();
  const role = auth?.role === 'senior' ? 'senior' : 'guardian';
  return api<{ photo: StoredPhoto }>(`/api/photos/${id}`, {
    method: 'PATCH',
    role,
    body: JSON.stringify(updates),
  });
}

export function deleteLocalPhoto(id: string) {
  const auth = readStoredAuth();
  const role = auth?.role === 'senior' ? 'senior' : 'guardian';
  return api<{ ok: boolean }>(`/api/photos/${id}`, {
    method: 'DELETE',
    role,
  });
}

export function fetchLocalFamilyQuestions() {
  const auth = readStoredAuth();
  const role = auth?.role === 'senior' ? 'senior' : 'guardian';
  return api<{ questions: FamilyQuestion[] }>('/api/family-questions', {
    role,
  });
}

export function updateLocalFamilyQuestion(id: string, updates: any) {
  const auth = readStoredAuth();
  const role = auth?.role === 'senior' ? 'senior' : 'guardian';
  return api<{ question: FamilyQuestion }>(`/api/questions/${id}`, {
    method: 'PATCH',
    role,
    body: JSON.stringify(updates),
  });
}

export function deleteLocalFamilyQuestion(id: string) {
  const auth = readStoredAuth();
  const role = auth?.role === 'senior' ? 'senior' : 'guardian';
  return api<{ ok: boolean }>(`/api/questions/${id}`, {
    method: 'DELETE',
    role,
  });
}

export function fetchLocalAutobiographyDraft(seniorId?: string | null) {
  const auth = readStoredAuth();
  const role = auth?.role === 'senior' ? 'senior' : 'guardian';
  const params = new URLSearchParams();
  if (seniorId) params.set('seniorId', seniorId);
  const query = params.toString();
  return api<{ draft: { currentStructure: any | null; narratives: any[]; lastGenerated: string | null } | null }>(`/api/autobiography/draft${query ? `?${query}` : ''}`, {
    role,
  });
}

export function saveLocalAutobiographyDraft(draft: { structure?: any | null; narratives?: any[] }, seniorId?: string | null) {
  const auth = readStoredAuth();
  const role = auth?.role === 'senior' ? 'senior' : 'guardian';
  return api<{ draft: { currentStructure: any | null; narratives: any[]; lastGenerated: string | null } }>('/api/autobiography/draft', {
    method: 'POST',
    role,
    body: JSON.stringify({ ...draft, ...(seniorId ? { seniorId } : {}) }),
  });
}

export function clearLocalAutobiographyDraft(seniorId?: string | null) {
  const auth = readStoredAuth();
  const role = auth?.role === 'senior' ? 'senior' : 'guardian';
  return api<{ ok: boolean }>('/api/autobiography/draft', {
    method: 'DELETE',
    role,
    body: JSON.stringify(seniorId ? { seniorId } : {}),
  });
}

export function fetchLocalCalendarEvents() {
  const auth = readStoredAuth();
  const role = auth?.role === 'senior' ? 'senior' : 'guardian';
  return api<{ events: any[] }>('/api/calendar-events', {
    role,
  });
}

export function saveLocalCalendarEvent(event: { eventType: string; eventDate: string; relatedPersons: string[]; recipientId?: string }) {
  const auth = readStoredAuth();
  const role = auth?.role === 'senior' ? 'senior' : 'guardian';
  return api<{ event: any }>('/api/calendar-events', {
    method: 'POST',
    role,
    body: JSON.stringify(event),
  });
}

export function deleteLocalCalendarEvent(id: string) {
  const auth = readStoredAuth();
  const role = auth?.role === 'senior' ? 'senior' : 'guardian';
  return api<{ ok: boolean }>(`/api/calendar-events/${id}`, {
    method: 'DELETE',
    role,
  });
}

export function updateLocalInterviewRecordConsent(id: string, publish: boolean, chatbot: boolean) {
  const auth = readStoredAuth();
  const role = auth?.role === 'senior' ? 'senior' : 'guardian';
  return api<{ record: any }>(`/api/interview-records/${id}`, {
    method: 'PATCH',
    role,
    body: JSON.stringify({ publish, chatbot }),
  });
}

export function updateLocalInterviewRecordReview(id: string, input: {
  reviewStatus: 'pending' | 'applied' | 'revision_requested';
  reviewRequestText?: string | null;
}) {
  const auth = readStoredAuth();
  const role = auth?.role === 'senior' ? 'senior' : 'guardian';
  return api<{ record: any }>(`/api/interview-records/${id}`, {
    method: 'PATCH',
    role,
    body: JSON.stringify(input),
  });
}

export function bulkUpdateLocalInterviewRecordConsent(ids: string[], publish: boolean, chatbot: boolean) {
  const auth = readStoredAuth();
  const role = auth?.role === 'senior' ? 'senior' : 'guardian';
  return api<{ ok: boolean }>('/api/interview-records/bulk-consent', {
    method: 'PATCH',
    role,
    body: JSON.stringify({ ids, publish, chatbot }),
  });
}

export function createParentInvitation(input?: string | CreateParentInvitationInput, seniorId?: string) {
  const auth = readStoredAuth();
  const role = auth?.role === 'senior' ? 'senior' : 'guardian';
  const body = typeof input === 'object' && input !== null
    ? input
    : { ...(input ? { seniorName: input } : {}), ...(seniorId ? { seniorId } : {}) };
  return api<{ invitation: LocalInvitation }>('/api/invitations', {
    method: 'POST',
    role,
    body: JSON.stringify(body),
  });
}

export function rotateLocalInvitation(invitationId: string) {
  return api<{ invitation: LocalInvitation }>(`/api/invitations/${invitationId}/rotate`, {
    method: 'POST',
    role: 'guardian',
  });
}

export function revokeLocalInvitation(invitationId: string) {
  return api<{ invitation: LocalInvitation }>(`/api/invitations/${invitationId}`, {
    method: 'DELETE',
    role: 'guardian',
  });
}

export function fetchFamilyMembers() {
  const auth = readStoredAuth();
  const role = auth?.role === 'senior' ? 'senior' : 'guardian';
  return api<{ members: LocalFamilyMember[] }>('/api/family-members', {
    method: 'GET',
    role,
  });
}

export function loginWithInvitationToken(token: string) {
  return api<{ user: any; authToken: string }>('/api/auth/token-login', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}
