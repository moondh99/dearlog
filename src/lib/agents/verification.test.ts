import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as fc from 'fast-check'
import type { MemoryChunk } from '../../types/agents'

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

import { verifyChunk } from './verification'

function makeChunk(chunkId: string, text: string): MemoryChunk & { chunkId: string } {
  return {
    chunkId,
    raw: text,
    clean: text,
    tags: {
      ner: { persons: [], places: [], times: [], events: [] },
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
    chapterHint: '일과 삶',
  }
}

function respondWith(payload: unknown) {
  openAIChatCreate.mockResolvedValueOnce({
    choices: [{ message: { content: JSON.stringify(payload) } }],
  })
}

function lastRequest() {
  return openAIChatCreate.mock.calls[openAIChatCreate.mock.calls.length - 1][0]
}

const FLAGGED_RESPONSE = {
  status: 'FLAG',
  reliabilityScore: 'ESTIMATED',
  uncertaintyFlag: true,
  conflicts: [
    {
      conflictType: 'TIME_CONFLICT',
      conflictingChunkId: 'chunk-old',
      description: '같은 개업 시점이 1968년과 1972년으로 다르게 기술됨',
      recommendedAction: '가족 확인 필요',
    },
  ],
}

describe('verifyChunk', () => {
  beforeEach(() => {
    openAIChatCreate.mockReset()
    devMode.demo = false
    // 폴백 경로는 의도적으로 console.warn 을 남기므로 테스트 출력에서 걷어낸다.
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('passes the first chunk without calling the provider when there is nothing to compare', async () => {
    const result = await verifyChunk(makeChunk('chunk-new', '첫 기억입니다.'), [])

    expect(openAIChatCreate).not.toHaveBeenCalled()
    expect(result.status).toBe('PASS')
    expect(result.conflicts).toEqual([])
    expect(result.uncertaintyFlag).toBe(false)
    expect(result.chunkId).toBe('chunk-new')
    expect(new Date(result.verifiedAt).toISOString()).toBe(result.verifiedAt)
  })

  it('passes without calling the provider in demo mode', async () => {
    devMode.demo = true

    const result = await verifyChunk(makeChunk('chunk-new', '기억'), [
      makeChunk('chunk-old', '다른 기억'),
    ])

    expect(openAIChatCreate).not.toHaveBeenCalled()
    expect(result.status).toBe('PASS')
  })

  it('surfaces provider conflict flags with the verified chunk id', async () => {
    respondWith(FLAGGED_RESPONSE)

    const result = await verifyChunk(makeChunk('chunk-new', '1972년에 가게를 열었어.'), [
      makeChunk('chunk-old', '1968년에 가게를 열었어.'),
    ])

    expect(result.chunkId).toBe('chunk-new')
    expect(result.status).toBe('FLAG')
    expect(result.uncertaintyFlag).toBe(true)
    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0].conflictType).toBe('TIME_CONFLICT')
    expect(result.conflicts[0].conflictingChunkId).toBe('chunk-old')
  })

  it('cannot have its chunkId or verifiedAt overwritten by the provider payload', async () => {
    respondWith({ ...FLAGGED_RESPONSE, chunkId: 'spoofed', verifiedAt: '1999-01-01T00:00:00.000Z' })

    const result = await verifyChunk(makeChunk('chunk-new', '기억'), [makeChunk('chunk-old', '다른 기억')])

    // 검증 결과는 호출자가 넘긴 chunkId 에 귀속돼야 하고, 시각은 서버 응답이 아니라 검증 시점이어야 한다.
    expect(result.chunkId).toBe('chunk-new')
    expect(result.verifiedAt).not.toBe('1999-01-01T00:00:00.000Z')
  })

  it('sends only the ten most recent existing chunks for comparison', async () => {
    respondWith({ status: 'PASS', reliabilityScore: 'CONFIRMED', uncertaintyFlag: false, conflicts: [] })

    const existing = Array.from({ length: 14 }, (_, index) =>
      makeChunk(`chunk-${index}`, `기억 ${index}`)
    )
    await verifyChunk(makeChunk('chunk-new', '새 기억'), existing)

    const userPrompt = lastRequest().messages.find((m: any) => m.role === 'user').content as string
    expect(userPrompt).toContain('"chunkId": "chunk-13"')
    expect(userPrompt).toContain('"chunkId": "chunk-4"')
    expect(userPrompt).not.toContain('"chunkId": "chunk-3"')
  })

  it('falls back to PASS without inventing conflicts when the provider fails', async () => {
    openAIChatCreate.mockRejectedValueOnce(new Error('network down'))

    const result = await verifyChunk(makeChunk('chunk-new', '기억'), [makeChunk('chunk-old', '다른 기억')])

    expect(result.status).toBe('PASS')
    expect(result.conflicts).toEqual([])
    expect(result.uncertaintyFlag).toBe(false)
    expect(result.chunkId).toBe('chunk-new')
  })

  it('falls back to PASS when the provider returns unparsable content', async () => {
    openAIChatCreate.mockResolvedValueOnce({ choices: [{ message: { content: 'not json' } }] })

    const result = await verifyChunk(makeChunk('chunk-new', '기억'), [makeChunk('chunk-old', '다른 기억')])

    expect(result.status).toBe('PASS')
    expect(result.conflicts).toEqual([])
  })

  it('never mutates the chunks it verifies', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 120, unit: 'grapheme' }),
        fc.array(fc.string({ minLength: 1, maxLength: 60 }), { minLength: 1, maxLength: 4 }),
        async (newText, existingTexts) => {
          openAIChatCreate.mockReset()
          respondWith(FLAGGED_RESPONSE)

          const newChunk = makeChunk('chunk-new', newText)
          const existing = existingTexts.map((text, index) => makeChunk(`chunk-${index}`, text))
          const newSnapshot = structuredClone(newChunk)
          const existingSnapshot = structuredClone(existing)

          await verifyChunk(newChunk, existing)

          // 검증 모듈은 플래그만 달고 기억 내용을 절대 수정하지 않는다.
          expect(newChunk).toEqual(newSnapshot)
          expect(existing).toEqual(existingSnapshot)
        }
      ),
      { numRuns: 40 }
    )
  })
})
