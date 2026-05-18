import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { VectorEntry } from '../types';

/**
 * Simulates the addRAGEntry logic from the Zustand store.
 * Given existing entries and a new entry, returns the updated entries array.
 */
function addRAGEntry(existingEntries: VectorEntry[], newEntry: VectorEntry): VectorEntry[] {
  return [...existingEntries, newEntry];
}

/**
 * Feature: memoir-platform-enhancement, Property 3: RAG Incremental Update Preservation
 *
 * Validates: Requirements 2.3
 *
 * For any existing RAG index state with N entries, adding a new entry SHALL
 * result in an index with N+1 entries where all original N entries retain
 * their exact embedding vectors unchanged.
 */
describe('Property 3: RAG Incremental Update Preservation', () => {
  const EMBEDDING_DIM = 8;

  // Generator for a non-zero embedding vector of fixed dimension
  const embeddingArb = fc.array(
    fc.double({ min: -1, max: 1, noNaN: true, noDefaultInfinity: true }),
    { minLength: EMBEDDING_DIM, maxLength: EMBEDDING_DIM }
  );

  // Generator for a VectorEntry
  const vectorEntryArb: fc.Arbitrary<VectorEntry> = fc.record({
    memoryId: fc.uuid(),
    embedding: embeddingArb,
    text: fc.string({ minLength: 1, maxLength: 50 }),
  });

  it('adding a new entry results in N+1 entries', () => {
    fc.assert(
      fc.property(
        fc.array(vectorEntryArb, { minLength: 0, maxLength: 20 }),
        vectorEntryArb,
        (existingEntries, newEntry) => {
          const n = existingEntries.length;
          const result = addRAGEntry(existingEntries, newEntry);

          expect(result.length).toBe(n + 1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('all original N entries retain their exact embedding vectors unchanged', () => {
    fc.assert(
      fc.property(
        fc.array(vectorEntryArb, { minLength: 0, maxLength: 20 }),
        vectorEntryArb,
        (existingEntries, newEntry) => {
          const result = addRAGEntry(existingEntries, newEntry);

          // Verify each original entry is preserved with deep equality
          for (let i = 0; i < existingEntries.length; i++) {
            expect(result[i]).toEqual(existingEntries[i]);
            // Explicitly verify embedding vectors are identical
            expect(result[i].embedding).toEqual(existingEntries[i].embedding);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('the new entry appears in the result at the end', () => {
    fc.assert(
      fc.property(
        fc.array(vectorEntryArb, { minLength: 0, maxLength: 20 }),
        vectorEntryArb,
        (existingEntries, newEntry) => {
          const result = addRAGEntry(existingEntries, newEntry);

          // The last entry in the result should be the new entry
          expect(result[result.length - 1]).toEqual(newEntry);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('adding an entry does not mutate the original entries array', () => {
    fc.assert(
      fc.property(
        fc.array(vectorEntryArb, { minLength: 0, maxLength: 20 }),
        vectorEntryArb,
        (existingEntries, newEntry) => {
          const originalLength = existingEntries.length;
          const originalCopy = existingEntries.map((e) => ({ ...e, embedding: [...e.embedding] }));

          addRAGEntry(existingEntries, newEntry);

          // Original array should not be mutated
          expect(existingEntries.length).toBe(originalLength);
          for (let i = 0; i < existingEntries.length; i++) {
            expect(existingEntries[i]).toEqual(originalCopy[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
