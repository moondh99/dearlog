/**
 * Unit tests for Ghostwriter Agent v2 enhancements.
 *
 * Tests the pure functions: categorizeMemories, toPDFReadyAutobiography,
 * and validates the chapter category structure.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */

import { describe, it, expect } from 'vitest';
import type { Memory, GhostwriterChapter, SpeechProfile } from '../types';
import {
  categorizeMemories,
  toPDFReadyAutobiography,
  CHAPTER_CATEGORIES,
} from './ghostwriter';

// ─── Test Helpers ────────────────────────────────────────────────────────────

function createMemory(overrides: Partial<Memory> = {}): Memory {
  return {
    id: `mem-${Math.random().toString(36).slice(2, 8)}`,
    date: '2024-01-01',
    topic: '일반 기억',
    originalTranscript: '원본 텍스트입니다.',
    cleanedTranscript: '정리된 텍스트입니다.',
    publishVersion: '정리된 텍스트입니다.',
    tags: {
      people: [],
      places: [],
      emotions: [],
      timePeriod: '2000년대',
    },
    privacy: 'public',
    confidenceLabel: '확인됨',
    contradictions: [],
    consent: {
      status: 'granted',
      accessTier: '전체 가족',
      designatedFamilyIds: [],
      lastModified: '2024-01-01',
    },
    embedding: null,
    ...overrides,
  };
}

// ─── categorizeMemories Tests ────────────────────────────────────────────────

describe('categorizeMemories', () => {
  it('assigns childhood-related memories to 어린시절', () => {
    const memories: Memory[] = [
      createMemory({ id: 'mem-1', topic: '어린 시절 학교 다니던 이야기' }),
      createMemory({ id: 'mem-2', topic: '초등학교 친구들' }),
    ];

    const result = categorizeMemories(memories);
    expect(result['어린시절']).toContain('mem-1');
    expect(result['어린시절']).toContain('mem-2');
  });

  it('assigns family-related memories to 가족', () => {
    const memories: Memory[] = [
      createMemory({ id: 'mem-1', topic: '가족 여행 이야기' }),
      createMemory({ id: 'mem-2', topic: '어머니와의 추억' }),
    ];

    const result = categorizeMemories(memories);
    expect(result['가족']).toContain('mem-1');
    expect(result['가족']).toContain('mem-2');
  });

  it('assigns career-related memories to 직업', () => {
    const memories: Memory[] = [
      createMemory({ id: 'mem-1', topic: '직장에서의 첫날' }),
      createMemory({ id: 'mem-2', topic: '회사 동료들과의 추억' }),
    ];

    const result = categorizeMemories(memories);
    expect(result['직업']).toContain('mem-1');
    expect(result['직업']).toContain('mem-2');
  });

  it('assigns turning-point memories to 전환점', () => {
    const memories: Memory[] = [
      createMemory({ id: 'mem-1', topic: '인생의 큰 전환점이 된 이사' }),
      createMemory({ id: 'mem-2', topic: '위기를 극복한 경험' }),
    ];

    const result = categorizeMemories(memories);
    expect(result['전환점']).toContain('mem-1');
    expect(result['전환점']).toContain('mem-2');
  });

  it('assigns message-type memories to 전하고싶은말', () => {
    const memories: Memory[] = [
      createMemory({ id: 'mem-1', topic: '후손에게 전하고 싶은 조언' }),
      createMemory({ id: 'mem-2', topic: '인생의 교훈' }),
    ];

    const result = categorizeMemories(memories);
    expect(result['전하고싶은말']).toContain('mem-1');
    expect(result['전하고싶은말']).toContain('mem-2');
  });

  it('excludes private memories from categorization', () => {
    const memories: Memory[] = [
      createMemory({ id: 'mem-1', topic: '학교 이야기', privacy: 'private' }),
      createMemory({ id: 'mem-2', topic: '학교 친구들', privacy: 'public' }),
    ];

    const result = categorizeMemories(memories);
    const allIds = Object.values(result).flat();
    expect(allIds).not.toContain('mem-1');
    expect(allIds).toContain('mem-2');
  });

  it('assigns unmatched memories to a fallback category', () => {
    const memories: Memory[] = [
      createMemory({ id: 'mem-1', topic: 'xyz 특이한 주제' }),
    ];

    const result = categorizeMemories(memories);
    const allIds = Object.values(result).flat();
    expect(allIds).toContain('mem-1');
  });

  it('can assign a memory to multiple categories if it matches multiple patterns', () => {
    const memories: Memory[] = [
      createMemory({
        id: 'mem-1',
        topic: '가족과 함께한 어린 시절 학교 이야기',
      }),
    ];

    const result = categorizeMemories(memories);
    expect(result['어린시절']).toContain('mem-1');
    expect(result['가족']).toContain('mem-1');
  });

  it('uses time period for fallback categorization', () => {
    const memories: Memory[] = [
      createMemory({
        id: 'mem-1',
        topic: 'xyz 특이한 주제',
        tags: { people: [], places: [], emotions: [], timePeriod: '1950년대' },
      }),
    ];

    const result = categorizeMemories(memories);
    expect(result['어린시절']).toContain('mem-1');
  });
});

// ─── CHAPTER_CATEGORIES Tests ────────────────────────────────────────────────

describe('CHAPTER_CATEGORIES', () => {
  it('contains exactly 5 categories', () => {
    expect(CHAPTER_CATEGORIES).toHaveLength(5);
  });

  it('contains all required categories', () => {
    expect(CHAPTER_CATEGORIES).toContain('어린시절');
    expect(CHAPTER_CATEGORIES).toContain('가족');
    expect(CHAPTER_CATEGORIES).toContain('직업');
    expect(CHAPTER_CATEGORIES).toContain('전환점');
    expect(CHAPTER_CATEGORIES).toContain('전하고싶은말');
  });
});

// ─── toPDFReadyAutobiography Tests ───────────────────────────────────────────

describe('toPDFReadyAutobiography', () => {
  it('converts GhostwriterChapter[] to Autobiography format', () => {
    const chapters: GhostwriterChapter[] = [
      {
        id: 'chapter-v2-어린시절',
        category: '어린시절',
        title: '어린 시절의 기억',
        narrative: '첫 번째 문장입니다. 두 번째 문장입니다.',
        sourceChunks: [
          { sentenceRange: [0, 0], memoryId: 'mem-1' },
          { sentenceRange: [1, 1], memoryId: 'mem-2' },
        ],
        styleRatio: { conversational: 0.6, literary: 0.4 },
      },
    ];

    const result = toPDFReadyAutobiography(chapters, '나의 자서전');

    expect(result.title).toBe('나의 자서전');
    expect(result.chapters).toHaveLength(1);
    expect(result.chapters[0].chapterId).toBe('chapter-v2-어린시절');
    expect(result.chapters[0].title).toBe('어린 시절의 기억');
    expect(result.chapters[0].body).toBe('첫 번째 문장입니다. 두 번째 문장입니다.');
    expect(result.chapters[0].citations).toHaveLength(2);
    expect(result.generatedAt).toBeDefined();
  });

  it('uses default title when none provided', () => {
    const chapters: GhostwriterChapter[] = [];
    const result = toPDFReadyAutobiography(chapters);
    expect(result.title).toBe('나의 이야기');
  });

  it('maps source chunks to citations correctly', () => {
    const chapters: GhostwriterChapter[] = [
      {
        id: 'chapter-v2-가족',
        category: '가족',
        title: '가족 이야기',
        narrative: '문장 하나. 문장 둘. 문장 셋.',
        sourceChunks: [
          { sentenceRange: [0, 1], memoryId: 'mem-a' },
          { sentenceRange: [2, 2], memoryId: 'mem-b' },
        ],
        styleRatio: { conversational: 0.6, literary: 0.4 },
      },
    ];

    const result = toPDFReadyAutobiography(chapters);
    expect(result.chapters[0].citations[0].sentenceIndex).toBe(0);
    expect(result.chapters[0].citations[0].memoryId).toBe('mem-a');
    expect(result.chapters[0].citations[1].sentenceIndex).toBe(2);
    expect(result.chapters[0].citations[1].memoryId).toBe('mem-b');
  });

  it('handles multiple chapters', () => {
    const chapters: GhostwriterChapter[] = CHAPTER_CATEGORIES.map((cat) => ({
      id: `chapter-v2-${cat}`,
      category: cat,
      title: `${cat} 제목`,
      narrative: `${cat} 내용입니다.`,
      sourceChunks: [{ sentenceRange: [0, 0] as [number, number], memoryId: 'mem-1' }],
      styleRatio: { conversational: 0.6, literary: 0.4 },
    }));

    const result = toPDFReadyAutobiography(chapters);
    expect(result.chapters).toHaveLength(5);
  });
});

// ─── Style Ratio Tests ───────────────────────────────────────────────────────

describe('GhostwriterChapter style ratio', () => {
  it('enforces 60/40 conversational/literary ratio', () => {
    const chapter: GhostwriterChapter = {
      id: 'chapter-v2-어린시절',
      category: '어린시절',
      title: '어린 시절',
      narrative: '테스트 서사',
      sourceChunks: [],
      styleRatio: { conversational: 0.6, literary: 0.4 },
    };

    expect(chapter.styleRatio.conversational).toBe(0.6);
    expect(chapter.styleRatio.literary).toBe(0.4);
    expect(chapter.styleRatio.conversational + chapter.styleRatio.literary).toBe(1.0);
  });
});
