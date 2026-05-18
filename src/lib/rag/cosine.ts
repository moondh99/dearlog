/**
 * Cosine similarity utility for comparing embedding vectors.
 * Used by the RAG index module for semantic search.
 */

/**
 * Calculates the cosine similarity between two vectors.
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns A value between -1 and 1 representing similarity.
 *          Returns 0 for zero vectors or mismatched dimensions.
 * @throws Error if vectors have mismatched dimensions
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `Vector dimension mismatch: a has ${a.length} dimensions, b has ${b.length} dimensions`
    );
  }

  if (a.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  // Handle zero vectors - return 0 when either vector has zero magnitude
  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}
