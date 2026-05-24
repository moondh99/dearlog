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

export interface MemoryScopeCategory {
  id: LifeStage;
  label: string;
  description: string;
  sampleQuestion: string;
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

export interface FamilyQuizItem {
  id: string;
  question: string;
  options: string[];
  answerIndex: number;
  sourceMemoryId: string;
  sourceTopic: string;
  sourceExcerpt: string;
}

export type EngagementLoopType = 'quiz' | 'family_question' | 'calendar' | 'interview';

export interface EngagementLoopItem {
  id: string;
  type: EngagementLoopType;
  title: string;
  description: string;
  cadence: string;
  actionLabel: string;
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

const MEMORY_SCOPE_CATEGORIES: MemoryScopeCategory[] = [
  {
    id: '어린시절',
    label: '어린시절과 학창시절',
    description: '고향, 학교, 친구, 부모님과 처음 형성된 가치관',
    sampleQuestion: '어릴 때 집 주변에서 가장 선명하게 기억나는 풍경은 무엇인가요?',
  },
  {
    id: '가족',
    label: '가족과 관계',
    description: '부모, 형제, 배우자, 자녀, 손주와 함께한 장면',
    sampleQuestion: '가족에게 아직 자세히 들려주지 못한 순간이 있으신가요?',
  },
  {
    id: '직업',
    label: '일과 생계',
    description: '첫 월급, 직장, 장사, 살림, 생계를 책임진 시간',
    sampleQuestion: '처음 돈을 벌었을 때 가장 먼저 떠오른 사람은 누구였나요?',
  },
  {
    id: '전환점',
    label: '전환점과 감정',
    description: '이사, 결혼, 실패, 상실, 극복처럼 삶의 방향이 바뀐 사건',
    sampleQuestion: '지금 돌아보면 인생의 방향을 바꾼 선택은 무엇이었나요?',
  },
  {
    id: '전하고싶은말',
    label: '가치관과 남길 말',
    description: '가족에게 전하고 싶은 조언, 당부, 감사, 사과',
    sampleQuestion: '자녀와 손주에게 꼭 남기고 싶은 한 문장이 있다면요?',
  },
  {
    id: '기타',
    label: '사진 속 생활사',
    description: '여행, 명절, 음식, 동네, 물건처럼 사진에서 시작되는 일상 기억',
    sampleQuestion: '이 사진 속 물건이나 장소에 얽힌 생활 이야기가 있으신가요?',
  },
];

const SENSITIVE_KEYWORDS = ['슬픔', '분노', '후회', '트라우마', '상실'];

export function getMemoryScopeCategories(): MemoryScopeCategory[] {
  return MEMORY_SCOPE_CATEGORIES.map((category) => ({ ...category }));
}

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

function uniq(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function buildOptions(correct: string, pool: string[], fallback: string[]): string[] {
  const candidates = uniq([correct, ...pool, ...fallback]).filter((value) => value !== correct);
  return uniq([correct, ...candidates]).slice(0, 3);
}

export function buildWeeklyFamilyQuizzes(memories: Memory[], limit = 3): FamilyQuizItem[] {
  const peoplePool = uniq(memories.flatMap((memory) => memory.tags.people));
  const placePool = uniq(memories.flatMap((memory) => memory.tags.places));
  const timePool = uniq(memories.map((memory) => memory.tags.timePeriod));
  const emotionPool = uniq(memories.flatMap((memory) => memory.tags.emotions));
  const quizzes: FamilyQuizItem[] = [];

  for (const memory of memories) {
    if (quizzes.length >= limit) break;

    const sourceExcerpt = (memory.publishVersion || memory.cleanedTranscript || memory.originalTranscript)
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 90);
    const base = {
      sourceMemoryId: memory.id,
      sourceTopic: memory.topic,
      sourceExcerpt,
    };

    const person = memory.tags.people.find(Boolean);
    if (person) {
      const options = buildOptions(person, peoplePool, ['어머니', '아버지', '손녀']);
      if (options.length >= 3) {
        quizzes.push({
          id: `quiz_${memory.id}_person`,
          question: `"${memory.topic}" 기억에 함께 등장한 사람은 누구일까요?`,
          options,
          answerIndex: options.indexOf(person),
          ...base,
        });
        continue;
      }
    }

    const place = memory.tags.places.find(Boolean);
    if (place) {
      const options = buildOptions(place, placePool, ['서울역', '부산 시장', '고향집']);
      if (options.length >= 3) {
        quizzes.push({
          id: `quiz_${memory.id}_place`,
          question: `"${memory.topic}" 이야기가 떠오른 장소는 어디일까요?`,
          options,
          answerIndex: options.indexOf(place),
          ...base,
        });
        continue;
      }
    }

    const timePeriod = memory.tags.timePeriod?.trim();
    if (timePeriod) {
      const options = buildOptions(timePeriod, timePool, ['1960년대', '1970년대', '1980년대']);
      if (options.length >= 3) {
        quizzes.push({
          id: `quiz_${memory.id}_time`,
          question: `"${memory.topic}" 기억은 어느 시기의 이야기일까요?`,
          options,
          answerIndex: options.indexOf(timePeriod),
          ...base,
        });
        continue;
      }
    }

    const emotion = memory.tags.emotions.find(Boolean);
    if (emotion) {
      const options = buildOptions(emotion, emotionPool, ['감사', '자부심', '그리움']);
      if (options.length >= 3) {
        quizzes.push({
          id: `quiz_${memory.id}_emotion`,
          question: `"${memory.topic}" 기억에 가장 가까운 마음은 무엇일까요?`,
          options,
          answerIndex: options.indexOf(emotion),
          ...base,
        });
      }
    }
  }

  return quizzes;
}

function daysUntil(date: string, now: Date): number {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function buildEngagementLoop(input: {
  memories: Memory[];
  familyQuestions: FamilyQuestion[];
  calendarEvents: CalendarEvent[];
  now?: Date;
}): EngagementLoopItem[] {
  const now = input.now ?? new Date();
  const items: EngagementLoopItem[] = [];
  const quiz = buildWeeklyFamilyQuizzes(input.memories, 1)[0];

  if (quiz) {
    items.push({
      id: `loop_${quiz.id}`,
      type: 'quiz',
      title: '이번 주 가족 퀴즈 보내기',
      description: `"${quiz.sourceTopic}" 기억을 손주 세대가 맞혀보는 질문으로 다시 꺼냅니다.`,
      cadence: '매주 1회',
      actionLabel: '퀴즈 공유',
    });
  }

  const pendingQuestion = input.familyQuestions
    .filter((question) => question.status === 'pending')
    .sort((a, b) => {
      const priorityDelta = (b.priority === 'high' ? 1 : 0) - (a.priority === 'high' ? 1 : 0);
      return priorityDelta || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    })[0];

  if (pendingQuestion) {
    items.push({
      id: `loop_question_${pendingQuestion.id}`,
      type: 'family_question',
      title: '가족 질문 이어 묻기',
      description: pendingQuestion.questionText,
      cadence: pendingQuestion.priority === 'high' ? '우선 질문' : '대기 질문',
      actionLabel: '다음 인터뷰에 연결',
    });
  }

  const upcomingEvent = input.calendarEvents
    .map((event) => ({ event, days: daysUntil(event.date, now) }))
    .filter(({ days }) => days >= 0 && days <= 14)
    .sort((a, b) => a.days - b.days)[0];

  if (upcomingEvent) {
    const dayLabel = upcomingEvent.days === 0 ? '오늘' : `D-${upcomingEvent.days}`;
    items.push({
      id: `loop_calendar_${upcomingEvent.event.id}`,
      type: 'calendar',
      title: '기념일 전에 기억 꺼내기',
      description: `${upcomingEvent.event.title}에 맞춰 관련 기억이나 새 인터뷰 질문을 준비합니다.`,
      cadence: dayLabel,
      actionLabel: '알림 준비',
    });
  }

  if (items.length < 3) {
    const groups = buildTimelineGroups(input.memories);
    const coveredStages = new Set(groups.map((group) => group.stage));
    const nextScope = getMemoryScopeCategories().find((category) => !coveredStages.has(category.id))
      ?? getMemoryScopeCategories()[0];
    items.push({
      id: `loop_interview_${nextScope.id}`,
      type: 'interview',
      title: `${nextScope.label} 추가 인터뷰`,
      description: nextScope.sampleQuestion,
      cadence: '다음 회차',
      actionLabel: '질문 예약',
    });
  }

  return items.slice(0, 3);
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
