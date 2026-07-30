import { v4 as uuidv4 } from 'uuid'
import { isDemoMode } from './config'
import { getOpenAIClient } from '../openai-client'
import type { ArchivistResult, MemoryChunk } from '../../types/agents'

const SYSTEM_PROMPT = `당신은 시니어의 구술 이야기를 구조화하는 아카이비스트 AI입니다.
원문을 분석하여 NER 태깅과 감정 태깅을 수행합니다.

NER 4종:
- persons: 이름 또는 관계로 언급된 인물
- places: 구체적 장소 또는 지역
- times: 시기, 나이, 계절, 연도
- events: 발생한 사건이나 행위

감정 8종 (0.0~1.0 점수):
pride(자부심), nostalgia(그리움), regret(후회), gratitude(감사),
loss(상실), joy(기쁨), fear(두려움), peace(평온)

신뢰도 라벨:
- CONFIRMED: "~였다", "~했다" 등 확정 진술
- ESTIMATED: "~인 것 같다", "아마도" 등 추정 표현
- UNVERIFIED: 기억 불확실 표현 ("뭐였더라", "잘 모르겠는데")

규칙:
- raw 필드는 원문을 절대 수정하지 않음
- 명시된 내용만 태깅, 추론 금지
- clean 필드는 구어체 유지, 반복/필러만 최소 정리

반드시 JSON 형식으로만 응답하세요:
{
  "raw": "원문 그대로",
  "clean": "정리된 텍스트",
  "tags": {
    "ner": { "persons": [], "places": [], "times": [], "events": [] },
    "emotions": { "pride": 0.0, "nostalgia": 0.8, "regret": 0.0, "gratitude": 0.0, "loss": 0.0, "joy": 0.0, "fear": 0.0, "peace": 0.0 }
  },
  "reliabilityLabel": "CONFIRMED",
  "chapterHint": "어린시절",
  "timelinePosition": "1960년대 초"
}`

function makeDemoChunk(rawText: string, chapterId: string): MemoryChunk {
  return {
    raw: rawText,
    clean: rawText,
    tags: {
      ner: { persons: [], places: [], times: [], events: [] },
      emotions: { pride: 0, nostalgia: 0.8, regret: 0, gratitude: 0, loss: 0, joy: 0, fear: 0, peace: 0 },
    },
    reliabilityLabel: 'CONFIRMED',
    chapterHint: chapterId,
  }
}

export async function archiveTranscript(
  rawText: string,
  sessionTopic: string,
  chapterId: string
): Promise<ArchivistResult> {
  const chunkId = uuidv4()
  const createdAt = new Date().toISOString()

  if (isDemoMode()) {
    return { chunk: makeDemoChunk(rawText, chapterId), chunkId, createdAt }
  }

  try {
    const client = getOpenAIClient()
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1000,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `챕터: ${chapterId}\n세션 주제: ${sessionTopic}\n\n원문:\n${rawText}`,
        },
      ],
    })
    const content = response.choices[0].message.content
    if (!content) throw new Error('Empty response')
    const chunk = JSON.parse(content) as MemoryChunk
    return { chunk, chunkId, createdAt }
  } catch (error) {
    console.warn('archiveTranscript failed; saving raw transcript without AI cleanup:', error)
    return { chunk: makeDemoChunk(rawText, chapterId), chunkId, createdAt }
  }
}
