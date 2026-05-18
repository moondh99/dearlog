import type {
  CalendarEvent,
  ChatMessage,
  FamilyQuestion,
  Memory,
  StoredPhoto,
} from '../types';
import { getEffectiveConsentSettings } from '../consent/manager';

export type LifeStage =
  | '어린시절'
  | '학창시절'
  | '가족'
  | '직업'
  | '전환점'
  | '전하고싶은말'
  | '기타';

export interface TimelineGroup {
  stage: LifeStage;
  memories: Memory[];
}

export interface MemoryMapPoint {
  place: string;
  count: number;
  memoryIds: string[];
  topics: string[];
}

export interface ContradictionCard {
  memoryId: string;
  topic: string;
  relatedMemoryIds: string[];
  severity: 'low' | 'medium' | 'high';
}

export interface SensitiveProtectionSuggestion {
  memoryId: string;
  topic: string;
  sensitiveEmotions: string[];
  shouldRevokeSensitiveAccess: boolean;
}

export interface InterviewProgressItem {
  category: '인물' | '장소' | '감정' | '사건' | '시간';
  covered: boolean;
}

export interface FamilyQuestionStats {
  total: number;
  pending: number;
  delivered: number;
  archived: number;
  highPriority: number;
  answerRate: number;
}

export interface PhotoAlbumItem {
  photoId: string;
  url: string;
  uploadedAt: string;
  description: string;
  linkedMemoryTopics: string[];
}

export interface ServiceMetrics {
  memoryCount: number;
  publicMemoryCount: number;
  indexedMemoryCount: number;
  sensitiveMemoryCount: number;
  contradictionCount: number;
  photoCount: number;
  linkedPhotoCount: number;
  pendingFamilyQuestionCount: number;
  upcomingEventCount: number;
}

export type ArchiveTabId = 'summary' | 'memories' | 'timeline' | 'map' | 'photos' | 'review';

export interface ArchiveTabCounts {
  summary: number;
  memories: number;
  timeline: number;
  map: number;
  photos: number;
  review: number;
}

const LIFE_STAGE_ORDER: LifeStage[] = [
  '어린시절',
  '학창시절',
  '가족',
  '직업',
  '전환점',
  '전하고싶은말',
  '기타',
];

const SENSITIVE_KEYWORDS = ['슬픔', '분노', '후회', '트라우마', '상실'];

export function getLifeStage(memory: Memory): LifeStage {
  const text = `${memory.topic} ${memory.cleanedTranscript} ${memory.tags.timePeriod}`.toLowerCase();
  const emotions = memory.tags.emotions.join(' ');

  if (/어린|유년|초등|194|195|196/.test(text)) return '어린시절';
  if (/학교|학창|중학|고등|대학|졸업/.test(text)) return '학창시절';
  if (/가족|어머니|아버지|부모|형제|자녀|결혼|손자|손녀/.test(text)) return '가족';
  if (/직장|회사|일|직업|사업|퇴직|동료/.test(text)) return '직업';
  if (/전환|이사|이민|위기|사고|병|극복|결정/.test(text) || /후회|상실/.test(emotions)) {
    return '전환점';
  }
  if (/전하|당부|조언|교훈|바람|소망|감사|사랑/.test(text)) return '전하고싶은말';
  return '기타';
}

export function buildTimelineGroups(memories: Memory[]): TimelineGroup[] {
  return LIFE_STAGE_ORDER
    .map((stage) => ({
      stage,
      memories: memories.filter((memory) => getLifeStage(memory) === stage),
    }))
    .filter((group) => group.memories.length > 0);
}

export function buildMemoryMapPoints(memories: Memory[]): MemoryMapPoint[] {
  const byPlace = new Map<string, MemoryMapPoint>();

  for (const memory of memories) {
    for (const rawPlace of memory.tags.places) {
      const place = rawPlace.trim();
      if (!place) continue;

      const existing = byPlace.get(place) ?? {
        place,
        count: 0,
        memoryIds: [],
        topics: [],
      };

      existing.count += 1;
      if (!existing.memoryIds.includes(memory.id)) existing.memoryIds.push(memory.id);
      if (!existing.topics.includes(memory.topic)) existing.topics.push(memory.topic);
      byPlace.set(place, existing);
    }
  }

  return [...byPlace.values()].sort((a, b) => b.count - a.count || a.place.localeCompare(b.place));
}

export function buildContradictionCards(memories: Memory[]): ContradictionCard[] {
  return memories
    .filter((memory) => memory.contradictions.length > 0)
    .map((memory) => ({
      memoryId: memory.id,
      topic: memory.topic,
      relatedMemoryIds: memory.contradictions,
      severity: memory.confidenceLabel === '추가 확인 필요'
        ? 'high'
        : memory.confidenceLabel === '추정'
          ? 'medium'
          : 'low',
    }));
}

export function getSensitiveProtectionSuggestions(memories: Memory[]): SensitiveProtectionSuggestion[] {
  return memories
    .map((memory) => {
      const sensitiveEmotions = memory.tags.emotions.filter((emotion) =>
        SENSITIVE_KEYWORDS.some((keyword) => emotion.includes(keyword))
      );
      const consentSettings = getEffectiveConsentSettings(memory);
      return {
        memoryId: memory.id,
        topic: memory.topic,
        sensitiveEmotions,
        shouldRevokeSensitiveAccess:
          sensitiveEmotions.length > 0 && consentSettings.민감정보 === 'granted',
      };
    })
    .filter((item) => item.sensitiveEmotions.length > 0);
}

export function estimateInterviewProgress(messages: ChatMessage[]): InterviewProgressItem[] {
  const userText = messages
    .filter((message) => message.role === 'user')
    .map((message) => message.text)
    .join(' ');

  return [
    { category: '인물', covered: /어머니|아버지|친구|선생|가족|사람|누구|분/.test(userText) },
    { category: '장소', covered: /학교|집|동네|마을|서울|부산|장소|어디|고향/.test(userText) },
    { category: '감정', covered: /기분|마음|슬펐|기뻤|감사|후회|좋았|힘들/.test(userText) },
    { category: '사건', covered: /일이|사건|그때|무슨|계기|순간|기억/.test(userText) },
    { category: '시간', covered: /년|살|때|시절|언제|무렵|당시/.test(userText) },
  ];
}

export function shouldNudgeForShortAnswer(answer: string): boolean {
  const normalized = answer.replace(/\s+/g, '');
  return normalized.length > 0 && normalized.length < 12;
}

export function buildShortAnswerNudge(answer: string): string {
  return shouldNudgeForShortAnswer(answer)
    ? '조금만 더 여쭤봐도 괜찮을까요? 그때 주변에 누가 계셨는지, 또는 어떤 장면이 떠오르는지 한 가지만 더 들려주세요.'
    : '';
}

export function getFamilyQuestionStats(questions: FamilyQuestion[]): FamilyQuestionStats {
  const total = questions.length;
  const archived = questions.filter((question) => question.status === 'archived').length;
  return {
    total,
    pending: questions.filter((question) => question.status === 'pending').length,
    delivered: questions.filter((question) => question.status === 'delivered').length,
    archived,
    highPriority: questions.filter((question) => question.priority === 'high').length,
    answerRate: total === 0 ? 0 : archived / total,
  };
}

export function buildPhotoAlbumItems(photos: StoredPhoto[], memories: Memory[]): PhotoAlbumItem[] {
  return photos.map((photo) => ({
    photoId: photo.id,
    url: photo.url,
    uploadedAt: photo.uploadedAt,
    description: photo.analysis?.description || '분석 대기 중인 사진',
    linkedMemoryTopics: photo.linkedMemoryIds
      .map((memoryId) => memories.find((memory) => memory.id === memoryId)?.topic)
      .filter((topic): topic is string => Boolean(topic)),
  }));
}

export function computeServiceMetrics(input: {
  memories: Memory[];
  ragEntryCount: number;
  photos: StoredPhoto[];
  familyQuestions: FamilyQuestion[];
  calendarEvents: CalendarEvent[];
  now?: Date;
}): ServiceMetrics {
  const now = input.now ?? new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowIso = tomorrow.toISOString().slice(0, 10);

  return {
    memoryCount: input.memories.length,
    publicMemoryCount: input.memories.filter((memory) => memory.privacy !== 'private').length,
    indexedMemoryCount: input.ragEntryCount,
    sensitiveMemoryCount: getSensitiveProtectionSuggestions(input.memories).length,
    contradictionCount: buildContradictionCards(input.memories).length,
    photoCount: input.photos.length,
    linkedPhotoCount: input.photos.filter((photo) => photo.linkedMemoryIds.length > 0).length,
    pendingFamilyQuestionCount: input.familyQuestions.filter((question) => question.status === 'pending').length,
    upcomingEventCount: input.calendarEvents.filter((event) => event.date === tomorrowIso).length,
  };
}

export function getArchiveTabCounts(input: {
  memories: Memory[];
  mapPoints: MemoryMapPoint[];
  photos: StoredPhoto[];
  contradictionCards: ContradictionCard[];
  sensitiveSuggestions: SensitiveProtectionSuggestion[];
}): ArchiveTabCounts {
  return {
    summary: input.memories.length,
    memories: input.memories.length,
    timeline: buildTimelineGroups(input.memories).length,
    map: input.mapPoints.length,
    photos: input.photos.length,
    review: input.contradictionCards.length + input.sensitiveSuggestions.length,
  };
}

export function createChapterReviewComment(chapterId: string, body: string) {
  return {
    id: `comment_${chapterId}_${Date.now()}`,
    chapterId,
    body: body.trim(),
    createdAt: new Date().toISOString(),
  };
}
