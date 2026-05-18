/**
 * Unit tests for Interviewer Agent v2 enhancements.
 * Tests question category tracking, session output, and wording preservation.
 */

import { describe, it, expect } from 'vitest';
import {
  createSessionState,
  getNextQuestionCategory,
  markCategoryCovered,
  addMessageToSession,
  generateSessionJSON,
  generateMemorySummaryCard,
  buildSystemPrompt,
  QUESTION_CATEGORY_SEQUENCE,
  type QuestionCategoryType,
  type InterviewSessionState,
} from './interviewer';
import type { ChatMessage } from '../types';

describe('Interviewer Agent v2', () => {
  describe('createSessionState', () => {
    it('creates a new session with default trigger', () => {
      const state = createSessionState('session-1');
      expect(state.sessionId).toBe('session-1');
      expect(state.triggeredBy).toBe('user');
      expect(state.coveredCategories).toEqual([]);
      expect(state.messages).toEqual([]);
      expect(state.isComplete).toBe(false);
      expect(state.startedAt).toBeTruthy();
    });

    it('creates a session with calendar trigger', () => {
      const state = createSessionState('session-2', 'calendar');
      expect(state.triggeredBy).toBe('calendar');
    });

    it('creates a session with photo trigger', () => {
      const state = createSessionState('session-3', 'photo');
      expect(state.triggeredBy).toBe('photo');
    });

    it('creates a session with family_question trigger', () => {
      const state = createSessionState('session-4', 'family_question');
      expect(state.triggeredBy).toBe('family_question');
    });
  });

  describe('getNextQuestionCategory', () => {
    it('returns 인물 when no categories are covered', () => {
      expect(getNextQuestionCategory([])).toBe('인물');
    });

    it('returns 장소 after 인물 is covered', () => {
      expect(getNextQuestionCategory(['인물'])).toBe('장소');
    });

    it('returns 감정 after 인물 and 장소 are covered', () => {
      expect(getNextQuestionCategory(['인물', '장소'])).toBe('감정');
    });

    it('returns 사건 after first three are covered', () => {
      expect(getNextQuestionCategory(['인물', '장소', '감정'])).toBe('사건');
    });

    it('returns 시간 after first four are covered', () => {
      expect(getNextQuestionCategory(['인물', '장소', '감정', '사건'])).toBe('시간');
    });

    it('returns null when all categories are covered', () => {
      expect(getNextQuestionCategory(['인물', '장소', '감정', '사건', '시간'])).toBeNull();
    });
  });

  describe('markCategoryCovered', () => {
    it('marks the next expected category', () => {
      const state = createSessionState('s1');
      const updated = markCategoryCovered(state, '인물');
      expect(updated.coveredCategories).toEqual(['인물']);
    });

    it('does not allow skipping categories', () => {
      const state = createSessionState('s1');
      const updated = markCategoryCovered(state, '장소'); // should be 인물 first
      expect(updated.coveredCategories).toEqual([]);
    });

    it('does not duplicate already covered categories', () => {
      let state = createSessionState('s1');
      state = markCategoryCovered(state, '인물');
      const updated = markCategoryCovered(state, '인물');
      expect(updated.coveredCategories).toEqual(['인물']);
    });

    it('marks session as complete when all categories are covered', () => {
      let state = createSessionState('s1');
      for (const cat of QUESTION_CATEGORY_SEQUENCE) {
        state = markCategoryCovered(state, cat);
      }
      expect(state.isComplete).toBe(true);
      expect(state.coveredCategories).toEqual(QUESTION_CATEGORY_SEQUENCE);
    });
  });

  describe('addMessageToSession', () => {
    it('preserves original user wording exactly', () => {
      const state = createSessionState('s1');
      const originalText = '우리 아버지는 1960년에 서울에서 태어나셨어요. 정말 힘든 시절이었지요.';
      const message: ChatMessage = { role: 'user', text: originalText };
      const updated = addMessageToSession(state, message);
      expect(updated.messages[0].text).toBe(originalText);
      expect(updated.messages[0].role).toBe('user');
    });

    it('preserves model messages exactly', () => {
      const state = createSessionState('s1');
      const modelText = '어르신, 그때 어떤 분들과 함께 계셨나요?';
      const message: ChatMessage = { role: 'model', text: modelText };
      const updated = addMessageToSession(state, message);
      expect(updated.messages[0].text).toBe(modelText);
      expect(updated.messages[0].role).toBe('model');
    });

    it('appends messages without modifying existing ones', () => {
      let state = createSessionState('s1');
      const msg1: ChatMessage = { role: 'user', text: '첫 번째 메시지' };
      const msg2: ChatMessage = { role: 'model', text: '두 번째 메시지' };
      state = addMessageToSession(state, msg1);
      state = addMessageToSession(state, msg2);
      expect(state.messages).toHaveLength(2);
      expect(state.messages[0].text).toBe('첫 번째 메시지');
      expect(state.messages[1].text).toBe('두 번째 메시지');
    });
  });

  describe('generateMemorySummaryCard', () => {
    it('generates a summary card from messages', () => {
      const messages: ChatMessage[] = [
        { role: 'model', text: '어르신, 가장 기억에 남는 분은 누구인가요?' },
        { role: 'user', text: '우리 어머니가 가장 기억에 남아요. 1965년에 부산시장에서 장사를 하셨지요. 정말 감사한 분이에요.' },
      ];
      const card = generateMemorySummaryCard(messages);
      expect(card.topic).toBeTruthy();
      expect(card.keyPeople).toContain('우리 어머니');
      expect(card.keyPlaces).toContain('부산시장');
      expect(card.keyEmotions).toContain('감사');
      expect(card.timePeriod).toBe('1965년대');
    });

    it('returns empty arrays when no entities found', () => {
      const messages: ChatMessage[] = [
        { role: 'user', text: '네, 좋습니다.' },
      ];
      const card = generateMemorySummaryCard(messages);
      expect(card.keyPeople).toEqual([]);
      expect(card.keyPlaces).toEqual([]);
      expect(card.keyEmotions).toEqual([]);
    });
  });

  describe('generateSessionJSON', () => {
    it('generates valid SessionJSON with all required fields', () => {
      let state = createSessionState('session-test', 'photo');
      state = addMessageToSession(state, { role: 'model', text: '질문입니다.' });
      state = addMessageToSession(state, { role: 'user', text: '답변입니다.' });

      const sessionJSON = generateSessionJSON(state);

      expect(sessionJSON.sessionId).toBe('session-test');
      expect(sessionJSON.startedAt).toBeTruthy();
      expect(sessionJSON.endedAt).toBeTruthy();
      expect(sessionJSON.messages).toHaveLength(2);
      expect(sessionJSON.triggeredBy).toBe('photo');
      expect(sessionJSON.memorySummaryCard).toBeDefined();
      expect(sessionJSON.memorySummaryCard.topic).toBeTruthy();
    });

    it('preserves original message wording in output', () => {
      let state = createSessionState('session-wording');
      const originalText = '특수문자 포함: !@#$%^&*() 그리고 한글 "따옴표"';
      state = addMessageToSession(state, { role: 'user', text: originalText });

      const sessionJSON = generateSessionJSON(state);
      expect(sessionJSON.messages[0].text).toBe(originalText);
    });

    it('supports all trigger types', () => {
      const triggers: Array<'user' | 'calendar' | 'photo' | 'family_question'> = [
        'user', 'calendar', 'photo', 'family_question',
      ];
      for (const trigger of triggers) {
        const state = createSessionState(`session-${trigger}`, trigger);
        const json = generateSessionJSON(state);
        expect(json.triggeredBy).toBe(trigger);
      }
    });
  });

  describe('buildSystemPrompt', () => {
    it('includes category instruction when nextCategory is provided', () => {
      const prompt = buildSystemPrompt('neutral', null, '인물');
      expect(prompt).toContain('인물');
      expect(prompt).toContain('꼬리질문 카테고리 지침');
    });

    it('includes single-question constraint', () => {
      const prompt = buildSystemPrompt('neutral', null);
      expect(prompt).toContain('단일 질문 제약');
      expect(prompt).toContain('한 번에 하나의 질문만');
    });

    it('includes emotion instructions for distressed state', () => {
      const prompt = buildSystemPrompt('distressed', null);
      expect(prompt).toContain('고통/트라우마 감지');
    });

    it('does not include category instruction when nextCategory is null', () => {
      const prompt = buildSystemPrompt('neutral', null, null);
      expect(prompt).not.toContain('꼬리질문 카테고리 지침');
    });
  });
});
