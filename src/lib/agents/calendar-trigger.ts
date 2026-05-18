/**
 * Calendar Trigger Agent (Agent ⑨)
 *
 * Automatically detects upcoming family events from a shared calendar at D-1
 * (one day before the event) and takes action based on memory availability:
 * - If related memories exist: auto-edit via Ghostwriter and deliver to family
 * - If no related memories exist: generate a new interview session with event-related questions
 *
 * Supported event types: 결혼식, 졸업, 생일, 기념일, 기일
 *
 * Error handling: Calendar Trigger failures skip the event and continue to the next one
 * (log and skip pattern).
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

import type {
  CalendarEvent,
  CalendarEventType,
  CalendarTriggerResult,
  EditedMemoryDelivery,
  InterviewSession,
  SearchResult,
} from '../types';
import { useStore } from '../../store';
import { ragIndex } from '../rag/index';
import { canAccessV2, getEffectiveConsentSettings } from '../consent/manager';
import { getOpenAIClient } from '../openai-client';

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Supported calendar event types for the Calendar Trigger Agent.
 */
export const SUPPORTED_EVENT_TYPES: CalendarEventType[] = [
  '결혼식',
  '졸업',
  '생일',
  '기념일',
  '기일',
];

/**
 * Minimum RAG similarity score to consider a memory as "related" to an event.
 */
const MEMORY_RELEVANCE_THRESHOLD = 0.3;

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Detects upcoming events from the shared calendar that are exactly D-1
 * (one day before the event date, relative to today).
 *
 * Only returns events whose eventType is one of the supported types:
 * 결혼식, 졸업, 생일, 기념일, 기일.
 *
 * @param calendar - Array of calendar events to scan
 * @param today - Optional reference date for "today" (defaults to current date). ISO string or Date.
 * @returns Array of events occurring tomorrow (D-1)
 */
export function detectUpcomingEvents(
  calendar: CalendarEvent[],
  today?: string | Date
): CalendarEvent[] {
  const referenceDate = today ? new Date(today) : new Date();
  // Normalize to start of day in local timezone
  referenceDate.setHours(0, 0, 0, 0);

  // Calculate tomorrow's date
  const tomorrow = new Date(referenceDate);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const tomorrowStr = formatDateToISO(tomorrow);

  return calendar.filter((event) => {
    // Only include supported event types
    if (!SUPPORTED_EVENT_TYPES.includes(event.eventType)) {
      return false;
    }

    // Check if event date is tomorrow (D-1)
    const eventDateStr = formatDateToISO(new Date(event.date));
    return eventDateStr === tomorrowStr;
  });
}

/**
 * Checks memory availability for a given calendar event by searching
 * the RAG index for related memories.
 *
 * Builds a search query from the event's title, type, related people,
 * and description, then searches the RAG index for relevant matches.
 *
 * @param event - The calendar event to check memories for
 * @returns Array of related memory IDs (empty if no related memories found)
 */
export async function checkMemoryAvailability(event: CalendarEvent): Promise<string[]> {
  // Build a search query from event context
  const queryParts: string[] = [
    event.title,
    event.eventType,
    ...event.relatedPeople,
  ];

  if (event.description) {
    queryParts.push(event.description);
  }

  const query = queryParts.join(' ');

  try {
    const results: SearchResult[] = await ragIndex.search(query, 5);

    // Filter results by relevance threshold
    const relevantResults = results.filter(
      (r) => r.score >= MEMORY_RELEVANCE_THRESHOLD
    );

    return relevantResults.map((r) => r.memoryId);
  } catch (error) {
    console.error('Calendar Trigger: Error checking memory availability:', error);
    // On failure, return empty (treat as no memories found)
    return [];
  }
}

/**
 * Processes a detected calendar event by branching based on memory availability:
 * - If related memories exist → auto-edit action with EditedMemoryDelivery
 * - If no related memories exist → new_interview action with InterviewSession
 *
 * @param event - The calendar event to process
 * @returns CalendarTriggerResult with the appropriate action and output
 */
export async function processEvent(event: CalendarEvent): Promise<CalendarTriggerResult> {
  const relatedMemoryIds = await checkMemoryAvailability(event);

  if (relatedMemoryIds.length > 0) {
    // Branch: auto-edit (memory exists)
    const delivery = await generateEditedMemoryDelivery(event, relatedMemoryIds);
    return {
      event,
      action: 'auto_edit',
      relatedMemoryIds,
      output: delivery,
    };
  } else {
    // Branch: new interview (no memory)
    const session = await generateInterviewSession(event);
    return {
      event,
      action: 'new_interview',
      relatedMemoryIds: [],
      output: session,
    };
  }
}

/**
 * Processes all detected upcoming events, skipping any that fail.
 * Implements the "log and skip" error handling pattern.
 *
 * @param calendar - Array of calendar events to scan
 * @param today - Optional reference date for "today"
 * @returns Array of successfully processed CalendarTriggerResults
 */
export async function processUpcomingEvents(
  calendar: CalendarEvent[],
  today?: string | Date
): Promise<CalendarTriggerResult[]> {
  const upcomingEvents = detectUpcomingEvents(calendar, today);
  const results: CalendarTriggerResult[] = [];

  for (const event of upcomingEvents) {
    try {
      // Skip already-processed events
      const { processedEventIds } = useStore.getState().calendar;
      if (processedEventIds.includes(event.id)) {
        continue;
      }

      const result = await processEvent(event);
      results.push(result);

      // Mark event as processed
      useStore.getState().markEventProcessed(event.id);
    } catch (error) {
      // Log and skip pattern: log the error and continue to next event
      console.error(
        `Calendar Trigger: Failed to process event "${event.title}" (${event.id}):`,
        error
      );
      continue;
    }
  }

  return results;
}

// ─── Internal Helper Functions ───────────────────────────────────────────────

/**
 * Generates an EditedMemoryDelivery by using GPT-4o-mini to re-narrate
 * the most relevant memory in the context of the upcoming event.
 *
 * @param event - The calendar event providing context
 * @param relatedMemoryIds - IDs of related memories found via RAG
 * @returns EditedMemoryDelivery with the edited narrative and target family IDs
 */
async function generateEditedMemoryDelivery(
  event: CalendarEvent,
  relatedMemoryIds: string[]
): Promise<EditedMemoryDelivery> {
  const memories = useStore.getState().memories;
  const primaryMemoryId = relatedMemoryIds[0];
  const primaryMemory = memories.find((m) =>
    m.id === primaryMemoryId &&
    canAccessV2(m, getEffectiveConsentSettings(m), 'family', '가족열람')
  );

  if (!primaryMemory) {
    // Fallback: return a minimal delivery
    return {
      memoryId: primaryMemoryId,
      editedNarrative: '',
      targetFamilyIds: event.relatedPeople,
    };
  }

  const systemPrompt = `당신은 어르신의 기억을 가족 이벤트에 맞게 따뜻하게 재구성하는 기록가입니다.

규칙:
1. 원본 기억의 사실만 사용하세요. 새로운 사실을 만들어내지 마세요.
2. 다가오는 이벤트와 연결되는 따뜻한 서사로 재구성하세요.
3. 감정 과장을 억제하고 담담하면서도 따뜻한 톤을 유지하세요.
4. 가족에게 전달하기 적합한 형태로 작성하세요.
5. 200자 이내로 간결하게 작성하세요.`;

  const userPrompt = `다가오는 이벤트: ${event.eventType} - "${event.title}" (${event.date})
관련 인물: ${event.relatedPeople.join(', ')}
이벤트 설명: ${event.description}

원본 기억:
주제: ${primaryMemory.topic}
내용: ${primaryMemory.cleanedTranscript || primaryMemory.originalTranscript}

이 기억을 다가오는 이벤트에 맞게 따뜻하게 재구성해주세요.`;

  try {
    const response = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.5,
    });

    const editedNarrative = response.choices[0].message.content || '';

    return {
      memoryId: primaryMemoryId,
      editedNarrative,
      targetFamilyIds: event.relatedPeople,
    };
  } catch (error) {
    console.error('Calendar Trigger: Error generating edited memory delivery:', error);
    // Fallback: use the original transcript
    return {
      memoryId: primaryMemoryId,
      editedNarrative: primaryMemory.cleanedTranscript || primaryMemory.originalTranscript,
      targetFamilyIds: event.relatedPeople,
    };
  }
}

/**
 * Generates an InterviewSession with questions related to the upcoming event.
 * Uses GPT-4o-mini to create contextual interview questions.
 *
 * @param event - The calendar event to generate questions for
 * @returns InterviewSession with event-related questions
 */
async function generateInterviewSession(event: CalendarEvent): Promise<InterviewSession> {
  const sessionId = `cal_session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const eventTypeDescriptions: Record<CalendarEventType, string> = {
    '결혼식': '결혼식과 관련된 기억',
    '졸업': '졸업과 관련된 기억',
    '생일': '생일과 관련된 기억',
    '기념일': '기념일과 관련된 기억',
    '기일': '고인에 대한 추억',
  };

  const systemPrompt = `당신은 어르신의 기억을 이끌어내는 따뜻한 인터뷰어입니다.
다가오는 가족 이벤트와 관련된 인터뷰 질문을 생성해주세요.

규칙:
1. 질문은 인물→장소→감정→사건→시간 순서로 구성하세요.
2. 따뜻하고 공감적인 말투를 사용하세요.
3. 한 번에 하나의 질문만 포함하세요.
4. 어르신이 편안하게 답할 수 있는 열린 질문을 만드세요.
5. 정확히 5개의 질문을 생성하세요.

다음 JSON 형식으로만 응답하세요:
{
  "questions": ["질문1", "질문2", "질문3", "질문4", "질문5"]
}`;

  const userPrompt = `다가오는 이벤트: ${event.eventType} - "${event.title}" (${event.date})
관련 인물: ${event.relatedPeople.join(', ')}
이벤트 설명: ${event.description}
주제: ${eventTypeDescriptions[event.eventType]}

이 이벤트와 관련된 어르신의 기억을 이끌어낼 수 있는 인터뷰 질문 5개를 생성해주세요.`;

  try {
    const response = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      return createFallbackInterviewSession(sessionId, event);
    }

    const parsed = JSON.parse(content);
    const questions: string[] = Array.isArray(parsed.questions)
      ? parsed.questions.filter((q: unknown): q is string => typeof q === 'string')
      : [];

    if (questions.length === 0) {
      return createFallbackInterviewSession(sessionId, event);
    }

    return {
      sessionId,
      questions,
      eventContext: event,
    };
  } catch (error) {
    console.error('Calendar Trigger: Error generating interview session:', error);
    return createFallbackInterviewSession(sessionId, event);
  }
}

/**
 * Creates a fallback interview session with default questions when
 * GPT-4o-mini fails to generate questions.
 */
function createFallbackInterviewSession(
  sessionId: string,
  event: CalendarEvent
): InterviewSession {
  const fallbackQuestions: Record<CalendarEventType, string[]> = {
    '결혼식': [
      `${event.relatedPeople[0] || ''}의 결혼식에 대해 어떤 기억이 있으신가요?`,
      '결혼식 날 어디에서 식을 올렸나요?',
      '그때 어떤 기분이 드셨나요?',
      '결혼식에서 가장 기억에 남는 순간이 있으신가요?',
      '그 시절 결혼식은 어떤 모습이었나요?',
    ],
    '졸업': [
      `${event.relatedPeople[0] || ''}의 졸업에 대해 어떤 기억이 있으신가요?`,
      '졸업식은 어디에서 했나요?',
      '졸업할 때 어떤 기분이 드셨나요?',
      '학창시절 가장 기억에 남는 일이 있으신가요?',
      '그때가 몇 년도쯤이었나요?',
    ],
    '생일': [
      `${event.relatedPeople[0] || ''}의 생일에 대해 어떤 기억이 있으신가요?`,
      '예전에 생일을 어떻게 보내셨나요?',
      '생일에 특별히 기억나는 일이 있으신가요?',
      '가장 기억에 남는 생일 선물이 있으신가요?',
      '어릴 때 생일은 어떻게 지내셨나요?',
    ],
    '기념일': [
      `${event.relatedPeople[0] || ''}과의 기념일에 대해 어떤 기억이 있으신가요?`,
      '그 기념일을 보통 어디에서 보내셨나요?',
      '기념일에 특별히 기억나는 순간이 있으신가요?',
      '그때 어떤 기분이 드셨나요?',
      '그 기념일이 시작된 계기가 있으신가요?',
    ],
    '기일': [
      `${event.relatedPeople[0] || ''}에 대해 어떤 기억이 있으신가요?`,
      '그분과 함께한 장소 중 기억나는 곳이 있으신가요?',
      '그분을 생각하면 어떤 감정이 드시나요?',
      '그분과의 가장 소중한 추억이 있으신가요?',
      '그분과 마지막으로 함께한 시간이 기억나시나요?',
    ],
  };

  return {
    sessionId,
    questions: fallbackQuestions[event.eventType] || fallbackQuestions['생일'],
    eventContext: event,
  };
}

/**
 * Formats a Date object to an ISO date string (YYYY-MM-DD) for comparison.
 */
function formatDateToISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
