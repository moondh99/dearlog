/**
 * Emotion Analyzer Agent
 *
 * Classifies emotional tone of user messages to adjust interview behavior.
 * Uses GPT-4o-mini with JSON response format for structured classification.
 *
 * Requirements: 12.1, 12.5
 */

import type { ChatMessage, EmotionClassification, EmotionLevel } from '../types';
import { getOpenAIClient } from '../openai-client';

const VALID_EMOTION_LEVELS: EmotionLevel[] = ['positive', 'neutral', 'sensitive', 'distressed'];

/**
 * Returns the context window for emotion analysis:
 * current message + last 3 messages from history (max 4 messages total).
 *
 * Exported for testability.
 */
export function getContextWindow(message: string, history: ChatMessage[]): ChatMessage[] {
  const last3 = history.slice(-3);
  const currentMessage: ChatMessage = { role: 'user', text: message };
  return [...last3, currentMessage];
}

/**
 * Classifies the emotional tone of a message given recent conversation history.
 *
 * Uses GPT-4o-mini to analyze the current message in context of the last 3 messages,
 * returning an EmotionClassification with:
 * - current: the emotion level of the current message
 * - trajectory: emotion levels of the last 3 messages from history
 * - confidence: a number between 0 and 1
 */
export async function classify(
  message: string,
  recentHistory: ChatMessage[]
): Promise<EmotionClassification> {
  const contextWindow = getContextWindow(message, recentHistory);

  const systemPrompt = `당신은 대화의 감정 상태를 분석하는 전문가입니다.
주어진 대화 맥락을 분석하여 감정을 분류해주세요.

감정 분류 기준:
- "positive": 기쁨, 즐거움, 감사, 자부심, 따뜻함 등 긍정적 감정
- "neutral": 특별한 감정 없이 사실을 전달하거나 일상적인 대화
- "sensitive": 슬픔, 그리움, 아쉬움 등 민감하지만 위험하지 않은 감정
- "distressed": 극심한 슬픔, 트라우마, 분노, 고통 등 강한 부정적 감정

응답은 반드시 다음 JSON 형식으로만 반환하세요:
{
  "current": "현재 메시지의 감정 (positive | neutral | sensitive | distressed)",
  "trajectory": ["이전 메시지1의 감정", "이전 메시지2의 감정", "이전 메시지3의 감정"],
  "confidence": 0.0에서 1.0 사이의 확신도
}

주의사항:
- trajectory는 이전 대화 기록의 감정만 포함합니다 (현재 메시지 제외).
- 이전 대화가 3개 미만이면 있는 만큼만 포함하세요.
- confidence는 분류의 확신도를 나타냅니다 (0.0 = 매우 불확실, 1.0 = 매우 확실).`;

  const conversationContext = contextWindow
    .map((msg, i) => {
      const isLast = i === contextWindow.length - 1;
      const label = isLast ? '[현재 메시지]' : `[이전 메시지 ${i + 1}]`;
      const role = msg.role === 'user' ? '사용자' : 'AI';
      return `${label} ${role}: ${msg.text}`;
    })
    .join('\n');

  const userPrompt = `다음 대화의 감정을 분석해주세요:\n\n${conversationContext}`;

  try {
    const response = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      return getDefaultClassification(recentHistory);
    }

    const parsed = JSON.parse(content);

    // Validate and normalize the response
    const current = validateEmotionLevel(parsed.current);
    const trajectory = validateTrajectory(parsed.trajectory, recentHistory.length);
    const confidence = validateConfidence(parsed.confidence);

    return { current, trajectory, confidence };
  } catch (error) {
    console.error('Emotion Analyzer: Error classifying emotion:', error);
    return getDefaultClassification(recentHistory);
  }
}

/**
 * Validates that an emotion level is one of the valid values.
 * Falls back to 'neutral' if invalid.
 */
function validateEmotionLevel(level: unknown): EmotionLevel {
  if (typeof level === 'string' && VALID_EMOTION_LEVELS.includes(level as EmotionLevel)) {
    return level as EmotionLevel;
  }
  return 'neutral';
}

/**
 * Validates the trajectory array.
 * Ensures it contains at most min(3, historyLength) valid emotion levels.
 */
function validateTrajectory(trajectory: unknown, historyLength: number): EmotionLevel[] {
  const maxLength = Math.min(3, historyLength);

  if (!Array.isArray(trajectory)) {
    return Array(maxLength).fill('neutral');
  }

  const validated = trajectory
    .slice(0, maxLength)
    .map((level) => validateEmotionLevel(level));

  // Pad with 'neutral' if trajectory is shorter than expected
  while (validated.length < maxLength) {
    validated.push('neutral');
  }

  return validated;
}

/**
 * Validates confidence is a number between 0 and 1.
 * Falls back to 0.5 if invalid.
 */
function validateConfidence(confidence: unknown): number {
  if (typeof confidence === 'number' && confidence >= 0 && confidence <= 1) {
    return confidence;
  }
  return 0.5;
}

/**
 * Returns a default classification when the LLM call fails.
 * Defaults to 'neutral' as specified in the error handling strategy.
 */
function getDefaultClassification(recentHistory: ChatMessage[]): EmotionClassification {
  const trajectoryLength = Math.min(3, recentHistory.length);
  return {
    current: 'neutral',
    trajectory: Array(trajectoryLength).fill('neutral'),
    confidence: 0.5,
  };
}
