import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import type { Memory, QuestionCategory, EvidenceBadge, DigitalTwinResponse } from '../types';

// Mock the rag module to avoid OpenAI API key requirement at module load
vi.mock('../rag/index', () => ({
  ragIndex: {
    search: vi.fn().mockResolvedValue([]),
    addMemory: vi.fn().mockResolvedValue(undefined),
    getEmbedding: vi.fn().mockResolvedValue([]),
    removeMemory: vi.fn(),
  },
}));

// Mock OpenAI to avoid API key requirement
vi.mock('openai', () => ({
  default: class MockOpenAI {
    constructor() {}
    chat = { completions: { create: vi.fn() } };
    embeddings = { create: vi.fn() };
  },
}));

import { classifyQuestion, filterMemories, generateEvidenceBadges, buildDigitalTwinResponse } from './persona';

/**
 * Property tests for Digital Twin Agent v2
 *
 * Properties 14-17 validate question classification, memory filtering,
 * response structure, and evidence badge integrity.
 */

// ─── Generators ────────────────────────────────────────────────────────────────

const VALID_QUESTION_CATEGORIES: QuestionCategory[] = [
  '사실확인형',
  '시기회상형',
  '가치관탐색형',
  '인물관련형',
];

const questionArb: fc.Arbitrary<string> = fc.oneof(
  fc.string({ minLength: 0, maxLength: 100 }),
  fc.constantFrom(
    '할아버지는 언제 결혼하셨어요?',
    '어린 시절에 뭐하고 놀았어요?',
    '인생에서 가장 중요한 가치가 뭐예요?',
    '아버지는 어떤 분이셨어요?',
    '정말 그런 일이 있었나요?',
    '그때 어떤 감정이었어요?',
    ''
  )
);

const memoryIdArb: fc.Arbitrary<string> = fc.stringMatching(/^mem_[a-z0-9]{4,8}$/);

const privacyLevelArb = fc.constantFrom('public' as const, 'family' as const, 'private' as const);

const confidenceLabelArb = fc.constantFrom('확인됨' as const, '추정' as const, '추가 확인 필요' as const);

const memoryConsentArb = fc.record({
  status: fc.constantFrom('granted' as const, 'revoked' as const),
  accessTier: fc.constantFrom('본인만' as const, '지정 가족' as const, '전체 가족' as const),
  designatedFamilyIds: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 0, maxLength: 3 }),
  lastModified: fc.constant(new Date().toISOString()),
});

const memoryArb: fc.Arbitrary<Memory> = fc.record({
  id: memoryIdArb,
  date: fc.constant('2024-01-15'),
  topic: fc.string({ minLength: 1, maxLength: 50 }),
  originalTranscript: fc.string({ minLength: 1, maxLength: 200 }),
  cleanedTranscript: fc.string({ minLength: 1, maxLength: 200 }),
  publishVersion: fc.string({ minLength: 1, maxLength: 200 }),
  tags: fc.record({
    people: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 5 }),
    places: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 5 }),
    emotions: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 5 }),
    timePeriod: fc.string({ minLength: 1, maxLength: 30 }),
  }),
  privacy: privacyLevelArb,
  confidenceLabel: confidenceLabelArb,
  contradictions: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 0, maxLength: 3 }),
  consent: memoryConsentArb,
  embedding: fc.constant(null),
});

const nonEmptyMemoryArrayArb: fc.Arbitrary<Memory[]> = fc.array(memoryArb, {
  minLength: 1,
  maxLength: 10,
});

const filterCriteriaArb = fc.record({
  time: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
  person: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
  emotion: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
});

const responseTextArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 300 });

// ─── Property 14: Digital Twin question category classification ────────────────

describe('Feature: agent-model-v2, Property 14: Digital Twin question category classification', () => {
  it('For any question classification output, the category SHALL be exactly one of the 4 valid categories', () => {
    fc.assert(
      fc.property(questionArb, (question) => {
        const category = classifyQuestion(question);

        expect(VALID_QUESTION_CATEGORIES).toContain(category);
      }),
      { numRuns: 100 }
    );
  });
});

// ─── Property 15: Digital Twin memory filter correctness ───────────────────────

describe('Feature: agent-model-v2, Property 15: Digital Twin memory filter correctness', () => {
  it('All memories returned by filterMemories SHALL match every specified filter criterion (intersection semantics)', () => {
    fc.assert(
      fc.property(
        fc.array(memoryArb, { minLength: 0, maxLength: 15 }),
        filterCriteriaArb,
        (memories, filters) => {
          const result = filterMemories(memories, filters);

          for (const memory of result) {
            // Time filter: timePeriod must contain the filter string (case-insensitive)
            if (filters.time) {
              expect(
                memory.tags.timePeriod.toLowerCase().includes(filters.time.toLowerCase())
              ).toBe(true);
            }

            // Person filter: at least one person must match (case-insensitive substring)
            if (filters.person) {
              const personFilter = filters.person.toLowerCase();
              const hasMatch = memory.tags.people.some((p) =>
                p.toLowerCase().includes(personFilter)
              );
              expect(hasMatch).toBe(true);
            }

            // Emotion filter: at least one emotion must match (case-insensitive substring)
            if (filters.emotion) {
              const emotionFilter = filters.emotion.toLowerCase();
              const hasMatch = memory.tags.emotions.some((e) =>
                e.toLowerCase().includes(emotionFilter)
              );
              expect(hasMatch).toBe(true);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 16: Digital Twin response structure with evidence ─────────────────

describe('Feature: agent-model-v2, Property 16: Digital Twin response structure with evidence', () => {
  it('For any Digital Twin response with non-empty memories, output SHALL contain non-empty text, valid evidence badges, and linked memory cards', () => {
    fc.assert(
      fc.property(
        responseTextArb,
        nonEmptyMemoryArrayArb,
        questionArb,
        (text, memories, question) => {
          const response = buildDigitalTwinResponse(text, memories, question);

          // Non-empty response text
          expect(response.text.length).toBeGreaterThan(0);

          // At least one evidence badge
          expect(response.evidenceBadges.length).toBeGreaterThanOrEqual(1);

          // Each evidence badge has valid memoryId and relevanceScore ∈ [0, 1]
          for (const badge of response.evidenceBadges) {
            expect(badge.memoryId).toBeTruthy();
            expect(badge.relevanceScore).toBeGreaterThanOrEqual(0);
            expect(badge.relevanceScore).toBeLessThanOrEqual(1);
          }

          // Non-empty linkedMemoryCards array
          expect(response.linkedMemoryCards.length).toBeGreaterThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 17: Evidence badge references valid memories ──────────────────────

describe('Feature: agent-model-v2, Property 17: Evidence badge references valid memories', () => {
  it('For any evidence badge, the referenced memoryId SHALL exist in the input memories array', () => {
    fc.assert(
      fc.property(
        nonEmptyMemoryArrayArb,
        questionArb,
        (memories, question) => {
          const badges = generateEvidenceBadges(memories, question);
          const validMemoryIds = new Set(memories.map((m) => m.id));

          for (const badge of badges) {
            expect(validMemoryIds.has(badge.memoryId)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
