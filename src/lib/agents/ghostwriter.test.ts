import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MemoryChunk, ToneProfile } from '../../types/agents'

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

import {
  buildMemoryChunksFromTranscripts,
  generateChapterDraft,
  type TranscriptLike,
} from './ghostwriter'

const STORY_TONE: ToneProfile = { name: '이야기책', patterns: [] }

function makeChunk(chunkId: string, text: string, chapterHint: string): MemoryChunk & { chunkId: string } {
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
    chapterHint,
  }
}

describe('buildMemoryChunksFromTranscripts', () => {
  it('keeps the interview answer as the chunk text so chapters are not generated empty', () => {
    const transcripts: TranscriptLike[] = [
      {
        id: 'tr-1',
        chapterId: 'ch1',
        chapterTitle: '어린시절',
        questionText: '가장 오래된 기억은 무엇인가요?',
        originalText: '  마당에서 형과 팽이를 돌리던 날이 제일 오래된 기억이에요.  ',
        aiSummary: null,
      },
    ]

    const [chunk] = buildMemoryChunksFromTranscripts(transcripts)

    expect(chunk.chunkId).toBe('tr-1')
    expect(chunk.raw).toBe('마당에서 형과 팽이를 돌리던 날이 제일 오래된 기억이에요.')
    expect(chunk.clean).toBe('마당에서 형과 팽이를 돌리던 날이 제일 오래된 기억이에요.')
    expect(chunk.reliabilityLabel).toBe('UNVERIFIED')
    expect(chunk.chapterHint).toBe('어린시절 · 가장 오래된 기억은 무엇인가요?')
    expect(chunk.tags.ner.events).toEqual(['가장 오래된 기억은 무엇인가요?'])
  })

  it('prefers the AI summary for clean text while keeping the original as raw', () => {
    const [chunk] = buildMemoryChunksFromTranscripts([
      {
        id: 'tr-2',
        chapterId: 'ch2',
        chapterTitle: '청년기',
        questionText: '첫 직장은 어디였나요?',
        originalText: '음, 그러니까, 첫 직장은 그 무역회사였지.',
        aiSummary: '첫 직장은 무역회사였다.',
      },
    ])

    expect(chunk.raw).toBe('음, 그러니까, 첫 직장은 그 무역회사였지.')
    expect(chunk.clean).toBe('첫 직장은 무역회사였다.')
  })

  it('falls back to the chapterId when no chapter title is available', () => {
    const [chunk] = buildMemoryChunksFromTranscripts([
      { id: 'tr-3', chapterId: 'ch3', chapterTitle: null, questionText: null, originalText: '가족 이야기' },
    ])

    expect(chunk.chapterHint).toBe('ch3')
    expect(chunk.tags.ner.events).toEqual([])
  })

  it('drops transcripts that carry no answer text at all', () => {
    const chunks = buildMemoryChunksFromTranscripts([
      { id: 'empty-1', chapterId: 'ch1', originalText: '   ', aiSummary: '   ' },
      { id: 'empty-2', chapterId: 'ch1', originalText: null, aiSummary: null },
      { id: 'kept', chapterId: 'ch1', originalText: null, aiSummary: '요약만 있는 기록' },
    ])

    expect(chunks.map((chunk) => chunk.chunkId)).toEqual(['kept'])
    // originalText 가 없으면 요약을 raw 로 승격해 근거 텍스트가 사라지지 않게 한다.
    expect(chunks[0].raw).toBe('요약만 있는 기록')
  })
})

describe('generateChapterDraft chapter scoping', () => {
  beforeEach(() => {
    openAIChatCreate.mockReset()
    devMode.demo = false
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('reports a missing section instead of writing a chapter with no matching memories', async () => {
    const result = await generateChapterDraft(
      'ch1',
      '어린시절',
      [makeChunk('c1', '퇴직 이후 텃밭을 가꾸던 이야기', 'ch9')],
      STORY_TONE
    )

    expect(openAIChatCreate).not.toHaveBeenCalled()
    expect(result.paragraphs).toEqual([])
    expect(result.missingSections).toEqual(['이 챕터에 대한 기록이 아직 없습니다'])
    expect(result.toneProfile).toEqual(STORY_TONE)
  })

  it('sends only chunks matching the chapter by hint or keyword to the provider', async () => {
    openAIChatCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              paragraphs: [
                { text: '어린 시절의 장면입니다.', sourceChunkIds: ['by-hint'], reliability: 'CONFIRMED' },
              ],
              missingSections: [],
            }),
          },
        },
      ],
    })

    const result = await generateChapterDraft(
      'ch1',
      '어린시절',
      [
        makeChunk('by-hint', '아무 말도 없는 기록', 'ch1'),
        makeChunk('by-keyword', '유년 시절 마당에서 놀던 기억', '다른 챕터 · 질문'),
        makeChunk('unrelated', '퇴직 이후의 텃밭 이야기', '다른 챕터 · 질문'),
      ],
      STORY_TONE
    )

    const userPrompt = openAIChatCreate.mock.calls[0][0].messages.find(
      (message: any) => message.role === 'user'
    ).content as string
    expect(userPrompt).toContain('"chunkId": "by-hint"')
    expect(userPrompt).toContain('"chunkId": "by-keyword"')
    expect(userPrompt).not.toContain('"chunkId": "unrelated"')
    expect(userPrompt).toContain('챕터: ch1 - 어린시절')
    // 문단마다 paragraphId 가 없더라도 채워져야 한다.
    expect(result.paragraphs[0].paragraphId).toBeTruthy()
  })

  it('returns a grounded fallback paragraph when the provider fails', async () => {
    openAIChatCreate.mockRejectedValueOnce(new Error('network down'))

    const result = await generateChapterDraft(
      'ch1',
      '어린시절',
      [makeChunk('c1', '유년 시절 마당에서 형과 팽이를 돌렸습니다.', 'ch1')],
      STORY_TONE
    )

    expect(result.paragraphs).toHaveLength(1)
    expect(result.paragraphs[0].text).toContain('팽이')
    expect(result.paragraphs[0].sourceChunkIds).toEqual(['c1'])
    expect(result.paragraphs[0].reliability).toBe('CONFIRMED')
  })

  it('uses the canned demo draft without calling the provider in demo mode', async () => {
    devMode.demo = true

    const result = await generateChapterDraft('ch1', '어린시절', [], STORY_TONE)

    expect(openAIChatCreate).not.toHaveBeenCalled()
    expect(result.paragraphs).toHaveLength(1)
    expect(result.paragraphs[0].text).toBeTruthy()
  })
})
