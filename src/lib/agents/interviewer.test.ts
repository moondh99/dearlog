import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as fc from 'fast-check'

const openAIChatCreate = vi.hoisted(() => vi.fn())
const devMode = vi.hoisted(() => ({ demo: false }))

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
  isDemoMode: () => devMode.demo,
}))

import { generateFollowUpQuestion } from './interviewer'

function respondWith(payload: unknown) {
  openAIChatCreate.mockResolvedValueOnce({
    choices: [{ message: { content: JSON.stringify(payload) } }],
  })
}

function lastRequest() {
  return openAIChatCreate.mock.calls[openAIChatCreate.mock.calls.length - 1][0]
}

function messageContent(role: 'system' | 'user') {
  return lastRequest().messages.find((message: any) => message.role === role).content as string
}

const VALID_RESULT = {
  question: '그 시장에서 함께 일하던 분은 누구였나요?',
  detectedKeywords: {
    persons: ['어머니'],
    places: ['남대문시장'],
    emotions: ['뿌듯함'],
    events: ['첫 장사'],
  },
  confidence: 'high' as const,
}

describe('generateFollowUpQuestion', () => {
  beforeEach(() => {
    openAIChatCreate.mockReset()
    devMode.demo = false
    // 실패 경로는 의도적으로 console.warn 을 남기므로 테스트 출력에서 걷어낸다.
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('returns the canned demo question without calling the provider in demo mode', async () => {
    devMode.demo = true

    const result = await generateFollowUpQuestion('아무 답변', '어린시절', [])

    expect(openAIChatCreate).not.toHaveBeenCalled()
    expect(result.question).toBeTruthy()
    expect(result.detectedKeywords).toEqual({ persons: [], places: [], emotions: [], events: [] })
    expect(result.confidence).toBe('high')
  })

  it('parses the provider question and detected keywords', async () => {
    respondWith(VALID_RESULT)

    const result = await generateFollowUpQuestion(
      '어머니와 남대문시장에서 처음 장사를 시작했어요.',
      '일과 삶',
      []
    )

    expect(result).toEqual(VALID_RESULT)
  })

  it('sends the topic, previous questions, and the untouched answer to the provider', async () => {
    respondWith(VALID_RESULT)

    const answer = '1968년 겨울, 어머니와 남대문시장에서 첫 가게를 열었어요.'
    await generateFollowUpQuestion(answer, '일과 삶', ['어디서 일하셨나요?', '누구와 함께였나요?'])

    const userPrompt = messageContent('user')
    expect(userPrompt).toContain('현재 주제: 일과 삶')
    expect(userPrompt).toContain('어디서 일하셨나요?')
    expect(userPrompt).toContain('누구와 함께였나요?')
    // 인터뷰어는 답변을 요약/재해석하지 않고 원문 그대로 전달해야 한다.
    expect(userPrompt.endsWith(answer)).toBe(true)
  })

  it('keeps the follow-up question constraints in the system prompt', async () => {
    respondWith(VALID_RESULT)

    await generateFollowUpQuestion('답변', '어린시절', [])

    const systemPrompt = messageContent('system')
    expect(systemPrompt).toContain('꼬리질문 1개')
    expect(systemPrompt).toContain('금지 사항')
    expect(systemPrompt).toContain('복합질문')
    expect(systemPrompt).toContain('JSON')
  })

  it('throws a Korean-facing error when the provider call fails', async () => {
    openAIChatCreate.mockRejectedValueOnce(new Error('network down'))

    await expect(generateFollowUpQuestion('답변', '어린시절', [])).rejects.toThrow(
      'AI 꼬리질문 생성에 실패했습니다.'
    )
  })

  it('throws instead of returning a blank question when the provider content is empty', async () => {
    openAIChatCreate.mockResolvedValueOnce({ choices: [{ message: { content: '' } }] })

    await expect(generateFollowUpQuestion('답변', '어린시절', [])).rejects.toThrow(
      'AI 꼬리질문 생성에 실패했습니다.'
    )
  })

  it('preserves arbitrary answer wording byte-for-byte in the provider prompt', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 300, unit: 'grapheme' }),
        async (answer) => {
          openAIChatCreate.mockReset()
          respondWith(VALID_RESULT)

          await generateFollowUpQuestion(answer, '어린시절', ['이전 질문'])

          expect(messageContent('user').endsWith(answer)).toBe(true)
        }
      ),
      { numRuns: 50 }
    )
  })
})
