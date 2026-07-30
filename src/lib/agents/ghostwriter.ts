import { v4 as uuidv4 } from 'uuid'
import { isDemoMode } from './config'
import { getOpenAIClient } from '../openai-client'
import type { MemoryChunk, ToneProfile, GhostwriterResult, Paragraph } from '../../types/agents'

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

export interface TranscriptLike {
  id: string
  chapterId: string
  chapterTitle?: string | null
  questionText?: string | null
  originalText?: string | null
  aiSummary?: string | null
}

/**
 * 서버에서 내려온 인터뷰 기록(transcript)을 고스트라이터 입력용 MemoryChunk로 변환한다.
 * 기존에는 transcript.chunk(거의 항상 undefined)에 의존해 실제 답변이 있어도
 * 빈 chunk만 전달되어 자서전이 비어버리는 문제가 있었다.
 */
export function buildMemoryChunksFromTranscripts(
  transcripts: TranscriptLike[]
): Array<MemoryChunk & { chunkId: string }> {
  return transcripts
    .map((t) => {
      const raw = (t.originalText ?? '').trim()
      const clean = (t.aiSummary ?? '').trim() || raw
      const chapterTitle = (t.chapterTitle ?? '').trim()
      const questionText = (t.questionText ?? '').trim()
      return { t, raw, clean, chapterTitle, questionText }
    })
    .filter(({ raw, clean }) => raw.length > 0 || clean.length > 0)
    .map(({ t, raw, clean, chapterTitle, questionText }) => ({
      chunkId: t.id,
      raw: raw || clean,
      clean,
      tags: {
        ner: { persons: [], places: [], times: [], events: questionText ? [questionText] : [] },
        emotions: { ...EMPTY_EMOTIONS },
      },
      reliabilityLabel: 'UNVERIFIED' as const,
      chapterHint: [chapterTitle || t.chapterId, questionText].filter(Boolean).join(' · '),
    }))
}

const CHAPTER_KEYWORDS: Record<string, string[]> = {
  ch1: ['어린시절', '초등', '유년', '태어', '부모', '형제', '어머니', '아버지'],
  ch2: ['청년', '20대', '30대', '직장', '일', '사회', '첫 직장', '월급'],
  ch3: ['가족', '결혼', '자녀', '아이', '배우자', '부인', '남편'],
  ch4: ['전환점', '변화', '결정', '위기', '극복', '도전'],
  ch5: ['지혜', '교훈', '메시지', '조언', '바람', '마지막'],
}

const SYSTEM_PROMPT = `당신은 자서전 초안을 작성하는 고스트라이터 AI입니다.
제공된 memory chunks만을 근거로 챕터 문단을 생성합니다.

문체 규칙:
- 사용자 메시지의 "선택 문체 지침"과 "말투 프로필"을 최우선으로 반영
- 문단당 150~300자
- 시니어의 말투와 온도를 살리되, 선택된 문체 밖으로 벗어나지 않기
- 같은 챕터 안에서 문단 시작, 인용 도입, 마무리 문형을 반복하지 않기
- "기록에는", "기록에 따르면", "되어 있어", "적혀 있어", "말을 들었고", "오래 남았습니다", "배운 시간입니다" 같은 보고서식 틀을 반복하지 않기
- source chunk가 같은 문장틀로 되어 있더라도 장면, 행동, 감정, 인용의 순서를 문단마다 다르게 배열하기

절대 금지:
- chunk에 없는 사실 추가
- UNVERIFIED chunk 단정 서술
- 감정 과장 또는 미화

반드시 JSON 형식으로만 응답하세요:
{
  "paragraphs": [
    {
      "paragraphId": "uuid",
      "text": "문단 텍스트",
      "sourceChunkIds": ["chunk_id"],
      "reliability": "CONFIRMED",
      "uncertaintyNote": "불확실한 부분 (없으면 생략)"
    }
  ],
  "missingSections": ["아직 기록되지 않은 구간"],
  "toneProfile": {
    "name": "말투 특징명",
    "patterns": ["특징 패턴1"]
  }
}`

export function getToneInstruction(toneProfile: ToneProfile) {
  if (toneProfile.name.includes('뉴스')) {
    return [
      '뉴스 기사 형태로 작성합니다.',
      '3인칭 중심, 사실 중심, 객관적이고 정리된 문장을 사용합니다.',
      '감탄, 과장, 지나친 감상 표현을 줄이고 담백한 보도문처럼 씁니다.',
      '"기록에 따르면", "기록은", "중심으로 전개된다" 같은 기사 도입 공식을 반복하지 않습니다.',
      '각 문단은 장소, 사건, 인물, 의미 중 서로 다른 요소로 시작합니다.',
      '예: "현정은 식품영양학과를 졸업한 뒤, 외국계 회사에서 첫 사회생활을 시작했다."',
    ].join('\n')
  }

  if (toneProfile.name.includes('인터뷰')) {
    return [
      '인터뷰 형태로 작성합니다.',
      '1인칭 회상과 구술체를 중심으로, 어르신이 직접 들려주는 듯한 문장을 사용합니다.',
      '문장은 자연스럽고 생생하게 쓰되, 질문자 표현은 넣지 않습니다.',
      '"기록에는", "되어 있어", "적혀 있어"처럼 남의 기록을 읽는 표현을 피하고, 직접 떠올려 말하는 문장으로 씁니다.',
      '모든 인용을 "라는 말을 들었고"로 연결하지 말고, 말의 여운이나 당시 행동으로 자연스럽게 이어갑니다.',
      '예: "처음엔 참 많이 긴장했어. 그래도 어렵게 시작한 일이니까 잘해보고 싶었지."',
    ].join('\n')
  }

  return [
    '이야기책 형태로 작성합니다.',
    '따뜻한 서술형 문장으로 장면, 감정, 시간의 흐름을 자연스럽게 연결합니다.',
    '자서전처럼 읽히되, 제공된 기억의 사실 범위를 넘지 않습니다.',
    '"앞에 두고", "오래 남았습니다", "배운 시간입니다" 같은 결말 공식을 반복하지 않습니다.',
    '장면 묘사, 행동, 인용, 감정의 순서를 바꾸어 문단마다 리듬을 다르게 만듭니다.',
    '예: "현정은 처음 일을 시작하던 날, 설렘과 걱정을 함께 안고 회사로 향했습니다."',
  ].join('\n')
}

function makeDemoResult(chapterId: string, chapterTitle: string, toneProfile: ToneProfile): GhostwriterResult {
  return {
    chapterId,
    chapterTitle,
    paragraphs: [
      {
        paragraphId: uuidv4(),
        text: '그 시절의 이야기를 들려주셨습니다. 소중한 기억들이 차곡차곡 쌓여가고 있습니다.',
        sourceChunkIds: [],
        reliability: 'CONFIRMED',
      },
    ],
    missingSections: [],
    toneProfile,
  }
}

type SceneMemory = {
  setting: string
  people: string
  object: string
  quote: string
  action: string
  emotion: string
  message: string
}

function compactText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function cleanFallbackSourceText(value: string) {
  return compactText(value)
    .replace(/^[^.!?。]{0,80}(?:을|를) 보면,\s*/, '')
    .replace(/기록에는\s*/g, '')
    .replace(/기록에 따르면,?\s*/g, '')
    .replace(/되어 있어요?/g, '남아 있어요')
    .replace(/적혀 있어요?/g, '남아 있어요')
    .replace(/라는 말을 들었고/g, '라는 말이 남았고')
    .replace(/앞에 두고/g, '곁에 두고')
}

function extractSceneMemory(value: string): SceneMemory | null {
  const text = compactText(value)
  const source = text.replace(/^[^.!?。]{0,90}(?:을|를) 보면,\s*/, '')
  const match = source.match(
    /^(.+?)에서\s+(.+?)(?:와|과|하고)\s+함께했던 일이 또렷합니다\.\s+(.+?)(?:을|를)\s+앞에 두고\s+"([^"]+)"라는 말을 들었고,\s+그때\s+(.+?)(?:이|가)\s+오래 남았습니다\.\s+지금 돌아보면 그 장면은 제 삶에서\s+(.+?)(?:을|를)\s+배운 시간입니다\.?\s*(.*)$/
  )
  if (!match) return null

  return {
    setting: match[1],
    people: match[2],
    object: match[3],
    quote: match[4],
    action: match[5],
    emotion: match[6],
    message: match[7],
  }
}

function composeFallbackScene(chapterTitle: string, scene: SceneMemory, toneProfile: ToneProfile, index: number) {
  if (toneProfile.name.includes('뉴스')) {
    const variants = [
      `${scene.setting}의 장면에는 ${scene.people}, ${scene.object}, 그리고 "${scene.quote}"라는 말이 함께 놓여 있었다. ${scene.action}은 ${chapterTitle}의 흐름 속에서 ${scene.emotion}을 남긴 사건으로 정리된다.`,
      `${chapterTitle}의 또 다른 단면은 ${scene.setting}에서 드러난다. ${scene.object}를 사이에 두고 남은 "${scene.quote}"는 ${scene.action}으로 이어졌고, 가족에게 전할 기준을 보여준다.`,
      `${scene.setting}에서 이어진 ${scene.action}은 ${scene.emotion}의 기억으로 남았다. ${scene.people}와 함께한 이 장면은 "${scene.quote}"라는 말로 요약된다.`,
    ]
    return variants[index % variants.length]
  }

  if (toneProfile.name.includes('인터뷰')) {
    const variants = [
      `그때를 떠올리면 ${scene.setting}, ${scene.object}가 먼저 생각나. ${scene.people}도 그 자리에 있었고, "${scene.quote}"라는 말이 마음에 남았지. ${scene.action}도 아직 선명해.`,
      `${scene.setting}의 일은 지금도 또렷해. ${scene.object} 곁에서 ${scene.people}와 함께 있었고, "${scene.quote}"라는 말을 마음에 두게 됐어. ${scene.action}을 지나며 ${scene.emotion}도 배웠지.`,
      `나는 ${scene.setting}의 공기를 아직 기억해. ${scene.people}, ${scene.object}, 그리고 "${scene.quote}"라는 한마디가 같이 떠올라. 그 뒤의 ${scene.action}이 내게는 오래 남은 장면이야.`,
    ]
    return variants[index % variants.length]
  }

  const variants = [
    `${scene.setting}에는 ${scene.object}가 먼저 떠오른다. 함께한 사람은 ${scene.people}였고, "${scene.quote}"라는 한마디 뒤로 ${scene.action}이 조용히 남았다. 그 장면의 끝에는 ${scene.emotion}이 있었다.`,
    `${scene.people}와 함께한 ${scene.setting}의 시간은 ${scene.object}의 모습과 겹쳐 남았다. "${scene.quote}"라는 말은 ${scene.action}으로 이어졌고, 그날의 ${scene.emotion}은 오래도록 마음 한쪽에 머물렀다.`,
    `${scene.setting}의 장면은 천천히 펼쳐진다. ${scene.object} 앞에서 들은 "${scene.quote}"라는 말, 그리고 ${scene.action}. 그 모든 것이 ${chapterTitle} 속 한 페이지가 되었다.`,
  ]
  return variants[index % variants.length]
}

function fallbackTextForChunk(chapterTitle: string, chunk: MemoryChunk & { chunkId: string }, toneProfile: ToneProfile, index: number) {
  const sourceText = chunk.clean || chunk.raw
  const scene = extractSceneMemory(sourceText)
  if (scene) return composeFallbackScene(chapterTitle, scene, toneProfile, index)
  return cleanFallbackSourceText(sourceText)
}

function makeFallbackText(chapterTitle: string, chunks: Array<MemoryChunk & { chunkId: string }>, toneProfile: ToneProfile) {
  const sourceText = chunks
    .slice(0, 3)
    .map((chunk, index) => fallbackTextForChunk(chapterTitle, chunk, toneProfile, index))
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 520)

  if (toneProfile.name.includes('뉴스')) {
    return sourceText || `${chapterTitle}에 관한 주요 장면을 사실 중심으로 정리했습니다.`
  }

  if (toneProfile.name.includes('인터뷰')) {
    return sourceText || '그 시절의 일을 천천히 떠올려 보았습니다.'
  }

  return sourceText || '그 시절의 장면을 가족의 기억으로 조용히 엮었습니다.'
}

function makeFallbackResult(
  chapterId: string,
  chapterTitle: string,
  chunks: Array<MemoryChunk & { chunkId: string }>,
  toneProfile: ToneProfile
): GhostwriterResult {
  return {
    chapterId,
    chapterTitle,
    paragraphs: [
      {
        paragraphId: uuidv4(),
        text: makeFallbackText(chapterTitle, chunks, toneProfile),
        sourceChunkIds: chunks.map((chunk) => chunk.chunkId),
        reliability: chunks.some((chunk) => chunk.reliabilityLabel === 'CONFIRMED') ? 'CONFIRMED' : 'UNVERIFIED',
      },
    ],
    missingSections: [],
    toneProfile,
  }
}

export async function generateChapterDraft(
  chapterId: string,
  chapterTitle: string,
  chunks: Array<MemoryChunk & { chunkId: string }>,
  toneProfile: ToneProfile
): Promise<GhostwriterResult> {
  if (isDemoMode()) return makeDemoResult(chapterId, chapterTitle, toneProfile)

  const keywords = CHAPTER_KEYWORDS[chapterId] || []
  const relevantChunks = chunks.filter(
    (c) =>
      c.chapterHint === chapterId ||
      keywords.some((k) => c.raw.includes(k) || c.clean.includes(k))
  )

  if (relevantChunks.length === 0) {
    return { chapterId, chapterTitle, paragraphs: [], missingSections: ['이 챕터에 대한 기록이 아직 없습니다'], toneProfile }
  }

  try {
    const client = getOpenAIClient()
    const response = await client.chat.completions.create({
      model: 'dearlog-writing',
      purpose: 'writing',
      max_tokens: 1500,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `챕터: ${chapterId} - ${chapterTitle}\n말투 프로필: ${JSON.stringify(toneProfile)}\n\n선택 문체 지침:\n${getToneInstruction(toneProfile)}\n\n기억 chunks:\n${JSON.stringify(relevantChunks, null, 2)}`,
        },
      ],
    })
    const content = response.choices[0].message.content
    if (!content) throw new Error('Empty response')
    const result = JSON.parse(content)
    const paragraphs: Paragraph[] = result.paragraphs.map((p: Partial<Paragraph>) => ({
      ...p,
      paragraphId: p.paragraphId || uuidv4(),
    }))
    return { chapterId, chapterTitle, paragraphs, missingSections: result.missingSections, toneProfile }
  } catch {
    return makeFallbackResult(chapterId, chapterTitle, relevantChunks, toneProfile)
  }
}
