/**
 * Shamir's Secret Sharing Utility in Galois Field GF(2^8)
 * Allows splitting a secret string into N shares, where any T shares can reconstruct the secret.
 */

// Irreducible polynomial for GF(2^8): x^8 + x^4 + x^3 + x + 1 (0x11b)
const PRIMITIVE = 0x11b;

// Precompute log and exponent tables for O(1) multiplication/division in GF(2^8)
const gfLog = new Uint8Array(256);
const gfExp = new Uint8Array(512);

let val = 1;
for (let i = 0; i < 255; i++) {
  gfLog[val] = i;
  gfExp[i] = val;
  gfExp[i + 255] = val;
  let nextVal = val << 1;
  if (nextVal & 0x100) {
    nextVal ^= PRIMITIVE;
  }
  val = nextVal ^ val;
}
gfLog[0] = 0;

/**
 * Multiplication in GF(2^8)
 */
function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return gfExp[gfLog[a] + gfLog[b]];
}

/**
 * Division in GF(2^8)
 */
function gfDiv(a: number, b: number): number {
  if (b === 0) throw new Error("Division by zero in GF(2^8)");
  if (a === 0) return 0;
  let diff = gfLog[a] - gfLog[b];
  if (diff < 0) diff += 255;
  return gfExp[diff];
}

/**
 * Evaluate polynomial at x in GF(2^8)
 * coefficients[0] is the constant term (the secret byte)
 */
function evalPolynomial(coefficients: number[], x: number): number {
  if (x === 0) return coefficients[0];
  
  let result = 0;
  let xPower = 1; // x^0
  
  for (let i = 0; i < coefficients.length; i++) {
    result ^= gfMul(coefficients[i], xPower);
    xPower = gfMul(xPower, x);
  }
  
  return result;
}

export interface Share {
  x: number;
  data: string; // Hex representation of evaluated bytes
}

/**
 * Splits a secret string into N shares, requiring T shares to reconstruct.
 * @param secret The secret string to split.
 * @param t Threshold (minimum shares required to reconstruct).
 * @param n Total number of shares to generate.
 */
export function splitSecret(secret: string, t: number, n: number): Share[] {
  if (t < 2) throw new Error("Threshold T must be at least 2.");
  if (n < t) throw new Error("Total shares N must be greater than or equal to threshold T.");
  if (n > 255) throw new Error("Total shares N cannot exceed 255.");

  const encoder = new TextEncoder();
  const secretBytes = encoder.encode(secret);
  
  // Initialize N shares
  const shares: Share[] = Array.from({ length: n }, (_, idx) => ({
    x: idx + 1,
    data: "",
  }));
  
  const sharesDataArrays = Array.from({ length: n }, () => new Uint8Array(secretBytes.length));

  for (let b = 0; b < secretBytes.length; b++) {
    const secretByte = secretBytes[b];
    
    // Generate polynomial coefficients: f(x) = a_0 + a_1*x + ... + a_{t-1}*x^{t-1}
    // a_0 is the secret byte
    const coefficients = new Array<number>(t);
    coefficients[0] = secretByte;
    
    for (let c = 1; c < t; c++) {
      // Pick random coefficient in GF(2^8) (excluding 0 to ensure degree t-1, though not strictly required, it's safer)
      let randCoeff = 0;
      while (randCoeff === 0) {
        randCoeff = Math.floor(Math.random() * 256);
      }
      coefficients[c] = randCoeff;
    }
    
    // Evaluate polynomial for each share x = 1 to N
    for (let s = 0; s < n; s++) {
      const xValue = shares[s].x;
      sharesDataArrays[s][b] = evalPolynomial(coefficients, xValue);
    }
  }

  // Convert Uint8Arrays to hex strings for transmission
  for (let s = 0; s < n; s++) {
    shares[s].data = Array.from(sharesDataArrays[s])
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
  }

  return shares;
}

/**
 * Reconstructs the secret string from a list of T (or more) shares.
 * @param shares List of Share objects.
 */
export function combineShares(shares: Share[]): string {
  if (shares.length === 0) throw new Error("No shares provided.");
  
  // Validate unique x values
  const xValues = new Set<number>();
  for (const share of shares) {
    if (share.x <= 0 || share.x > 255) {
      throw new Error(`Invalid share index x: ${share.x}`);
    }
    xValues.add(share.x);
  }
  
  if (xValues.size !== shares.length) {
    throw new Error("Duplicate shares detected.");
  }
  
  const length = shares[0].data.length / 2;
  const secretBytes = new Uint8Array(length);

  // Convert hex strings to byte arrays
  const sharesBytes = shares.map(share => {
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = parseInt(share.data.substring(i * 2, i * 2 + 2), 16);
    }
    return {
      x: share.x,
      bytes,
    };
  });

  // Reconstruct each byte using Lagrange interpolation at x = 0
  for (let b = 0; b < length; b++) {
    let secretByte = 0;
    
    for (let i = 0; i < shares.length; i++) {
      const xi = sharesBytes[i].x;
      const yi = sharesBytes[i].bytes[b];
      
      // Calculate Lagrange basis polynomial l_i(0)
      let li = 1;
      for (let j = 0; j < shares.length; j++) {
        if (i === j) continue;
        const xj = sharesBytes[j].x;
        
        // li = li * (0 - xj) / (xi - xj)
        // In GF(2^8), subtraction is XOR, so 0 - xj is just xj, and xi - xj is xi ^ xj.
        const numerator = xj;
        const denominator = xi ^ xj;
        
        li = gfMul(li, gfDiv(numerator, denominator));
      }
      
      // Accumulate: f(0) = sum(yi * l_i(0))
      secretByte ^= gfMul(yi, li);
    }
    
    secretBytes[b] = secretByte;
  }

  const decoder = new TextDecoder();
  return decoder.decode(secretBytes);
}
