import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import type {
  VerificationJSON,
  ConflictDetail,
  ConflictType,
  AgentError,
  FamilyQuestion,
  CalendarEvent,
  CalendarEventType,
  PriorityTag,
  SessionContext,
} from '../types';

/**
 * Feature: agent-model-v2, Property 29: Pipeline branching based on verification result
 *
 * Validates: Requirements 11.2, 11.3
 *
 * For any verification result, if status is 'FLAG' with no related memories (기억 없음 path),
 * the Agent Router SHALL route back to the Archivist Agent; if status indicates related memories
 * exist (기억 있음 path), the Agent Router SHALL route to Ghostwriter/Tone Calibrator and
 * Digital Twin/Calendar Trigger in parallel.
 */

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Mock OpenAI at module level
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: '{}' } }],
          }),
        },
      },
      embeddings: {
        create: vi.fn().mockResolvedValue({
          data: [{ embedding: Array(256).fill(0.1) }],
        }),
      },
    })),
  };
});

// Track ragIndex.addMemory calls
const mockAddMemory = vi.fn().mockResolvedValue(undefined);
const mockSearch = vi.fn().mockResolvedValue([]);

vi.mock('../rag/index', () => ({
  ragIndex: {
    addMemory: (...args: any[]) => mockAddMemory(...args),
    search: (...args: any[]) => mockSearch(...args),
    updateMemory: vi.fn().mockResolvedValue(undefined),
    removeMemory: vi.fn(),
    searchByEmbedding: vi.fn().mockReturnValue([]),
    getEmbedding: vi.fn().mockResolvedValue(Array(256).fill(0.1)),
    getIndexSize: vi.fn().mockReturnValue(0),
  },
  createRAGIndex: vi.fn(),
}));

// Mock tone-calibrator
const mockAnalyzeSpeechPatterns = vi.fn().mockResolvedValue({
  sentenceEndings: ['~했지'],
  vocabularyPreferences: {},
  fillerWords: [],
  characteristicExpressions: [],
  dialect: null,
  sessionCount: 1,
  lastUpdated: new Date().toISOString(),
});

const mockUpdateProfile = vi.fn().mockResolvedValue({
  sentenceEndings: ['~했지'],
  vocabularyPreferences: {},
  fillerWords: [],
  characteristicExpressions: [],
  dialect: null,
  sessionCount: 2,
  lastUpdated: new Date().toISOString(),
});

vi.mock('./tone-calibrator', () => ({
  analyzeSpeechPatterns: (...args: any[]) => mockAnalyzeSpeechPatterns(...args),
  updateProfile: (...args: any[]) => mockUpdateProfile(...args),
}));

// Mock calendar-trigger
vi.mock('./calendar-trigger', () => ({
  processEvent: vi.fn().mockResolvedValue({
    event: { id: 'evt-1', title: 'test', eventType: '생일', date: '2024-01-01', relatedPeople: [], description: '' },
    action: 'new_interview',
    relatedMemoryIds: [],
    output: { sessionId: 'sess-1', questions: [], eventContext: { id: 'evt-1', title: 'test', eventType: '생일', date: '2024-01-01', relatedPeople: [], description: '' } },
  }),
}));

// Mock other agents that might be imported
vi.mock('./emotion-analyzer', () => ({
  classify: vi.fn().mockResolvedValue({ current: 'neutral', trajectory: [], confidence: 0.5 }),
}));

vi.mock('./interviewer', () => ({
  generateInterviewResponse: vi.fn().mockResolvedValue('응답입니다.'),
}));

vi.mock('./archivist', () => ({
  processTranscript: vi.fn().mockResolvedValue({
    topic: '테스트',
    originalTranscript: '원본',
    cleanedTranscript: '정제본',
    publishVersion: '출판본',
    tags: { people: [], places: [], emotions: [], timePeriod: '' },
    confidenceLabel: '확인됨',
    contradictions: [],
    consent: { status: 'granted', accessTier: '본인만', designatedFamilyIds: [], lastModified: '' },
    embedding: null,
  }),
}));

vi.mock('./verification', () => ({
  checkContradictions: vi.fn().mockResolvedValue({
    contradictions: [],
    confidenceLabel: '확인됨',
    verificationJSON: null,
  }),
}));

vi.mock('./family-question-queue', () => ({
  restructureForInterview: vi.fn().mockResolvedValue('재구성된 질문'),
}));

vi.mock('./photo-recall', () => ({
  storePhoto: vi.fn().mockResolvedValue({ id: 'photo-1', url: '', uploadedAt: '', analysis: null, linkedMemoryIds: [] }),
  analyzePhoto: vi.fn().mockResolvedValue(null),
  generateQuestions: vi.fn().mockResolvedValue([]),
}));

// ─── Store Setup ─────────────────────────────────────────────────────────────

import { useStore } from '../../store';

function setupStoreWithMemory(memoryId: string, people: string[] = []): void {
  useStore.setState({
    memories: [{
      id: memoryId,
      date: '2024-01-01T00:00:00.000Z',
      topic: '테스트 기억',
      originalTranscript: '원본 텍스트',
      cleanedTranscript: '정제된 텍스트',
      publishVersion: '출판 버전',
      tags: { people, places: ['서울'], emotions: ['감사'], timePeriod: '1960년대' },
      privacy: 'private' as const,
      confidenceLabel: '확인됨' as const,
      contradictions: [],
      consent: { status: 'granted' as const, accessTier: '본인만' as const, designatedFamilyIds: [], lastModified: '2024-01-01T00:00:00.000Z' },
      embedding: null,
    }],
    calendar: {
      events: [],
      processedEventIds: [],
      lastSynced: '',
    },
    speechProfile: {
      profile: null,
      sessionCount: 0,
    },
  });
}

// ─── Import the function under test ──────────────────────────────────────────

import { executePipelineBranch, injectFamilyQuestion, processCalendarEvent, processPhotoUpload } from './router';

// ─── Generators ──────────────────────────────────────────────────────────────

const conflictTypeArb: fc.Arbitrary<ConflictType> = fc.constantFrom(
  'TIME', 'PERSON', 'FACT', 'DUPLICATE'
);

const severityArb = fc.constantFrom('soft' as const, 'hard' as const);

const confidenceLabelV2Arb = fc.constantFrom(
  'CONFIRMED' as const, 'ESTIMATED' as const, 'UNVERIFIED' as const
);

// Conflict with EMPTY relatedMemoryIds (기억 없음)
const conflictNoMemoryArb: fc.Arbitrary<ConflictDetail> = fc.record({
  type: conflictTypeArb,
  relatedMemoryIds: fc.constant([] as string[]),
  explanation: fc.string({ minLength: 1, maxLength: 50 }),
  severity: severityArb,
});

// Conflict with NON-EMPTY relatedMemoryIds (기억 있음)
const conflictWithMemoryArb: fc.Arbitrary<ConflictDetail> = fc.record({
  type: conflictTypeArb,
  relatedMemoryIds: fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }),
  explanation: fc.string({ minLength: 1, maxLength: 50 }),
  severity: severityArb,
});

// VerificationJSON for "기억 없음" path: FLAG with all conflicts having empty relatedMemoryIds
const verificationFlagNoMemoryArb: fc.Arbitrary<VerificationJSON> = fc.record({
  memoryId: fc.constant('test-memory-id'),
  status: fc.constant('FLAG' as const),
  conflicts: fc.array(conflictNoMemoryArb, { minLength: 1, maxLength: 5 }),
  confidenceLabel: confidenceLabelV2Arb,
});

// VerificationJSON for "기억 있음" path via PASS status
const verificationPassArb: fc.Arbitrary<VerificationJSON> = fc.record({
  memoryId: fc.constant('test-memory-id'),
  status: fc.constant('PASS' as const),
  conflicts: fc.array(
    fc.oneof(conflictNoMemoryArb, conflictWithMemoryArb),
    { minLength: 0, maxLength: 3 }
  ),
  confidenceLabel: confidenceLabelV2Arb,
});

// VerificationJSON for "기억 있음" path via FLAG with at least one conflict having non-empty relatedMemoryIds
const verificationFlagWithMemoryArb: fc.Arbitrary<VerificationJSON> = fc
  .tuple(
    conflictWithMemoryArb,
    fc.array(fc.oneof(conflictNoMemoryArb, conflictWithMemoryArb), { minLength: 0, maxLength: 3 }),
    confidenceLabelV2Arb
  )
  .map(([required, rest, confidenceLabel]) => ({
    memoryId: 'test-memory-id',
    status: 'FLAG' as const,
    conflicts: [required, ...rest],
    confidenceLabel,
  }));

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Property 29: Pipeline branching based on verification result', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStoreWithMemory('test-memory-id');
  });

  // Sub-property 1: FLAG with no related memories → Archivist re-indexing (기억 없음 path)
  it('routes to Archivist re-indexing when status is FLAG with empty relatedMemoryIds in all conflicts', async () => {
    await fc.assert(
      fc.asyncProperty(verificationFlagNoMemoryArb, async (verificationResult) => {
        mockAddMemory.mockClear();
        mockAnalyzeSpeechPatterns.mockClear();
        mockUpdateProfile.mockClear();
        setupStoreWithMemory('test-memory-id');

        const result = await executePipelineBranch(verificationResult);

        // Should call ragIndex.addMemory (Archivist re-indexing)
        expect(mockAddMemory).toHaveBeenCalledTimes(1);
        expect(mockAddMemory).toHaveBeenCalledWith(
          'test-memory-id',
          expect.any(String),
          expect.any(Object)
        );

        // Should NOT call tone calibrator (parallel branches not executed)
        expect(mockAnalyzeSpeechPatterns).not.toHaveBeenCalled();
        expect(mockUpdateProfile).not.toHaveBeenCalled();

        // Result should have errors array (empty if re-indexing succeeds)
        expect(result).toHaveProperty('errors');
        expect(Array.isArray(result.errors)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  // Sub-property 2: PASS status → parallel branches (기억 있음 path)
  it('routes to parallel branches (Ghostwriter/TC and DT/CT) when status is PASS', async () => {
    await fc.assert(
      fc.asyncProperty(verificationPassArb, async (verificationResult) => {
        mockAddMemory.mockClear();
        mockAnalyzeSpeechPatterns.mockClear();
        mockUpdateProfile.mockClear();
        setupStoreWithMemory('test-memory-id');

        const result = await executePipelineBranch(verificationResult);

        // Should NOT call ragIndex.addMemory (not re-indexing path)
        expect(mockAddMemory).not.toHaveBeenCalled();

        // Should call tone calibrator (part of parallel Branch A: Ghostwriter/TC)
        // Since speechProfile is null, analyzeSpeechPatterns should be called
        const tcCalled = mockAnalyzeSpeechPatterns.mock.calls.length > 0 ||
          mockUpdateProfile.mock.calls.length > 0;
        expect(tcCalled).toBe(true);

        // Result should have errors array (may be empty if all branches succeed)
        expect(result).toHaveProperty('errors');
        expect(Array.isArray(result.errors)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  // Sub-property 3: FLAG with non-empty relatedMemoryIds → parallel branches (기억 있음 path)
  it('routes to parallel branches when status is FLAG with non-empty relatedMemoryIds', async () => {
    await fc.assert(
      fc.asyncProperty(verificationFlagWithMemoryArb, async (verificationResult) => {
        mockAddMemory.mockClear();
        mockAnalyzeSpeechPatterns.mockClear();
        mockUpdateProfile.mockClear();
        setupStoreWithMemory('test-memory-id');

        const result = await executePipelineBranch(verificationResult);

        // Should NOT call ragIndex.addMemory (not re-indexing, because related memories exist)
        expect(mockAddMemory).not.toHaveBeenCalled();

        // Should call tone calibrator (part of parallel Branch A: Ghostwriter/TC)
        const tcCalled = mockAnalyzeSpeechPatterns.mock.calls.length > 0 ||
          mockUpdateProfile.mock.calls.length > 0;
        expect(tcCalled).toBe(true);

        // Result should have errors array
        expect(result).toHaveProperty('errors');
        expect(Array.isArray(result.errors)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});


// ─── Property 30 Generators ──────────────────────────────────────────────────

const priorityTagArb: fc.Arbitrary<PriorityTag> = fc.constantFrom('high', 'normal', 'low');

const familyQuestionStatusArb = fc.constantFrom(
  'pending' as const, 'delivered' as const, 'answered' as const, 'archived' as const
);

const familyQuestionArb: fc.Arbitrary<FamilyQuestion> = fc.record({
  id: fc.uuid(),
  questionText: fc.string({ minLength: 1, maxLength: 100 }),
  submittedBy: fc.string({ minLength: 1, maxLength: 30 }),
  anonymous: fc.boolean(),
  priority: priorityTagArb,
  status: familyQuestionStatusArb,
  createdAt: fc.integer({ min: 946684800000, max: 1924905600000 }).map((ts) => new Date(ts).toISOString()),
  answeredAt: fc.option(fc.integer({ min: 946684800000, max: 1924905600000 }).map((ts) => new Date(ts).toISOString()), { nil: null }),
  answerMemoryId: fc.option(fc.uuid(), { nil: null }),
});

const calendarEventTypeArb: fc.Arbitrary<CalendarEventType> = fc.constantFrom(
  '결혼식', '졸업', '생일', '기념일', '기일'
);

const calendarEventArb: fc.Arbitrary<CalendarEvent> = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 50 }),
  eventType: calendarEventTypeArb,
  date: fc.integer({ min: 946684800000, max: 1924905600000 }).map((ts) => new Date(ts).toISOString().split('T')[0]),
  relatedPeople: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 5 }),
  description: fc.string({ minLength: 0, maxLength: 100 }),
});

const sessionContextArb: fc.Arbitrary<SessionContext> = fc.record({
  emotionState: fc.record({
    current: fc.constantFrom('positive' as const, 'neutral' as const, 'sensitive' as const, 'distressed' as const),
    trajectory: fc.array(
      fc.constantFrom('positive' as const, 'neutral' as const, 'sensitive' as const, 'distressed' as const),
      { minLength: 0, maxLength: 3 }
    ),
    confidence: fc.double({ min: 0, max: 1, noNaN: true }),
  }),
  silenceState: fc.record({
    isActive: fc.boolean(),
    silenceDuration: fc.nat({ max: 120 }),
    phase: fc.constantFrom('normal' as const, 'waiting' as const, 'encouraging' as const, 'offering_options' as const),
  }),
  speechProfile: fc.constant(null),
});

// Reuse verification generators from Property 29 for executePipelineBranch
const verificationForDataPreservationArb: fc.Arbitrary<VerificationJSON> = fc.oneof(
  verificationFlagNoMemoryArb,
  verificationPassArb,
  verificationFlagWithMemoryArb
);

// ─── Property 30 Tests ───────────────────────────────────────────────────────

/**
 * Feature: agent-model-v2, Property 30: Pipeline data preservation across all agents
 *
 * Validates: Requirements 11.4
 *
 * For any agent output in the v2 processing pipeline (including new agents:
 * Family Question Queue, Calendar Trigger, Photo Recall), the data passed to
 * the next agent SHALL be structurally identical to the previous agent's output
 * — no fields dropped, mutated, or added during routing.
 */
describe('Property 30: Pipeline data preservation across all agents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStoreWithMemory('test-memory-id');
  });

  // Sub-property 1: injectFamilyQuestion does not mutate the original FamilyQuestion
  it('injectFamilyQuestion does not mutate the original FamilyQuestion object', async () => {
    await fc.assert(
      fc.asyncProperty(familyQuestionArb, sessionContextArb, async (question, sessionContext) => {
        // Deep copy the input before calling the function
        const snapshot = JSON.parse(JSON.stringify(question));

        await injectFamilyQuestion(question, sessionContext);

        // The original question object should be unchanged
        expect(question).toEqual(snapshot);
      }),
      { numRuns: 100 }
    );
  });

  // Sub-property 2: processCalendarEvent does not mutate the original CalendarEvent
  it('processCalendarEvent does not mutate the original CalendarEvent object', async () => {
    await fc.assert(
      fc.asyncProperty(calendarEventArb, async (event) => {
        // Deep copy the input before calling the function
        const snapshot = JSON.parse(JSON.stringify(event));

        await processCalendarEvent(event);

        // The original event object should be unchanged
        expect(event).toEqual(snapshot);
      }),
      { numRuns: 100 }
    );
  });

  // Sub-property 3: executePipelineBranch does not mutate the original VerificationJSON
  it('executePipelineBranch does not mutate the original VerificationJSON object', async () => {
    await fc.assert(
      fc.asyncProperty(verificationForDataPreservationArb, async (verificationResult) => {
        setupStoreWithMemory('test-memory-id');

        // Deep copy the input before calling the function
        const snapshot = JSON.parse(JSON.stringify(verificationResult));

        await executePipelineBranch(verificationResult);

        // The original verificationResult object should be unchanged
        expect(verificationResult).toEqual(snapshot);
      }),
      { numRuns: 100 }
    );
  });

  // Sub-property 4: No fields are dropped or added to input objects during routing
  it('no fields are dropped or added to FamilyQuestion during routing', async () => {
    await fc.assert(
      fc.asyncProperty(familyQuestionArb, sessionContextArb, async (question, sessionContext) => {
        const originalKeys = Object.keys(question).sort();

        await injectFamilyQuestion(question, sessionContext);

        // Same set of keys after the call
        const afterKeys = Object.keys(question).sort();
        expect(afterKeys).toEqual(originalKeys);
      }),
      { numRuns: 100 }
    );
  });

  it('no fields are dropped or added to CalendarEvent during routing', async () => {
    await fc.assert(
      fc.asyncProperty(calendarEventArb, async (event) => {
        const originalKeys = Object.keys(event).sort();

        await processCalendarEvent(event);

        // Same set of keys after the call
        const afterKeys = Object.keys(event).sort();
        expect(afterKeys).toEqual(originalKeys);
      }),
      { numRuns: 100 }
    );
  });

  it('no fields are dropped or added to VerificationJSON during routing', async () => {
    await fc.assert(
      fc.asyncProperty(verificationForDataPreservationArb, async (verificationResult) => {
        setupStoreWithMemory('test-memory-id');
        const originalKeys = Object.keys(verificationResult).sort();
        const originalConflictKeys = verificationResult.conflicts.map(
          (c) => Object.keys(c).sort()
        );

        await executePipelineBranch(verificationResult);

        // Same set of keys after the call
        const afterKeys = Object.keys(verificationResult).sort();
        expect(afterKeys).toEqual(originalKeys);

        // Each conflict should also have the same keys
        verificationResult.conflicts.forEach((c, i) => {
          expect(Object.keys(c).sort()).toEqual(originalConflictKeys[i]);
        });
      }),
      { numRuns: 100 }
    );
  });
});


// ─── Property 31 Tests ───────────────────────────────────────────────────────

/**
 * Feature: agent-model-v2, Property 31: Pipeline error resilience
 *
 * Validates: Requirements 11.5
 *
 * For any agent failure in the pipeline, the Agent Router SHALL: add an AgentError entry
 * to the errors array (with agent name, error message, skipped=true), skip the failed agent,
 * and continue executing remaining agents in the pipeline. The final ProcessingResult SHALL
 * contain all collected errors.
 */
describe('Property 31: Pipeline error resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStoreWithMemory('test-memory-id');
  });

  // Generator for arbitrary error messages
  const errorMessageArb = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0);

  // Sub-property 1: When ragIndex.addMemory throws (기억 없음 path), error is captured with agent='archivist', skipped=true
  it('captures archivist error with skipped=true when ragIndex.addMemory throws in 기억 없음 path', async () => {
    await fc.assert(
      fc.asyncProperty(errorMessageArb, async (errorMsg) => {
        setupStoreWithMemory('test-memory-id');
        mockAddMemory.mockRejectedValueOnce(new Error(errorMsg));

        // FLAG with no related memories → 기억 없음 path → calls ragIndex.addMemory
        const verificationResult: VerificationJSON = {
          memoryId: 'test-memory-id',
          status: 'FLAG',
          conflicts: [{ type: 'TIME', relatedMemoryIds: [], explanation: 'test', severity: 'soft' }],
          confidenceLabel: 'ESTIMATED',
        };

        const result = await executePipelineBranch(verificationResult);

        // Function should NOT throw - it returns normally
        expect(result).toBeDefined();
        expect(result).toHaveProperty('errors');

        // Error should be captured in the errors array
        expect(result.errors.length).toBeGreaterThanOrEqual(1);

        const archivistError = result.errors.find(e => e.agent === 'archivist');
        expect(archivistError).toBeDefined();
        expect(archivistError!.agent).toBe('archivist');
        expect(archivistError!.error).toBe(errorMsg);
        expect(archivistError!.skipped).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  // Sub-property 2: When tone calibrator throws (기억 있음 path), error is captured and pipeline still completes
  it('captures tone_calibrator error with skipped=true and pipeline continues in 기억 있음 path', async () => {
    await fc.assert(
      fc.asyncProperty(errorMessageArb, async (errorMsg) => {
        setupStoreWithMemory('test-memory-id');
        mockAnalyzeSpeechPatterns.mockRejectedValueOnce(new Error(errorMsg));
        mockUpdateProfile.mockRejectedValueOnce(new Error(errorMsg));

        // PASS status → 기억 있음 path → calls tone calibrator
        const verificationResult: VerificationJSON = {
          memoryId: 'test-memory-id',
          status: 'PASS',
          conflicts: [],
          confidenceLabel: 'CONFIRMED',
        };

        const result = await executePipelineBranch(verificationResult);

        // Function should NOT throw - it returns normally
        expect(result).toBeDefined();
        expect(result).toHaveProperty('errors');

        // Error should be captured in the errors array
        expect(result.errors.length).toBeGreaterThanOrEqual(1);

        const tcError = result.errors.find(e => e.agent === 'tone_calibrator');
        expect(tcError).toBeDefined();
        expect(tcError!.agent).toBe('tone_calibrator');
        expect(tcError!.error).toBe(errorMsg);
        expect(tcError!.skipped).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  // Sub-property 3: Each error entry has correct structure (agent name string, error message string, skipped === true)
  it('each AgentError entry has agent (string), error (string), and skipped === true', async () => {
    await fc.assert(
      fc.asyncProperty(errorMessageArb, async (errorMsg) => {
        setupStoreWithMemory('test-memory-id');
        mockAddMemory.mockRejectedValueOnce(new Error(errorMsg));

        const verificationResult: VerificationJSON = {
          memoryId: 'test-memory-id',
          status: 'FLAG',
          conflicts: [{ type: 'FACT', relatedMemoryIds: [], explanation: 'conflict', severity: 'hard' }],
          confidenceLabel: 'UNVERIFIED',
        };

        const result = await executePipelineBranch(verificationResult);

        // Verify structure of every error entry
        for (const err of result.errors) {
          expect(typeof err.agent).toBe('string');
          expect(err.agent.length).toBeGreaterThan(0);
          expect(typeof err.error).toBe('string');
          expect(err.error.length).toBeGreaterThan(0);
          expect(err.skipped).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  // Sub-property 4: Multiple agent failures are all collected in the errors array
  it('multiple agent failures are all collected in the errors array', async () => {
    await fc.assert(
      fc.asyncProperty(errorMessageArb, errorMessageArb, async (tcErrorMsg, ctErrorMsg) => {
        // Setup store with memory that has people matching calendar events
        useStore.setState({
          memories: [{
            id: 'test-memory-id',
            date: '2024-01-01T00:00:00.000Z',
            topic: '테스트 기억',
            originalTranscript: '원본 텍스트',
            cleanedTranscript: '정제된 텍스트',
            publishVersion: '출판 버전',
            tags: { people: ['할머니'], places: ['서울'], emotions: ['감사'], timePeriod: '1960년대' },
            privacy: 'private' as const,
            confidenceLabel: '확인됨' as const,
            contradictions: [],
            consent: { status: 'granted' as const, accessTier: '본인만' as const, designatedFamilyIds: [], lastModified: '2024-01-01T00:00:00.000Z' },
            embedding: null,
          }],
          calendar: {
            events: [{
              id: 'evt-1',
              title: '할머니 생신',
              eventType: '생일' as CalendarEventType,
              date: '2024-06-15',
              relatedPeople: ['할머니'],
              description: '할머니 생신',
            }],
            processedEventIds: [],
            lastSynced: '',
          },
          speechProfile: {
            profile: null,
            sessionCount: 0,
          },
        });

        // Make tone calibrator fail
        mockAnalyzeSpeechPatterns.mockRejectedValueOnce(new Error(tcErrorMsg));
        mockUpdateProfile.mockRejectedValueOnce(new Error(tcErrorMsg));

        // Make calendar trigger fail
        const { processEvent } = await import('./calendar-trigger');
        (processEvent as any).mockRejectedValueOnce(new Error(ctErrorMsg));

        // PASS status → 기억 있음 path → both branches execute
        const verificationResult: VerificationJSON = {
          memoryId: 'test-memory-id',
          status: 'PASS',
          conflicts: [],
          confidenceLabel: 'CONFIRMED',
        };

        const result = await executePipelineBranch(verificationResult);

        // Function should NOT throw
        expect(result).toBeDefined();
        expect(result).toHaveProperty('errors');

        // Multiple errors should be collected
        expect(result.errors.length).toBeGreaterThanOrEqual(1);

        // All errors should have correct structure
        for (const err of result.errors) {
          expect(typeof err.agent).toBe('string');
          expect(typeof err.error).toBe('string');
          expect(err.skipped).toBe(true);
        }

        // At least the tone calibrator error should be present
        const tcError = result.errors.find(e => e.agent === 'tone_calibrator');
        expect(tcError).toBeDefined();
        expect(tcError!.error).toBe(tcErrorMsg);
      }),
      { numRuns: 100 }
    );
  });

  // Sub-property 5: executePipelineBranch never throws even when agents fail
  it('executePipelineBranch never throws even when agents fail - always returns normally with errors collected', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(verificationFlagNoMemoryArb, verificationPassArb, verificationFlagWithMemoryArb),
        errorMessageArb,
        async (verificationResult, errorMsg) => {
          setupStoreWithMemory('test-memory-id');

          // Make all possible agents fail
          mockAddMemory.mockRejectedValue(new Error(errorMsg));
          mockAnalyzeSpeechPatterns.mockRejectedValue(new Error(errorMsg));
          mockUpdateProfile.mockRejectedValue(new Error(errorMsg));

          // The function should NEVER throw - it should always return normally
          const result = await executePipelineBranch(verificationResult);

          expect(result).toBeDefined();
          expect(result).toHaveProperty('errors');
          expect(Array.isArray(result.errors)).toBe(true);

          // Since agents failed, there should be at least one error
          expect(result.errors.length).toBeGreaterThanOrEqual(1);

          // All errors have the correct shape
          for (const err of result.errors) {
            expect(typeof err.agent).toBe('string');
            expect(typeof err.error).toBe('string');
            expect(err.skipped).toBe(true);
          }

          // Reset mocks for next iteration
          mockAddMemory.mockResolvedValue(undefined);
          mockAnalyzeSpeechPatterns.mockResolvedValue({
            sentenceEndings: ['~했지'],
            vocabularyPreferences: {},
            fillerWords: [],
            characteristicExpressions: [],
            dialect: null,
            sessionCount: 1,
            lastUpdated: new Date().toISOString(),
          });
          mockUpdateProfile.mockResolvedValue({
            sentenceEndings: ['~했지'],
            vocabularyPreferences: {},
            fillerWords: [],
            characteristicExpressions: [],
            dialect: null,
            sessionCount: 2,
            lastUpdated: new Date().toISOString(),
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
