import { isDemoMode } from './config'
import { getOpenAIClient } from '../openai-client'
import type { InterviewerResult } from '../../types/agents'

const SYSTEM_PROMPT = `당신은 시니어 세대의 생애 이야기를 수집하는 인터뷰어 AI입니다.
사용자의 답변을 분석하여 자연스러운 꼬리질문 1개를 생성합니다.

분석 우선순위:
1. 인물 (언급된 사람들의 관계, 특징)
2. 장소 (구체적인 장소, 공간)
3. 감정 (느낌, 심리 상태)
4. 사건 (일어난 일, 전후 관계)
5. 시간 (시기, 계절, 나이)

금지 사항:
- 예/아니오로만 답할 수 있는 질문
- 두 가지 이상을 묻는 복합질문
- "~하셨겠어요?" 같은 감정 단정 질문
- 유도형 질문

반드시 JSON 형식으로만 응답하세요:
{
  "question": "꼬리질문 1개",
  "detectedKeywords": {
    "persons": ["인물1"],
    "places": ["장소1"],
    "emotions": ["감정1"],
    "events": ["사건1"]
  },
  "confidence": "high"
}`

const DEMO_RESULT: InterviewerResult = {
  question: '그때 기억나는 장면이 있으신가요?',
  detectedKeywords: { persons: [], places: [], emotions: [], events: [] },
  confidence: 'high',
}

export async function generateFollowUpQuestion(
  userAnswer: string,
  currentTopic: string,
  previousQuestions: string[]
): Promise<InterviewerResult> {
  if (isDemoMode()) return DEMO_RESULT

  try {
    const client = getOpenAIClient()
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `현재 주제: ${currentTopic}\n이전 질문들: ${previousQuestions.join(', ')}\n\n사용자 답변:\n${userAnswer}`,
        },
      ],
    })
    const content = response.choices[0].message.content
    if (!content) throw new Error('Empty response')
    return JSON.parse(content) as InterviewerResult
  } catch (error) {
    console.warn('generateFollowUpQuestion failed:', error)
    throw new Error('AI 꼬리질문 생성에 실패했습니다.')
  }
}
