/**
 * Interviewer Agent v2
 *
 * Generates interview responses adapted to the senior user's emotional state.
 * Uses GPT-4o-mini with emotion-aware system prompts for empathetic,
 * context-sensitive interview guidance.
 *
 * v2 enhancements:
 * - Question category tracking (인물→장소→감정→사건→시간 sequence)
 * - SessionJSON and MemorySummaryCard generation on session completion
 * - Original wording preservation (no reinterpretation)
 * - Single-question-at-a-time constraint
 * - triggeredBy field support for calendar/photo/family_question triggers
 *
 * Requirements: 1.2, 1.4, 1.5, 1.6
 */

import type {
  ChatMessage,
  SessionContext,
  EmotionLevel,
  SpeechProfile,
  SessionJSON,
  MemorySummaryCard,
} from '../types';
import { getOpenAIClient } from '../openai-client';

// ─── Question Category Sequence ──────────────────────────────────────────────

/**
 * The ordered sequence of question categories for follow-up questions.
 * 인물(person) → 장소(place) → 감정(emotion) → 사건(event) → 시간(time)
 */
export type QuestionCategoryType = '인물' | '장소' | '감정' | '사건' | '시간';

export const QUESTION_CATEGORY_SEQUENCE: QuestionCategoryType[] = [
  '인물',
  '장소',
  '감정',
  '사건',
  '시간',
];

/**
 * Trigger source for an interview session.
 */
export type TriggerSource = 'user' | 'calendar' | 'photo' | 'family_question';

/**
 * Tracks the state of an interview session including covered question categories.
 */
export interface InterviewSessionState {
  sessionId: string;
  startedAt: string;
  messages: ChatMessage[];
  coveredCategories: QuestionCategoryType[];
  triggeredBy: TriggerSource;
  isComplete: boolean;
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Maps internal ChatMessage format to OpenAI API message format.
 */
function mapHistory(history: ChatMessage[]) {
  return history.map((msg) => ({
    role: msg.role === 'model' ? ('assistant' as const) : ('user' as const),
    content: msg.text,
  }));
}

/**
 * Base system instruction for the interviewer agent.
 */
const BASE_SYSTEM_INSTRUCTION = `당신은 70대 어르신의 인생 이야기를 경청하고 기록하는 'Dearlog 기록가'입니다.
말투: 정중하고 따뜻한 격식체를 사용하세요. (예: ~하셨군요, ~이지요)
속도: 한 번에 한 가지 질문만 던지세요.
공감: 답변 내용에 대해 구체적인 감정적 공감을 먼저 표현한 뒤, 관련 있는 꼬리 질문을 하세요.
금기: AI인 티를 너무 내거나, 분석적인 태도를 보이지 마세요. "각색"하지 말고 "기억을 모시는" 태도를 유지하세요.
시작: 첫 질문은 "어르신, 오늘 함께 인생의 소중한 조각들을 모아보고 싶습니다. 가장 기억에 남는 어린 시절의 풍경은 어떤 모습인가요?"와 같이 시작합니다.`;

/**
 * Emotion-specific instructions appended to the system prompt.
 */
const EMOTION_INSTRUCTIONS: Record<EmotionLevel, string> = {
  distressed: `
[감정 대응 지침 - 고통/트라우마 감지]
어르신이 매우 힘든 감정을 표현하고 계십니다. 다음 지침을 반드시 따르세요:
- 먼저 어르신의 감정을 진심으로 공감하고 인정해주세요.
- "그 시간이 정말 힘드셨겠습니다" 등의 따뜻한 위로를 건네세요.
- 현재 주제에서 자연스럽게 벗어나 더 가볍고 따뜻한 주제로 전환하세요.
- 예: 좋았던 기억, 즐거웠던 순간, 좋아하시는 음식이나 계절 등으로 화제를 바꾸세요.
- 절대 현재 힘든 주제를 더 깊이 파고들지 마세요.`,

  sensitive: `
[감정 대응 지침 - 민감한 감정 감지]
어르신이 민감한 감정을 표현하고 계십니다. 다음 지침을 반드시 따르세요:
- 공감을 표현하되, 꼬리 질문의 깊이를 줄이세요.
- 현재 주제를 계속할지, 다른 이야기로 넘어갈지 어르신께 선택권을 드리세요.
- 예: "이 이야기를 더 해주셔도 좋고, 다른 기억으로 넘어가셔도 괜찮습니다."
- 어르신의 페이스를 존중하며 부담을 주지 마세요.`,

  positive: `
[감정 대응 지침 - 긍정적 감정 감지]
어르신이 긍정적이고 편안한 상태입니다. 다음 지침을 따르세요:
- 어르신의 기쁨과 즐거움에 함께 공감하세요.
- 현재 주제에 대해 더 깊은 꼬리 질문을 던지세요.
- 구체적인 디테일을 물어보세요 (누구와 함께였는지, 어떤 느낌이었는지, 그 후에 어떻게 되었는지 등).
- 이 좋은 기억을 충분히 탐색할 수 있도록 격려하세요.`,

  neutral: '',
};

/**
 * Category-specific follow-up question prompts.
 */
const CATEGORY_QUESTION_PROMPTS: Record<QuestionCategoryType, string> = {
  '인물': '이 기억에서 함께했던 사람에 대해 여쭤보세요. (예: 누구와 함께 계셨나요? 그분은 어떤 분이셨나요?)',
  '장소': '이 기억이 일어난 장소에 대해 여쭤보세요. (예: 어디에서 있었던 일인가요? 그곳은 어떤 모습이었나요?)',
  '감정': '그때의 감정에 대해 여쭤보세요. (예: 그때 어떤 기분이셨나요? 어떤 마음이 드셨나요?)',
  '사건': '구체적인 사건이나 일에 대해 여쭤보세요. (예: 그때 무슨 일이 있었나요? 어떻게 되었나요?)',
  '시간': '시기나 때에 대해 여쭤보세요. (예: 그게 언제쯤이었나요? 몇 살 때의 일인가요?)',
};

// ─── Session State Management ────────────────────────────────────────────────

/**
 * Creates a new interview session state.
 */
export function createSessionState(
  sessionId: string,
  triggeredBy: TriggerSource = 'user'
): InterviewSessionState {
  return {
    sessionId,
    startedAt: new Date().toISOString(),
    messages: [],
    coveredCategories: [],
    triggeredBy,
    isComplete: false,
  };
}

/**
 * Determines the next question category in the sequence based on already covered categories.
 * Returns null if all categories have been covered.
 */
export function getNextQuestionCategory(
  coveredCategories: QuestionCategoryType[]
): QuestionCategoryType | null {
  for (const category of QUESTION_CATEGORY_SEQUENCE) {
    if (!coveredCategories.includes(category)) {
      return category;
    }
  }
  return null;
}

/**
 * Marks a question category as covered and returns the updated session state.
 * Enforces the sequence order: only the next category in sequence can be marked.
 */
export function markCategoryCovered(
  state: InterviewSessionState,
  category: QuestionCategoryType
): InterviewSessionState {
  if (state.coveredCategories.includes(category)) {
    return state;
  }

  const nextExpected = getNextQuestionCategory(state.coveredCategories);
  if (nextExpected !== category) {
    // Only allow marking the next category in sequence
    return state;
  }

  const updatedCategories = [...state.coveredCategories, category];
  const isComplete = updatedCategories.length === QUESTION_CATEGORY_SEQUENCE.length;

  return {
    ...state,
    coveredCategories: updatedCategories,
    isComplete,
  };
}

/**
 * Adds a message to the session state, preserving original wording exactly.
 * No reinterpretation or paraphrasing is applied.
 */
export function addMessageToSession(
  state: InterviewSessionState,
  message: ChatMessage
): InterviewSessionState {
  return {
    ...state,
    messages: [...state.messages, { role: message.role, text: message.text }],
  };
}

// ─── Session Completion ──────────────────────────────────────────────────────

/**
 * Extracts key people mentioned in user messages.
 */
function extractKeyPeople(messages: ChatMessage[]): string[] {
  const userMessages = messages.filter((m) => m.role === 'user');
  const people: string[] = [];
  // Match patterns like "우리 어머니", "김철수씨", "할아버지" etc.
  const personSuffixes = '씨|님|선생님|할머니|할아버지|아버지|어머니|엄마|아빠|형|누나|동생|오빠|언니';
  const patterns = [
    // "우리/저희 + family term" pattern
    new RegExp(`(?:우리|저희)\\s*(?:${personSuffixes})`, 'g'),
    // "Name + suffix" pattern
    new RegExp(`[가-힣]{2,4}(?:${personSuffixes})`, 'g'),
    // Standalone family terms at word boundaries
    new RegExp(`(?:^|\\s)(${personSuffixes})(?:가|는|를|의|에게|한테|께서|이|와|과|도)`, 'g'),
  ];

  for (const msg of userMessages) {
    for (const pattern of patterns) {
      const matches = msg.text.match(pattern);
      if (matches) {
        for (const match of matches) {
          const trimmed = match.trim();
          if (trimmed && !people.includes(trimmed)) {
            people.push(trimmed);
          }
        }
      }
    }
  }
  return people;
}

/**
 * Extracts key places mentioned in user messages.
 */
function extractKeyPlaces(messages: ChatMessage[]): string[] {
  const userMessages = messages.filter((m) => m.role === 'user');
  const places: string[] = [];
  // Use longer suffixes first to avoid partial matches (e.g., "시장" before "시")
  const placeSuffixes = '시장|학교|병원|마을|공원|군|구|동|읍|면|리|역|시';
  for (const msg of userMessages) {
    const pattern = new RegExp(`[가-힣]{1,}(?:${placeSuffixes})`, 'g');
    const placeMatches = msg.text.match(pattern);
    if (placeMatches) {
      // Prefer longer matches (remove substrings that are part of longer matches)
      const sorted = placeMatches.sort((a, b) => b.length - a.length);
      for (const match of sorted) {
        const isSubstring = places.some((p) => p.includes(match) && p !== match);
        if (!isSubstring && !places.includes(match)) {
          places.push(match);
        }
      }
    }
  }
  return places;
}

/**
 * Extracts key emotions mentioned in user messages.
 */
function extractKeyEmotions(messages: ChatMessage[]): string[] {
  const userMessages = messages.filter((m) => m.role === 'user');
  const emotionKeywords = ['기쁨', '슬픔', '행복', '그리움', '감사', '후회', '자부심', '두려움', '설렘', '외로움'];
  const emotions: string[] = [];
  for (const msg of userMessages) {
    for (const keyword of emotionKeywords) {
      if (msg.text.includes(keyword) && !emotions.includes(keyword)) {
        emotions.push(keyword);
      }
    }
  }
  return emotions;
}

/**
 * Extracts time period references from user messages.
 */
function extractTimePeriod(messages: ChatMessage[]): string {
  const userMessages = messages.filter((m) => m.role === 'user');
  for (const msg of userMessages) {
    // Look for year references
    const yearMatch = msg.text.match(/(\d{4})년/);
    if (yearMatch) {
      return `${yearMatch[1]}년대`;
    }
    // Look for decade references
    const decadeMatch = msg.text.match(/(\d{2,4})년대/);
    if (decadeMatch) {
      return `${decadeMatch[1]}년대`;
    }
    // Look for age references
    const ageMatch = msg.text.match(/(\d{1,2})살/);
    if (ageMatch) {
      return `${ageMatch[1]}살 무렵`;
    }
  }
  return '';
}

/**
 * Generates a brief summary from user messages (first user message topic).
 */
function generateBriefSummary(messages: ChatMessage[]): string {
  const userMessages = messages.filter((m) => m.role === 'user');
  if (userMessages.length === 0) return '';
  // Use the first user message as the topic basis, truncated
  const firstMessage = userMessages[0].text;
  return firstMessage.length > 100 ? firstMessage.substring(0, 100) + '...' : firstMessage;
}

/**
 * Generates a topic from the session messages.
 */
function generateTopic(messages: ChatMessage[]): string {
  const userMessages = messages.filter((m) => m.role === 'user');
  if (userMessages.length === 0) return '인터뷰 세션';
  // Use first meaningful user message as topic
  const firstMessage = userMessages[0].text;
  return firstMessage.length > 50 ? firstMessage.substring(0, 50) + '...' : firstMessage;
}

/**
 * Generates a MemorySummaryCard from the session messages.
 * Extracts key information without reinterpreting the user's words.
 */
export function generateMemorySummaryCard(messages: ChatMessage[]): MemorySummaryCard {
  return {
    topic: generateTopic(messages),
    keyPeople: extractKeyPeople(messages),
    keyPlaces: extractKeyPlaces(messages),
    keyEmotions: extractKeyEmotions(messages),
    timePeriod: extractTimePeriod(messages),
    briefSummary: generateBriefSummary(messages),
  };
}

/**
 * Generates a complete SessionJSON when an interview session is completed.
 * Preserves all original user wording in messages without reinterpretation.
 */
export function generateSessionJSON(state: InterviewSessionState): SessionJSON {
  return {
    sessionId: state.sessionId,
    startedAt: state.startedAt,
    endedAt: new Date().toISOString(),
    messages: state.messages.map((msg) => ({ role: msg.role, text: msg.text })),
    memorySummaryCard: generateMemorySummaryCard(state.messages),
    triggeredBy: state.triggeredBy,
  };
}

// ─── System Prompt Building ──────────────────────────────────────────────────

/**
 * Builds a speech profile instruction to append to the system prompt.
 */
function buildSpeechProfileInstruction(profile: SpeechProfile): string {
  const parts: string[] = ['\n[화법 스타일 지침]', '어르신의 말투에 맞춰 응답 스타일을 조정하세요:'];

  if (profile.sentenceEndings.length > 0) {
    parts.push(`- 문장 끝맺음 참고: ${profile.sentenceEndings.slice(0, 5).join(', ')}`);
  }

  if (profile.characteristicExpressions.length > 0) {
    parts.push(`- 어르신이 자주 쓰시는 표현: ${profile.characteristicExpressions.slice(0, 5).join(', ')}`);
  }

  if (profile.dialect) {
    parts.push(`- 사투리/방언: ${profile.dialect}`);
  }

  parts.push('- 위 패턴을 참고하여 어르신이 편안하게 느끼실 수 있는 말투로 응답하세요.');

  return parts.join('\n');
}

/**
 * Builds the category-specific follow-up instruction for the system prompt.
 */
function buildCategoryInstruction(nextCategory: QuestionCategoryType): string {
  return `\n[꼬리질문 카테고리 지침]
다음 꼬리질문은 반드시 "${nextCategory}" 카테고리에 해당하는 질문이어야 합니다.
${CATEGORY_QUESTION_PROMPTS[nextCategory]}
반드시 한 가지 질문만 하세요. 여러 질문을 한꺼번에 하지 마세요.`;
}

/**
 * Builds the complete system prompt based on emotion state, speech profile, and question category.
 */
export function buildSystemPrompt(
  emotionLevel: EmotionLevel,
  speechProfile: SpeechProfile | null,
  nextCategory?: QuestionCategoryType | null
): string {
  let prompt = BASE_SYSTEM_INSTRUCTION;

  const emotionInstruction = EMOTION_INSTRUCTIONS[emotionLevel];
  if (emotionInstruction) {
    prompt += emotionInstruction;
  }

  if (speechProfile && speechProfile.sessionCount >= 3) {
    prompt += buildSpeechProfileInstruction(speechProfile);
  }

  if (nextCategory) {
    prompt += buildCategoryInstruction(nextCategory);
  }

  // Enforce single-question constraint
  prompt += `\n[단일 질문 제약]
반드시 한 번에 하나의 질문만 하세요. 여러 질문을 동시에 하지 마세요.
질문 후에는 어르신의 답변을 기다리세요.`;

  return prompt;
}

// ─── Interview Response Generation ───────────────────────────────────────────

/**
 * Generates an interview response adapted to the user's emotional state.
 *
 * v2: Also considers the question category sequence and enforces single-question constraint.
 *
 * Adjusts behavior based on emotion classification:
 * - 'distressed': Responds with empathy and transitions to a lighter topic
 * - 'sensitive': Reduces follow-up depth and offers choice to continue or change topics
 * - 'positive': Asks deeper follow-up questions
 * - 'neutral': Uses default interview behavior
 *
 * Optionally applies the speech profile to adjust response style.
 */
export async function generateInterviewResponse(
  history: ChatMessage[],
  sessionContext: SessionContext,
  sessionState?: InterviewSessionState
): Promise<string> {
  const emotionLevel = sessionContext.emotionState.current;
  const speechProfile = sessionContext.speechProfile;

  // Determine next question category from session state
  const nextCategory = sessionState
    ? getNextQuestionCategory(sessionState.coveredCategories)
    : null;

  const systemPrompt = buildSystemPrompt(emotionLevel, speechProfile, nextCategory);

  try {
    const response = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...mapHistory(history),
      ],
      temperature: 0.7,
    });

    return response.choices[0].message.content || '말씀을 더 듣고 싶습니다. 계속 이야기해 주시겠어요?';
  } catch (error) {
    console.error('Interviewer Agent: Error generating response:', error);
    return '죄송합니다. 잠시 생각이 멈췄네요. 다시 한 번 말씀해 주시겠어요?';
  }
}
