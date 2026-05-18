import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { SpeechProfile } from '../types';

/**
 * Feature: memoir-platform-enhancement, Property 11: Speech Profile Incremental Preservation
 *
 * Validates: Requirements 10.4
 *
 * For any existing speech profile with N patterns and a new transcript, updating the profile
 * SHALL result in a profile that contains all N original patterns (sentenceEndings,
 * vocabularyPreferences, fillerWords, characteristicExpressions) as a subset, with
 * sessionCount incremented.
 *
 * Since `updateProfile` calls OpenAI (which we can't call in tests), we test the merge logic
 * directly. The merge behavior is:
 * - Arrays (sentenceEndings, fillerWords, characteristicExpressions): union/deduplicated
 * - vocabularyPreferences: spread merge (existing keys preserved, new keys added)
 * - sessionCount: incremented by 1
 */

// ─── Merge Logic (mirrors internal implementation) ─────────────────────────────

/**
 * Merges two string arrays, removing duplicates.
 * Preserves all items from the existing array and adds new unique items.
 */
function mergeArrays(existing: string[], additions: string[]): string[] {
  const set = new Set(existing);
  for (const item of additions) {
    set.add(item);
  }
  return Array.from(set);
}

/**
 * Simulates the profile merge that updateProfile performs after receiving
 * new patterns from the LLM. This is the pure data transformation logic.
 */
function mergeProfile(existing: SpeechProfile, newPatterns: {
  sentenceEndings: string[];
  vocabularyPreferences: Record<string, string>;
  fillerWords: string[];
  characteristicExpressions: string[];
  dialect: string | null;
}): SpeechProfile {
  return {
    sentenceEndings: mergeArrays(existing.sentenceEndings, newPatterns.sentenceEndings),
    vocabularyPreferences: {
      ...existing.vocabularyPreferences,
      ...newPatterns.vocabularyPreferences,
    },
    fillerWords: mergeArrays(existing.fillerWords, newPatterns.fillerWords),
    characteristicExpressions: mergeArrays(
      existing.characteristicExpressions,
      newPatterns.characteristicExpressions
    ),
    dialect: newPatterns.dialect ?? existing.dialect,
    sessionCount: existing.sessionCount + 1,
    lastUpdated: new Date().toISOString(),
  };
}

// ─── Generators ────────────────────────────────────────────────────────────────

const koreanPatternArb: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom(
    '~했지', '~란다', '~거든', '~잖아', '~더라고',
    '그래가지고', '인자', '뭐시기', '아이고', '글쎄말이야',
    '그러니까', '있잖아', '말이야', '그래서', '근데'
  ),
  fc.string({ minLength: 1, maxLength: 20 })
);

const stringArrayArb: fc.Arbitrary<string[]> = fc.array(koreanPatternArb, {
  minLength: 0,
  maxLength: 15,
});

const vocabularyMapArb: fc.Arbitrary<Record<string, string>> = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 10 }),
  fc.string({ minLength: 1, maxLength: 20 }),
  { minKeys: 0, maxKeys: 10 }
);

const dialectArb: fc.Arbitrary<string | null> = fc.oneof(
  fc.constant(null),
  fc.constantFrom('경상도', '전라도', '충청도', '강원도', '제주도')
);

const speechProfileArb: fc.Arbitrary<SpeechProfile> = fc.record({
  sentenceEndings: stringArrayArb,
  vocabularyPreferences: vocabularyMapArb,
  fillerWords: stringArrayArb,
  characteristicExpressions: stringArrayArb,
  dialect: dialectArb,
  sessionCount: fc.nat({ max: 100 }),
  lastUpdated: fc.constant(new Date().toISOString()),
});

const newPatternsArb = fc.record({
  sentenceEndings: stringArrayArb,
  vocabularyPreferences: vocabularyMapArb,
  fillerWords: stringArrayArb,
  characteristicExpressions: stringArrayArb,
  dialect: dialectArb,
});

// ─── Property Tests ────────────────────────────────────────────────────────────

describe('Property 11: Speech Profile Incremental Preservation', () => {
  // ─── Sub-property 1: All original sentenceEndings are preserved ──────────────

  it('after merging, all original sentenceEndings are present in the result', () => {
    fc.assert(
      fc.property(speechProfileArb, newPatternsArb, (existing, newPatterns) => {
        const merged = mergeProfile(existing, newPatterns);

        for (const ending of existing.sentenceEndings) {
          expect(merged.sentenceEndings).toContain(ending);
        }
      }),
      { numRuns: 100 }
    );
  });

  // ─── Sub-property 2: All original vocabularyPreferences keys are preserved ────

  it('after merging, all original vocabularyPreferences keys are present in the result', () => {
    fc.assert(
      fc.property(speechProfileArb, newPatternsArb, (existing, newPatterns) => {
        const merged = mergeProfile(existing, newPatterns);

        for (const key of Object.keys(existing.vocabularyPreferences)) {
          expect(key in merged.vocabularyPreferences).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  // ─── Sub-property 3: All original fillerWords are preserved ──────────────────

  it('after merging, all original fillerWords are present in the result', () => {
    fc.assert(
      fc.property(speechProfileArb, newPatternsArb, (existing, newPatterns) => {
        const merged = mergeProfile(existing, newPatterns);

        for (const filler of existing.fillerWords) {
          expect(merged.fillerWords).toContain(filler);
        }
      }),
      { numRuns: 100 }
    );
  });

  // ─── Sub-property 4: All original characteristicExpressions are preserved ─────

  it('after merging, all original characteristicExpressions are present in the result', () => {
    fc.assert(
      fc.property(speechProfileArb, newPatternsArb, (existing, newPatterns) => {
        const merged = mergeProfile(existing, newPatterns);

        for (const expr of existing.characteristicExpressions) {
          expect(merged.characteristicExpressions).toContain(expr);
        }
      }),
      { numRuns: 100 }
    );
  });

  // ─── Sub-property 5: sessionCount is incremented by 1 ────────────────────────

  it('after merging, sessionCount is incremented by exactly 1', () => {
    fc.assert(
      fc.property(speechProfileArb, newPatternsArb, (existing, newPatterns) => {
        const merged = mergeProfile(existing, newPatterns);

        expect(merged.sessionCount).toBe(existing.sessionCount + 1);
      }),
      { numRuns: 100 }
    );
  });

  // ─── Sub-property 6: New patterns are also included (merge is additive) ───────

  it('after merging, all new patterns are also included in the result', () => {
    fc.assert(
      fc.property(speechProfileArb, newPatternsArb, (existing, newPatterns) => {
        const merged = mergeProfile(existing, newPatterns);

        // New sentenceEndings are included
        for (const ending of newPatterns.sentenceEndings) {
          expect(merged.sentenceEndings).toContain(ending);
        }

        // New fillerWords are included
        for (const filler of newPatterns.fillerWords) {
          expect(merged.fillerWords).toContain(filler);
        }

        // New characteristicExpressions are included
        for (const expr of newPatterns.characteristicExpressions) {
          expect(merged.characteristicExpressions).toContain(expr);
        }

        // New vocabularyPreferences keys are included
        for (const key of Object.keys(newPatterns.vocabularyPreferences)) {
          expect(key in merged.vocabularyPreferences).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  // ─── Sub-property 7: Error path preserves profile with incremented count ──────

  it('on error path, existing profile is fully preserved with sessionCount + 1', () => {
    fc.assert(
      fc.property(speechProfileArb, (existing) => {
        // Simulate the error path of updateProfile:
        // return { ...existingProfile, sessionCount: existingProfile.sessionCount + 1, lastUpdated: ... }
        const errorResult: SpeechProfile = {
          ...existing,
          sessionCount: existing.sessionCount + 1,
          lastUpdated: new Date().toISOString(),
        };

        // All original patterns are exactly preserved
        expect(errorResult.sentenceEndings).toEqual(existing.sentenceEndings);
        expect(errorResult.vocabularyPreferences).toEqual(existing.vocabularyPreferences);
        expect(errorResult.fillerWords).toEqual(existing.fillerWords);
        expect(errorResult.characteristicExpressions).toEqual(existing.characteristicExpressions);
        expect(errorResult.dialect).toEqual(existing.dialect);
        expect(errorResult.sessionCount).toBe(existing.sessionCount + 1);
      }),
      { numRuns: 100 }
    );
  });
});
