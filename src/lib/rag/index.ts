/**
 * RAG Index Module
 *
 * Client-side vector index using OpenAI text-embedding-3-small embeddings
 * and cosine similarity search. Persists entries via Zustand store.
 */

import { cosineSimilarity } from './cosine';
import { useStore } from '../../store';
import type { SearchResult, VectorEntry } from '../types';
import { getOpenAIClient } from '../openai-client';

export interface MemoryTags {
  people: string[];
  places: string[];
  emotions: string[];
  timePeriod: string;
}

export interface RAGIndex {
  addMemory(memoryId: string, text: string, tags: MemoryTags): Promise<void>;
  updateMemory(memoryId: string, text: string, tags: MemoryTags): Promise<void>;
  removeMemory(memoryId: string): void;
  search(query: string, topK?: number): Promise<SearchResult[]>;
  searchByEmbedding(embedding: number[], topK?: number): SearchResult[];
  getEmbedding(text: string): Promise<number[]>;
  getIndexSize(): number;
}

/**
 * Combines memory text and tags into a single string for embedding generation.
 * This produces a richer semantic representation for search.
 */
function buildEmbeddingText(text: string, tags: MemoryTags): string {
  const parts: string[] = [text];

  if (tags.people.length > 0) {
    parts.push(`인물: ${tags.people.join(', ')}`);
  }
  if (tags.places.length > 0) {
    parts.push(`장소: ${tags.places.join(', ')}`);
  }
  if (tags.emotions.length > 0) {
    parts.push(`감정: ${tags.emotions.join(', ')}`);
  }
  if (tags.timePeriod) {
    parts.push(`시기: ${tags.timePeriod}`);
  }

  return parts.join('\n');
}

/**
 * Creates a RAG index instance that uses OpenAI embeddings and
 * persists vector entries through the Zustand store.
 */
export function createRAGIndex(): RAGIndex {
  const ragIndex: RAGIndex = {
    /**
     * Generates an embedding for the given text using OpenAI text-embedding-3-small.
     */
    async getEmbedding(text: string): Promise<number[]> {
      const response = await getOpenAIClient().embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });
      return response.data[0].embedding;
    },

    /**
     * Adds a new memory to the RAG index.
     * Combines text and tags, generates an embedding, and persists via store.
     */
    async addMemory(memoryId: string, text: string, tags: MemoryTags): Promise<void> {
      const embeddingText = buildEmbeddingText(text, tags);
      const embedding = await ragIndex.getEmbedding(embeddingText);

      const entry: VectorEntry = {
        memoryId,
        embedding,
        text: embeddingText,
      };

      useStore.getState().addRAGEntry(entry);
    },

    /**
     * Updates an existing memory in the RAG index.
     * Re-generates the embedding with new text/tags and updates the store.
     */
    async updateMemory(memoryId: string, text: string, tags: MemoryTags): Promise<void> {
      const embeddingText = buildEmbeddingText(text, tags);
      const embedding = await ragIndex.getEmbedding(embeddingText);

      const entry: VectorEntry = {
        memoryId,
        embedding,
        text: embeddingText,
      };

      useStore.getState().updateRAGEntry(memoryId, entry);
    },

    /**
     * Removes a memory from the RAG index by its ID.
     */
    removeMemory(memoryId: string): void {
      useStore.getState().removeRAGEntry(memoryId);
    },

    /**
     * Searches the RAG index using a text query.
     * Generates an embedding for the query, then delegates to searchByEmbedding.
     */
    async search(query: string, topK: number = 5): Promise<SearchResult[]> {
      const queryEmbedding = await ragIndex.getEmbedding(query);
      return ragIndex.searchByEmbedding(queryEmbedding, topK);
    },

    /**
     * Searches the RAG index using a pre-computed embedding vector.
     * Computes cosine similarity against all entries and returns top-K
     * results sorted in descending order by score.
     */
    searchByEmbedding(embedding: number[], topK: number = 5): SearchResult[] {
      const entries = useStore.getState().ragIndex.entries;

      const scored: SearchResult[] = entries
        .map((entry) => ({
          memoryId: entry.memoryId,
          score: cosineSimilarity(entry.embedding, embedding),
          text: entry.text,
        }))
        .sort((a, b) => b.score - a.score);

      return scored.slice(0, topK);
    },

    /**
     * Returns the current number of entries in the RAG index.
     */
    getIndexSize(): number {
      return useStore.getState().ragIndex.entries.length;
    },
  };

  return ragIndex;
}

/**
 * Default singleton RAG index instance for use across the application.
 */
export const ragIndex = createRAGIndex();
