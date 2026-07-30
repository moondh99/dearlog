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

import { archiveTranscript } from './archivist'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function makeChunk(raw: string): MemoryChunk {
  return {
    raw,
    clean: raw.replace(/음+,\s*/g, ''),
    tags: {
      ner: {
        persons: ['어머니'],
        places: ['남대문시장'],
        times: ['1968년'],
        events: ['첫 가게 개업'],
      },
      emotions: {
        pride: 0.7,
        nostalgia: 0.4,
        regret: 0,
        gratitude: 0.2,
        loss: 0,
        joy: 0.3,
        fear: 0,
        peace: 0,
      },
    },
    reliabilityLabel: 'CONFIRMED',
    chapterHint: '일과 삶',
    timelinePosition: '1960년대 말',
  }
}

function respondWithChunk(chunk: MemoryChunk) {
  openAIChatCreate.mockResolvedValueOnce({
    choices: [{ message: { content: JSON.stringify(chunk) } }],
  })
}

function lastRequest() {
  return openAIChatCreate.mock.calls[openAIChatCreate.mock.calls.length - 1][0]
}

describe('archiveTranscript', () => {
  beforeEach(() => {
    openAIChatCreate.mockReset()
    devMode.demo = false
    // 폴백 경로는 의도적으로 console.warn 을 남기므로 테스트 출력에서 걷어낸다.
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('stores the transcript untouched without calling the provider in demo mode', async () => {
    devMode.demo = true
    const raw = '음, 그때 남대문시장에서 처음 장사를 시작했지.'

    const result = await archiveTranscript(raw, '첫 직업', '일과 삶')

    expect(openAIChatCreate).not.toHaveBeenCalled()
    expect(result.chunk.raw).toBe(raw)
    expect(result.chunk.clean).toBe(raw)
    expect(result.chunk.chapterHint).toBe('일과 삶')
    expect(result.chunk.reliabilityLabel).toBe('CONFIRMED')
    expect(result.chunkId).toMatch(UUID_PATTERN)
    expect(new Date(result.createdAt).toISOString()).toBe(result.createdAt)
  })

  it('returns the tagged chunk parsed from the provider response', async () => {
    const raw = '음, 1968년에 어머니와 남대문시장에서 첫 가게를 열었어.'
    const chunk = makeChunk(raw)
    respondWithChunk(chunk)

    const result = await archiveTranscript(raw, '첫 직업', '일과 삶')

    expect(result.chunk).toEqual(chunk)
    expect(result.chunk.tags.ner.places).toContain('남대문시장')
    expect(result.chunk.tags.emotions.pride).toBeCloseTo(0.7)
  })

  it('sends the chapter, session topic, and raw transcript to the provider', async () => {
    const raw = '어머니와 남대문시장에서 첫 가게를 열었어.'
    respondWithChunk(makeChunk(raw))

    await archiveTranscript(raw, '첫 직업', '일과 삶')

    const request = lastRequest()
    const systemPrompt = request.messages.find((m: any) => m.role === 'system').content as string
    const userPrompt = request.messages.find((m: any) => m.role === 'user').content as string

    expect(systemPrompt).toContain('raw 필드는 원문을 절대 수정하지 않음')
    expect(userPrompt).toContain('챕터: 일과 삶')
    expect(userPrompt).toContain('세션 주제: 첫 직업')
    expect(userPrompt.endsWith(raw)).toBe(true)
  })

  it('assigns a distinct chunkId to each archived transcript', async () => {
    devMode.demo = true

    const first = await archiveTranscript('첫 번째', '주제', '챕터')
    const second = await archiveTranscript('두 번째', '주제', '챕터')

    expect(first.chunkId).not.toBe(second.chunkId)
  })

  it('keeps the raw transcript when the provider call fails instead of losing the answer', async () => {
    const raw = '기록이 사라지면 안 되는 답변입니다.'
    openAIChatCreate.mockRejectedValueOnce(new Error('network down'))

    const result = await archiveTranscript(raw, '첫 직업', '일과 삶')

    expect(result.chunk.raw).toBe(raw)
    expect(result.chunk.chapterHint).toBe('일과 삶')
    expect(result.chunkId).toMatch(UUID_PATTERN)
  })

  it('keeps the raw transcript when the provider returns empty content', async () => {
    const raw = '빈 응답이 와도 원문은 남아야 한다.'
    openAIChatCreate.mockResolvedValueOnce({ choices: [{ message: { content: '' } }] })

    const result = await archiveTranscript(raw, '첫 직업', '일과 삶')

    expect(result.chunk.raw).toBe(raw)
  })

  it('keeps the raw transcript when the provider returns malformed JSON', async () => {
    const raw = 'JSON 이 깨져도 원문은 남아야 한다.'
    openAIChatCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '{ not json' } }],
    })

    const result = await archiveTranscript(raw, '첫 직업', '일과 삶')

    expect(result.chunk.raw).toBe(raw)
  })

  it('preserves arbitrary transcripts byte-for-byte on the provider failure path', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 300, unit: 'grapheme' }),
        fc.string({ minLength: 1, maxLength: 20 }),
        async (raw, chapterId) => {
          openAIChatCreate.mockReset()
          openAIChatCreate.mockRejectedValueOnce(new Error('provider unavailable'))

          const result = await archiveTranscript(raw, '세션 주제', chapterId)

          expect(result.chunk.raw).toBe(raw)
          expect(result.chunk.clean).toBe(raw)
          expect(result.chunk.chapterHint).toBe(chapterId)
        }
      ),
      { numRuns: 50 }
    )
  })
})
