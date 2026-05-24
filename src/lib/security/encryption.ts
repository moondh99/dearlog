/**
 * AES-GCM Symmetric Key Encryption Utility using standard Web Crypto API.
 * Compatible with modern browsers and Node.js 19+ (or Vitest test runner).
 */

// Key Derivation function: derives a 256-bit AES-GCM key from a string secret using SHA-256 hash.
async function deriveKey(secretString: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const secretBytes = encoder.encode(secretString);
  
  // Hash the secret string using SHA-256 to get a fixed 256-bit key material
  const hash = await globalThis.crypto.subtle.digest('SHA-256', secretBytes);
  
  return await globalThis.crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a plain text string using a key string.
 * Returns a hexadecimal representation of the combined IV (12 bytes) and ciphertext.
 *
 * @param plainText The text to encrypt.
 * @param keyString The password or key to encrypt with.
 */
export async function encryptText(plainText: string, keyString: string): Promise<string> {
  const key = await deriveKey(keyString);
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(plainText);
  
  // Generate a random 12-byte Initialization Vector (IV)
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  
  const encryptedBuffer = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    dataBytes
  );
  
  const encryptedBytes = new Uint8Array(encryptedBuffer);
  
  // Combine IV (12 bytes) and Ciphertext into a single array
  const combined = new Uint8Array(iv.length + encryptedBytes.length);
  combined.set(iv, 0);
  combined.set(encryptedBytes, iv.length);
  
  // Convert byte array to hex string
  return Array.from(combined)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Decrypts a hex string formatted as (12-byte IV + ciphertext) using a key string.
 *
 * @param cipherTextHex The hex string to decrypt.
 * @param keyString The password or key to decrypt with.
 */
export async function decryptText(cipherTextHex: string, keyString: string): Promise<string> {
  const key = await deriveKey(keyString);
  
  // Convert hex string to byte array
  const combinedLength = cipherTextHex.length / 2;
  const combined = new Uint8Array(combinedLength);
  for (let i = 0; i < combinedLength; i++) {
    combined[i] = parseInt(cipherTextHex.substring(i * 2, i * 2 + 2), 16);
  }
  
  if (combined.length < 12) {
    throw new Error('Invalid ciphertext: too short to contain IV');
  }
  
  // Separate IV and ciphertext
  const iv = combined.slice(0, 12);
  const encryptedBytes = combined.slice(12);
  
  const decryptedBuffer = await globalThis.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encryptedBytes
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}
