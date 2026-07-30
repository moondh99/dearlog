import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Memory } from '../types'
import type { MemoryChunk } from '../../types/agents'

const openAIChatCreate = vi.hoisted(() => vi.fn())

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
  isDemoMode: () => false,
}))

import {
  buildMemoryChunksFromMemories,
  generatePersonaResponse,
  selectRelevantMemoryChunks,
} from './digitalTwin'

function makeMemory(overrides: Partial<Memory> = {}): Memory {
  return {
    id: 'memory_1',
    date: '2026-06-07T00:00:00.000Z',
    topic: '남대문시장 첫 가게',
    originalTranscript: '김영자님은 남대문시장에서 처음 장사를 시작하던 날을 기억했다.',
    cleanedTranscript: '남대문시장 첫 장사 이야기',
    publishVersion: '남대문시장 첫 장사 이야기',
    tags: {
      people: ['김영자'],
      places: ['남대문시장'],
      emotions: ['뿌듯함'],
      timePeriod: '1968년',
    },
    privacy: 'public',
    confidenceLabel: '확인됨',
    contradictions: [],
    consent: {
      status: 'granted',
      accessTier: '전체 가족',
      designatedFamilyIds: [],
      lastModified: '2026-06-07T00:00:00.000Z',
    },
    consentSettings: {
      출판: 'granted',
      가족열람: 'granted',
      챗봇: 'granted',
      사후공개: 'granted',
      민감정보: 'granted',
    },
    embedding: null,
    ...overrides,
  }
}

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
    chapterHint: text,
  }
}

describe('digitalTwin memory grounding', () => {
  beforeEach(() => {
    openAIChatCreate.mockReset()
  })

  it('builds chat-ready chunks from server memories', () => {
    const chunks = buildMemoryChunksFromMemories([makeMemory()])

    expect(chunks).toHaveLength(1)
    expect(chunks[0].chunkId).toBe('memory_1')
    expect(chunks[0].reliabilityLabel).toBe('CONFIRMED')
    expect(chunks[0].tags.ner.places).toContain('남대문시장')
  })

  it('excludes memories revoked for chatbot use', () => {
    const chunks = buildMemoryChunksFromMemories([
      makeMemory({
        consentSettings: {
          출판: 'granted',
          가족열람: 'granted',
          챗봇: 'revoked',
          사후공개: 'granted',
          민감정보: 'granted',
        },
      }),
    ])

    expect(chunks).toHaveLength(0)
  })

  it('prioritizes memories relevant to the user question', () => {
    const chunks = [
      makeChunk('family', '가족 밥상과 손주들 이야기'),
      makeChunk('school', '학교 운동장과 졸업식 이야기'),
      makeChunk('market', '남대문시장 첫 가게와 장사 이야기'),
    ]

    const selected = selectRelevantMemoryChunks('남대문시장에서 처음 장사한 이야기를 들려줘', chunks, 2)

    expect(selected[0].chunkId).toBe('market')
    expect(selected).toHaveLength(2)
  })

  it('matches compound Korean query words against question context', () => {
    const hobby = makeChunk('hobby', '실뜨기나 실타래로 행주 만드는 것을 좋아했고 즐거웠어.')
    hobby.chapterHint = '일과 삶 · 살면서 오래 좋아해 온 취미나 즐거움은 무엇인가요?'
    const chunks = [
      makeChunk('family', '가족 밥상과 손주들 이야기'),
      hobby,
    ]

    const selected = selectRelevantMemoryChunks('엄마 취미활동있어?', chunks, 1)

    expect(selected[0].chunkId).toBe('hobby')
  })

  it('uses a persona-safe no-evidence response instead of promising future memories', async () => {
    const result = await generatePersonaResponse('엄마 트럼프 대통령에 대해 알아?', [], {
      name: '따뜻한 구어체',
      patterns: [],
    })

    expect(result.responseText).toContain('내가 남겨둔 이야기에는 없어')
    expect(result.responseText).toContain('아는 척 말하진 않을게')
    expect(result.responseText).not.toContain('언젠가 이야기')
    expect(result.fallbackTriggered).toBe(true)
  })

  it('normalizes provider no-evidence replies to the same persona-safe wording', async () => {
    openAIChatCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              responseText: '그 부분은 아직 기억이 남아있지 않네요... 언젠가 이야기해 드릴게요.',
              questionType: 'recall',
              evidenceBadge: {
                usedChunkIds: [],
                reliability: 'UNVERIFIED',
                note: '근거 기억 없음',
              },
              fallbackTriggered: true,
            }),
          },
        },
      ],
    })

    const result = await generatePersonaResponse('기록에 없는 일을 물어볼게', [
      makeChunk('market', '남대문시장 첫 가게와 장사 이야기'),
    ], {
      name: '따뜻한 구어체',
      patterns: [],
    })

    expect(result.responseText).toContain('내가 남겨둔 이야기에는 없어')
    expect(result.responseText).not.toContain('언젠가 이야기')
    expect(result.fallbackTriggered).toBe(true)
  })

  it('sends relevant chunks to the model instead of only the latest chunks', async () => {
    openAIChatCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              responseText: '남대문시장 첫 가게 이야기를 바탕으로 답할게요.',
              questionType: 'recall',
              evidenceBadge: {
                usedChunkIds: ['market'],
                reliability: 'CONFIRMED',
                note: '남대문시장 기억 사용',
              },
              fallbackTriggered: false,
            }),
          },
        },
      ],
    })

    const chunks = [
      makeChunk('recent_1', '최근 가족 식사 자리'),
      makeChunk('recent_2', '손주 졸업식'),
      makeChunk('recent_3', '공원 산책'),
      makeChunk('recent_4', '건강수첩 정리'),
      makeChunk('recent_5', '거실 창가 가족사진'),
      makeChunk('market', '남대문시장 첫 가게와 장사 이야기'),
    ]

    const result = await generatePersonaResponse('남대문시장에서 처음 장사한 이야기를 들려줘', chunks, {
      name: '따뜻한 구어체',
      patterns: [],
    })

    const userPrompt = openAIChatCreate.mock.calls[0][0].messages.find((message: any) => message.role === 'user').content
    expect(userPrompt.indexOf('"chunkId": "market"')).toBeGreaterThan(-1)
    expect(userPrompt.indexOf('"chunkId": "market"')).toBeLessThan(userPrompt.indexOf('"chunkId": "recent_1"'))
    expect(result.evidenceBadge.usedChunkIds).toEqual(['market'])
  })

  it('uses a bounded completion cap and falls back to grounded memory text when provider content is empty', async () => {
    openAIChatCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '' } }],
    })

    const result = await generatePersonaResponse('남대문시장 이야기를 들려줘', [
      makeChunk('market', '남대문시장 첫 가게에서 장사를 시작하던 날이 기억납니다.'),
    ], {
      name: '따뜻한 구어체',
      patterns: [],
    })

    expect(openAIChatCreate.mock.calls[0][0].max_completion_tokens).toBe(1000)
    expect(openAIChatCreate.mock.calls[0][0].max_tokens).toBeUndefined()
    expect(result.responseText).toContain('남대문시장 첫 가게')
    expect(result.responseText).not.toContain('지금은 말씀드리기 어렵')
    expect(result.evidenceBadge.usedChunkIds).toEqual(['market'])
    expect(result.fallbackTriggered).toBe(false)
  })

  it('parses fenced JSON responses from the provider', async () => {
    openAIChatCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: '```json\n{"responseText":"시장 이야기를 기억하고 있어요.","questionType":"recall","evidenceBadge":{"usedChunkIds":["market"],"reliability":"CONFIRMED","note":"시장 기억 사용"},"fallbackTriggered":true}\n```',
          },
        },
      ],
    })

    const result = await generatePersonaResponse('시장 이야기를 들려줘', [
      makeChunk('market', '남대문시장 첫 가게와 장사 이야기'),
    ], {
      name: '따뜻한 구어체',
      patterns: [],
    })

    expect(result.responseText).toBe('시장 이야기를 기억하고 있어요.')
    expect(result.evidenceBadge.usedChunkIds).toEqual(['market'])
    expect(result.fallbackTriggered).toBe(false)
  })
})
