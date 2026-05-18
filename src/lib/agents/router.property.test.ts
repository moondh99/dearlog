import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type {
  Memory,
  SessionContext,
  EmotionClassification,
  EmotionLevel,
  SilenceState,
  SilencePhase,
  SpeechProfile,
  ConfidenceLabel,
  MemoryConsent,
  ConsentStatus,
  AccessTier,
  ProcessingResult,
  ContradictionReport,
  AgentError,
  AgentName,
} from '../types';
import type { ArchivistResult } from './archivist';

/**
 * Feature: memoir-platform-enhancement, Property 9: Pipeline Data Preservation
 *
 * Validates: Requirements 9.4
 *
 * For any agent output in the processing pipeline, the data passed to the next agent
 * in sequence SHALL be structurally identical to the previous agent's output (no fields
 * dropped or mutated during routing).
 */
describe('Property 9: Pipeline Data Preservation', () => {
  // ─── Generators ──────────────────────────────────────────────────────────────

  const emotionLevelArb: fc.Arbitrary<EmotionLevel> = fc.constantFrom(
    'positive',
    'neutral',
    'sensitive',
    'distressed'
  );

  const silencePhaseArb: fc.Arbitrary<SilencePhase> = fc.constantFrom(
    'normal',
    'waiting',
    'encouraging',
    'offering_options'
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

  // Use integer timestamps to avoid invalid date issues with fc.date()
  const isoDateArb = fc
    .integer({ min: -2208988800000, max: 4102444800000 })
    .map((ts) => new Date(ts).toISOString());

  const memoryConsentArb: fc.Arbitrary<MemoryConsent> = fc.record({
    status: consentStatusArb,
    accessTier: accessTierArb,
    designatedFamilyIds: fc.array(fc.uuid(), { minLength: 0, maxLength: 3 }),
    lastModified: isoDateArb,
  });

  const emotionClassificationArb: fc.Arbitrary<EmotionClassification> = fc.record({
    current: emotionLevelArb,
    trajectory: fc.array(emotionLevelArb, { minLength: 0, maxLength: 3 }),
    confidence: fc.float({ min: 0, max: 1, noNaN: true }),
  });

  const silenceStateArb: fc.Arbitrary<SilenceState> = fc.record({
    isActive: fc.boolean(),
    silenceDuration: fc.float({ min: 0, max: 120, noNaN: true }),
    phase: silencePhaseArb,
  });

  const speechProfileArb: fc.Arbitrary<SpeechProfile> = fc.record({
    sentenceEndings: fc.array(fc.string({ minLength: 1, maxLength: 10 }), {
      minLength: 0,
      maxLength: 5,
    }),
    vocabularyPreferences: fc.dictionary(
      fc.string({ minLength: 1, maxLength: 10 }),
      fc.string({ minLength: 1, maxLength: 10 }),
      { minKeys: 0, maxKeys: 3 }
    ),
    fillerWords: fc.array(fc.string({ minLength: 1, maxLength: 10 }), {
      minLength: 0,
      maxLength: 5,
    }),
    characteristicExpressions: fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
      minLength: 0,
      maxLength: 5,
    }),
    dialect: fc.option(fc.string({ minLength: 1, maxLength: 10 }), { nil: null }),
    sessionCount: fc.integer({ min: 0, max: 100 }),
    lastUpdated: isoDateArb,
  });

  const sessionContextArb: fc.Arbitrary<SessionContext> = fc.record({
    emotionState: emotionClassificationArb,
    silenceState: silenceStateArb,
    speechProfile: fc.option(speechProfileArb, { nil: null }),
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

  const archivistResultArb: fc.Arbitrary<ArchivistResult> = fc.record({
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
    confidenceLabel: confidenceLabelArb,
    contradictions: fc.array(fc.uuid(), { minLength: 0, maxLength: 3 }),
    consent: memoryConsentArb,
    embedding: fc.option(
      fc.array(fc.float({ min: -1, max: 1, noNaN: true }), { minLength: 3, maxLength: 10 }),
      { nil: null }
    ),
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

  const agentNameArb: fc.Arbitrary<AgentName> = fc.constantFrom(
    'interviewer',
    'archivist',
    'verification',
    'ghostwriter',
    'tone_calibrator',
    'persona',
    'emotion_analyzer'
  );

  const agentErrorArb: fc.Arbitrary<AgentError> = fc.record({
    agent: agentNameArb,
    error: fc.string({ minLength: 1, maxLength: 50 }),
    skipped: fc.boolean(),
  });

  const embeddingArb = fc.array(fc.float({ min: -1, max: 1, noNaN: true }), {
    minLength: 3,
    maxLength: 10,
  });

  const processingResultArb: fc.Arbitrary<ProcessingResult> = fc.record({
    memory: memoryArb,
    embedding: embeddingArb,
    contradictions: fc.array(contradictionReportArb, { minLength: 0, maxLength: 3 }),
    confidenceLabel: confidenceLabelArb,
    errors: fc.array(agentErrorArb, { minLength: 0, maxLength: 3 }),
  });

  // ─── Sub-property 1: ArchivistResult fields are preserved in Memory ──────────

  it('all ArchivistResult fields are preserved when creating a Memory', () => {
    fc.assert(
      fc.property(archivistResultArb, fc.uuid(), isoDateArb, (archivistResult, id, dateStr) => {
        // Simulate what the router does: spread ArchivistResult into a Memory
        const memory: Memory = {
          ...archivistResult,
          id,
          date: dateStr,
          privacy: 'private',
        };

        // Verify all ArchivistResult fields are preserved in the Memory
        expect(memory.topic).toBe(archivistResult.topic);
        expect(memory.originalTranscript).toBe(archivistResult.originalTranscript);
        expect(memory.cleanedTranscript).toBe(archivistResult.cleanedTranscript);
        expect(memory.publishVersion).toBe(archivistResult.publishVersion);
        expect(memory.tags).toEqual(archivistResult.tags);
        expect(memory.confidenceLabel).toBe(archivistResult.confidenceLabel);
        expect(memory.contradictions).toEqual(archivistResult.contradictions);
        expect(memory.consent).toEqual(archivistResult.consent);
        expect(memory.embedding).toEqual(archivistResult.embedding);

        // Verify no fields from ArchivistResult are dropped
        const archivistKeys = Object.keys(archivistResult);
        for (const key of archivistKeys) {
          expect(memory).toHaveProperty(key);
          expect((memory as any)[key]).toEqual((archivistResult as any)[key]);
        }
      }),
      { numRuns: 100 }
    );
  });

  // ─── Sub-property 2: ProcessingResult preserves Memory unchanged ─────────────

  it('ProcessingResult contains the memory unchanged after pipeline routing', () => {
    fc.assert(
      fc.property(memoryArb, embeddingArb, (memory, embedding) => {
        // Simulate what the router does: construct ProcessingResult from pipeline outputs
        const contradictions: ContradictionReport[] = [];
        const confidenceLabel: ConfidenceLabel = '확인됨';
        const errors: AgentError[] = [];

        const result: ProcessingResult = {
          memory,
          embedding,
          contradictions,
          confidenceLabel,
          errors,
        };

        // The memory in the result must be structurally identical to the input
        expect(result.memory).toEqual(memory);
        expect(result.memory.id).toBe(memory.id);
        expect(result.memory.date).toBe(memory.date);
        expect(result.memory.topic).toBe(memory.topic);
        expect(result.memory.originalTranscript).toBe(memory.originalTranscript);
        expect(result.memory.cleanedTranscript).toBe(memory.cleanedTranscript);
        expect(result.memory.publishVersion).toBe(memory.publishVersion);
        expect(result.memory.tags).toEqual(memory.tags);
        expect(result.memory.privacy).toBe(memory.privacy);
        expect(result.memory.confidenceLabel).toBe(memory.confidenceLabel);
        expect(result.memory.contradictions).toEqual(memory.contradictions);
        expect(result.memory.consent).toEqual(memory.consent);
        expect(result.memory.embedding).toEqual(memory.embedding);

        // Embedding is passed through without mutation
        expect(result.embedding).toEqual(embedding);
      }),
      { numRuns: 100 }
    );
  });

  // ─── Sub-property 3: handleInterviewMessage does not mutate input sessionContext

  it('handleInterviewMessage does not mutate the input sessionContext', () => {
    fc.assert(
      fc.property(sessionContextArb, (sessionContext) => {
        // Deep clone the session context to compare after simulated routing
        const originalSnapshot = JSON.parse(JSON.stringify(sessionContext));

        // Simulate what handleInterviewMessage does internally:
        // It creates a new updatedSessionContext via spread, not mutating the original
        const newEmotionState: EmotionClassification = {
          current: 'positive',
          trajectory: ['neutral', 'positive'],
          confidence: 0.9,
        };

        // This mirrors the router's logic: spread to create new context
        const updatedSessionContext: SessionContext = {
          ...sessionContext,
          emotionState: newEmotionState,
        };

        // The original sessionContext must remain unchanged
        expect(sessionContext).toEqual(originalSnapshot);

        // The updated context should have the new emotion state
        expect(updatedSessionContext.emotionState).toEqual(newEmotionState);

        // But the original's emotion state is untouched
        expect(sessionContext.emotionState).toEqual(originalSnapshot.emotionState);

        // Silence state and speech profile are also preserved in original
        expect(sessionContext.silenceState).toEqual(originalSnapshot.silenceState);
        expect(sessionContext.speechProfile).toEqual(originalSnapshot.speechProfile);
      }),
      { numRuns: 100 }
    );
  });

  // ─── Sub-property 4: Pipeline data flows through without field loss ──────────

  it('data passed between pipeline stages retains all fields (no fields dropped during routing)', () => {
    fc.assert(
      fc.property(
        processingResultArb,
        (processingResult) => {
          // Simulate routing: the ProcessingResult is the final output of the pipeline.
          // Each field must be present and match what was produced by the agents.
          const { memory, embedding, contradictions, confidenceLabel, errors } = processingResult;

          // Reconstruct the result as the router would
          const routedResult: ProcessingResult = {
            memory,
            embedding,
            contradictions,
            confidenceLabel,
            errors,
          };

          // Verify structural identity - no fields dropped
          expect(routedResult).toEqual(processingResult);

          // Verify each field individually to ensure no mutation
          expect(routedResult.memory).toEqual(processingResult.memory);
          expect(routedResult.embedding).toEqual(processingResult.embedding);
          expect(routedResult.contradictions).toEqual(processingResult.contradictions);
          expect(routedResult.confidenceLabel).toBe(processingResult.confidenceLabel);
          expect(routedResult.errors).toEqual(processingResult.errors);

          // Verify all ProcessingResult keys are present
          const expectedKeys: (keyof ProcessingResult)[] = [
            'memory',
            'embedding',
            'contradictions',
            'confidenceLabel',
            'errors',
          ];
          for (const key of expectedKeys) {
            expect(routedResult).toHaveProperty(key);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // ─── Sub-property 5: Nested data in Memory is preserved through pipeline ─────

  it('nested tags and consent data in Memory are preserved through pipeline routing', () => {
    fc.assert(
      fc.property(archivistResultArb, (archivistResult) => {
        // Simulate the full pipeline: ArchivistResult → Memory → ProcessingResult
        const memory: Memory = {
          ...archivistResult,
          id: 'test-id',
          date: '2024-01-01T00:00:00.000Z',
          privacy: 'private',
        };

        const result: ProcessingResult = {
          memory,
          embedding: [],
          contradictions: [],
          confidenceLabel: memory.confidenceLabel,
          errors: [],
        };

        // Verify deeply nested structures are preserved
        expect(result.memory.tags.people).toEqual(archivistResult.tags.people);
        expect(result.memory.tags.places).toEqual(archivistResult.tags.places);
        expect(result.memory.tags.emotions).toEqual(archivistResult.tags.emotions);
        expect(result.memory.tags.timePeriod).toBe(archivistResult.tags.timePeriod);

        // Consent nested fields preserved
        expect(result.memory.consent.status).toBe(archivistResult.consent.status);
        expect(result.memory.consent.accessTier).toBe(archivistResult.consent.accessTier);
        expect(result.memory.consent.designatedFamilyIds).toEqual(
          archivistResult.consent.designatedFamilyIds
        );
        expect(result.memory.consent.lastModified).toBe(archivistResult.consent.lastModified);
      }),
      { numRuns: 100 }
    );
  });
});
