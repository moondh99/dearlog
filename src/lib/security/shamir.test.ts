import { describe, it, expect, vi } from 'vitest';
import { splitSecret, combineShares } from './shamir';

describe("Shamir's Secret Sharing (t-of-n)", () => {
  const secret = "my-super-secure-key-12345!@#";

  it("should split and reconstruct a simple 1-byte secret (2-of-3)", () => {
    const miniSecret = "A";
    const shares = splitSecret(miniSecret, 2, 3);
    expect(shares.length).toBe(3);
    const recovered = combineShares([shares[0], shares[1]]);
    expect(recovered).toBe(miniSecret);
  });

  it("should successfully split and reconstruct using exactly T shares", () => {
    // 3-of-5 scheme
    const t = 3;
    const n = 5;
    const shares = splitSecret(secret, t, n);
    
    expect(shares.length).toBe(n);

    // Test all combinations of size 3 (T)
    const combinations = [
      [shares[0], shares[1], shares[2]],
      [shares[0], shares[2], shares[4]],
      [shares[1], shares[3], shares[4]],
      [shares[2], shares[3], shares[4]],
      [shares[0], shares[1], shares[4]],
    ];

    for (const combo of combinations) {
      const recovered = combineShares(combo);
      expect(recovered).toBe(secret);
    }
  });

  it("should successfully reconstruct when more than T shares are provided", () => {
    const t = 3;
    const n = 5;
    const shares = splitSecret(secret, t, n);

    // Provide 4 shares
    const recovered = combineShares([shares[0], shares[1], shares[2], shares[3]]);
    expect(recovered).toBe(secret);
  });

  it("should fail to reconstruct or return garbage when fewer than T shares are provided", () => {
    const t = 3;
    const n = 5;
    const shares = splitSecret(secret, t, n);

    // Only provide 2 shares (T = 3)
    const recovered = combineShares([shares[0], shares[1]]);
    expect(recovered).not.toBe(secret);
  });

  it("should throw errors for invalid configuration arguments", () => {
    // T must be at least 2
    expect(() => splitSecret(secret, 1, 3)).toThrow();
    // N must be >= T
    expect(() => splitSecret(secret, 3, 2)).toThrow();
    // N cannot exceed 255
    expect(() => splitSecret(secret, 5, 256)).toThrow();
  });

  it("draws coefficients from the CSPRNG, never Math.random", () => {
    // Math.random 의 내부 상태는 출력 몇 개로 되돌릴 수 있다. 그걸로 계수를 뽑으면 조각
    // 하나만 쥔 사람이 나머지를 계산해 비밀을 복원할 수 있어 분할이 무의미해진다.
    const mathRandom = vi.spyOn(Math, "random");
    const getRandomValues = vi.spyOn(globalThis.crypto, "getRandomValues");

    try {
      splitSecret(secret, 3, 3);

      expect(mathRandom).not.toHaveBeenCalled();
      expect(getRandomValues).toHaveBeenCalled();
    } finally {
      mathRandom.mockRestore();
      getRandomValues.mockRestore();
    }
  });

  it("should throw errors for duplicate shares or empty arrays during recovery", () => {
    const shares = splitSecret(secret, 2, 3);
    
    // Empty shares
    expect(() => combineShares([])).toThrow();

    // Duplicate share index x
    expect(() => combineShares([shares[0], shares[0]])).toThrow();
  });
});
