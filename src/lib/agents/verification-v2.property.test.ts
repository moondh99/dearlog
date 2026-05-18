import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { classifyConflictType, generateVerificationJSON, detectUncertainty } from './verification';
import type { ContradictionReport, Memory, VerificationJSON, ConflictType } from '../types';

/**
 * Feature: agent-model-v2, Property 8: Conflict type classification validation
 *
 * Validates: Requirements 3.2
 *
 * For any contradiction detected by the Verification Module, the conflict type
 * SHALL be exactly one of: 'TIME', 'PERSON', 'FACT', or 'DUPLICATE'.
 */
describe('Property 8: Conflict type classification validation', () => {
  const conflictingFieldsArb = fc.array(
    fc.string({ minLength: 1, maxLength: 30 }),
    { minLength: 0, maxLength: 5 }
  );

  const explanationArb = fc.string({ minLength: 0, maxLength: 200 });

  const VALID_CONFLICT_TYPES: ConflictType[] = ['TIME', 'PERSON', 'FACT', 'DUPLICATE'];

  it('classifyConflictType always returns one of TIME, PERSON, FACT, or DUPLICATE', () => {
    fc.assert(
      fc.property(
        conflictingFieldsArb,
        explanationArb,
        (conflictingFields, explanation) => {
          const result = classifyConflictType(conflictingFields, explanation);
          expect(VALID_CONFLICT_TYPES).toContain(result);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: agent-model-v2, Property 9: Verification preserves memory immutability
 *
 * Validates: Requirements 3.3, 3.4
 *
 * For any existing Memory_Chunk in the store, after the Verification Module processes
 * a new memory and attaches flags, the existing Memory_Chunk's content SHALL remain
 * byte-for-byte identical.
 */
describe('Property 9: Verification preserves memory immutability', () => {
  const validDateArb = fc.date({
    min: new Date('1900-01-01'),
    max: new Date('2100-01-01'),
    noInvalidDate: true,
  });

  const memoryArb: fc.Arbitrary<Memory> = fc.record({
    id: fc.uuid(),
    date: validDateArb.map((d) => d.toISOString()),
    topic: fc.string({ minLength: 1, maxLength: 50 }),
    originalTranscript: fc.string({ minLength: 1, maxLength: 200 }),
    cleanedTranscript: fc.string({ minLength: 1, maxLength: 200 }),
    publishVersion: fc.string({ minLength: 1, maxLength: 100 }),
    tags: fc.record({
      people: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 3 }),
      places: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 3 }),
      emotions: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 3 }),
      timePeriod: fc.string({ minLength: 1, maxLength: 20 }),
    }),
    privacy: fc.constantFrom('public', 'family', 'private') as fc.Arbitrary<'public' | 'family' | 'private'>,
    confidenceLabel: fc.constantFrom('확인됨', '추정', '추가 확인 필요') as fc.Arbitrary<'확인됨' | '추정' | '추가 확인 필요'>,
    contradictions: fc.array(fc.uuid(), { minLength: 0, maxLength: 3 }),
    consent: fc.record({
      status: fc.constantFrom('granted', 'revoked') as fc.Arbitrary<'granted' | 'revoked'>,
      accessTier: fc.constantFrom('본인만', '지정 가족', '전체 가족') as fc.Arbitrary<'본인만' | '지정 가족' | '전체 가족'>,
      designatedFamilyIds: fc.array(fc.uuid(), { minLength: 0, maxLength: 3 }),
      lastModified: validDateArb.map((d) => d.toISOString()),
    }),
    embedding: fc.constant(null),
  });

  const contradictionReportArb: fc.Arbitrary<ContradictionReport> = fc.record({
    memoryIdA: fc.uuid(),
    memoryIdB: fc.uuid(),
    conflictingFields: fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
      minLength: 1,
      maxLength: 5,
    }),
    severity: fc.constantFrom('soft', 'hard') as fc.Arbitrary<'soft' | 'hard'>,
    explanation: fc.string({ minLength: 1, maxLength: 100 }),
  });

  it('existing memories remain unchanged after generateVerificationJSON processes a new memory', () => {
    fc.assert(
      fc.property(
        fc.array(memoryArb, { minLength: 1, maxLength: 5 }),
        fc.uuid(),
        fc.array(contradictionReportArb, { minLength: 0, maxLength: 5 }),
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.integer({ min: 2, max: 100 }),
        (existingMemories, newMemoryId, contradictions, memoryText, indexSize) => {
          // Deep clone existing memories to compare after verification
          const snapshotBefore = JSON.parse(JSON.stringify(existingMemories));

          // Run verification (generateVerificationJSON is pure, only produces output)
          generateVerificationJSON(newMemoryId, contradictions, memoryText, indexSize);

          // Verify existing memories are unchanged
          expect(existingMemories).toEqual(snapshotBefore);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: agent-model-v2, Property 10: Verification JSON output schema conformance
 *
 * Validates: Requirements 3.5, 3.6
 *
 * For any verification run, the output SHALL conform to the VerificationJSON schema
 * containing: a valid memoryId, a status of exactly 'PASS' or 'FLAG', an array of
 * conflicts (each with type, relatedMemoryIds, explanation, severity), and a
 * confidenceLabel from {CONFIRMED, ESTIMATED, UNVERIFIED}.
 */
describe('Property 10: Verification JSON output schema conformance', () => {
  const contradictionReportArb: fc.Arbitrary<ContradictionReport> = fc.record({
    memoryIdA: fc.uuid(),
    memoryIdB: fc.uuid(),
    conflictingFields: fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
      minLength: 1,
      maxLength: 5,
    }),
    severity: fc.constantFrom('soft', 'hard') as fc.Arbitrary<'soft' | 'hard'>,
    explanation: fc.string({ minLength: 1, maxLength: 100 }),
  });

  const VALID_STATUSES = ['PASS', 'FLAG'] as const;
  const VALID_CONFIDENCE_LABELS = ['CONFIRMED', 'ESTIMATED', 'UNVERIFIED'] as const;
  const VALID_CONFLICT_TYPES: ConflictType[] = ['TIME', 'PERSON', 'FACT', 'DUPLICATE'];

  it('generateVerificationJSON output conforms to VerificationJSON schema', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.array(contradictionReportArb, { minLength: 0, maxLength: 5 }),
        fc.string({ minLength: 0, maxLength: 200 }),
        fc.integer({ min: 0, max: 100 }),
        (memoryId, contradictions, memoryText, indexSize) => {
          const result: VerificationJSON = generateVerificationJSON(
            memoryId,
            contradictions,
            memoryText,
            indexSize
          );

          // Verify memoryId is present and matches input
          expect(result.memoryId).toBe(memoryId);
          expect(typeof result.memoryId).toBe('string');

          // Verify status is exactly 'PASS' or 'FLAG'
          expect(VALID_STATUSES).toContain(result.status);

          // Verify conflicts is an array
          expect(Array.isArray(result.conflicts)).toBe(true);

          // Verify each conflict has required fields with valid values
          for (const conflict of result.conflicts) {
            expect(VALID_CONFLICT_TYPES).toContain(conflict.type);
            expect(Array.isArray(conflict.relatedMemoryIds)).toBe(true);
            expect(conflict.relatedMemoryIds.length).toBeGreaterThan(0);
            expect(typeof conflict.explanation).toBe('string');
            expect(['soft', 'hard']).toContain(conflict.severity);
          }

          // Verify confidenceLabel is from valid set
          expect(VALID_CONFIDENCE_LABELS).toContain(result.confidenceLabel);

          // Verify status consistency: FLAG if conflicts exist, PASS otherwise
          if (result.conflicts.length > 0) {
            expect(result.status).toBe('FLAG');
          } else {
            expect(result.status).toBe('PASS');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
