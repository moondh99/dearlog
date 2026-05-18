import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { SpeechProfile } from '../types';
import { updateSpeechProfile, ExtractedPatterns } from './tone-calibrator';

/**
 * Feature: agent-model-v2, Property 13: Speech profile monotonic growth
 *
 * Validates: Requirements 5.1, 5.4
 *
 * For any existing SpeechProfile and new transcript, updating the profile SHALL produce
 * a new profile where: sentenceEndings is a superset of the original, vocabularyPreferences
 * contains all original keys, fillerWords is a superset of the original,
 * characteristicExpressions is a superset of the original, and sessionCount is incremented
 * by exactly 1.
 */

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

const extractedPatternsArb: fc.Arbitrary<ExtractedPatterns> = fc.record({
  sentenceEndings: stringArrayArb,
  vocabularyPreferences: vocabularyMapArb,
  fillerWords: stringArrayArb,
  characteristicExpressions: stringArrayArb,
  dialect: dialectArb,
});

// ─── Property Tests ────────────────────────────────────────────────────────────

describe('Feature: agent-model-v2, Property 13: Speech profile monotonic growth', () => {
  it('sentenceEndings is a superset of the original after update', () => {
    fc.assert(
      fc.property(speechProfileArb, extractedPatternsArb, (existing, newPatterns) => {
        const updated = updateSpeechProfile(existing, newPatterns);

        for (const ending of existing.sentenceEndings) {
          expect(updated.sentenceEndings).toContain(ending);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('vocabularyPreferences contains all original keys after update', () => {
    fc.assert(
      fc.property(speechProfileArb, extractedPatternsArb, (existing, newPatterns) => {
        const updated = updateSpeechProfile(existing, newPatterns);

        for (const key of Object.keys(existing.vocabularyPreferences)) {
          expect(key in updated.vocabularyPreferences).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('fillerWords is a superset of the original after update', () => {
    fc.assert(
      fc.property(speechProfileArb, extractedPatternsArb, (existing, newPatterns) => {
        const updated = updateSpeechProfile(existing, newPatterns);

        for (const filler of existing.fillerWords) {
          expect(updated.fillerWords).toContain(filler);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('characteristicExpressions is a superset of the original after update', () => {
    fc.assert(
      fc.property(speechProfileArb, extractedPatternsArb, (existing, newPatterns) => {
        const updated = updateSpeechProfile(existing, newPatterns);

        for (const expr of existing.characteristicExpressions) {
          expect(updated.characteristicExpressions).toContain(expr);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('sessionCount is incremented by exactly 1 after update', () => {
    fc.assert(
      fc.property(speechProfileArb, extractedPatternsArb, (existing, newPatterns) => {
        const updated = updateSpeechProfile(existing, newPatterns);

        expect(updated.sessionCount).toBe(existing.sessionCount + 1);
      }),
      { numRuns: 100 }
    );
  });
});
