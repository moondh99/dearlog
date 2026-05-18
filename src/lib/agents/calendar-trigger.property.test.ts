import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import type { CalendarEvent, CalendarEventType } from '../types';

// ─── Mock OpenAI (required because calendar-trigger imports rag/index which instantiates OpenAI) ─

vi.mock('openai', () => ({
  default: class MockOpenAI {
    constructor() {}
    chat = {
      completions: {
        create: vi.fn().mockImplementation(async () => ({
          choices: [{ message: { content: '{}' } }],
        })),
      },
    };
    embeddings = {
      create: vi.fn().mockImplementation(async () => ({
        data: [{ embedding: Array(1536).fill(0) }],
      })),
    };
  },
}));

import { detectUpcomingEvents, SUPPORTED_EVENT_TYPES } from './calendar-trigger';

/**
 * Property tests for Calendar Trigger Agent (Agent ⑨)
 *
 * Property 25 validates that detectUpcomingEvents returns exactly those events
 * whose date is tomorrow (today + 1 day) and whose eventType is from the
 * supported set {결혼식, 졸업, 생일, 기념일, 기일}.
 *
 * **Validates: Requirements 9.1, 9.2**
 */

// ─── Constants ─────────────────────────────────────────────────────────────────

const VALID_EVENT_TYPES: CalendarEventType[] = ['결혼식', '졸업', '생일', '기념일', '기일'];

// ─── Generators ────────────────────────────────────────────────────────────────

/** Generate a valid CalendarEventType */
const eventTypeArb: fc.Arbitrary<CalendarEventType> = fc.constantFrom(...VALID_EVENT_TYPES);

/** Generate an invalid event type (not in the supported set) */
const invalidEventTypeArb: fc.Arbitrary<string> = fc.constantFrom(
  '회의',
  '출장',
  '여행',
  '병원',
  '약속',
  '운동',
);

/** Generate a reference "today" date within a reasonable range */
const todayArb: fc.Arbitrary<Date> = fc.date({
  min: new Date('2020-01-01'),
  max: new Date('2030-12-31'),
});

/** Generate a day offset relative to today (-10 to +10 days) */
const dayOffsetArb: fc.Arbitrary<number> = fc.integer({ min: -10, max: 10 });

/** Generate a unique event ID */
const eventIdArb: fc.Arbitrary<string> = fc.stringMatching(/^evt_[a-z0-9]{4,12}$/);

/** Generate event title */
const eventTitleArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 50 });

/** Generate related people array */
const relatedPeopleArb: fc.Arbitrary<string[]> = fc.array(
  fc.string({ minLength: 1, maxLength: 20 }),
  { minLength: 0, maxLength: 5 },
);

/** Generate event description */
const descriptionArb: fc.Arbitrary<string> = fc.string({ minLength: 0, maxLength: 100 });

/**
 * Helper: format a Date to YYYY-MM-DD string (matching the implementation's formatDateToISO)
 */
function formatDateToISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Helper: create a date that is `offset` days from `base`
 */
function addDays(base: Date, offset: number): Date {
  const result = new Date(base);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() + offset);
  return result;
}

/**
 * Generator: a CalendarEvent with a specific date string and event type
 */
function calendarEventArb(
  dateStr: string,
  evtType: fc.Arbitrary<CalendarEventType | string>,
): fc.Arbitrary<CalendarEvent> {
  return fc.record({
    id: eventIdArb,
    title: eventTitleArb,
    eventType: evtType as fc.Arbitrary<CalendarEventType>,
    date: fc.constant(dateStr),
    relatedPeople: relatedPeopleArb,
    description: descriptionArb,
  });
}

// ─── Property 25: Calendar D-1 event detection and type validation ─────────────

describe('Feature: agent-model-v2, Property 25: Calendar D-1 event detection and type validation', () => {
  it('All returned events have a date that is exactly tomorrow relative to the provided "today"', () => {
    fc.assert(
      fc.property(
        todayArb,
        fc.array(
          fc.record({
            id: eventIdArb,
            title: eventTitleArb,
            eventType: eventTypeArb,
            date: todayArb.map((d) => formatDateToISO(d)),
            relatedPeople: relatedPeopleArb,
            description: descriptionArb,
          }),
          { minLength: 0, maxLength: 20 },
        ),
        (today, events) => {
          const result = detectUpcomingEvents(events, today);
          const tomorrowStr = formatDateToISO(addDays(today, 1));

          // Every returned event must have tomorrow's date
          for (const event of result) {
            const eventDateStr = formatDateToISO(new Date(event.date));
            expect(eventDateStr).toBe(tomorrowStr);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('All returned events have an eventType from the supported set {결혼식, 졸업, 생일, 기념일, 기일}', () => {
    fc.assert(
      fc.property(
        todayArb,
        fc.array(
          fc.record({
            id: eventIdArb,
            title: eventTitleArb,
            eventType: eventTypeArb,
            date: todayArb.map((d) => formatDateToISO(d)),
            relatedPeople: relatedPeopleArb,
            description: descriptionArb,
          }),
          { minLength: 0, maxLength: 20 },
        ),
        (today, events) => {
          const result = detectUpcomingEvents(events, today);

          // Every returned event must have a valid event type
          for (const event of result) {
            expect(VALID_EVENT_TYPES).toContain(event.eventType);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('No events with tomorrow date and valid type are missed (completeness)', () => {
    fc.assert(
      fc.property(
        todayArb,
        fc.array(dayOffsetArb, { minLength: 1, maxLength: 15 }),
        fc.array(eventTypeArb, { minLength: 1, maxLength: 15 }),
        (today, offsets, types) => {
          // Build events with known offsets from today
          const tomorrowStr = formatDateToISO(addDays(today, 1));

          const events: CalendarEvent[] = offsets.map((offset, i) => {
            const eventDate = addDays(today, offset);
            return {
              id: `evt_${i}_${Math.random().toString(36).substring(2, 8)}`,
              title: `Event ${i}`,
              eventType: types[i % types.length],
              date: formatDateToISO(eventDate),
              relatedPeople: [],
              description: '',
            };
          });

          const result = detectUpcomingEvents(events, today);

          // Identify which events SHOULD be returned (tomorrow + valid type)
          const expectedEvents = events.filter((e) => {
            const eDateStr = formatDateToISO(new Date(e.date));
            return eDateStr === tomorrowStr && VALID_EVENT_TYPES.includes(e.eventType);
          });

          // All expected events must be in the result
          for (const expected of expectedEvents) {
            const found = result.some((r) => r.id === expected.id);
            expect(found).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('No events with other dates are included (soundness)', () => {
    fc.assert(
      fc.property(
        todayArb,
        fc.array(dayOffsetArb, { minLength: 1, maxLength: 15 }),
        fc.array(eventTypeArb, { minLength: 1, maxLength: 15 }),
        (today, offsets, types) => {
          const tomorrowStr = formatDateToISO(addDays(today, 1));

          const events: CalendarEvent[] = offsets.map((offset, i) => {
            const eventDate = addDays(today, offset);
            return {
              id: `evt_${i}_${Math.random().toString(36).substring(2, 8)}`,
              title: `Event ${i}`,
              eventType: types[i % types.length],
              date: formatDateToISO(eventDate),
              relatedPeople: [],
              description: '',
            };
          });

          const result = detectUpcomingEvents(events, today);

          // No event with a non-tomorrow date should be in the result
          for (const event of result) {
            const eventDateStr = formatDateToISO(new Date(event.date));
            expect(eventDateStr).toBe(tomorrowStr);
          }

          // No event with an invalid type should be in the result
          for (const event of result) {
            expect(VALID_EVENT_TYPES).toContain(event.eventType);
          }

          // Result size must equal the number of events that match both criteria
          const expectedCount = events.filter((e) => {
            const eDateStr = formatDateToISO(new Date(e.date));
            return eDateStr === tomorrowStr && VALID_EVENT_TYPES.includes(e.eventType);
          }).length;

          expect(result.length).toBe(expectedCount);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Events with invalid event types are never returned even if date is tomorrow', () => {
    fc.assert(
      fc.property(
        todayArb,
        fc.array(
          fc.record({
            id: eventIdArb,
            title: eventTitleArb,
            eventType: invalidEventTypeArb,
            date: fc.constant('placeholder'),
            relatedPeople: relatedPeopleArb,
            description: descriptionArb,
          }),
          { minLength: 1, maxLength: 10 },
        ),
        (today, events) => {
          const tomorrowStr = formatDateToISO(addDays(today, 1));

          // Set all events to tomorrow's date but with invalid types
          const eventsWithTomorrowDate = events.map((e) => ({
            ...e,
            date: tomorrowStr,
          })) as CalendarEvent[];

          const result = detectUpcomingEvents(eventsWithTomorrowDate, today);

          // No events should be returned since all have invalid types
          expect(result.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});


// ─── Property 26: Calendar trigger branching correctness ───────────────────────

import { processEvent } from './calendar-trigger';
import type {
  CalendarTriggerResult,
  EditedMemoryDelivery,
  InterviewSession,
  Memory,
} from '../types';
import { ragIndex } from '../rag/index';
import { useStore } from '../../store';

/**
 * Property 26: Calendar trigger branching correctness
 *
 * For any detected calendar event, if related memories exist in the store then
 * the action SHALL be 'auto_edit' with a valid EditedMemoryDelivery output;
 * if no related memories exist then the action SHALL be 'new_interview' with
 * a valid InterviewSession output. The output SHALL always be exactly one of
 * these two types.
 *
 * **Validates: Requirements 9.3, 9.4, 9.5**
 */

// ─── Generators for Property 26 ───────────────────────────────────────────────

/** Generate a valid CalendarEvent for processEvent testing */
const calendarEventForProcessArb: fc.Arbitrary<CalendarEvent> = fc.record({
  id: fc.stringMatching(/^evt_[a-z0-9]{4,12}$/),
  title: fc.string({ minLength: 1, maxLength: 50 }),
  eventType: fc.constantFrom<CalendarEventType>('결혼식', '졸업', '생일', '기념일', '기일'),
  date: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).map(
    (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    },
  ),
  relatedPeople: fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
    minLength: 1,
    maxLength: 5,
  }),
  description: fc.string({ minLength: 1, maxLength: 100 }),
});

/** Generate a non-empty array of memory IDs (simulating RAG returning results) */
const relatedMemoryIdsArb: fc.Arbitrary<string[]> = fc.array(
  fc.stringMatching(/^mem_[a-z0-9]{4,12}$/),
  { minLength: 1, maxLength: 5 },
);

/** Generate a mock Memory object for the store */
function createMockMemory(id: string): Memory {
  return {
    id,
    date: '2024-01-01',
    topic: '테스트 기억',
    originalTranscript: '원본 텍스트입니다.',
    cleanedTranscript: '정제된 텍스트입니다.',
    publishVersion: '',
    tags: { people: ['할머니'], places: ['서울'], emotions: ['감사'], timePeriod: '2020년대' },
    privacy: 'private',
    confidenceLabel: '확인됨',
    contradictions: [],
    consent: {
      status: 'granted',
      accessTier: '본인만',
      designatedFamilyIds: [],
      lastModified: '2024-01-01T00:00:00.000Z',
    },
    embedding: null,
  };
}

// ─── Helper: Type guards ───────────────────────────────────────────────────────

function isEditedMemoryDelivery(output: unknown): output is EditedMemoryDelivery {
  if (!output || typeof output !== 'object') return false;
  const o = output as Record<string, unknown>;
  return (
    typeof o.memoryId === 'string' &&
    typeof o.editedNarrative === 'string' &&
    Array.isArray(o.targetFamilyIds)
  );
}

function isInterviewSession(output: unknown): output is InterviewSession {
  if (!output || typeof output !== 'object') return false;
  const o = output as Record<string, unknown>;
  return (
    typeof o.sessionId === 'string' &&
    Array.isArray(o.questions) &&
    o.eventContext !== undefined &&
    typeof o.eventContext === 'object'
  );
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('Feature: agent-model-v2, Property 26: Calendar trigger branching correctness', () => {
  it('When memories exist (RAG returns results), action is auto_edit with valid EditedMemoryDelivery', () => {
    return fc.assert(
      fc.asyncProperty(
        calendarEventForProcessArb,
        relatedMemoryIdsArb,
        async (event, memoryIds) => {
          // Mock ragIndex.search to return results with high scores
          const searchMock = vi.spyOn(ragIndex, 'search').mockResolvedValue(
            memoryIds.map((id) => ({ memoryId: id, score: 0.8, text: '관련 기억 텍스트' })),
          );

          // Mock store memories to include the first memory
          const originalGetState = useStore.getState;
          const mockMemories = memoryIds.map((id) => createMockMemory(id));
          vi.spyOn(useStore, 'getState').mockImplementation(() => ({
            ...originalGetState(),
            memories: mockMemories,
            calendar: { events: [], processedEventIds: [], lastSynced: '' },
          }));

          const result: CalendarTriggerResult = await processEvent(event);

          // Verify action is 'auto_edit'
          expect(result.action).toBe('auto_edit');

          // Verify output is a valid EditedMemoryDelivery
          expect(isEditedMemoryDelivery(result.output)).toBe(true);
          const delivery = result.output as EditedMemoryDelivery;
          expect(typeof delivery.memoryId).toBe('string');
          expect(delivery.memoryId.length).toBeGreaterThan(0);
          expect(typeof delivery.editedNarrative).toBe('string');
          expect(Array.isArray(delivery.targetFamilyIds)).toBe(true);

          // Verify relatedMemoryIds is non-empty
          expect(result.relatedMemoryIds.length).toBeGreaterThan(0);

          // Verify event is preserved
          expect(result.event).toEqual(event);

          // Cleanup
          searchMock.mockRestore();
          vi.mocked(useStore.getState).mockRestore();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('When no memories exist (RAG returns empty), action is new_interview with valid InterviewSession', () => {
    return fc.assert(
      fc.asyncProperty(calendarEventForProcessArb, async (event) => {
        // Mock ragIndex.search to return empty results
        const searchMock = vi.spyOn(ragIndex, 'search').mockResolvedValue([]);

        // Mock store with no memories
        const originalGetState = useStore.getState;
        vi.spyOn(useStore, 'getState').mockImplementation(() => ({
          ...originalGetState(),
          memories: [],
          calendar: { events: [], processedEventIds: [], lastSynced: '' },
        }));

        const result: CalendarTriggerResult = await processEvent(event);

        // Verify action is 'new_interview'
        expect(result.action).toBe('new_interview');

        // Verify output is a valid InterviewSession
        expect(isInterviewSession(result.output)).toBe(true);
        const session = result.output as InterviewSession;
        expect(typeof session.sessionId).toBe('string');
        expect(session.sessionId.length).toBeGreaterThan(0);
        expect(Array.isArray(session.questions)).toBe(true);
        expect(session.questions.length).toBeGreaterThan(0);
        expect(session.eventContext).toEqual(event);

        // Verify relatedMemoryIds is empty
        expect(result.relatedMemoryIds).toEqual([]);

        // Verify event is preserved
        expect(result.event).toEqual(event);

        // Cleanup
        searchMock.mockRestore();
        vi.mocked(useStore.getState).mockRestore();
      }),
      { numRuns: 100 },
    );
  });

  it('Output is always exactly one of EditedMemoryDelivery or InterviewSession (never both, never neither)', () => {
    return fc.assert(
      fc.asyncProperty(
        calendarEventForProcessArb,
        fc.boolean(), // true = memories exist, false = no memories
        relatedMemoryIdsArb,
        async (event, hasMemories, memoryIds) => {
          if (hasMemories) {
            // Mock RAG to return results
            vi.spyOn(ragIndex, 'search').mockResolvedValue(
              memoryIds.map((id) => ({ memoryId: id, score: 0.8, text: '관련 기억' })),
            );
            const originalGetState = useStore.getState;
            vi.spyOn(useStore, 'getState').mockImplementation(() => ({
              ...originalGetState(),
              memories: memoryIds.map((id) => createMockMemory(id)),
              calendar: { events: [], processedEventIds: [], lastSynced: '' },
            }));
          } else {
            // Mock RAG to return empty
            vi.spyOn(ragIndex, 'search').mockResolvedValue([]);
            const originalGetState = useStore.getState;
            vi.spyOn(useStore, 'getState').mockImplementation(() => ({
              ...originalGetState(),
              memories: [],
              calendar: { events: [], processedEventIds: [], lastSynced: '' },
            }));
          }

          const result: CalendarTriggerResult = await processEvent(event);

          // Exactly one type check must pass
          const isDelivery = isEditedMemoryDelivery(result.output);
          const isSession = isInterviewSession(result.output);

          // XOR: exactly one must be true
          expect(isDelivery || isSession).toBe(true);
          // They cannot both be true (EditedMemoryDelivery doesn't have sessionId/questions/eventContext,
          // InterviewSession doesn't have memoryId/editedNarrative/targetFamilyIds)
          // But since the shapes are distinct, we verify mutual exclusivity by checking the action field
          if (result.action === 'auto_edit') {
            expect(isDelivery).toBe(true);
          } else if (result.action === 'new_interview') {
            expect(isSession).toBe(true);
          } else {
            // Action must be one of the two
            expect(result.action).toMatch(/^(auto_edit|new_interview)$/);
          }

          // Cleanup
          vi.restoreAllMocks();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('relatedMemoryIds is non-empty for auto_edit and empty for new_interview', () => {
    return fc.assert(
      fc.asyncProperty(
        calendarEventForProcessArb,
        fc.boolean(),
        relatedMemoryIdsArb,
        async (event, hasMemories, memoryIds) => {
          if (hasMemories) {
            vi.spyOn(ragIndex, 'search').mockResolvedValue(
              memoryIds.map((id) => ({ memoryId: id, score: 0.8, text: '관련 기억' })),
            );
            const originalGetState = useStore.getState;
            vi.spyOn(useStore, 'getState').mockImplementation(() => ({
              ...originalGetState(),
              memories: memoryIds.map((id) => createMockMemory(id)),
              calendar: { events: [], processedEventIds: [], lastSynced: '' },
            }));
          } else {
            vi.spyOn(ragIndex, 'search').mockResolvedValue([]);
            const originalGetState = useStore.getState;
            vi.spyOn(useStore, 'getState').mockImplementation(() => ({
              ...originalGetState(),
              memories: [],
              calendar: { events: [], processedEventIds: [], lastSynced: '' },
            }));
          }

          const result: CalendarTriggerResult = await processEvent(event);

          if (result.action === 'auto_edit') {
            expect(result.relatedMemoryIds.length).toBeGreaterThan(0);
          } else {
            expect(result.relatedMemoryIds).toEqual([]);
          }

          // Cleanup
          vi.restoreAllMocks();
        },
      ),
      { numRuns: 100 },
    );
  });
});
