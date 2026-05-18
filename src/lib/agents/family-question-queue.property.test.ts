import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import type { PriorityTag, FamilyQuestion } from '../types';
import { useStore } from '../../store';

// ─── Priority Weight Map (mirrors implementation) ──────────────────────────────

const PRIORITY_WEIGHT: Record<PriorityTag, number> = {
  high: 3,
  normal: 2,
  low: 1,
};

// ─── Mock OpenAI ───────────────────────────────────────────────────────────────

let mockOpenAIResponse: string | null = '자연스럽게 재구성된 질문입니다.';

vi.mock('openai', () => ({
  default: class MockOpenAI {
    constructor() {}
    chat = {
      completions: {
        create: vi.fn().mockImplementation(async () => ({
          choices: [{ message: { content: mockOpenAIResponse } }],
        })),
      },
    };
  },
}));

import { submitQuestion, getNextQuestion, restructureForInterview, markAnswered } from './family-question-queue';

/**
 * Property tests for Family Question Queue (Agent ⑧)
 *
 * Property 21 validates that submitted family questions preserve
 * all input fields exactly in the stored question.
 * Property 22 validates that anonymous questions never leak submitter identity.
 *
 * **Validates: Requirements 8.1, 8.2**
 */

// ─── Generators ────────────────────────────────────────────────────────────────

const VALID_PRIORITIES: PriorityTag[] = ['high', 'normal', 'low'];

const questionTextArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 200 });

const submitterIdArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 50 });

const anonymousFlagArb: fc.Arbitrary<boolean> = fc.boolean();

const priorityArb: fc.Arbitrary<PriorityTag> = fc.constantFrom(...VALID_PRIORITIES);

// ─── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Reset the store before each test to ensure isolation
  useStore.setState({
    familyQuestions: {
      questions: [],
      lastUpdated: '',
    },
  });
});

// ─── Property 21: Family question storage preservation ─────────────────────────

describe('Feature: agent-model-v2, Property 21: Family question storage preservation', () => {
  it('For any family question submission with text T, anonymous flag A, and priority P, the stored question SHALL have questionText === T, anonymous === A, priority === P, and status === "pending"', () => {
    fc.assert(
      fc.property(
        questionTextArb,
        submitterIdArb,
        anonymousFlagArb,
        priorityArb,
        (text, submittedBy, anonymous, priority) => {
          // Reset store before each property run
          useStore.setState({
            familyQuestions: {
              questions: [],
              lastUpdated: '',
            },
          });

          // Submit the question
          const result = submitQuestion(text, submittedBy, anonymous, priority);

          // Verify the returned question preserves all input fields
          expect(result.questionText).toBe(text);
          expect(result.anonymous).toBe(anonymous);
          expect(result.priority).toBe(priority);
          expect(result.status).toBe('pending');

          // Verify the question is stored in the store with the same values
          const { questions } = useStore.getState().familyQuestions;
          const storedQuestion = questions.find((q) => q.id === result.id);

          expect(storedQuestion).toBeDefined();
          expect(storedQuestion!.questionText).toBe(text);
          expect(storedQuestion!.anonymous).toBe(anonymous);
          expect(storedQuestion!.priority).toBe(priority);
          expect(storedQuestion!.status).toBe('pending');
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ─── Property 22: Anonymous question identity protection ───────────────────────

describe('Feature: agent-model-v2, Property 22: Anonymous question identity protection', () => {
  /**
   * Property: For any family question with anonymous === true, the restructured
   * interview question delivered to the Senior_User SHALL NOT contain the
   * submitter's user ID or any identifying information.
   *
   * **Validates: Requirements 8.2**
   */

  // Generator for submitter IDs that are non-empty and identifiable
  const submitterIdArb22: fc.Arbitrary<string> = fc.stringMatching(/^[a-zA-Z0-9_]{3,20}$/);

  const questionTextArb22: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 200 });

  const interviewContextArb: fc.Arbitrary<string> = fc.constantFrom(
    '어린 시절 이야기를 나누고 있습니다.',
    '가족에 대한 이야기를 하고 있습니다.',
    '직장 생활에 대해 이야기하고 있습니다.',
    '인생의 전환점에 대해 이야기하고 있습니다.',
  );

  const priorityArb22: fc.Arbitrary<PriorityTag> = fc.constantFrom('high', 'normal', 'low');

  it('For any anonymous question, the restructured output SHALL NOT contain the submitter user ID', () => {
    fc.assert(
      fc.asyncProperty(
        submitterIdArb22,
        questionTextArb22,
        interviewContextArb,
        priorityArb22,
        async (submittedBy, questionText, interviewContext, priority) => {
          // Simulate OpenAI returning a response that accidentally includes the submitter ID
          // This tests the safety check in restructureForInterview
          mockOpenAIResponse = `가족 중 ${submittedBy}님이 궁금해하시는 건데요, ${questionText}`;

          const question: FamilyQuestion = {
            id: `fq_test_${Date.now()}`,
            questionText,
            submittedBy,
            anonymous: true,
            priority,
            status: 'pending',
            createdAt: new Date().toISOString(),
            answeredAt: null,
            answerMemoryId: null,
          };

          const result = await restructureForInterview(question, interviewContext);

          // The restructured output must NOT contain the submitter's user ID
          expect(result).not.toContain(submittedBy);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('For any anonymous question where OpenAI returns a clean response, the output still does not contain submitter ID', () => {
    fc.assert(
      fc.asyncProperty(
        submitterIdArb22,
        questionTextArb22,
        interviewContextArb,
        priorityArb22,
        async (submittedBy, questionText, interviewContext, priority) => {
          // Simulate OpenAI returning a clean response without the submitter ID
          mockOpenAIResponse = `그런데 말이에요, 혹시 ${questionText}에 대해 기억나시는 게 있으세요?`;

          const question: FamilyQuestion = {
            id: `fq_test_${Date.now()}`,
            questionText,
            submittedBy,
            anonymous: true,
            priority,
            status: 'pending',
            createdAt: new Date().toISOString(),
            answeredAt: null,
            answerMemoryId: null,
          };

          const result = await restructureForInterview(question, interviewContext);

          // The restructured output must NOT contain the submitter's user ID
          expect(result).not.toContain(submittedBy);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ─── Property 23: Priority-based queue ordering ────────────────────────────────

describe('Feature: agent-model-v2, Property 23: Priority-based queue ordering', () => {
  /**
   * Property: For any set of queued questions, getNextQuestion SHALL return a
   * question with priority ≥ all other pending questions' priorities
   * (high > normal > low), with FIFO ordering within the same priority level.
   *
   * **Validates: Requirements 8.3**
   */

  // Generator for a non-empty array of questions with varying priorities and timestamps
  const questionEntryArb = fc.record({
    text: fc.string({ minLength: 1, maxLength: 100 }),
    submittedBy: fc.string({ minLength: 1, maxLength: 30 }),
    anonymous: fc.boolean(),
    priority: fc.constantFrom<PriorityTag>('high', 'normal', 'low'),
  });

  const questionsArrayArb = fc.array(questionEntryArb, { minLength: 1, maxLength: 20 });

  it('getNextQuestion SHALL return the highest priority pending question, with FIFO within same priority', () => {
    fc.assert(
      fc.property(
        questionsArrayArb,
        (questionEntries) => {
          // Reset store
          useStore.setState({
            familyQuestions: {
              questions: [],
              lastUpdated: '',
            },
          });

          // Submit all questions with incrementing timestamps to ensure deterministic FIFO
          const submittedQuestions: FamilyQuestion[] = [];
          for (let i = 0; i < questionEntries.length; i++) {
            const entry = questionEntries[i];
            // Use incrementing timestamps to guarantee FIFO ordering is deterministic
            const baseTime = new Date('2024-01-01T00:00:00.000Z').getTime();
            const createdAt = new Date(baseTime + i * 1000).toISOString();

            const question: FamilyQuestion = {
              id: `fq_test_${i}_${Math.random().toString(36).substring(2, 9)}`,
              questionText: entry.text,
              submittedBy: entry.submittedBy,
              anonymous: entry.anonymous,
              priority: entry.priority,
              status: 'pending',
              createdAt,
              answeredAt: null,
              answerMemoryId: null,
            };

            submittedQuestions.push(question);
          }

          // Add all questions to the store directly (to control createdAt precisely)
          useStore.setState({
            familyQuestions: {
              questions: submittedQuestions,
              lastUpdated: new Date().toISOString(),
            },
          });

          // Call getNextQuestion
          const nextQuestion = getNextQuestion('test context');

          // It should not be null since we have pending questions
          expect(nextQuestion).not.toBeNull();

          if (nextQuestion === null) return; // type guard

          // Verify: the returned question has priority >= all other pending questions
          const remainingPending = submittedQuestions.filter(
            (q) => q.id !== nextQuestion.id
          );

          for (const other of remainingPending) {
            // The returned question's priority weight should be >= all others
            expect(PRIORITY_WEIGHT[nextQuestion.priority]).toBeGreaterThanOrEqual(
              PRIORITY_WEIGHT[other.priority]
            );
          }

          // Verify FIFO within same priority: among questions with the same priority
          // as the returned one, the returned question should have the earliest createdAt
          const samePriorityQuestions = submittedQuestions.filter(
            (q) => q.priority === nextQuestion.priority
          );

          if (samePriorityQuestions.length > 1) {
            const earliestInSamePriority = samePriorityQuestions.reduce((earliest, q) =>
              new Date(q.createdAt).getTime() < new Date(earliest.createdAt).getTime() ? q : earliest
            );
            expect(nextQuestion.id).toBe(earliestInSamePriority.id);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('sequential getNextQuestion calls SHALL return questions in strict priority-then-FIFO order', () => {
    fc.assert(
      fc.property(
        questionsArrayArb,
        (questionEntries) => {
          // Reset store
          useStore.setState({
            familyQuestions: {
              questions: [],
              lastUpdated: '',
            },
          });

          // Submit all questions with incrementing timestamps
          const submittedQuestions: FamilyQuestion[] = [];
          for (let i = 0; i < questionEntries.length; i++) {
            const entry = questionEntries[i];
            const baseTime = new Date('2024-01-01T00:00:00.000Z').getTime();
            const createdAt = new Date(baseTime + i * 1000).toISOString();

            const question: FamilyQuestion = {
              id: `fq_seq_${i}_${Math.random().toString(36).substring(2, 9)}`,
              questionText: entry.text,
              submittedBy: entry.submittedBy,
              anonymous: entry.anonymous,
              priority: entry.priority,
              status: 'pending',
              createdAt,
              answeredAt: null,
              answerMemoryId: null,
            };

            submittedQuestions.push(question);
          }

          // Add all questions to the store
          useStore.setState({
            familyQuestions: {
              questions: submittedQuestions,
              lastUpdated: new Date().toISOString(),
            },
          });

          // Call getNextQuestion repeatedly and collect the order
          const deliveredOrder: FamilyQuestion[] = [];
          for (let i = 0; i < questionEntries.length; i++) {
            const next = getNextQuestion('test context');
            if (next === null) break;
            deliveredOrder.push(next);
          }

          // All questions should have been delivered
          expect(deliveredOrder.length).toBe(questionEntries.length);

          // Verify ordering: each consecutive pair should respect priority-then-FIFO
          for (let i = 0; i < deliveredOrder.length - 1; i++) {
            const current = deliveredOrder[i];
            const next = deliveredOrder[i + 1];

            // Current priority weight should be >= next priority weight
            expect(PRIORITY_WEIGHT[current.priority]).toBeGreaterThanOrEqual(
              PRIORITY_WEIGHT[next.priority]
            );

            // If same priority, current should have earlier or equal createdAt (FIFO)
            if (current.priority === next.priority) {
              expect(new Date(current.createdAt).getTime()).toBeLessThanOrEqual(
                new Date(next.createdAt).getTime()
              );
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ─── Property 24: Question lifecycle state transition ──────────────────────────

describe('Feature: agent-model-v2, Property 24: Question lifecycle state transition', () => {
  /**
   * Property: For any question that has been answered, calling markAnswered SHALL
   * transition the question's status to 'archived', set answeredAt to a valid ISO
   * timestamp, and set answerMemoryId to the provided memory ID.
   *
   * **Validates: Requirements 8.5**
   */

  const memoryIdArb: fc.Arbitrary<string> = fc.stringMatching(/^mem_[a-z0-9]{4,20}$/);

  it('markAnswered SHALL transition status to archived, set answeredAt to valid ISO timestamp, and set answerMemoryId to the provided memory ID', () => {
    fc.assert(
      fc.property(
        questionTextArb,
        submitterIdArb,
        anonymousFlagArb,
        priorityArb,
        memoryIdArb,
        (text, submittedBy, anonymous, priority, memoryId) => {
          // Reset store before each property run
          useStore.setState({
            familyQuestions: {
              questions: [],
              lastUpdated: '',
            },
          });

          // Step 1: Submit a question
          const question = submitQuestion(text, submittedBy, anonymous, priority);

          // Step 2: Call markAnswered with the random memory ID
          markAnswered(question.id, memoryId);

          // Step 3: Verify the store state
          const { questions } = useStore.getState().familyQuestions;
          const updatedQuestion = questions.find((q) => q.id === question.id);

          // The question must exist in the store
          expect(updatedQuestion).toBeDefined();

          // Status must be 'archived'
          expect(updatedQuestion!.status).toBe('archived');

          // answeredAt must be a valid ISO timestamp
          expect(updatedQuestion!.answeredAt).not.toBeNull();
          const parsedDate = new Date(updatedQuestion!.answeredAt!);
          expect(parsedDate.toISOString()).toBe(updatedQuestion!.answeredAt);
          expect(Number.isNaN(parsedDate.getTime())).toBe(false);

          // answerMemoryId must equal the provided memory ID
          expect(updatedQuestion!.answerMemoryId).toBe(memoryId);
        }
      ),
      { numRuns: 100 }
    );
  });
});
