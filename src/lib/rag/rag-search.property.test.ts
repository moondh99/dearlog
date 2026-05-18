import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { cosineSimilarity } from './cosine';
import type { VectorEntry, SearchResult } from '../types';

/**
 * Helper function: searchByEmbedding
 *
 * Searches a set of VectorEntry objects by computing cosine similarity
 * against a query embedding, returning at most topK results sorted
 * in descending order by score.
 */
function searchByEmbedding(
  entries: VectorEntry[],
  queryEmbedding: number[],
  topK: number = 5
): SearchResult[] {
  const scored = entries
    .map((entry) => ({
      memoryId: entry.memoryId,
      score: cosineSimilarity(entry.embedding, queryEmbedding),
      text: entry.text,
    }))
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, topK);
}

/**
 * Feature: memoir-platform-enhancement, Property 2: RAG Search Returns Sorted Results
 *
 * Validates: Requirements 2.2
 *
 * For any set of vector entries in the RAG index and any query embedding,
 * the search function SHALL return results sorted in descending order by
 * cosine similarity score, with at most topK results (default 5).
 */
describe('Property 2: RAG Search Returns Sorted Results', () => {
  const EMBEDDING_DIM = 8;

  // Generator for a non-zero embedding vector of fixed dimension
  const embeddingArb = fc
    .array(fc.double({ min: -1, max: 1, noNaN: true, noDefaultInfinity: true }), {
      minLength: EMBEDDING_DIM,
      maxLength: EMBEDDING_DIM,
    })
    .filter((arr) => arr.some((v) => v !== 0));

  // Generator for a VectorEntry
  const vectorEntryArb = fc.record({
    memoryId: fc.uuid(),
    embedding: embeddingArb,
    text: fc.string({ minLength: 1, maxLength: 50 }),
  });

  it('results are sorted in descending order by cosine similarity score', () => {
    fc.assert(
      fc.property(
        fc.array(vectorEntryArb, { minLength: 1, maxLength: 20 }),
        embeddingArb,
        fc.integer({ min: 1, max: 20 }),
        (entries, queryEmbedding, topK) => {
          const results = searchByEmbedding(entries, queryEmbedding, topK);

          // Verify descending order
          for (let i = 0; i < results.length - 1; i++) {
            expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('results length is at most topK', () => {
    fc.assert(
      fc.property(
        fc.array(vectorEntryArb, { minLength: 0, maxLength: 20 }),
        embeddingArb,
        fc.integer({ min: 1, max: 20 }),
        (entries, queryEmbedding, topK) => {
          const results = searchByEmbedding(entries, queryEmbedding, topK);

          expect(results.length).toBeLessThanOrEqual(topK);
          expect(results.length).toBeLessThanOrEqual(entries.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('default topK is 5', () => {
    fc.assert(
      fc.property(
        fc.array(vectorEntryArb, { minLength: 6, maxLength: 20 }),
        embeddingArb,
        (entries, queryEmbedding) => {
          const results = searchByEmbedding(entries, queryEmbedding);

          expect(results.length).toBeLessThanOrEqual(5);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('each result score matches the actual cosine similarity with the query', () => {
    fc.assert(
      fc.property(
        fc.array(vectorEntryArb, { minLength: 1, maxLength: 15 }),
        embeddingArb,
        fc.integer({ min: 1, max: 10 }),
        (entries, queryEmbedding, topK) => {
          const results = searchByEmbedding(entries, queryEmbedding, topK);

          for (const result of results) {
            const entry = entries.find((e) => e.memoryId === result.memoryId);
            expect(entry).toBeDefined();
            const expectedScore = cosineSimilarity(entry!.embedding, queryEmbedding);
            expect(result.score).toBeCloseTo(expectedScore);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
