import type { Memory, StoredPhoto, FamilyQuestion, ChapterStructure, ChapterNarrative } from './types';

const isLocalFrontend = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_BASE = import.meta.env.VITE_LOCAL_API_URL ?? (isLocalFrontend ? 'http://localhost:8787' : window.location.origin);

export type LocalAuthUser = {
  id: string;
  name: string;
  phoneNumber: string;
  role: 'pending' | 'senior' | 'guardian';
  birthDecade: string | null;
  preferredName: string | null;
  seniorName: string | null;
  seniorBirthDecade: string | null;
  seniorPreferredName: string | null;
  guardianName: string | null;
  guardianRelationship: string | null;
  guardianPreferredName: string | null;
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

type ApiOptions = RequestInit & {
  userId?: string;
  role?: 'senior' | 'guardian';
};

function readStoredAuth() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem('dearlog-storage');
    if (!raw) return null;
    return JSON.parse(raw)?.state?.auth as { userId?: string | null; role?: 'senior' | 'guardian' | null } | undefined;
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

async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  headers.set('x-user-id', options.userId ?? getCurrentUserId(options.role));
  if (options.role) headers.set('x-user-role', options.role);
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error ?? '로컬 서버 요청에 실패했습니다.');
  }
  return response.json();
}

export function registerLocalPhoneAccount(phoneNumber: string) {
  return api<{ user: LocalAuthUser; isNew: boolean }>('/api/auth/phone', {
    method: 'POST',
    body: JSON.stringify({ phoneNumber }),
  });
}

export function updateLocalUserRole(userId: string, role: 'senior' | 'guardian') {
  return api<{ user: LocalAuthUser }>(`/api/auth/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export function updateLocalUserProfile(input: {
  userId: string;
  role: 'senior' | 'guardian';
  name: string;
  birthDecade?: string;
  preferredName: string;
  relationship?: string;
}) {
  return api<{ user: LocalAuthUser }>(`/api/auth/users/${input.userId}/profile`, {
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

export function saveLocalInterviewRecord(input: {
  chapterId: string;
  sessionId?: string | null;
  questionId?: string | null;
  transcriptText: string;
  mode?: 'photo' | 'phone' | 'app_call';
  audioFileKey?: string;
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
      mode: input.mode ?? 'photo',
      audioFileKey: input.audioFileKey ?? 'audio/browser-speech-placeholder.txt',
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

export function uploadLocalPhoto(file: File, chapterId = 'childhood') {
  const form = new FormData();
  form.set('photo', file);
  form.set('chapterId', chapterId);
  return api<{ photo: unknown; questions: unknown[] }>('/api/uploads/photos', {
    method: 'POST',
    role: 'guardian',
    body: form,
  });
}

export function generateLocalCoverDesign() {
  return api<{ coverDesign: { id: string; palette: string; template: string; font: string }; analysis: { tone: string; keywords: string[]; reason: string } }>('/api/cover-designs/generate', {
    method: 'POST',
    role: 'guardian',
    body: JSON.stringify({}),
  });
}

export function confirmLocalCoverDesign(id: string) {
  return api<{ coverDesign: unknown }>(`/api/cover-designs/${id}/confirm`, {
    method: 'PATCH',
    role: 'guardian',
  });
}

export function requestLocalPublication(format: 'A5' | 'B5' = 'A5') {
  return api<{ publicationRequest: { id: string; status: string; pdfFileKey?: string } }>('/api/publication-requests', {
    method: 'POST',
    role: 'guardian',
    body: JSON.stringify({ format }),
  });
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

export function fetchLocalInterviewRecords() {
  const auth = readStoredAuth();
  const role = auth?.role === 'senior' ? 'senior' : 'guardian';
  return api<{ records: any[] }>('/api/interview-records', {
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

export function fetchLocalMemories() {
  const auth = readStoredAuth();
  const role = auth?.role === 'senior' ? 'senior' : 'guardian';
  return api<{ memories: Memory[] }>('/api/memories', {
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

export function fetchLocalAutobiographyDraft() {
  const auth = readStoredAuth();
  const role = auth?.role === 'senior' ? 'senior' : 'guardian';
  return api<{ draft: { currentStructure: ChapterStructure | null; narratives: ChapterNarrative[]; lastGenerated: string | null } | null }>('/api/autobiography/draft', {
    role,
  });
}

export function saveLocalAutobiographyDraft(draft: { structure?: ChapterStructure | null; narratives?: ChapterNarrative[] }) {
  const auth = readStoredAuth();
  const role = auth?.role === 'senior' ? 'senior' : 'guardian';
  return api<{ draft: { currentStructure: ChapterStructure | null; narratives: ChapterNarrative[]; lastGenerated: string | null } }>('/api/autobiography/draft', {
    method: 'POST',
    role,
    body: JSON.stringify(draft),
  });
}

export function clearLocalAutobiographyDraft() {
  const auth = readStoredAuth();
  const role = auth?.role === 'senior' ? 'senior' : 'guardian';
  return api<{ ok: boolean }>('/api/autobiography/draft', {
    method: 'DELETE',
    role,
  });
}


