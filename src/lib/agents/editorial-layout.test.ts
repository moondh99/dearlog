import { vi, describe, it, expect } from 'vitest';
import { correlatePhotosToText, generateEditorialNotes } from './editorial-layout';

vi.mock('../openai-client', () => ({
  getOpenAIClient: () => ({
    chat: {
      completions: {
        create: vi.fn().mockImplementation((config) => {
          const userMessage = config.messages.find((m: any) => m.role === 'user' || m.role === 'system')?.content || '';
          
          if (userMessage.includes('편집자') || userMessage.includes('사진')) {
            return Promise.resolve({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      correlations: [
                        {
                          chapterId: 'childhood',
                          photoId: 'photo_01',
                          placementReason: '유년기 시절의 시골 풍경 묘사 및 인물 일치.',
                        },
                      ],
                    }),
                  },
                },
              ],
            });
          } else {
            return Promise.resolve({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      prologue: '멋진 서문입니다.',
                      epilogue: '감동적인 발문입니다.',
                    }),
                  },
                },
              ],
            });
          }
        }),
      },
    },
  }),
}));

describe('Editorial Layout Agent', () => {
  const dummyChapters = [
    { id: 'childhood', title: '유년기', text: '내가 어릴 적 살던 시골 고향에는 큰 참외밭이 있었단다.' },
  ];

  const dummyPhotos = [
    {
      id: 'photo_01',
      description: '시골 풍경에서 환하게 웃는 아이 사진',
      people: ['나'],
      places: ['시골'],
      estimatedEra: '1960년대',
    },
  ];

  it('correlates photos to chapters correctly', async () => {
    const correlations = await correlatePhotosToText(dummyChapters, dummyPhotos);
    expect(correlations).toHaveLength(1);
    expect(correlations[0].chapterId).toBe('childhood');
    expect(correlations[0].photoId).toBe('photo_01');
    expect(correlations[0].placementReason).toContain('유년기 시절');
  });

  it('generates elegant prologue and epilogue notes', async () => {
    const notes = await generateEditorialNotes('자서전 전체 본문 내용입니다.');
    expect(notes.prologue).toBe('멋진 서문입니다.');
    expect(notes.epilogue).toBe('감동적인 발문입니다.');
  });
});
