import { vi, describe, it, expect } from 'vitest';
import { detectFactualConflicts } from './coherence-truth';

vi.mock('../openai-client', () => ({
  getOpenAIClient: () => ({
    chat: {
      completions: {
        create: vi.fn().mockImplementation((config) => {
          const userMessage = config.messages.find((m: any) => m.role === 'user')?.content || '';
          
          if (userMessage.includes('mem_01') && userMessage.includes('mem_02')) {
            return Promise.resolve({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      conflicts: [
                        {
                          conflictType: '날짜',
                          description: '결혼한 연도가 1965년과 1968년으로 불일치합니다.',
                          conflictingItems: ['mem_01', 'mem_02'],
                          followUpQuestion: '어르신, 이전에 1965년에 결혼하셨다고 하셨는데, 방금 말씀하신 1968년 결혼은 어떤 이야기인지 조금만 더 말씀해 주실 수 있을까요?'
                        }
                      ]
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
                      conflicts: []
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

describe('Coherence & Truth Agent', () => {
  it('detects chronological conflicts between memories', async () => {
    const dummyMemories = [
      { id: 'mem_01', text: '나는 1965년 화창한 봄날에 아내와 만나 명동 성당에서 결혼식을 올렸어.' },
      { id: 'mem_02', text: '우리가 1968년에 결혼하고 나서 바로 첫째 아이를 가졌던 것 같아.' }
    ];

    const conflicts = await detectFactualConflicts(dummyMemories);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].conflictType).toBe('날짜');
    expect(conflicts[0].conflictingItems).toContain('mem_01');
    expect(conflicts[0].conflictingItems).toContain('mem_02');
    expect(conflicts[0].followUpQuestion).toContain('1965년');
  });

  it('returns empty array if memory count is less than 2', async () => {
    const conflicts = await detectFactualConflicts([{ id: 'mem_01', text: '기억 하나' }]);
    expect(conflicts).toHaveLength(0);
  });
});
