import { beforeEach, describe, expect, it, vi } from 'vitest';

const localServerMocks = vi.hoisted(() => ({
  createLocalAIChatCompletion: vi.fn(),
  createLocalAIEmbedding: vi.fn(),
}));

vi.mock('./local-server', () => ({
  createLocalAIChatCompletion: localServerMocks.createLocalAIChatCompletion,
  createLocalAIEmbedding: localServerMocks.createLocalAIEmbedding,
}));

import { getOpenAIClient, resetOpenAIClientForTests } from './openai-client';

describe('openai client local proxy singleton', () => {
  beforeEach(() => {
    resetOpenAIClientForTests();
    localServerMocks.createLocalAIChatCompletion.mockReset();
    localServerMocks.createLocalAIEmbedding.mockReset();
  });

  it('does not call the local AI API until requested', async () => {
    await import('./agents/interviewer');
    await import('./agents/ghostwriter');
    await import('./agents/verification');
    await import('./agents/archivist');
    await import('./agents/digitalTwin');
    await import('./agents/calendarTrigger');
    await import('./agents/questionQueue');

    expect(localServerMocks.createLocalAIChatCompletion).not.toHaveBeenCalled();
    expect(localServerMocks.createLocalAIEmbedding).not.toHaveBeenCalled();
  });

  it('creates and reuses one shared local proxy client', () => {
    const first = getOpenAIClient();
    const second = getOpenAIClient();

    expect(first).toBe(second);
  });

  it('routes chat completions and embeddings through the local server API', async () => {
    localServerMocks.createLocalAIChatCompletion.mockResolvedValueOnce({
      choices: [{ message: { content: '안녕하세요' } }],
    });
    localServerMocks.createLocalAIEmbedding.mockResolvedValueOnce({
      data: [{ embedding: [0.1, 0.2] }],
    });

    const client = getOpenAIClient();
    await expect(client.chat.completions.create({ model: 'gpt-4o-mini', messages: [] })).resolves.toEqual({
      choices: [{ message: { content: '안녕하세요' } }],
    });
    await expect(client.embeddings.create({ model: 'text-embedding-3-small', input: '기억' })).resolves.toEqual({
      data: [{ embedding: [0.1, 0.2] }],
    });

    expect(localServerMocks.createLocalAIChatCompletion).toHaveBeenCalledWith({ model: 'gpt-4o-mini', messages: [] });
    expect(localServerMocks.createLocalAIEmbedding).toHaveBeenCalledWith({ model: 'text-embedding-3-small', input: '기억' });
  });
});
