import OpenAI from 'openai';
import { config } from './config';

export const FACTCHAT_DEFAULT_BASE_URL = 'https://factchat-cloud.mindlogic.ai/v1/gateway';
export const FACTCHAT_DEFAULT_CHAT_MODEL = 'gpt-5-mini';
export const FACTCHAT_GPT5_MIN_COMPLETION_TOKENS = 16000;

type FactChatPurpose = 'chat' | 'vision' | 'writing';

let factChatClient: OpenAI | null = null;
let factChatClientKey = '';
let openAIClient: OpenAI | null = null;
let openAIClientKey = '';

function nonEmpty(...values: Array<string | undefined | null>) {
  return values.find((value): value is string => typeof value === 'string' && value.trim().length > 0)?.trim();
}

function providersDisabledInTests() {
  return process.env.NODE_ENV === 'test' && process.env.ALLOW_OPENAI_IN_TESTS !== 'true';
}

function configError(message: string) {
  return Object.assign(new Error(message), { statusCode: 503 });
}

export function getFactChatSettings() {
  const chatModel = nonEmpty(process.env.FACTCHAT_CHAT_MODEL, config.factchat.chatModel)
    ?? FACTCHAT_DEFAULT_CHAT_MODEL;
  return {
    apiKey: providersDisabledInTests()
      ? ''
      : nonEmpty(process.env.FACTCHAT_API_KEY, config.factchat.apiKey) ?? '',
    baseURL: nonEmpty(process.env.FACTCHAT_BASE_URL, config.factchat.baseUrl)
      ?? FACTCHAT_DEFAULT_BASE_URL,
    chatModel,
    visionModel: nonEmpty(process.env.FACTCHAT_VISION_MODEL, config.factchat.visionModel)
      ?? chatModel,
    writingModel: nonEmpty(process.env.FACTCHAT_WRITING_MODEL, config.factchat.writingModel)
      ?? chatModel,
  };
}

export function getOpenAISettings() {
  return {
    apiKey: providersDisabledInTests()
      ? ''
      : nonEmpty(process.env.OPENAI_API_KEY, config.openaiApiKey) ?? '',
  };
}

export function hasFactChatApiKey() {
  return getFactChatSettings().apiKey.length > 0;
}

export function getFactChatClient() {
  const settings = getFactChatSettings();
  if (!settings.apiKey) {
    throw configError('FACTCHAT_API_KEY가 설정되지 않았습니다.');
  }

  const cacheKey = `${settings.apiKey}\n${settings.baseURL}`;
  if (!factChatClient || factChatClientKey !== cacheKey) {
    factChatClient = new OpenAI({
      apiKey: settings.apiKey,
      baseURL: settings.baseURL,
    });
    factChatClientKey = cacheKey;
  }

  return factChatClient;
}

export function getOpenAIClient() {
  const settings = getOpenAISettings();
  if (!settings.apiKey) {
    throw configError('OPENAI_API_KEY가 설정되지 않았습니다.');
  }

  if (!openAIClient || openAIClientKey !== settings.apiKey) {
    openAIClient = new OpenAI({ apiKey: settings.apiKey });
    openAIClientKey = settings.apiKey;
  }

  return openAIClient;
}

export function resolveFactChatModel(requestedModel: unknown, purpose: FactChatPurpose = 'chat') {
  const model = typeof requestedModel === 'string' ? requestedModel.trim() : '';
  const settings = getFactChatSettings();
  const configuredModel = purpose === 'vision'
    ? settings.visionModel
    : purpose === 'writing'
      ? settings.writingModel
      : settings.chatModel;
  if (model === 'dearlog-writing') {
    return settings.writingModel;
  }
  if (!model || model === 'gpt-4o' || model === 'gpt-4o-mini') {
    return configuredModel;
  }
  return model;
}

export function isFactChatGpt5Model(model: string) {
  return /^gpt-5(?:[.\-]|$)/.test(model);
}

export function isFactChatClaudeModel(model: string) {
  return /^claude(?:[.\-]|$)/.test(model);
}

export function normalizeFactChatChatCompletionInput(
  input: Record<string, unknown>,
  purpose: FactChatPurpose = 'chat',
) {
  const normalized = { ...input };
  const model = resolveFactChatModel(normalized.model, purpose);
  normalized.model = model;

  if (isFactChatClaudeModel(model)) {
    delete normalized.temperature;

    const responseFormat = normalized.response_format as { type?: unknown } | undefined;
    if (responseFormat?.type === 'json_object') {
      delete normalized.response_format;
    }

    if (normalized.max_completion_tokens !== undefined && normalized.max_tokens === undefined) {
      normalized.max_tokens = normalized.max_completion_tokens;
      delete normalized.max_completion_tokens;
    }
  }

  if (isFactChatGpt5Model(model)) {
    if (normalized.temperature !== undefined && normalized.temperature !== 1) {
      normalized.temperature = 1;
    }

    const explicitMaxCompletion = Number(normalized.max_completion_tokens);
    const explicitMaxTokens = Number(normalized.max_tokens);
    const currentLimit = Number.isFinite(explicitMaxCompletion)
      ? explicitMaxCompletion
      : Number.isFinite(explicitMaxTokens)
        ? explicitMaxTokens
        : undefined;

    if (currentLimit === undefined) {
      normalized.max_completion_tokens = FACTCHAT_GPT5_MIN_COMPLETION_TOKENS;
      delete normalized.max_tokens;
    } else if (normalized.max_tokens !== undefined) {
      normalized.max_completion_tokens = currentLimit;
      delete normalized.max_tokens;
    }
  }

  return normalized;
}

export function resetAIClientsForTests() {
  factChatClient = null;
  factChatClientKey = '';
  openAIClient = null;
  openAIClientKey = '';
}
