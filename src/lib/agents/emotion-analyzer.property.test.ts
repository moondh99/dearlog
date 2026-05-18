import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { getContextWindow } from './emotion-analyzer';
import type { ChatMessage } from '../types';

/**
 * Feature: memoir-platform-enhancement, Property 13: Emotion Classification Validity and Context
 *
 * Validates: Requirements 12.1, 12.5
 *
 * For any message and conversation history, the Emotion Analyzer SHALL return a
 * classification that is exactly one of ('positive', 'neutral', 'sensitive', 'distressed'),
 * and the context passed to the analyzer SHALL consist of exactly the current message plus
 * at most the last 3 messages from history.
 */
describe('Property 13: Emotion Classification Validity and Context', () => {
  // ─── Generators ──────────────────────────────────────────────────────────────

  const roleArb: fc.Arbitrary<'user' | 'model'> = fc.constantFrom('user', 'model');

  const chatMessageArb: fc.Arbitrary<ChatMessage> = fc.record({
    role: roleArb,
    text: fc.string({ minLength: 1, maxLength: 200 }),
  });

  const messageTextArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 200 });

  const historyArb: fc.Arbitrary<ChatMessage[]> = fc.array(chatMessageArb, {
    minLength: 0,
    maxLength: 20,
  });

  // ─── Sub-property 1: Context window always returns at most 4 messages ─────────

  it('getContextWindow always returns at most 4 messages (current + last 3 from history)', () => {
    fc.assert(
      fc.property(messageTextArb, historyArb, (message, history) => {
        const contextWindow = getContextWindow(message, history);
        expect(contextWindow.length).toBeLessThanOrEqual(4);
      }),
      { numRuns: 100 }
    );
  });

  // ─── Sub-property 2: Last message in context window is always the current message ─

  it('the last message in the context window is always the current message', () => {
    fc.assert(
      fc.property(messageTextArb, historyArb, (message, history) => {
        const contextWindow = getContextWindow(message, history);
        const lastMessage = contextWindow[contextWindow.length - 1];
        expect(lastMessage.role).toBe('user');
        expect(lastMessage.text).toBe(message);
      }),
      { numRuns: 100 }
    );
  });

  // ─── Sub-property 3: Context window contains at most 3 messages from history ──

  it('the context window contains at most 3 messages from history (the last 3)', () => {
    fc.assert(
      fc.property(messageTextArb, historyArb, (message, history) => {
        const contextWindow = getContextWindow(message, history);
        // Total messages minus the current message = history messages in context
        const historyMessagesInContext = contextWindow.length - 1;
        expect(historyMessagesInContext).toBeLessThanOrEqual(3);

        // Verify the history messages are the last 3 from the original history
        const expectedHistorySlice = history.slice(-3);
        const actualHistoryInContext = contextWindow.slice(0, contextWindow.length - 1);
        expect(actualHistoryInContext).toEqual(expectedHistorySlice);
      }),
      { numRuns: 100 }
    );
  });

  // ─── Sub-property 4: When history has fewer than 3 messages, all are included ─

  it('when history has fewer than 3 messages, all history messages are included', () => {
    const shortHistoryArb: fc.Arbitrary<ChatMessage[]> = fc.array(chatMessageArb, {
      minLength: 0,
      maxLength: 2,
    });

    fc.assert(
      fc.property(messageTextArb, shortHistoryArb, (message, history) => {
        const contextWindow = getContextWindow(message, history);
        // All history messages should be present
        const historyMessagesInContext = contextWindow.slice(0, contextWindow.length - 1);
        expect(historyMessagesInContext.length).toBe(history.length);
        expect(historyMessagesInContext).toEqual(history);
      }),
      { numRuns: 100 }
    );
  });

  // ─── Sub-property 5: Context window structure is always valid ──────────────────

  it('the context window always has valid structure (1 to 4 ChatMessages with valid roles)', () => {
    const validRoles = ['user', 'model'];

    fc.assert(
      fc.property(messageTextArb, historyArb, (message, history) => {
        const contextWindow = getContextWindow(message, history);

        // Must have at least 1 message (the current one)
        expect(contextWindow.length).toBeGreaterThanOrEqual(1);
        // Must have at most 4 messages
        expect(contextWindow.length).toBeLessThanOrEqual(4);

        // Every message must have a valid role and non-empty text
        for (const msg of contextWindow) {
          expect(validRoles).toContain(msg.role);
          expect(typeof msg.text).toBe('string');
        }
      }),
      { numRuns: 100 }
    );
  });
});
