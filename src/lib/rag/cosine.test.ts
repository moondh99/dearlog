import { describe, it, expect } from 'vitest';
import { cosineSimilarity } from './cosine';

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const v = [1, 2, 3];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1);
  });

  it('returns -1 for opposite vectors', () => {
    const a = [1, 0, 0];
    const b = [-1, 0, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1);
  });

  it('returns 0 for orthogonal vectors', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0);
  });

  it('returns 0 for zero vector (first argument)', () => {
    const a = [0, 0, 0];
    const b = [1, 2, 3];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('returns 0 for zero vector (second argument)', () => {
    const a = [1, 2, 3];
    const b = [0, 0, 0];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('returns 0 for both zero vectors', () => {
    const a = [0, 0, 0];
    const b = [0, 0, 0];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('throws an error for mismatched dimensions', () => {
    const a = [1, 2, 3];
    const b = [1, 2];
    expect(() => cosineSimilarity(a, b)).toThrow('Vector dimension mismatch');
  });

  it('returns 0 for empty vectors', () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it('handles single-dimension vectors', () => {
    expect(cosineSimilarity([5], [3])).toBeCloseTo(1);
    expect(cosineSimilarity([5], [-3])).toBeCloseTo(-1);
  });

  it('is independent of vector magnitude', () => {
    const a = [1, 2, 3];
    const b = [2, 4, 6]; // same direction, different magnitude
    expect(cosineSimilarity(a, b)).toBeCloseTo(1);
  });

  it('computes correct similarity for known values', () => {
    const a = [1, 0];
    const b = [1, 1];
    // cos(45°) = 1/√2 ≈ 0.7071
    expect(cosineSimilarity(a, b)).toBeCloseTo(Math.SQRT1_2);
  });
});
