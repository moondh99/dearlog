import { isDemoMode } from './config'
import { getOpenAIClient } from '../openai-client'
import type { QuestionQueueResult } from '../../types/agents'

const SYSTEM_PROMPT = `당신은 자녀가 등록한 질문을 시니어 친화적 형태로 재구성하는 AI입니다.

변환 원칙:
- 직접 → 간접 표현
- 사실확인 → 기억회상 형식
- 민감 주제 → 우회 표현
- 판단 요청 → 경험 중심

변환 예시:
- "왜 그 직업을 선택했어요?" → "그 일을 시작하게 된 계기가 있으셨나요?"
- "힘들지 않으셨어요?" → "그 시절 어떻게 버티셨나요?"
- "후회하세요?" → "그때로 돌아간다면 어떻게 하실 것 같으세요?"

반드시 JSON 형식으로만 응답하세요:
{
  "reformulatedQuestion": "재구성된 질문",
  "transformReason": "변환 이유",
  "sensitivityLevel": "low",
  "suggestedTopic": "연관 챕터 또는 주제"
}`

export async function reformulateQuestion(
  originalQuestion: string,
  priority: number,
  isAnonymous: boolean,
  currentTopic: string
): Promise<QuestionQueueResult> {
  if (isDemoMode()) {
    return {
      originalQuestion,
      reformulatedQuestion: originalQuestion,
      priority,
      isAnonymous,
      transformReason: '데모 모드 — 원본 그대로 사용',
      sensitivityLevel: 'low',
      suggestedTopic: currentTopic,
    }
  }

  try {
    const client = getOpenAIClient()
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 400,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `현재 주제: ${currentTopic}\n우선순위: ${priority}\n익명: ${isAnonymous}\n\n원본 질문: ${originalQuestion}`,
        },
      ],
    })
    const content = response.choices[0].message.content
    if (!content) throw new Error('Empty response')
    const result = JSON.parse(content)
    return { originalQuestion, priority, isAnonymous, ...result }
  } catch {
    return {
      originalQuestion,
      reformulatedQuestion: originalQuestion,
      priority,
      isAnonymous,
      transformReason: '재구성 실패, 원본 사용',
      sensitivityLevel: 'low',
      suggestedTopic: currentTopic,
    }
  }
}
