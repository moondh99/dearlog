import { beforeEach, describe, expect, it, vi } from 'vitest';

const openAIMocks = vi.hoisted(() => ({
  constructorSpy: vi.fn(),
}));

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: vi.fn(),
      },
    };

    embeddings = {
      create: vi.fn(),
    };

    constructor(config: unknown) {
      openAIMocks.constructorSpy(config);
    }
  },
}));

import { getOpenAIClient, resetOpenAIClientForTests } from './openai-client';

describe('openai client lazy singleton', () => {
  beforeEach(() => {
    resetOpenAIClientForTests();
    openAIMocks.constructorSpy.mockClear();
  });

  it('does not instantiate OpenAI until requested', async () => {
    await import('./agents/emotion-analyzer');
    await import('./agents/interviewer');
    await import('./agents/ghostwriter');
    await import('./agents/calendar-trigger');
    await import('./agents/photo-recall');
    await import('./agents/verification');
    await import('./agents/family-question-queue');
    await import('./agents/persona');
    await import('./agents/archivist');
    await import('./openai');

    expect(openAIMocks.constructorSpy).not.toHaveBeenCalled();
  });

  it('creates and reuses one shared client on demand', () => {
    const first = getOpenAIClient();
    const second = getOpenAIClient();

    expect(first).toBe(second);
    expect(openAIMocks.constructorSpy).toHaveBeenCalledTimes(1);
  });
});
