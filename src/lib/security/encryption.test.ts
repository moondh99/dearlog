import { describe, it, expect } from 'vitest';
import { encryptText, decryptText } from './encryption';

describe('AES-GCM Encryption Utility', () => {
  const SECRET_KEY = 'test-secret-key-1234';
  const PLAIN_TEXT = '안녕하세요. 디어로그 사후 타임캡슐 암호화 테스트 데이터입니다. 1234!@#$';

  it('should encrypt and decrypt a plain text string successfully', async () => {
    const encrypted = await encryptText(PLAIN_TEXT, SECRET_KEY);
    expect(encrypted).toBeDefined();
    expect(typeof encrypted).toBe('string');
    expect(encrypted.length).toBeGreaterThan(0);

    const decrypted = await decryptText(encrypted, SECRET_KEY);
    expect(decrypted).toBe(PLAIN_TEXT);
  });

  it('should encrypt and decrypt JSON data formats', async () => {
    const data = {
      id: 'test_memory_id',
      topic: '가족들과의 부산 영도 바다 여행',
      transcript: '내가 스물두 살 때 영도 바닷가에서 신랑이랑 붕어빵을 사 먹었는데...',
      tags: ['부산', '영도', '붕어빵', '가족'],
    };
    
    const plainJson = JSON.stringify(data);
    const encrypted = await encryptText(plainJson, SECRET_KEY);
    const decrypted = await decryptText(encrypted, SECRET_KEY);
    
    const parsed = JSON.parse(decrypted);
    expect(parsed).toEqual(data);
  });

  it('should output different ciphertexts for the same plaintext due to random IV', async () => {
    const encrypted1 = await encryptText(PLAIN_TEXT, SECRET_KEY);
    const encrypted2 = await encryptText(PLAIN_TEXT, SECRET_KEY);
    
    expect(encrypted1).not.toBe(encrypted2);
    
    // Both should decrypt to the same plaintext
    const decrypted1 = await decryptText(encrypted1, SECRET_KEY);
    const decrypted2 = await decryptText(encrypted2, SECRET_KEY);
    expect(decrypted1).toBe(PLAIN_TEXT);
    expect(decrypted2).toBe(PLAIN_TEXT);
  });

  it('should fail to decrypt with an incorrect key', async () => {
    const encrypted = await encryptText(PLAIN_TEXT, SECRET_KEY);
    
    await expect(
      decryptText(encrypted, 'wrong-secret-key')
    ).rejects.toThrow();
  });

  it('should fail to decrypt if ciphertext is too short', async () => {
    const tooShortHex = '0011223344'; // 5 bytes (less than 12 bytes IV)
    
    await expect(
      decryptText(tooShortHex, SECRET_KEY)
    ).rejects.toThrow('Invalid ciphertext: too short to contain IV');
  });

  it('should fail to decrypt if ciphertext data is corrupted', async () => {
    const encrypted = await encryptText(PLAIN_TEXT, SECRET_KEY);
    
    // Corrupt one character in the ciphertext
    const corruptedHex = encrypted.substring(0, encrypted.length - 1) + (encrypted.endsWith('0') ? '1' : '0');
    
    await expect(
      decryptText(corruptedHex, SECRET_KEY)
    ).rejects.toThrow();
  });
});
