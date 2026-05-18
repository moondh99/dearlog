import { describe, expect, it } from 'vitest';
import { AUTOBIOGRAPHY_STYLE_LABELS, getStyleInstruction, toPDFReadyAutobiography } from './ghostwriter';

describe('ghostwriter style presets', () => {
  it('provides a news style instruction for small family incidents', () => {
    expect(AUTOBIOGRAPHY_STYLE_LABELS.news).toBe('기사체');
    expect(getStyleInstruction('news')).toContain('30개월 아이 목욕 거부 사건');
    expect(getStyleInstruction('news')).toContain('기사체');
  });

  it('marks PDF-ready chapter titles when news style is selected', () => {
    const autobiography = toPDFReadyAutobiography([
      {
        id: 'chapter-v2-family',
        category: '가족',
        title: '젖병 거부 사건',
        narrative: '아이는 젖병을 밀어냈고 가족은 그 장면을 오래 기억했다.',
        sourceChunks: [{ sentenceRange: [0, 0], memoryId: 'm1' }],
        styleRatio: { conversational: 0.6, literary: 0.4 },
      },
    ], '나의 이야기', 'news');

    expect(autobiography.chapters[0].title).toBe('젖병 거부 사건 - 가족 뉴스');
  });
});
