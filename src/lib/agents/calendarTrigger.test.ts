import { describe, expect, it, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import type { CalendarEvent, EventType, MemoryChunk } from '../../types/agents'

const openAIChatCreate = vi.hoisted(() => vi.fn())
const demoModeFlag = vi.hoisted(() => ({ value: false }))

vi.mock('../openai-client', () => ({
  getOpenAIClient: () => ({
    chat: {
      completions: {
        create: openAIChatCreate,
      },
    },
  }),
}))

vi.mock('./config', () => ({
  isDemoMode: () => demoModeFlag.value,
}))

import { processCalendarTrigger } from './calendarTrigger'

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    eventId: 'ev_1',
    eventType: '결혼식',
    eventDate: '2026-08-01',
    relatedPersons: [],
    recipientId: 'family-group',
    ...overrides,
  }
}

function makeChunk(
  chunkId: string,
  text: string,
  persons: string[] = []
): MemoryChunk & { chunkId: string } {
  return {
    chunkId,
    raw: text,
    clean: text,
    tags: {
      ner: { persons, places: [], times: [], events: [] },
      emotions: {
        pride: 0,
        nostalgia: 0,
        regret: 0,
        gratitude: 0,
        loss: 0,
        joy: 0,
        fear: 0,
        peace: 0,
      },
    },
    reliabilityLabel: 'CONFIRMED',
    chapterHint: text,
  }
}

const EVENT_TYPES: EventType[] = ['결혼식', '졸업식', '생일', '기념일', '기일', '입학', '출산']

/** 각 이벤트 타입에서 실제로 chunk 매칭에 쓰이는 키워드 예시 */
const KEYWORD_SAMPLE: Record<EventType, string> = {
  결혼식: '결혼',
  졸업식: '졸업',
  생일: '생일',
  기념일: '기념',
  기일: '기일',
  입학: '입학',
  출산: '출산',
}

function deliveryPayload() {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify({
            triggerType: 'DELIVERY',
            editedStory: {
              text: '결혼식 날의 이야기입니다.',
              sourceChunkIds: ['c1'],
              reliability: 'CONFIRMED',
            },
            suggestedInterviewTopics: ['첫 만남 이야기'],
            matchedChunkIds: ['c1'],
          }),
        },
      },
    ],
  }
}

describe('processCalendarTrigger - 데모 모드', () => {
  beforeEach(() => {
    openAIChatCreate.mockReset()
    demoModeFlag.value = false
  })

  it('데모 모드에서는 AI 호출 없이 고정 INTERVIEW 결과를 준다', async () => {
    demoModeFlag.value = true

    const result = await processCalendarTrigger(
      makeEvent({ eventId: 'ev_demo' }),
      [makeChunk('c1', '결혼 이야기')]
    )

    expect(openAIChatCreate).not.toHaveBeenCalled()
    expect(result).toEqual({
      eventId: 'ev_demo',
      triggerType: 'INTERVIEW',
      editedStory: null,
      suggestedInterviewTopics: ['관련 기억 인터뷰'],
      matchedChunkIds: [],
    })
  })
})

describe('processCalendarTrigger - 관련 기억이 없는 경우', () => {
  beforeEach(() => {
    openAIChatCreate.mockReset()
    demoModeFlag.value = false
  })

  it('chunk가 비어 있으면 AI를 호출하지 않고 인터뷰 주제 3개를 제안한다', async () => {
    const result = await processCalendarTrigger(makeEvent({ eventType: '졸업식' }), [])

    expect(openAIChatCreate).not.toHaveBeenCalled()
    expect(result.triggerType).toBe('INTERVIEW')
    expect(result.editedStory).toBeNull()
    expect(result.matchedChunkIds).toEqual([])
    expect(result.suggestedInterviewTopics).toHaveLength(3)
    expect(result.suggestedInterviewTopics[0]).toBe('졸업식에 얽힌 이야기를 들려주세요')
  })

  it('키워드도 인물도 겹치지 않는 chunk만 있으면 INTERVIEW로 분기한다', async () => {
    const result = await processCalendarTrigger(
      makeEvent({ eventType: '결혼식', relatedPersons: ['어머니'] }),
      [makeChunk('c1', '텃밭에 상추를 심었던 날', ['아버지'])]
    )

    expect(openAIChatCreate).not.toHaveBeenCalled()
    expect(result.triggerType).toBe('INTERVIEW')
    expect(result.matchedChunkIds).toEqual([])
  })

  it('알 수 없는 이벤트 타입은 키워드 매칭 없이 인물 매칭만 사용한다', async () => {
    const unknownEvent = makeEvent({
      eventType: '회의' as EventType,
      relatedPersons: ['어머니'],
    })

    const noMatch = await processCalendarTrigger(unknownEvent, [
      makeChunk('c1', '결혼식에 갔던 이야기', ['아버지']),
    ])
    expect(openAIChatCreate).not.toHaveBeenCalled()
    expect(noMatch.triggerType).toBe('INTERVIEW')

    openAIChatCreate.mockResolvedValueOnce(deliveryPayload())
    const personMatch = await processCalendarTrigger(unknownEvent, [
      makeChunk('c1', '아무 상관 없는 이야기', ['어머니']),
    ])
    expect(openAIChatCreate).toHaveBeenCalledTimes(1)
    expect(personMatch.triggerType).toBe('DELIVERY')
  })
})

describe('processCalendarTrigger - 관련 기억이 있는 경우', () => {
  beforeEach(() => {
    openAIChatCreate.mockReset()
    demoModeFlag.value = false
  })

  it('키워드가 일치하는 chunk만 프롬프트에 담아 AI를 호출한다', async () => {
    openAIChatCreate.mockResolvedValueOnce(deliveryPayload())

    const result = await processCalendarTrigger(makeEvent({ eventId: 'ev_kw' }), [
      makeChunk('hit', '결혼식 날 신부 입장을 기억한다'),
      makeChunk('miss', '텃밭에 상추를 심었던 날'),
    ])

    expect(openAIChatCreate).toHaveBeenCalledTimes(1)
    const request = openAIChatCreate.mock.calls[0][0]
    expect(request.model).toBe('gpt-4o-mini')
    expect(request.max_tokens).toBe(700)
    expect(request.messages[0].role).toBe('system')

    const userPrompt: string = request.messages[1].content
    expect(userPrompt).toContain('"chunkId": "hit"')
    expect(userPrompt).not.toContain('"chunkId": "miss"')

    expect(result.eventId).toBe('ev_kw')
    expect(result.triggerType).toBe('DELIVERY')
    expect(result.editedStory?.sourceChunkIds).toEqual(['c1'])
    expect(result.matchedChunkIds).toEqual(['c1'])
  })

  it('clean 텍스트에만 키워드가 있어도 관련 기억으로 인정한다', async () => {
    openAIChatCreate.mockResolvedValueOnce(deliveryPayload())

    const chunk = makeChunk('c1', 'no korean keyword here')
    chunk.clean = '생일 잔치를 했다'

    const result = await processCalendarTrigger(makeEvent({ eventType: '생일' }), [chunk])

    expect(openAIChatCreate).toHaveBeenCalledTimes(1)
    expect(result.triggerType).toBe('DELIVERY')
  })

  it('relatedPersons가 chunk의 인물 태그와 겹치면 관련 기억으로 인정한다', async () => {
    openAIChatCreate.mockResolvedValueOnce(deliveryPayload())

    const result = await processCalendarTrigger(
      makeEvent({ eventType: '기념일', relatedPersons: ['영자'] }),
      [makeChunk('c1', '아무 관련 없는 문장', ['영자'])]
    )

    expect(openAIChatCreate).toHaveBeenCalledTimes(1)
    expect(result.triggerType).toBe('DELIVERY')
  })
})

describe('processCalendarTrigger - 모델 응답 보정', () => {
  beforeEach(() => {
    openAIChatCreate.mockReset()
    demoModeFlag.value = false
  })

  it('모델이 eventId를 응답에 넣어도 실제 이벤트 eventId를 덮어쓰지 못한다', async () => {
    openAIChatCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              eventId: 'ev_모델이_지어낸_id',
              triggerType: 'DELIVERY',
              editedStory: { text: '이야기', sourceChunkIds: ['hit'], reliability: 'CONFIRMED' },
              suggestedInterviewTopics: [],
              matchedChunkIds: ['hit'],
            }),
          },
        },
      ],
    })

    const result = await processCalendarTrigger(makeEvent({ eventId: 'ev_실제' }), [
      makeChunk('hit', '결혼식 날의 기억'),
    ])

    // CalendarScreen 은 triggerResults[ev.eventId] 로 결과를 찾으므로 eventId가 바뀌면 카드가 사라진다
    expect(result.eventId).toBe('ev_실제')
  })

  it('모델이 필수 필드를 생략해도 렌더가 깨지지 않는 기본값을 채운다', async () => {
    openAIChatCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ triggerType: 'DELIVERY' }) } }],
    })

    const result = await processCalendarTrigger(makeEvent(), [makeChunk('hit', '결혼식 준비')])

    // CalendarScreen 이 렌더 중 .map() 하고 useScheduledCall 이 .slice() 한다
    expect(Array.isArray(result.suggestedInterviewTopics)).toBe(true)
    expect(Array.isArray(result.matchedChunkIds)).toBe(true)
    expect(result.editedStory).toBeNull()
  })

  it('모델이 알 수 없는 triggerType을 주면 INTERVIEW로 정규화한다', async () => {
    openAIChatCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ triggerType: '뭔가_이상한_값' }) } }],
    })

    const result = await processCalendarTrigger(makeEvent(), [makeChunk('hit', '결혼식 준비')])

    expect(result.triggerType).toBe('INTERVIEW')
  })
})

describe('processCalendarTrigger - AI 실패 처리', () => {
  beforeEach(() => {
    openAIChatCreate.mockReset()
    demoModeFlag.value = false
  })

  const failures: Array<[string, () => void]> = [
    ['네트워크 오류', () => openAIChatCreate.mockRejectedValueOnce(new Error('network down'))],
    [
      '빈 content',
      () => openAIChatCreate.mockResolvedValueOnce({ choices: [{ message: { content: '' } }] }),
    ],
    [
      'null content',
      () => openAIChatCreate.mockResolvedValueOnce({ choices: [{ message: { content: null } }] }),
    ],
    [
      'JSON 파싱 불가',
      () =>
        openAIChatCreate.mockResolvedValueOnce({
          choices: [{ message: { content: '```json\n{oops' } }],
        }),
    ],
    ['빈 choices', () => openAIChatCreate.mockResolvedValueOnce({ choices: [] })],
  ]

  for (const [label, setup] of failures) {
    it(`${label}일 때 INTERVIEW 단일 주제로 안전하게 폴백한다`, async () => {
      setup()

      const result = await processCalendarTrigger(
        makeEvent({ eventId: 'ev_fail', eventType: '기일' }),
        [makeChunk('c1', '기일에 모여 제사를 지냈다')]
      )

      expect(openAIChatCreate).toHaveBeenCalledTimes(1)
      expect(result).toEqual({
        eventId: 'ev_fail',
        triggerType: 'INTERVIEW',
        editedStory: null,
        suggestedInterviewTopics: ['기일에 대한 이야기를 들려주세요'],
        matchedChunkIds: [],
      })
    })
  }
})

describe('processCalendarTrigger - 속성 검증', () => {
  beforeEach(() => {
    openAIChatCreate.mockReset()
    demoModeFlag.value = false
  })

  const eventTypeArb = fc.constantFrom(...EVENT_TYPES)
  /** ASCII 전용 텍스트 - 한국어 키워드와 절대 겹치지 않는다 */
  const asciiTextArb = fc.string({ minLength: 1, maxLength: 30 })

  it('AI가 개입하지 않는 모든 경로에서 항상 하나의 INTERVIEW 결과를 준다', async () => {
    await fc.assert(
      fc.asyncProperty(
        eventTypeArb,
        fc.array(fc.tuple(asciiTextArb, asciiTextArb), { maxLength: 5 }),
        fc.array(asciiTextArb.map((s) => `person_${s}`), { maxLength: 3 }),
        async (eventType, chunkTexts, relatedPersons) => {
          const event = makeEvent({ eventId: `ev_${eventType}`, eventType, relatedPersons })
          const chunks = chunkTexts.map(([text, hint], i) =>
            makeChunk(`c${i}`, `${text} ${hint}`, ['tagged_person'])
          )

          const result = await processCalendarTrigger(event, chunks)

          expect(openAIChatCreate).not.toHaveBeenCalled()
          expect(result.eventId).toBe(event.eventId)
          expect(result.triggerType).toBe('INTERVIEW')
          expect(result.editedStory).toBeNull()
          expect(result.matchedChunkIds).toEqual([])
          expect(result.suggestedInterviewTopics.length).toBeGreaterThan(0)
          expect(
            result.suggestedInterviewTopics.every((t) => typeof t === 'string' && t.length > 0)
          ).toBe(true)
        }
      ),
      { numRuns: 25 }
    )
  })

  it('키워드가 일치하면 이벤트 타입과 무관하게 AI 경로를 타고, 실패해도 이벤트 타입이 담긴 폴백을 준다', async () => {
    await fc.assert(
      fc.asyncProperty(eventTypeArb, asciiTextArb, async (eventType, noise) => {
        openAIChatCreate.mockReset()
        openAIChatCreate.mockRejectedValueOnce(new Error('provider unavailable'))

        const event = makeEvent({ eventId: `ev_${eventType}`, eventType })
        const chunk = makeChunk('c1', `${noise} ${KEYWORD_SAMPLE[eventType]} ${noise}`)

        const result = await processCalendarTrigger(event, [chunk])

        expect(openAIChatCreate).toHaveBeenCalledTimes(1)
        expect(result.eventId).toBe(event.eventId)
        expect(result.triggerType).toBe('INTERVIEW')
        expect(result.suggestedInterviewTopics).toEqual([
          `${eventType}에 대한 이야기를 들려주세요`,
        ])
        expect(result.matchedChunkIds).toEqual([])
      }),
      { numRuns: 20 }
    )
  })
})
