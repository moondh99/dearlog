import { isDemoMode } from './config'
import { getOpenAIClient } from '../openai-client'
import type { MemoryChunk, CalendarEvent, CalendarTriggerResult } from '../../types/agents'

const EVENT_KEYWORDS: Record<string, string[]> = {
  결혼식: ['결혼', '혼인', '부부', '신랑', '신부', '배우자'],
  졸업식: ['졸업', '학교', '학업', '공부'],
  생일: ['생일', '태어', '나이', '돌'],
  기념일: ['기념', '주년', '추억'],
  기일: ['돌아가신', '별세', '기일', '추모'],
  입학: ['입학', '학교', '시작'],
  출산: ['출산', '태어', '아이', '자녀'],
}

const SYSTEM_PROMPT = `당신은 캘린더 이벤트와 기억 아카이브를 연결하는 AI입니다.

역할:
- 이벤트와 관련된 memory chunk를 바탕으로 이야기를 편집하거나 인터뷰 주제를 생성합니다.

편집 형식 (DELIVERY):
- 도입부·본문·마무리 구조
- 200~400자
- 시니어의 따뜻한 말투

절대 금지:
- chunk 없는 내용 창작
- 추측성 이야기 생성

반드시 JSON 형식으로만 응답하세요:
{
  "triggerType": "DELIVERY",
  "editedStory": {
    "text": "편집된 이야기",
    "sourceChunkIds": ["chunk_id"],
    "reliability": "CONFIRMED"
  },
  "suggestedInterviewTopics": ["주제1"],
  "matchedChunkIds": ["chunk_id"]
}`

export async function processCalendarTrigger(
  event: CalendarEvent,
  memoryChunks: Array<MemoryChunk & { chunkId: string }>
): Promise<CalendarTriggerResult> {
  if (isDemoMode()) {
    return {
      eventId: event.eventId,
      triggerType: 'INTERVIEW',
      editedStory: null,
      suggestedInterviewTopics: ['관련 기억 인터뷰'],
      matchedChunkIds: [],
    }
  }

  const keywords = EVENT_KEYWORDS[event.eventType] || []
  const relatedChunks = memoryChunks.filter(
    (c) =>
      keywords.some((k) => c.raw.includes(k) || c.clean.includes(k)) ||
      event.relatedPersons.some((p) => c.tags.ner.persons.includes(p))
  )

  if (relatedChunks.length === 0) {
    return {
      eventId: event.eventId,
      triggerType: 'INTERVIEW',
      editedStory: null,
      suggestedInterviewTopics: [
        `${event.eventType}에 얽힌 이야기를 들려주세요`,
        '그때 함께한 사람들을 기억하시나요?',
        '그 날의 감정이 어떠셨나요?',
      ],
      matchedChunkIds: [],
    }
  }

  try {
    const client = getOpenAIClient()
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 700,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `이벤트: ${JSON.stringify(event)}\n\n관련 기억 chunks:\n${JSON.stringify(relatedChunks, null, 2)}`,
        },
      ],
    })
    const content = response.choices[0].message.content
    if (!content) throw new Error('Empty response')
    const result = JSON.parse(content)
    // 모델 응답을 그대로 신뢰하지 않는다. eventId 는 스프레드 뒤에 두어 응답이 덮어쓰지 못하게 하고,
    // 나머지 필드는 기본값을 채운다. CalendarScreen 이 suggestedInterviewTopics.map() 을 렌더 중 호출하므로
    // 모델이 필드를 생략하면 화면이 throw 한다.
    return {
      ...result,
      eventId: event.eventId,
      triggerType: result.triggerType === 'DELIVERY' ? 'DELIVERY' : 'INTERVIEW',
      editedStory: result.editedStory ?? null,
      suggestedInterviewTopics: Array.isArray(result.suggestedInterviewTopics)
        ? result.suggestedInterviewTopics
        : [],
      matchedChunkIds: Array.isArray(result.matchedChunkIds) ? result.matchedChunkIds : [],
    }
  } catch {
    return {
      eventId: event.eventId,
      triggerType: 'INTERVIEW',
      editedStory: null,
      suggestedInterviewTopics: [`${event.eventType}에 대한 이야기를 들려주세요`],
      matchedChunkIds: [],
    }
  }
}
