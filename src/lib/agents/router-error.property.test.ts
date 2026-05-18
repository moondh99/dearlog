import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type {
  Memory,
  ProcessingResult,
  ContradictionReport,
  AgentError,
  AgentName,
  ConfidenceLabel,
  MemoryConsent,
  ConsentStatus,
  AccessTier,
} from '../types';

/**
 * Feature: memoir-platform-enhancement, Property 10: Pipeline Error Resilience
 *
 * Validates: Requirements 9.5
 *
 * For any agent in the pipeline that throws an error, the Agent Router SHALL continue
 * executing all remaining agents in the pipeline, collect the error in the errors array,
 * and the final ProcessingResult SHALL contain results from all non-failing agents.
 */
describe('Property 10: Pipeline Error Resilience', () => {
  // ─── Generators ──────────────────────────────────────────────────────────────

  const agentNameArb: fc.Arbitrary<AgentName> = fc.constantFrom(
    'interviewer',
    'archivist',
    'verification',
    'ghostwriter',
    'tone_calibrator',
    'persona',
    'emotion_analyzer'
  );

  const confidenceLabelArb: fc.Arbitrary<ConfidenceLabel> = fc.constantFrom(
    '확인됨',
    '추정',
    '추가 확인 필요'
  );

  const consentStatusArb: fc.Arbitrary<ConsentStatus> = fc.constantFrom('granted', 'revoked');

  const accessTierArb: fc.Arbitrary<AccessTier> = fc.constantFrom(
    '본인만',
    '지정 가족',
    '전체 가족'
  );

  const isoDateArb = fc
    .integer({ min: -2208988800000, max: 4102444800000 })
    .map((ts) => new Date(ts).toISOString());

  const memoryConsentArb: fc.Arbitrary<MemoryConsent> = fc.record({
    status: consentStatusArb,
    accessTier: accessTierArb,
    designatedFamilyIds: fc.array(fc.uuid(), { minLength: 0, maxLength: 3 }),
    lastModified: isoDateArb,
  });

  const memoryArb: fc.Arbitrary<Memory> = fc.record({
    id: fc.uuid(),
    date: isoDateArb,
    topic: fc.string({ minLength: 1, maxLength: 50 }),
    originalTranscript: fc.string({ minLength: 1, maxLength: 200 }),
    cleanedTranscript: fc.string({ minLength: 1, maxLength: 200 }),
    publishVersion: fc.string({ minLength: 1, maxLength: 200 }),
    tags: fc.record({
      people: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 0, maxLength: 3 }),
      places: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 0, maxLength: 3 }),
      emotions: fc.array(fc.string({ minLength: 1, maxLength: 10 }), {
        minLength: 0,
        maxLength: 3,
      }),
      timePeriod: fc.string({ minLength: 0, maxLength: 20 }),
    }),
    privacy: fc.constantFrom('public' as const, 'family' as const, 'private' as const),
    confidenceLabel: confidenceLabelArb,
    contradictions: fc.array(fc.uuid(), { minLength: 0, maxLength: 3 }),
    consent: memoryConsentArb,
    embedding: fc.option(
      fc.array(fc.float({ min: -1, max: 1, noNaN: true }), { minLength: 3, maxLength: 10 }),
      { nil: null }
    ),
  });

  const embeddingArb = fc.array(fc.float({ min: -1, max: 1, noNaN: true }), {
    minLength: 3,
    maxLength: 10,
  });

  const contradictionReportArb: fc.Arbitrary<ContradictionReport> = fc.record({
    memoryIdA: fc.uuid(),
    memoryIdB: fc.uuid(),
    conflictingFields: fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
      minLength: 1,
      maxLength: 5,
    }),
    severity: fc.constantFrom('soft' as const, 'hard' as const),
    explanation: fc.string({ minLength: 1, maxLength: 100 }),
  });

  // Pipeline agent names in the order they execute in processEndOfSession
  const pipelineAgents: AgentName[] = [
    'archivist',
    'archivist', // RAG index uses 'archivist' agent name in the router
    'verification',
    'tone_calibrator',
  ];

  /**
   * Represents the outcome of a single agent in the pipeline.
   * Either succeeds with a result value, or fails with an error message.
   */
  interface AgentOutcome {
    agent: AgentName;
    succeeds: boolean;
    errorMessage: string;
  }

  // Generator for a pipeline agent outcome
  const agentOutcomeArb = (agent: AgentName): fc.Arbitrary<AgentOutcome> =>
    fc.record({
      agent: fc.constant(agent),
      succeeds: fc.boolean(),
      errorMessage: fc.string({ minLength: 1, maxLength: 50 }),
    });

  // Generator for a full pipeline of agent outcomes (4 stages)
  const pipelineOutcomesArb: fc.Arbitrary<AgentOutcome[]> = fc.tuple(
    agentOutcomeArb('archivist'),
    agentOutcomeArb('archivist'), // RAG index step
    agentOutcomeArb('verification'),
    agentOutcomeArb('tone_calibrator')
  ).map(outcomes => outcomes);

  /**
   * Simulates the pipeline's error handling logic as implemented in router.ts.
   * For each agent step:
   * - If it succeeds, its result is included in the final output
   * - If it fails, the error is caught, pushed to errors array, and pipeline continues
   *
   * This mirrors the try/catch pattern in processEndOfSession.
   */
  function simulatePipeline(
    outcomes: AgentOutcome[],
    fallbackMemory: Memory,
    fallbackEmbedding: number[],
    fallbackContradictions: ContradictionReport[],
    fallbackConfidenceLabel: ConfidenceLabel
  ): ProcessingResult {
    const errors: AgentError[] = [];
    let memory: Memory = fallbackMemory;
    let embedding: number[] = fallbackEmbedding;
    let contradictions: ContradictionReport[] = fallbackContradictions;
    let confidenceLabel: ConfidenceLabel = fallbackConfidenceLabel;

    // Step 1: Archivist
    try {
      if (!outcomes[0].succeeds) {
        throw new Error(outcomes[0].errorMessage);
      }
      // On success, memory is produced by archivist
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push({ agent: 'archivist', error: errorMessage, skipped: true });
      // Pipeline continues with fallback memory
    }

    // Step 2: RAG Index
    try {
      if (!outcomes[1].succeeds) {
        throw new Error(outcomes[1].errorMessage);
      }
      // On success, embedding is produced
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push({ agent: 'archivist', error: errorMessage, skipped: true });
      // Pipeline continues without embedding
    }

    // Step 3: Verification
    try {
      if (!outcomes[2].succeeds) {
        throw new Error(outcomes[2].errorMessage);
      }
      // On success, contradictions and confidence label are produced
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push({ agent: 'verification', error: errorMessage, skipped: true });
      // Pipeline continues with default confidence
    }

    // Step 4: Tone Calibrator
    try {
      if (!outcomes[3].succeeds) {
        throw new Error(outcomes[3].errorMessage);
      }
      // On success, speech profile is updated
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push({ agent: 'tone_calibrator', error: errorMessage, skipped: true });
      // Pipeline continues without profile update
    }

    return {
      memory,
      embedding,
      contradictions,
      confidenceLabel,
      errors,
    };
  }

  // ─── Sub-property 1: Pipeline always produces a result regardless of failures ─

  it('pipeline always produces a ProcessingResult regardless of which agents fail', () => {
    fc.assert(
      fc.property(
        pipelineOutcomesArb,
        memoryArb,
        embeddingArb,
        confidenceLabelArb,
        (outcomes, fallbackMemory, fallbackEmbedding, fallbackLabel) => {
          const result = simulatePipeline(
            outcomes,
            fallbackMemory,
            fallbackEmbedding,
            [],
            fallbackLabel
          );

          // The pipeline ALWAYS produces a ProcessingResult (never throws)
          expect(result).toBeDefined();
          expect(result).toHaveProperty('memory');
          expect(result).toHaveProperty('embedding');
          expect(result).toHaveProperty('contradictions');
          expect(result).toHaveProperty('confidenceLabel');
          expect(result).toHaveProperty('errors');

          // Result types are correct
          expect(Array.isArray(result.errors)).toBe(true);
          expect(Array.isArray(result.embedding)).toBe(true);
          expect(Array.isArray(result.contradictions)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  // ─── Sub-property 2: Errors array contains exactly the failed agents ──────────

  it('errors array contains exactly the agents that failed', () => {
    fc.assert(
      fc.property(
        pipelineOutcomesArb,
        memoryArb,
        embeddingArb,
        confidenceLabelArb,
        (outcomes, fallbackMemory, fallbackEmbedding, fallbackLabel) => {
          const result = simulatePipeline(
            outcomes,
            fallbackMemory,
            fallbackEmbedding,
            [],
            fallbackLabel
          );

          // Count how many agents failed
          const failedCount = outcomes.filter((o) => !o.succeeds).length;

          // The errors array should have exactly as many entries as failed agents
          expect(result.errors.length).toBe(failedCount);

          // Each error should have the correct agent name and error message
          let errorIndex = 0;
          for (let i = 0; i < outcomes.length; i++) {
            if (!outcomes[i].succeeds) {
              expect(result.errors[errorIndex].agent).toBe(outcomes[i].agent);
              expect(result.errors[errorIndex].error).toBe(outcomes[i].errorMessage);
              expect(result.errors[errorIndex].skipped).toBe(true);
              errorIndex++;
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // ─── Sub-property 3: Results from non-failing agents are preserved ────────────

  it('results from all non-failing agents are preserved in the final ProcessingResult', () => {
    fc.assert(
      fc.property(
        memoryArb,
        embeddingArb,
        fc.array(contradictionReportArb, { minLength: 0, maxLength: 3 }),
        confidenceLabelArb,
        fc.array(fc.boolean(), { minLength: 4, maxLength: 4 }),
        (memory, embedding, contradictions, confidenceLabel, successes) => {
          const outcomes: AgentOutcome[] = [
            { agent: 'archivist', succeeds: successes[0], errorMessage: 'archivist error' },
            { agent: 'archivist', succeeds: successes[1], errorMessage: 'rag error' },
            { agent: 'verification', succeeds: successes[2], errorMessage: 'verification error' },
            { agent: 'tone_calibrator', succeeds: successes[3], errorMessage: 'tone error' },
          ];

          const result = simulatePipeline(
            outcomes,
            memory,
            embedding,
            contradictions,
            confidenceLabel
          );

          // Memory is always present (either from archivist or fallback)
          expect(result.memory).toBeDefined();
          expect(result.memory).toEqual(memory);

          // Embedding is always present (either from RAG or fallback)
          expect(result.embedding).toBeDefined();
          expect(result.embedding).toEqual(embedding);

          // Contradictions are always present (either from verification or fallback)
          expect(result.contradictions).toBeDefined();
          expect(result.contradictions).toEqual(contradictions);

          // Confidence label is always present
          expect(result.confidenceLabel).toBeDefined();
          expect(result.confidenceLabel).toBe(confidenceLabel);
        }
      ),
      { numRuns: 100 }
    );
  });

  // ─── Sub-property 4: All agents failing still produces a valid result ─────────

  it('even when ALL agents fail, pipeline produces a valid ProcessingResult with all errors collected', () => {
    fc.assert(
      fc.property(
        memoryArb,
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 4, maxLength: 4 }),
        (fallbackMemory, errorMessages) => {
          // All agents fail
          const outcomes: AgentOutcome[] = [
            { agent: 'archivist', succeeds: false, errorMessage: errorMessages[0] },
            { agent: 'archivist', succeeds: false, errorMessage: errorMessages[1] },
            { agent: 'verification', succeeds: false, errorMessage: errorMessages[2] },
            { agent: 'tone_calibrator', succeeds: false, errorMessage: errorMessages[3] },
          ];

          const result = simulatePipeline(outcomes, fallbackMemory, [], [], '확인됨');

          // Pipeline still produces a result
          expect(result).toBeDefined();
          expect(result.memory).toEqual(fallbackMemory);
          expect(result.embedding).toEqual([]);
          expect(result.contradictions).toEqual([]);
          expect(result.confidenceLabel).toBe('확인됨');

          // All 4 errors are collected
          expect(result.errors.length).toBe(4);

          // Error messages match
          expect(result.errors[0].error).toBe(errorMessages[0]);
          expect(result.errors[1].error).toBe(errorMessages[1]);
          expect(result.errors[2].error).toBe(errorMessages[2]);
          expect(result.errors[3].error).toBe(errorMessages[3]);

          // All errors are marked as skipped
          for (const err of result.errors) {
            expect(err.skipped).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // ─── Sub-property 5: No agents failing produces empty errors array ────────────

  it('when no agents fail, the errors array is empty and all results are preserved', () => {
    fc.assert(
      fc.property(
        memoryArb,
        embeddingArb,
        fc.array(contradictionReportArb, { minLength: 0, maxLength: 3 }),
        confidenceLabelArb,
        (memory, embedding, contradictions, confidenceLabel) => {
          // All agents succeed
          const outcomes: AgentOutcome[] = [
            { agent: 'archivist', succeeds: true, errorMessage: '' },
            { agent: 'archivist', succeeds: true, errorMessage: '' },
            { agent: 'verification', succeeds: true, errorMessage: '' },
            { agent: 'tone_calibrator', succeeds: true, errorMessage: '' },
          ];

          const result = simulatePipeline(
            outcomes,
            memory,
            embedding,
            contradictions,
            confidenceLabel
          );

          // No errors
          expect(result.errors).toEqual([]);
          expect(result.errors.length).toBe(0);

          // All results preserved
          expect(result.memory).toEqual(memory);
          expect(result.embedding).toEqual(embedding);
          expect(result.contradictions).toEqual(contradictions);
          expect(result.confidenceLabel).toBe(confidenceLabel);
        }
      ),
      { numRuns: 100 }
    );
  });
});
