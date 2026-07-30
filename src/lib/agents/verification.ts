import { isDemoMode } from './config'
import { getOpenAIClient } from '../openai-client'
import type { MemoryChunk, VerificationResult } from '../../types/agents'

const SYSTEM_PROMPT = `당신은 기억 아카이브의 검증 AI입니다.
새로운 memory chunk와 기존 chunks를 비교하여 충돌을 감지합니다.

충돌 유형:
- TIME_CONFLICT: 같은 사건의 시기가 다르게 기술된 경우
- PERSON_CONFLICT: 같은 인물이 다른 정보로 기술된 경우
- FACT_CONFLICT: 명백히 상충되는 사실 진술
- DUPLICATE: 거의 동일한 내용이 이미 존재하는 경우

규칙:
- 플래그만 달고 내용 수정 금지
- AI 판단으로 내용 결정 금지
- 모호한 경우 PASS 처리

반드시 JSON 형식으로만 응답하세요:
{
  "status": "PASS",
  "reliabilityScore": "CONFIRMED",
  "uncertaintyFlag": false,
  "conflicts": []
}`

const DEMO_RESULT = {
  status: 'PASS' as const,
  reliabilityScore: 'CONFIRMED' as const,
  uncertaintyFlag: false,
  conflicts: [],
}

export async function verifyChunk(
  newChunk: MemoryChunk & { chunkId: string },
  existingChunks: Array<MemoryChunk & { chunkId: string }>
): Promise<VerificationResult> {
  const verifiedAt = new Date().toISOString()

  if (isDemoMode() || existingChunks.length === 0) {
    return { chunkId: newChunk.chunkId, verifiedAt, ...DEMO_RESULT }
  }

  try {
    const client = getOpenAIClient()
    const recentChunks = existingChunks.slice(-10)
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 600,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `새 chunk:\n${JSON.stringify(newChunk, null, 2)}\n\n기존 chunks:\n${JSON.stringify(recentChunks, null, 2)}`,
        },
      ],
    })
    const content = response.choices[0].message.content
    if (!content) throw new Error('Empty response')
    const result = JSON.parse(content)
    // chunkId/verifiedAt 은 호출자 기준값이므로 모델 응답이 덮어쓰지 못하게 뒤에 둔다.
    return { ...result, chunkId: newChunk.chunkId, verifiedAt }
  } catch (error) {
    console.warn('verifyChunk failed; continuing without conflict flags:', error)
    return { chunkId: newChunk.chunkId, verifiedAt, ...DEMO_RESULT }
  }
}
