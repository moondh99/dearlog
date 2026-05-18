import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { assignConfidenceLabel } from './verification';
import type { ContradictionReport } from '../types';

/**
 * Feature: memoir-platform-enhancement, Property 1: Confidence Label Assignment
 *
 * Validates: Requirements 1.3, 1.4, 1.5, 1.6, 1.8
 *
 * For any list of contradiction reports (each with severity 'soft' or 'hard'), the
 * `assignConfidenceLabel` function SHALL return exactly one label following these rules:
 * "확인됨" when the list is empty or the RAG index has fewer than 2 entries, "추정" when
 * all contradictions are soft, and "추가 확인 필요" when at least one contradiction is hard.
 */
describe('Property 1: Confidence Label Assignment', () => {
  // ─── Generators ──────────────────────────────────────────────────────────────

  const severityArb: fc.Arbitrary<'soft' | 'hard'> = fc.constantFrom('soft', 'hard');

  const contradictionReportArb: fc.Arbitrary<ContradictionReport> = fc.record({
    memoryIdA: fc.uuid(),
    memoryIdB: fc.uuid(),
    conflictingFields: fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
      minLength: 1,
      maxLength: 5,
    }),
    severity: severityArb,
    explanation: fc.string({ minLength: 1, maxLength: 100 }),
  });

  const softContradictionArb: fc.Arbitrary<ContradictionReport> = fc.record({
    memoryIdA: fc.uuid(),
    memoryIdB: fc.uuid(),
    conflictingFields: fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
      minLength: 1,
      maxLength: 5,
    }),
    severity: fc.constant('soft' as const),
    explanation: fc.string({ minLength: 1, maxLength: 100 }),
  });

  const hardContradictionArb: fc.Arbitrary<ContradictionReport> = fc.record({
    memoryIdA: fc.uuid(),
    memoryIdB: fc.uuid(),
    conflictingFields: fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
      minLength: 1,
      maxLength: 5,
    }),
    severity: fc.constant('hard' as const),
    explanation: fc.string({ minLength: 1, maxLength: 100 }),
  });

  // ─── Sub-property 1: Empty contradictions list → "확인됨" ─────────────────────

  it('returns "확인됨" when contradictions list is empty', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 1000 }), // indexSize >= 2 (sufficient entries)
        (indexSize) => {
          const result = assignConfidenceLabel([], indexSize);
          expect(result).toBe('확인됨');
        }
      ),
      { numRuns: 100 }
    );
  });

  // ─── Sub-property 2: indexSize < 2 → "확인됨" regardless of contradictions ────

  it('returns "확인됨" when indexSize < 2 regardless of contradictions', () => {
    fc.assert(
      fc.property(
        fc.array(contradictionReportArb, { minLength: 0, maxLength: 10 }),
        fc.integer({ min: 0, max: 1 }), // indexSize < 2
        (contradictions, indexSize) => {
          const result = assignConfidenceLabel(contradictions, indexSize);
          expect(result).toBe('확인됨');
        }
      ),
      { numRuns: 100 }
    );
  });

  // ─── Sub-property 3: All soft contradictions → "추정" ─────────────────────────

  it('returns "추정" when all contradictions are soft', () => {
    fc.assert(
      fc.property(
        fc.array(softContradictionArb, { minLength: 1, maxLength: 10 }),
        fc.integer({ min: 2, max: 1000 }), // indexSize >= 2
        (contradictions, indexSize) => {
          const result = assignConfidenceLabel(contradictions, indexSize);
          expect(result).toBe('추정');
        }
      ),
      { numRuns: 100 }
    );
  });

  // ─── Sub-property 4: At least one hard contradiction → "추가 확인 필요" ────────

  it('returns "추가 확인 필요" when at least one contradiction is hard', () => {
    fc.assert(
      fc.property(
        fc.array(contradictionReportArb, { minLength: 0, maxLength: 9 }),
        hardContradictionArb,
        fc.integer({ min: 2, max: 1000 }), // indexSize >= 2
        (otherContradictions, hardContradiction, indexSize) => {
          // Insert the hard contradiction at a random position
          const contradictions = [...otherContradictions, hardContradiction];
          const result = assignConfidenceLabel(contradictions, indexSize);
          expect(result).toBe('추가 확인 필요');
        }
      ),
      { numRuns: 100 }
    );
  });

  // ─── Sub-property 5: Always returns exactly one of the three valid labels ─────

  it('always returns exactly one of the three valid labels', () => {
    const validLabels = ['확인됨', '추정', '추가 확인 필요'];

    fc.assert(
      fc.property(
        fc.array(contradictionReportArb, { minLength: 0, maxLength: 10 }),
        fc.option(fc.integer({ min: 0, max: 1000 }), { nil: undefined }),
        (contradictions, indexSize) => {
          const result = assignConfidenceLabel(contradictions, indexSize);
          expect(validLabels).toContain(result);
          expect(typeof result).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });
});
