import { describe, expect, it } from 'vitest';
import type { CalendarEvent, FamilyQuestion, Memory, StoredPhoto } from '../types';
import {
  buildContradictionCards,
  buildMemoryMapPoints,
  buildPhotoAlbumItems,
  buildShortAnswerNudge,
  buildTimelineGroups,
  computeServiceMetrics,
  createChapterReviewComment,
  estimateInterviewProgress,
  getArchiveTabCounts,
  getFamilyQuestionStats,
  getSensitiveProtectionSuggestions,
  getLifeStage,
  shouldNudgeForShortAnswer,
} from './memory-insights';

function memory(overrides: Partial<Memory> = {}): Memory {
  return {
    id: overrides.id ?? 'mem-1',
    date: overrides.date ?? '2024-01-01T00:00:00.000Z',
    topic: overrides.topic ?? '어린 시절 학교 이야기',
    originalTranscript: overrides.originalTranscript ?? '학교에서 친구와 놀았습니다.',
    cleanedTranscript: overrides.cleanedTranscript ?? '학교에서 친구와 놀았습니다.',
    publishVersion: overrides.publishVersion ?? '학교에서 친구와 놀았습니다.',
    tags: overrides.tags ?? {
      people: ['친구'],
      places: ['서울'],
      emotions: ['감사'],
      timePeriod: '1960년대',
    },
    privacy: overrides.privacy ?? 'family',
    confidenceLabel: overrides.confidenceLabel ?? '확인됨',
    contradictions: overrides.contradictions ?? [],
    consent: overrides.consent ?? {
      status: 'granted',
      accessTier: '전체 가족',
      designatedFamilyIds: [],
      lastModified: '2024-01-01T00:00:00.000Z',
    },
    consentSettings: overrides.consentSettings,
    embedding: overrides.embedding ?? null,
  };
}

describe('memory insights helpers', () => {
  it('classifies memories into life stages and timeline groups', () => {
    expect(getLifeStage(memory())).toBe('어린시절');
    const groups = buildTimelineGroups([
      memory({ id: 'a', topic: '회사 생활', cleanedTranscript: '직장에서 일했습니다.', tags: { people: [], places: [], emotions: [], timePeriod: '1980년대' } }),
      memory({ id: 'b', topic: '가족 여행', cleanedTranscript: '가족과 여행을 갔습니다.', tags: { people: ['아버지'], places: [], emotions: [], timePeriod: '1970년대' } }),
    ]);
    expect(groups.map((group) => group.stage)).toContain('가족');
    expect(groups.map((group) => group.stage)).toContain('직업');
  });

  it('aggregates memory map points by place', () => {
    const points = buildMemoryMapPoints([
      memory({ id: 'a', topic: '서울 이야기', tags: { people: [], places: ['서울'], emotions: [], timePeriod: '' } }),
      memory({ id: 'b', topic: '또 서울', tags: { people: [], places: ['서울'], emotions: [], timePeriod: '' } }),
    ]);
    expect(points[0]).toMatchObject({ place: '서울', count: 2 });
    expect(points[0].memoryIds).toEqual(['a', 'b']);
  });

  it('builds contradiction cards with severity', () => {
    const cards = buildContradictionCards([
      memory({ id: 'a', contradictions: ['b'], confidenceLabel: '추가 확인 필요' }),
    ]);
    expect(cards[0]).toMatchObject({ memoryId: 'a', severity: 'high' });
  });

  it('detects sensitive memories that still allow sensitive access', () => {
    const suggestions = getSensitiveProtectionSuggestions([
      memory({
        tags: { people: [], places: [], emotions: ['상실'], timePeriod: '' },
        consentSettings: { 출판: 'granted', 가족열람: 'granted', 챗봇: 'granted', 사후공개: 'granted', 민감정보: 'granted' },
      }),
    ]);
    expect(suggestions[0].shouldRevokeSensitiveAccess).toBe(true);
  });

  it('estimates interview progress from user messages', () => {
    const progress = estimateInterviewProgress([
      { role: 'user', text: '어머니와 학교에 갔던 때가 기억나요.' },
    ]);
    expect(progress.find((item) => item.category === '인물')?.covered).toBe(true);
    expect(progress.find((item) => item.category === '장소')?.covered).toBe(true);
  });

  it('nudges short answers only', () => {
    expect(shouldNudgeForShortAnswer('네')).toBe(true);
    expect(buildShortAnswerNudge('네').length).toBeGreaterThan(0);
    expect(shouldNudgeForShortAnswer('그때는 학교 운동장에서 친구들과 오래 놀았습니다.')).toBe(false);
  });

  it('computes family question stats', () => {
    const questions: FamilyQuestion[] = [
      { id: 'q1', questionText: '질문', submittedBy: 'u', anonymous: false, priority: 'high', status: 'pending', createdAt: '', answeredAt: null, answerMemoryId: null },
      { id: 'q2', questionText: '질문', submittedBy: 'u', anonymous: false, priority: 'normal', status: 'archived', createdAt: '', answeredAt: '', answerMemoryId: 'm1' },
    ];
    expect(getFamilyQuestionStats(questions)).toMatchObject({ total: 2, pending: 1, archived: 1, highPriority: 1 });
  });

  it('builds photo album items with linked memory topics', () => {
    const photos: StoredPhoto[] = [{ id: 'p1', url: 'blob:x', uploadedAt: '2024-01-01', analysis: null, linkedMemoryIds: ['m1'] }];
    const items = buildPhotoAlbumItems(photos, [memory({ id: 'm1', topic: '사진 속 기억' })]);
    expect(items[0].linkedMemoryTopics).toEqual(['사진 속 기억']);
  });

  it('computes service metrics', () => {
    const event: CalendarEvent = { id: 'e1', title: '생일', eventType: '생일', date: '2024-01-02', relatedPeople: [], description: '' };
    const metrics = computeServiceMetrics({
      memories: [memory()],
      ragEntryCount: 1,
      photos: [{ id: 'p1', url: '', uploadedAt: '', analysis: null, linkedMemoryIds: ['m1'] }],
      familyQuestions: [],
      calendarEvents: [event],
      now: new Date('2024-01-01T00:00:00.000Z'),
    });
    expect(metrics).toMatchObject({ memoryCount: 1, indexedMemoryCount: 1, linkedPhotoCount: 1, upcomingEventCount: 1 });
  });

  it('computes archive tab counts', () => {
    const memories = [memory({ id: 'm1', tags: { people: [], places: ['서울'], emotions: [], timePeriod: '1960년대' } })];
    const mapPoints = buildMemoryMapPoints(memories);
    const counts = getArchiveTabCounts({
      memories,
      mapPoints,
      photos: [{ id: 'p1', url: '', uploadedAt: '', analysis: null, linkedMemoryIds: [] }],
      contradictionCards: [{ memoryId: 'm1', topic: '확인', relatedMemoryIds: ['m2'], severity: 'high' }],
      sensitiveSuggestions: [],
    });

    expect(counts).toMatchObject({ memories: 1, map: 1, photos: 1, review: 1 });
  });

  it('creates chapter review comments with trimmed body', () => {
    const comment = createChapterReviewComment('chapter-1', '  이 문장 확인 필요  ');
    expect(comment.chapterId).toBe('chapter-1');
    expect(comment.body).toBe('이 문장 확인 필요');
  });
});
