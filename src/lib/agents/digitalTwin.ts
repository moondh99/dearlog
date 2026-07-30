import { isDemoMode } from './config'
import { getOpenAIClient } from '../openai-client'
import type { MemoryChunk, ToneProfile, DigitalTwinResult } from '../../types/agents'
import type { Memory } from '../types'

const SYSTEM_PROMPT = `당신은 시니어의 디지털 페르소나입니다.
제공된 memory chunks만을 근거로 시니어의 말투로 응답합니다.

질문 유형:
- fact: 사실 확인 ("언제", "어디서", "누가")
- recall: 기억 회상 ("어떠셨나요", "기억하시나요")
- value: 가치관/교훈 ("어떻게 생각하세요", "무엇이 중요한가요")
- person: 인물 관련 ("~는 어떤 사람이었나요")

기억이 없거나 기록 밖의 일반 지식/시사 질문일 때:
"그건 내가 남겨둔 이야기에는 없어. 없는 이야기를 아는 척 말하진 않을게. 내가 겪은 일이나 좋아했던 것에 대해 물어보면, 남아 있는 기록으로 차근차근 들려줄게."

절대 금지:
- memory chunk에 없는 내용 창작
- 추측성 응답 ("~이었을 것 같아요")
- 기록 밖의 인물, 정치, 시사, 일반 지식 질문에 답변하지 않기

반드시 JSON 형식으로만 응답하세요:
{
  "responseText": "시니어 말투 응답",
  "questionType": "recall",
  "evidenceBadge": {
    "usedChunkIds": [],
    "reliability": "CONFIRMED",
    "note": "근거 설명"
  },
  "fallbackTriggered": false,
  "suggestedInterviewTopic": "추가 주제 (없으면 생략)"
}`

const DEMO_RESULT: DigitalTwinResult = {
  responseText: '아이고, 그때 생각이 나네요. 참 소중한 기억이에요.',
  questionType: 'recall',
  evidenceBadge: { usedChunkIds: [], reliability: 'CONFIRMED', note: '데모 응답' },
  fallbackTriggered: false,
}

const NO_EVIDENCE_RESPONSE_TEXT = '그건 내가 남겨둔 이야기에는 없어. 없는 이야기를 아는 척 말하진 않을게. 내가 겪은 일이나 좋아했던 것에 대해 물어보면, 남아 있는 기록으로 차근차근 들려줄게.'

const EMPTY_EMOTIONS = {
  pride: 0,
  nostalgia: 0,
  regret: 0,
  gratitude: 0,
  loss: 0,
  joy: 0,
  fear: 0,
  peace: 0,
}

const STOPWORDS = new Set([
  '이야기',
  '기억',
  '대해',
  '대해서',
  '어떤',
  '무엇',
  '뭐야',
  '들려줘',
  '설명해줘',
  '알려줘',
  '부모님',
  '어르신',
  '님의',
])

const DOMAIN_KEYWORDS = [
  '취미',
  '활동',
  '즐거움',
  '좋아',
  '음식',
  '놀이',
  '학교',
  '직장',
  '일',
  '가족',
  '결혼',
  '친구',
  '부모',
  '고향',
  '태어',
  '시장',
  '월급',
  '사진',
]

function toReliabilityLabel(confidenceLabel: string): MemoryChunk['reliabilityLabel'] {
  if (confidenceLabel.includes('미확인')) return 'UNVERIFIED'
  if (confidenceLabel.includes('확인됨')) return 'CONFIRMED'
  if (confidenceLabel.includes('추정') || confidenceLabel.includes('확인 필요')) return 'ESTIMATED'
  return 'ESTIMATED'
}

function emotionScores(emotions: string[]): MemoryChunk['tags']['emotions'] {
  const scores = { ...EMPTY_EMOTIONS }
  for (const emotion of emotions) {
    if (emotion.includes('감사') || emotion.includes('고마움')) scores.gratitude = 1
    if (emotion.includes('그리움') || emotion.includes('향수')) scores.nostalgia = 1
    if (emotion.includes('자부') || emotion.includes('뿌듯')) scores.pride = 1
    if (emotion.includes('기쁨') || emotion.includes('즐거움')) scores.joy = 1
    if (emotion.includes('후회') || emotion.includes('미안')) scores.regret = 1
    if (emotion.includes('상실') || emotion.includes('슬픔')) scores.loss = 1
    if (emotion.includes('두려움') || emotion.includes('긴장')) scores.fear = 1
    if (emotion.includes('평온') || emotion.includes('차분')) scores.peace = 1
  }
  return scores
}

export function buildMemoryChunksFromMemories(
  memories: Memory[]
): Array<MemoryChunk & { chunkId: string }> {
  return memories
    .filter((memory) => {
      const chatbotConsent = String(memory.consentSettings?.챗봇 ?? 'granted')
      return chatbotConsent !== 'revoked' && memory.consent?.status !== 'revoked'
    })
    .map((memory) => {
      const raw = (memory.originalTranscript || memory.cleanedTranscript || memory.publishVersion || '').trim()
      const clean = (memory.cleanedTranscript || memory.publishVersion || raw).trim()
      return {
        chunkId: memory.id,
        raw,
        clean,
        tags: {
          ner: {
            persons: memory.tags?.people ?? [],
            places: memory.tags?.places ?? [],
            times: memory.tags?.timePeriod ? [memory.tags.timePeriod] : [],
            events: memory.topic ? [memory.topic] : [],
          },
          emotions: emotionScores(memory.tags?.emotions ?? []),
        },
        reliabilityLabel: toReliabilityLabel(String(memory.confidenceLabel ?? '추정')),
        chapterHint: memory.topic,
      }
    })
    .filter((chunk) => chunk.raw.length > 0 || chunk.clean.length > 0)
}

function stripKoreanParticle(token: string) {
  return token.replace(/(에서|에게|으로|한테|께|하고|부터|까지|이나|나|은|는|이|가|을|를|에|의|와|과|도|만|로|랑)$/u, '')
}

function tokenize(text: string) {
  return text
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((token) => stripKoreanParticle(token.trim()))
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token))
}

function expandQueryTokens(tokens: string[]) {
  const expanded = new Set(tokens)
  for (const token of tokens) {
    for (const keyword of DOMAIN_KEYWORDS) {
      if (token !== keyword && token.includes(keyword)) expanded.add(keyword)
    }
  }
  return [...expanded]
}

function searchableChunkText(chunk: MemoryChunk & { chunkId: string }) {
  return [
    chunk.raw,
    chunk.clean,
    chunk.chapterHint,
    ...chunk.tags.ner.persons,
    ...chunk.tags.ner.places,
    ...chunk.tags.ner.times,
    ...chunk.tags.ner.events,
  ]
    .join(' ')
    .toLocaleLowerCase()
}

function classifyQuestionType(userQuestion: string): DigitalTwinResult['questionType'] {
  if (/(언제|어디|누가|몇\s*살|몇\s*년|무슨\s*일)/.test(userQuestion)) return 'fact'
  if (/(어떻게\s*생각|무엇이\s*중요|교훈|가치|의미|왜)/.test(userQuestion)) return 'value'
  if (/(어머니|아버지|엄마|아빠|가족|친구|선생님|남편|아내|딸|아들|손주|사람)/.test(userQuestion)) return 'person'
  return 'recall'
}

function truncateForChat(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1).trim()}…`
}

function buildNoEvidenceResponse(userQuestion: string): DigitalTwinResult {
  return {
    responseText: NO_EVIDENCE_RESPONSE_TEXT,
    questionType: classifyQuestionType(userQuestion),
    evidenceBadge: { usedChunkIds: [], reliability: 'UNVERIFIED', note: '기록에 근거 없음' },
    fallbackTriggered: true,
  }
}

function parseDigitalTwinJson(content: string): DigitalTwinResult {
  const trimmed = content.trim()
  if (!trimmed) throw new Error('Empty response')

  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  const candidate = fenced?.[1]?.trim() ?? trimmed
  const firstBrace = candidate.indexOf('{')
  const lastBrace = candidate.lastIndexOf('}')
  const jsonText = firstBrace >= 0 && lastBrace > firstBrace
    ? candidate.slice(firstBrace, lastBrace + 1)
    : candidate

  return JSON.parse(jsonText) as DigitalTwinResult
}

function normalizeDigitalTwinResult(result: DigitalTwinResult): DigitalTwinResult {
  const usedChunkIds = Array.isArray(result.evidenceBadge?.usedChunkIds)
    ? Array.from(new Set(result.evidenceBadge.usedChunkIds.filter((chunkId): chunkId is string => typeof chunkId === 'string' && chunkId.length > 0)))
    : []
  return {
    ...result,
    questionType: ['fact', 'recall', 'value', 'person'].includes(result.questionType)
      ? result.questionType
      : 'recall',
    evidenceBadge: {
      usedChunkIds,
      reliability: result.evidenceBadge?.reliability ?? 'ESTIMATED',
      note: result.evidenceBadge?.note ?? '저장된 기억을 근거로 답했습니다.',
    },
    responseText: usedChunkIds.length === 0 && result.fallbackTriggered
      ? NO_EVIDENCE_RESPONSE_TEXT
      : result.responseText,
    fallbackTriggered: usedChunkIds.length > 0 ? false : Boolean(result.fallbackTriggered),
  }
}

function buildGroundedFallbackResponse(
  userQuestion: string,
  validChunks: Array<MemoryChunk & { chunkId: string }>
): DigitalTwinResult {
  const primary = validChunks[0]
  const rawText = primary?.raw || primary?.clean || ''
  const sourceText = truncateForChat(rawText, 300)
  const chapterHint = primary?.chapterHint ? `${primary.chapterHint}에 남아 있는 이야기` : '저장된 이야기'
  const responseText = sourceText
    ? `${chapterHint}를 보면 이렇게 말씀드릴 수 있어요. ${sourceText}`
    : buildNoEvidenceResponse(userQuestion).responseText

  return {
    responseText,
    questionType: classifyQuestionType(userQuestion),
    evidenceBadge: {
      usedChunkIds: primary ? [primary.chunkId] : [],
      reliability: primary?.reliabilityLabel ?? 'UNVERIFIED',
      note: primary
        ? 'AI 응답이 비어 있어 저장된 원문으로 답했습니다.'
        : '근거 기억 없음',
    },
    fallbackTriggered: !primary,
  }
}

export function selectRelevantMemoryChunks(
  userQuestion: string,
  memoryChunks: Array<MemoryChunk & { chunkId: string }>,
  limit = 5
) {
  if (memoryChunks.length <= limit) return memoryChunks

  const queryTokens = expandQueryTokens(tokenize(userQuestion))
  if (queryTokens.length === 0) return memoryChunks.slice(0, limit)

  const scored = memoryChunks.map((chunk, index) => {
    const source = searchableChunkText(chunk)
    const sourceTokens = new Set(tokenize(source))
    const score = queryTokens.reduce((sum, token) => {
      const exactTokenScore = sourceTokens.has(token) ? 3 : 0
      const substringScore = source.includes(token) ? 2 : 0
      return sum + Math.max(exactTokenScore, substringScore)
    }, 0)
    return { chunk, index, score }
  })

  const hasMatch = scored.some((item) => item.score > 0)
  return scored
    .sort((a, b) => {
      if (hasMatch && b.score !== a.score) return b.score - a.score
      return a.index - b.index
    })
    .slice(0, limit)
    .map((item) => item.chunk)
}

export async function generatePersonaResponse(
  userQuestion: string,
  memoryChunks: Array<MemoryChunk & { chunkId: string }>,
  toneProfile: ToneProfile
): Promise<DigitalTwinResult> {
  if (isDemoMode()) return DEMO_RESULT

  try {
    const client = getOpenAIClient()
    const validChunks = selectRelevantMemoryChunks(
      userQuestion,
      memoryChunks.filter((c) => c.reliabilityLabel !== 'UNVERIFIED'),
      5
    )

    if (validChunks.length === 0) {
      return buildNoEvidenceResponse(userQuestion)
    }

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_completion_tokens: 1000,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `말투 프로필: ${JSON.stringify(toneProfile)}\n\n기억 chunks:\n${JSON.stringify(validChunks, null, 2)}\n\n질문: ${userQuestion}`,
        },
      ],
    })
    const content = response.choices[0].message.content
    if (!content) return buildGroundedFallbackResponse(userQuestion, validChunks)
    return normalizeDigitalTwinResult(parseDigitalTwinJson(content))
  } catch {
    const validChunks = selectRelevantMemoryChunks(
      userQuestion,
      memoryChunks.filter((c) => c.reliabilityLabel !== 'UNVERIFIED'),
      5
    )
    if (validChunks.length > 0) {
      return buildGroundedFallbackResponse(userQuestion, validChunks)
    }
    return buildNoEvidenceResponse(userQuestion)
  }
}
