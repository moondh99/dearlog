import { describe, expect, it } from 'vitest'
import { normalizeAutobiographyNarratives } from './autobiographyStore'

describe('normalizeAutobiographyNarratives', () => {
  it('fills missing draft arrays and paragraph ids for seeded publication drafts', () => {
    const [chapter] = normalizeAutobiographyNarratives([
      {
        chapterId: 'childhood',
        chapterTitle: '유년기',
        paragraphs: [
          {
            text: '영도 골목의 항구 불빛을 기억합니다.',
            sourceChunkIds: ['record-1'],
            reliability: 'CONFIRMED',
          },
        ],
      },
    ])

    expect(chapter).toMatchObject({
      chapterId: 'childhood',
      chapterTitle: '유년기',
      missingSections: [],
      toneProfile: {
        name: '기록집 문체',
        patterns: [],
      },
    })
    expect(chapter.paragraphs).toHaveLength(1)
    expect(chapter.paragraphs[0]).toMatchObject({
      paragraphId: 'childhood_paragraph_1',
      text: '영도 골목의 항구 불빛을 기억합니다.',
      sourceChunkIds: ['record-1'],
      reliability: 'CONFIRMED',
    })
  })

  it('drops invalid paragraphs and defaults unsafe reliability labels', () => {
    const [chapter] = normalizeAutobiographyNarratives([
      {
        chapterId: 'work',
        chapterTitle: '일과 가족',
        paragraphs: [
          { text: '', reliability: 'CONFIRMED' },
          { text: '도면 앞에서 하루를 정리했습니다.', reliability: 'UNKNOWN' },
        ],
        missingSections: [null, '첫 직장의 구체적인 동료 이름'],
      },
    ])

    expect(chapter.paragraphs).toHaveLength(1)
    expect(chapter.paragraphs[0].reliability).toBe('UNVERIFIED')
    expect(chapter.missingSections).toEqual(['첫 직장의 구체적인 동료 이름'])
  })
})
