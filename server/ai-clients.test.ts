// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const openAIMock = vi.hoisted(() => ({
  instances: [] as Array<Record<string, unknown>>,
}));

vi.mock('openai', () => ({
  default: class MockOpenAI {
    constructor(options: Record<string, unknown>) {
      openAIMock.instances.push(options);
    }
  },
}));

import {
  FACTCHAT_DEFAULT_BASE_URL,
  FACTCHAT_DEFAULT_CHAT_MODEL,
  FACTCHAT_GPT5_MIN_COMPLETION_TOKENS,
  getFactChatClient,
  getFactChatSettings,
  getOpenAIClient,
  normalizeFactChatChatCompletionInput,
  resetAIClientsForTests,
} from './ai-clients';

describe('AI provider client configuration', () => {
  beforeEach(() => {
    process.env.ALLOW_OPENAI_IN_TESTS = 'true';
    delete process.env.FACTCHAT_API_KEY;
    delete process.env.FACTCHAT_BASE_URL;
    delete process.env.FACTCHAT_CHAT_MODEL;
    delete process.env.FACTCHAT_VISION_MODEL;
    delete process.env.FACTCHAT_WRITING_MODEL;
    delete process.env.OPENAI_API_KEY;
    openAIMock.instances = [];
    resetAIClientsForTests();
  });

  it('uses FactChat Gateway defaults when model settings are omitted', () => {
    const settings = getFactChatSettings();

    expect(settings.baseURL).toBe(FACTCHAT_DEFAULT_BASE_URL);
    expect(settings.chatModel).toBe(FACTCHAT_DEFAULT_CHAT_MODEL);
    expect(settings.visionModel).toBe(FACTCHAT_DEFAULT_CHAT_MODEL);
    expect(settings.writingModel).toBe(FACTCHAT_DEFAULT_CHAT_MODEL);
  });

  it('creates FactChat clients with the configured Gateway base URL', () => {
    process.env.FACTCHAT_API_KEY = 'factchat-test-key';
    process.env.FACTCHAT_BASE_URL = 'https://factchat.example.test/v1/gateway';

    getFactChatClient();

    expect(openAIMock.instances).toEqual([
      {
        apiKey: 'factchat-test-key',
        baseURL: 'https://factchat.example.test/v1/gateway',
      },
    ]);
  });

  it('normalizes legacy OpenAI chat models to the configured FactChat model', () => {
    process.env.FACTCHAT_CHAT_MODEL = 'gpt-5-mini';

    const input = normalizeFactChatChatCompletionInput({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: '안녕하세요' }],
      temperature: 0.2,
      max_tokens: 700,
    });

    expect(input.model).toBe('gpt-5-mini');
    expect(input.temperature).toBe(1);
    expect(input.max_tokens).toBeUndefined();
    expect(input.max_completion_tokens).toBe(700);
  });

  it('only applies the GPT-5 default token floor when no explicit max is provided', () => {
    process.env.FACTCHAT_CHAT_MODEL = 'gpt-5-mini';

    const input = normalizeFactChatChatCompletionInput({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: '안녕하세요' }],
      temperature: 0.2,
    });

    expect(input.model).toBe('gpt-5-mini');
    expect(input.max_tokens).toBeUndefined();
    expect(input.max_completion_tokens).toBe(FACTCHAT_GPT5_MIN_COMPLETION_TOKENS);
  });

  it('keeps non-legacy non-GPT-5 chat models unchanged', () => {
    const input = normalizeFactChatChatCompletionInput({
      model: 'solar-pro3',
      messages: [{ role: 'user', content: 'Hello' }],
      temperature: 0.2,
      max_tokens: 700,
    });

    expect(input.model).toBe('solar-pro3');
    expect(input.temperature).toBe(0.2);
    expect(input.max_tokens).toBe(700);
    expect(input.max_completion_tokens).toBeUndefined();
  });

  it('routes Dearlog writing requests to the configured writing model and normalizes Claude options', () => {
    process.env.FACTCHAT_CHAT_MODEL = 'gpt-5.5';
    process.env.FACTCHAT_WRITING_MODEL = 'claude-test-model';

    const input = normalizeFactChatChatCompletionInput({
      model: 'dearlog-writing',
      messages: [{ role: 'user', content: '자서전 문단을 다듬어 주세요.' }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_completion_tokens: 1200,
    }, 'writing');

    expect(input.model).toBe('claude-test-model');
    expect(input.temperature).toBeUndefined();
    expect(input.response_format).toBeUndefined();
    expect(input.max_tokens).toBe(1200);
    expect(input.max_completion_tokens).toBeUndefined();
  });

  it('keeps OpenAI clients separate for embeddings and realtime use cases', () => {
    process.env.FACTCHAT_API_KEY = 'factchat-test-key';
    process.env.OPENAI_API_KEY = 'openai-test-key';

    getOpenAIClient();

    expect(openAIMock.instances).toEqual([{ apiKey: 'openai-test-key' }]);
  });
});
