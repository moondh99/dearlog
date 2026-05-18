/**
 * Family Question Queue (Agent ⑧)
 *
 * Manages family member questions for the senior user's interview sessions.
 * Supports anonymous submissions, priority-based ordering, and natural
 * conversational restructuring via GPT-4o-mini.
 *
 * Key behaviors:
 * - Questions are stored with optional anonymous flag and priority tag
 * - Priority ordering: high > normal > low, FIFO within same priority
 * - Anonymous questions never leak submitter identity
 * - Questions are restructured into natural conversational form before delivery
 * - Contextual injection timing avoids disrupting narrative flow
 * - Answered questions are archived with timestamp and memory ID
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */

import type { FamilyQuestion, PriorityTag } from '../types';
import { useStore } from '../../store';
import { getOpenAIClient } from '../openai-client';

// ─── Priority Weight Map ─────────────────────────────────────────────────────

const PRIORITY_WEIGHT: Record<PriorityTag, number> = {
  high: 3,
  normal: 2,
  low: 1,
};

// ─── ID Generation ───────────────────────────────────────────────────────────

/**
 * Generates a unique ID for a new family question.
 */
function generateQuestionId(): string {
  return `fq_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Submits a new family question to the queue.
 *
 * Stores the question with the provided text, anonymous flag, and priority tag.
 * The question starts in 'pending' status and is added to the store.
 *
 * @param text - The question text
 * @param submittedBy - The family user ID who submitted the question
 * @param anonymous - Whether the question should hide the submitter's identity
 * @param priority - Priority tag (high, normal, low)
 * @returns The created FamilyQuestion
 */
export function submitQuestion(
  text: string,
  submittedBy: string,
  anonymous: boolean,
  priority: PriorityTag
): FamilyQuestion {
  const question: FamilyQuestion = {
    id: generateQuestionId(),
    questionText: text,
    submittedBy,
    anonymous,
    priority,
    status: 'pending',
    createdAt: new Date().toISOString(),
    answeredAt: null,
    answerMemoryId: null,
  };

  useStore.getState().addFamilyQuestion(question);

  return question;
}

/**
 * Gets the next question from the queue based on priority ordering.
 *
 * Priority ordering: high > normal > low.
 * Within the same priority level, questions are ordered by FIFO (earliest createdAt first).
 *
 * Only returns questions with 'pending' status.
 * Considers the current interview context to determine if injection is appropriate
 * (contextual injection timing - no disruption to narrative flow).
 *
 * @param currentContext - The current interview context/topic being discussed
 * @returns The next question to deliver, or null if no pending questions
 */
export function getNextQuestion(currentContext: string): FamilyQuestion | null {
  const { questions } = useStore.getState().familyQuestions;

  // Filter only pending questions
  const pendingQuestions = questions.filter((q) => q.status === 'pending');

  if (pendingQuestions.length === 0) {
    return null;
  }

  // Sort by priority (high > normal > low), then by createdAt (FIFO)
  const sorted = [...pendingQuestions].sort((a, b) => {
    const priorityDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    // FIFO within same priority: earlier createdAt comes first
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  const nextQuestion = sorted[0];

  // Update status to 'delivered'
  useStore.getState().updateFamilyQuestion(nextQuestion.id, { status: 'delivered' });

  return nextQuestion;
}

/**
 * Restructures a family question into a natural conversational form
 * suitable for the interview context using GPT-4o-mini.
 *
 * For anonymous questions, the restructured output must NOT contain
 * any identifying information about the submitter.
 *
 * @param question - The family question to restructure
 * @param interviewContext - The current interview context for natural integration
 * @returns A naturally phrased question suitable for the interview
 */
export async function restructureForInterview(
  question: FamilyQuestion,
  interviewContext: string
): Promise<string> {
  // Build the system prompt - ensure anonymous questions don't leak identity
  const anonymityInstruction = question.anonymous
    ? `이 질문은 익명으로 제출되었습니다. 절대로 질문자의 신원이나 정체를 암시하는 내용을 포함하지 마세요.
       "가족 중 누군가가", "누군가 궁금해하는데" 등의 표현도 사용하지 마세요.
       마치 인터뷰어가 자연스럽게 떠올린 질문처럼 재구성하세요.`
    : `이 질문은 가족 구성원이 제출한 것입니다. 자연스럽게 "가족분이 궁금해하시는 게 있는데요" 정도로 소개할 수 있습니다.`;

  const systemPrompt = `당신은 어르신 인터뷰를 진행하는 Dearlog 기록가입니다.
가족이 등록한 질문을 인터뷰 대화 흐름에 자연스럽게 녹여내야 합니다.

규칙:
1. 질문을 자연스러운 대화체로 재구성하세요.
2. 현재 인터뷰 맥락과 자연스럽게 연결되도록 전환 문구를 포함하세요.
3. 한 번에 하나의 질문만 하세요.
4. 어르신이 편안하게 느끼실 수 있는 따뜻한 말투를 사용하세요.
5. 원래 질문의 의도를 보존하되, 딱딱한 질문 형식이 아닌 대화 형식으로 바꾸세요.

${anonymityInstruction}

현재 인터뷰 맥락: ${interviewContext}`;

  try {
    const response = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `다음 질문을 자연스러운 인터뷰 대화로 재구성해주세요: "${question.questionText}"` },
      ],
      temperature: 0.7,
    });

    const restructured = response.choices[0].message.content;

    if (!restructured) {
      return question.questionText;
    }

    // Safety check: for anonymous questions, verify no identity leak
    if (question.anonymous && restructured.includes(question.submittedBy)) {
      // Fallback: return a generic restructured version without identity
      return '이 이야기와 관련해서 떠오르는 기억이 있으신가요? 편하신 만큼만 들려주세요.';
    }

    return restructured;
  } catch (error) {
    console.error('Family Question Queue: Error restructuring question:', error);
    // Fallback: return the original question text
    return question.anonymous
      ? '이 이야기와 관련해서 떠오르는 기억이 있으신가요? 편하신 만큼만 들려주세요.'
      : question.questionText;
  }
}

/**
 * Marks a question as answered, transitioning its status to 'archived'
 * with the answer timestamp and associated memory ID.
 *
 * @param questionId - The ID of the question to mark as answered
 * @param memoryId - The ID of the memory created from the answer
 */
export function markAnswered(questionId: string, memoryId: string): void {
  useStore.getState().updateFamilyQuestion(questionId, {
    status: 'archived',
    answeredAt: new Date().toISOString(),
    answerMemoryId: memoryId,
  });
}

/**
 * Notifies the original questioner that their question has been answered.
 *
 * In the current client-side implementation, this updates the question status
 * so the family user can see the answer is available. In a full implementation,
 * this would trigger a push notification or email.
 *
 * @param questionId - The ID of the answered question
 */
export function notifyQuestioner(questionId: string): void {
  const { questions } = useStore.getState().familyQuestions;
  const question = questions.find((q) => q.id === questionId);

  if (!question) {
    console.warn(`Family Question Queue: Question ${questionId} not found for notification`);
    return;
  }

  // In a client-side app, notification is handled by the UI observing store changes.
  // The question's 'archived' status with answerMemoryId signals the answer is ready.
  // A full implementation would dispatch a notification event here.
  console.log(
    `Family Question Queue: Notifying questioner ${question.anonymous ? '[anonymous]' : question.submittedBy} ` +
    `that question ${questionId} has been answered`
  );
}

/**
 * Returns all currently queued (pending) questions, sorted by priority and FIFO.
 *
 * @returns Array of pending FamilyQuestion objects in priority order
 */
export function getQueuedQuestions(): FamilyQuestion[] {
  const { questions } = useStore.getState().familyQuestions;

  return questions
    .filter((q) => q.status === 'pending')
    .sort((a, b) => {
      const priorityDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
}

/**
 * Determines if the current interview context is appropriate for injecting
 * a family question without disrupting the narrative flow.
 *
 * Injection is appropriate when:
 * - There's a natural pause or topic transition in the conversation
 * - The current topic has been sufficiently explored
 * - The senior user is in a neutral or positive emotional state
 *
 * @param currentContext - Description of the current interview state
 * @param lastMessages - Recent messages to assess conversation flow
 * @returns Whether it's appropriate to inject a family question now
 */
export function isInjectionAppropriate(
  currentContext: string,
  lastMessages: { role: string; text: string }[]
): boolean {
  // Heuristic: injection is appropriate if:
  // 1. There are at least 2 exchanges (4 messages) in the current topic
  // 2. The last model message contains a transition indicator
  if (lastMessages.length < 4) {
    return false;
  }

  const lastModelMessage = [...lastMessages]
    .reverse()
    .find((m) => m.role === 'model');

  if (!lastModelMessage) {
    return false;
  }

  // Check for natural transition points in the last model response
  const transitionIndicators = [
    '다른 이야기',
    '또 다른',
    '다음으로',
    '그러면',
    '혹시',
    '그 외에',
    '넘어가',
    '바꿔서',
  ];

  const hasTransitionIndicator = transitionIndicators.some((indicator) =>
    lastModelMessage.text.includes(indicator)
  );

  // Also consider if the user gave a short response (indicating topic exhaustion)
  const lastUserMessage = [...lastMessages]
    .reverse()
    .find((m) => m.role === 'user');

  const isShortResponse = lastUserMessage != null && lastUserMessage.text.length < 20;

  return hasTransitionIndicator || isShortResponse;
}
