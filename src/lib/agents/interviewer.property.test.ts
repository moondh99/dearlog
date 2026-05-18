/**
 * Property-based tests for Interviewer Agent v2.
 *
 * Feature: agent-model-v2, Property 1: Interview question sequence ordering
 *
 * Validates: Requirements 1.2
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  getNextQuestionCategory,
  QUESTION_CATEGORY_SEQUENCE,
  createSessionState,
  addMessageToSession,
  generateSessionJSON,
  type QuestionCategoryType,
} from './interviewer';

describe('Feature: agent-model-v2, Property 1: Interview question sequence ordering', () => {
  /**
   * Property: For any interview session state with N completed question categories
   * (where N < 5), the next follow-up question generated SHALL belong to the (N+1)th
   * category in the sequence [인물, 장소, 감정, 사건, 시간].
   *
   * **Validates: Requirements 1.2**
   */
  it('getNextQuestionCategory returns the (N+1)th category for N completed categories', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary N from 0 to 4 representing number of completed categories
        fc.integer({ min: 0, max: 4 }),
        (n) => {
          // Build the list of N covered categories (first N items in the sequence)
          const coveredCategories: QuestionCategoryType[] = QUESTION_CATEGORY_SEQUENCE.slice(0, n);

          // Get the next question category
          const nextCategory = getNextQuestionCategory(coveredCategories);

          // The next category SHALL be the (N+1)th category in the sequence (0-indexed: index N)
          const expectedCategory = QUESTION_CATEGORY_SEQUENCE[n];

          expect(nextCategory).toBe(expectedCategory);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: agent-model-v2, Property 2: Original wording preservation in session output', () => {
  /**
   * Property: For any user answer string provided during an interview, the Session_JSON
   * output SHALL contain the exact original wording without any reinterpretation or
   * paraphrasing (byte-for-byte equality of the originalTranscript field).
   *
   * **Validates: Requirements 1.4**
   */
  it('user message text is preserved byte-for-byte in SessionJSON output', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary unicode strings representing user answers
        fc.string({ minLength: 1, maxLength: 500, unit: 'grapheme' }),
        (userAnswer) => {
          // Create a session state
          const session = createSessionState('test-session-' + Date.now(), 'user');

          // Add the user message to the session
          const updatedSession = addMessageToSession(session, {
            role: 'user',
            text: userAnswer,
          });

          // Generate SessionJSON from the session state
          const sessionJSON = generateSessionJSON(updatedSession);

          // Verify that the message text in SessionJSON is byte-for-byte identical
          const userMessages = sessionJSON.messages.filter((m) => m.role === 'user');
          expect(userMessages.length).toBe(1);
          expect(userMessages[0].text).toBe(userAnswer);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: agent-model-v2, Property 3: Session completion output structure', () => {
  /**
   * Property: For any completed interview session with a non-empty chat history,
   * the session completion output SHALL contain a valid MemorySummaryCard
   * (with topic, keyPeople, keyPlaces, keyEmotions, timePeriod, briefSummary)
   * and a valid Session_JSON (with sessionId, startedAt, endedAt, messages, triggeredBy).
   *
   * **Validates: Requirements 1.6**
   */

  const triggerTypes = ['user', 'calendar', 'photo', 'family_question'] as const;

  const arbChatMessage = fc.record({
    role: fc.constantFrom('user' as const, 'model' as const),
    text: fc.string({ minLength: 1, maxLength: 200 }),
  });

  // Generate non-empty arrays of ChatMessages with at least 1 user message
  const arbChatHistory = fc
    .tuple(
      // Ensure at least one user message
      fc.record({
        role: fc.constant('user' as const),
        text: fc.string({ minLength: 1, maxLength: 200 }),
      }),
      fc.array(arbChatMessage, { minLength: 0, maxLength: 10 })
    )
    .map(([userMsg, rest]) => [userMsg, ...rest]);

  const arbTriggerType = fc.constantFrom(...triggerTypes);

  it('session completion output contains valid MemorySummaryCard and SessionJSON fields', () => {
    fc.assert(
      fc.property(
        arbChatHistory,
        arbTriggerType,
        fc.uuid(),
        (messages, trigger, sessionId) => {
          // Create a session with the given trigger type
          const session = createSessionState(sessionId, trigger);

          // Add all messages to the session
          let currentSession = session;
          for (const msg of messages) {
            currentSession = addMessageToSession(currentSession, msg);
          }

          // Generate SessionJSON (session completion output)
          const sessionJSON = generateSessionJSON(currentSession);

          // Verify SessionJSON has all required fields
          expect(sessionJSON).toHaveProperty('sessionId');
          expect(sessionJSON.sessionId).toBe(sessionId);

          expect(sessionJSON).toHaveProperty('startedAt');
          expect(typeof sessionJSON.startedAt).toBe('string');
          expect(sessionJSON.startedAt.length).toBeGreaterThan(0);

          expect(sessionJSON).toHaveProperty('endedAt');
          expect(typeof sessionJSON.endedAt).toBe('string');
          expect(sessionJSON.endedAt.length).toBeGreaterThan(0);

          expect(sessionJSON).toHaveProperty('messages');
          expect(Array.isArray(sessionJSON.messages)).toBe(true);
          expect(sessionJSON.messages.length).toBe(messages.length);

          expect(sessionJSON).toHaveProperty('triggeredBy');
          expect(triggerTypes).toContain(sessionJSON.triggeredBy);
          expect(sessionJSON.triggeredBy).toBe(trigger);

          // Verify MemorySummaryCard has all required fields
          const card = sessionJSON.memorySummaryCard;
          expect(card).toBeDefined();

          expect(card).toHaveProperty('topic');
          expect(typeof card.topic).toBe('string');
          expect(card.topic.length).toBeGreaterThan(0);

          expect(card).toHaveProperty('keyPeople');
          expect(Array.isArray(card.keyPeople)).toBe(true);

          expect(card).toHaveProperty('keyPlaces');
          expect(Array.isArray(card.keyPlaces)).toBe(true);

          expect(card).toHaveProperty('keyEmotions');
          expect(Array.isArray(card.keyEmotions)).toBe(true);

          expect(card).toHaveProperty('timePeriod');
          expect(typeof card.timePeriod).toBe('string');

          expect(card).toHaveProperty('briefSummary');
          expect(typeof card.briefSummary).toBe('string');
          expect(card.briefSummary.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
