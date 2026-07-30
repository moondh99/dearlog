import { describe, expect, it, vi } from 'vitest'
import { generateChapterDraft, getToneInstruction } from './ghostwriter'

vi.mock('../local-server', () => ({
  createLocalAIChatCompletion: vi.fn(async () => {
    throw new Error('AI proxy unavailable')
  }),
  createLocalAIEmbedding: vi.fn(),
}))

describe('ghostwriter tone instructions', () => {
  it('uses objective article guidance for news style', () => {
    const instruction = getToneInstruction({
      name: '뉴스 기사 형태',
      patterns: ['기사체', '객관적 사실 중심'],
    })

    expect(instruction).toContain('뉴스 기사 형태')
    expect(instruction).toContain('3인칭 중심')
    expect(instruction).toContain('객관적')
    expect(instruction).toContain('기록에 따르면')
    expect(instruction).toContain('반복하지 않습니다')
  })

  it('uses oral first-person guidance for interview style', () => {
    const instruction = getToneInstruction({
      name: '인터뷰 형태',
      patterns: ['1인칭 구술체'],
    })

    expect(instruction).toContain('인터뷰 형태')
    expect(instruction).toContain('1인칭 회상')
    expect(instruction).toContain('직접 들려주는 듯한')
    expect(instruction).toContain('기록에는')
    expect(instruction).toContain('피하고')
  })

  it('keeps selected tone profile when generating draft fallback text', async () => {
    const chunk = {
      chunkId: 'memory-1',
      raw: '어릴 적 집에는 가족이 함께 모여 밥을 먹던 따뜻한 기억이 남아 있다.',
      clean: '어릴 적 집에는 가족이 함께 모여 밥을 먹던 따뜻한 기억이 남아 있다.',
      emotions: [],
      people: [],
      timeHints: [],
      placeHints: [],
      chapterHint: 'childhood',
      reliabilityLabel: 'CONFIRMED' as const,
    }
    const profiles = [
      { name: '뉴스 기사 형태', patterns: ['기사체'] },
      { name: '이야기책 형태', patterns: ['따뜻한 서술형'] },
      { name: '인터뷰 형태', patterns: ['1인칭 구술체'] },
    ]

    const results = await Promise.all(
      profiles.map((profile) => generateChapterDraft('childhood', '어린 시절의 집', [chunk], profile)),
    )

    expect(results.map((result) => result.toneProfile.name)).toEqual([
      '뉴스 기사 형태',
      '이야기책 형태',
      '인터뷰 형태',
    ])
    expect(results[0].paragraphs[0]?.text).not.toContain('기록에 따르면')
    expect(results[1].paragraphs[0]?.text).not.toContain('기록에 따르면')
    expect(results[2].paragraphs[0]?.text).not.toMatch(/^".*"$/)
  })

  it('de-templates repeated demo source wording for all tone fallbacks', async () => {
    const chunk = {
      chunkId: 'memory-1',
      raw: '최근 항구 산책길 부산항 산책로에서 딸 민지와 함께했던 일이 또렷합니다. 흰 등대를 앞에 두고 "멀리 보려면 먼저 발밑을 단단히 해야 한다"라는 말을 들었고, 그때 민지에게 일과 가족 이야기를 차분히 들려준 날이 오래 남았습니다. 지금 돌아보면 그 장면은 제 삶에서 담담한 애정을 배운 시간입니다.',
      clean: '최근 항구 산책길 부산항 산책로에서 딸 민지와 함께했던 일이 또렷합니다. 흰 등대를 앞에 두고 "멀리 보려면 먼저 발밑을 단단히 해야 한다"라는 말을 들었고, 그때 민지에게 일과 가족 이야기를 차분히 들려준 날이 오래 남았습니다. 지금 돌아보면 그 장면은 제 삶에서 담담한 애정을 배운 시간입니다.',
      emotions: [],
      people: [],
      timeHints: [],
      placeHints: [],
      chapterHint: 'legacy',
      reliabilityLabel: 'CONFIRMED' as const,
    }
    const profiles = [
      { name: '뉴스 기사 형태', patterns: ['기사체'] },
      { name: '이야기책 형태', patterns: ['따뜻한 서술형'] },
      { name: '인터뷰 형태', patterns: ['1인칭 구술체'] },
    ]

    const results = await Promise.all(
      profiles.map((profile) => generateChapterDraft('legacy', '자녀에게 남기는 말', [chunk], profile)),
    )

    for (const result of results) {
      const text = result.paragraphs[0]?.text ?? ''
      expect(text).not.toMatch(/기록에는|기록에 따르면|되어 있어|적혀 있어|말을 들었고|배운 시간입니다/)
      expect(text).toContain('발밑을 단단히')
    }
  })
})
