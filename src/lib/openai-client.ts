import {
  createLocalAIChatCompletion,
  createLocalAIEmbedding,
  type LocalAIChatCompletionRequest,
  type LocalAIChatCompletionResponse,
  type LocalAIEmbeddingRequest,
  type LocalAIEmbeddingResponse,
} from './local-server';

export type LocalOpenAIClient = {
  chat: {
    completions: {
      create(input: LocalAIChatCompletionRequest): Promise<LocalAIChatCompletionResponse>;
    };
  };
  embeddings: {
    create(input: LocalAIEmbeddingRequest): Promise<LocalAIEmbeddingResponse>;
  };
};

let client: LocalOpenAIClient | null = null;

function createLocalOpenAIClient(): LocalOpenAIClient {
  return {
    chat: {
      completions: {
        create: createLocalAIChatCompletion,
      },
    },
    embeddings: {
      create: createLocalAIEmbedding,
    },
  };
}

export function getOpenAIClient(): LocalOpenAIClient {
  if (!client) {
    client = createLocalOpenAIClient();
  }

  return client;
}

export function resetOpenAIClientForTests() {
  client = null;
}
