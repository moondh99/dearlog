import { beforeEach, describe, expect, it, vi } from 'vitest';

const openAIMocks = vi.hoisted(() => ({
  constructorSpy: vi.fn(),
  embeddingCreate: vi.fn(async () => ({
    data: [{ embedding: [0.1, 0.2, 0.3] }],
  })),
}));

vi.mock('openai', () => ({
  default: class MockOpenAI {
    embeddings = {
      create: openAIMocks.embeddingCreate,
    };

    constructor(config: unknown) {
      openAIMocks.constructorSpy(config);
    }
  },
}));

import { resetOpenAIClientForTests } from '../openai-client';
import { createRAGIndex } from './index';

describe('createRAGIndex', () => {
  beforeEach(() => {
    resetOpenAIClientForTests();
    openAIMocks.constructorSpy.mockClear();
    openAIMocks.embeddingCreate.mockClear();
  });

  it('does not create the OpenAI client until embeddings are requested', async () => {
    const index = createRAGIndex();

    expect(openAIMocks.constructorSpy).not.toHaveBeenCalled();
    expect(index.getIndexSize()).toBeGreaterThanOrEqual(0);
    expect(openAIMocks.constructorSpy).not.toHaveBeenCalled();

    await expect(index.getEmbedding('검색할 문장')).resolves.toEqual([0.1, 0.2, 0.3]);
    expect(openAIMocks.constructorSpy).toHaveBeenCalledTimes(1);
  });

  it('reuses the same OpenAI client for repeated embedding requests', async () => {
    const index = createRAGIndex();

    await index.getEmbedding('첫 번째 문장');
    await index.getEmbedding('두 번째 문장');

    expect(openAIMocks.constructorSpy).toHaveBeenCalledTimes(1);
    expect(openAIMocks.embeddingCreate).toHaveBeenCalledWith({
      model: 'text-embedding-3-small',
      input: '두 번째 문장',
    });
  });
});
