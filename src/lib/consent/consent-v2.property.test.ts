import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  getAccessTier,
  canAccessV2,
  isSensitiveMemory,
  getDefaultConsentSettingsV2,
  updateConsentV2,
  filterAccessibleMemoriesV2,
  compareAccessTiers,
  type AccessTierV2,
  type ConsentCategoryV2,
  type ConsentSettingsV2,
} from './manager';
import type { Memory, UserRole, ConsentStatus } from '../types';

/**
 * Feature: agent-model-v2, Property 18: Access hierarchy enforcement
 *
 * Validates: Requirements 7.2
 *
 * For any memory with access tier T and any user with role R, if T = 'NO ACCESS' then
 * no non-senior user can access; if T = 'SUMMARY' then only summary is accessible;
 * the hierarchy NO ACCESS < SUMMARY < FULL READ < FULL ACCESS SHALL be strictly enforced
 * such that a lower tier never grants more permissions than a higher tier.
 */

/**
 * Feature: agent-model-v2, Property 19: Sensitive memory default consent
 *
 * Validates: Requirements 7.3
 *
 * For any memory whose emotion tags contain a sensitive keyword (슬픔, 분노, 후회, 트라우마),
 * the default consent status SHALL be 'revoked' (private).
 */

/**
 * Feature: agent-model-v2, Property 20: Consent change immediate consistency
 *
 * Validates: Requirements 7.4
 *
 * For any consent modification on a memory, all subsequent access checks (canAccess,
 * filterAccessibleMemories) SHALL immediately reflect the new consent state without
 * requiring any refresh or propagation delay.
 */

// ─── Shared Generators ─────────────────────────────────────────────────────────

const SENSITIVE_EMOTIONS = ['슬픔', '분노', '후회', '트라우마'];

const userRoleArb: fc.Arbitrary<UserRole> = fc.constantFrom('senior', 'guardian');

const consentStatusArb: fc.Arbitrary<ConsentStatus> = fc.constantFrom('granted', 'revoked');

const consentCategoryArb: fc.Arbitrary<ConsentCategoryV2> = fc.constantFrom(
  '출판',
  '가족열람',
  '챗봇',
  '사후공개',
  '민감정보'
);

const consentSettingsArb: fc.Arbitrary<ConsentSettingsV2> = fc.record({
  출판: consentStatusArb,
  가족열람: consentStatusArb,
  챗봇: consentStatusArb,
  사후공개: consentStatusArb,
  민감정보: consentStatusArb,
});

const accessTierV2Arb: fc.Arbitrary<AccessTierV2> = fc.constantFrom(
  'NO_ACCESS',
  'SUMMARY',
  'FULL_READ',
  'FULL_ACCESS'
);

const dateStringArb = fc
  .tuple(
    fc.integer({ min: 2000, max: 2030 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 })
  )
  .map(([y, m, d]) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);

const nonSensitiveEmotionArb = fc.constantFrom('기쁨', '평온', '감사', '설렘', '희망', '사랑');
const sensitiveEmotionArb = fc.constantFrom(...SENSITIVE_EMOTIONS);

const memoryArb = (emotionsOverride?: fc.Arbitrary<string[]>): fc.Arbitrary<Memory> =>
  fc.record({
    id: fc.uuid(),
    date: dateStringArb,
    topic: fc.string({ minLength: 1, maxLength: 30 }),
    originalTranscript: fc.string({ minLength: 1, maxLength: 50 }),
    cleanedTranscript: fc.string({ minLength: 1, maxLength: 50 }),
    publishVersion: fc.string({ minLength: 1, maxLength: 50 }),
    tags: fc.record({
      people: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 0, maxLength: 2 }),
      places: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 0, maxLength: 2 }),
      emotions: emotionsOverride ?? fc.array(nonSensitiveEmotionArb, { minLength: 0, maxLength: 3 }),
      timePeriod: fc.string({ minLength: 1, maxLength: 10 }),
    }),
    privacy: fc.constantFrom('public' as const, 'family' as const, 'private' as const),
    confidenceLabel: fc.constantFrom('확인됨' as const, '추정' as const, '추가 확인 필요' as const),
    contradictions: fc.array(fc.uuid(), { minLength: 0, maxLength: 2 }),
    consent: fc.record({
      status: consentStatusArb,
      accessTier: fc.constantFrom('본인만' as const, '지정 가족' as const, '전체 가족' as const),
      designatedFamilyIds: fc.array(fc.uuid(), { minLength: 0, maxLength: 3 }),
      lastModified: dateStringArb.map((d) => `${d}T00:00:00.000Z`),
    }),
    embedding: fc.constant(null),
  });

// ─── Property 18: Access hierarchy enforcement ─────────────────────────────────

describe('Feature: agent-model-v2, Property 18: Access hierarchy enforcement', () => {
  it('senior users always get FULL_ACCESS regardless of consent settings', () => {
    fc.assert(
      fc.property(consentSettingsArb, (settings) => {
        const tier = getAccessTier(settings, 'senior');
        expect(tier).toBe('FULL_ACCESS');
      }),
      { numRuns: 100 }
    );
  });

  it('family users get tier based on consent: revoked 가족열람 → NO_ACCESS', () => {
    fc.assert(
      fc.property(
        consentSettingsArb.map((s) => ({ ...s, 가족열람: 'revoked' as ConsentStatus })),
        (settings) => {
          const tier = getAccessTier(settings, 'family');
          expect(tier).toBe('NO_ACCESS');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('family users get SUMMARY when 가족열람 granted but 민감정보 revoked', () => {
    fc.assert(
      fc.property(
        consentSettingsArb.map((s) => ({
          ...s,
          가족열람: 'granted' as ConsentStatus,
          민감정보: 'revoked' as ConsentStatus,
        })),
        (settings) => {
          const tier = getAccessTier(settings, 'family');
          expect(tier).toBe('SUMMARY');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('family users get FULL_READ when both 가족열람 and 민감정보 are granted', () => {
    fc.assert(
      fc.property(
        consentSettingsArb.map((s) => ({
          ...s,
          가족열람: 'granted' as ConsentStatus,
          민감정보: 'granted' as ConsentStatus,
        })),
        (settings) => {
          const tier = getAccessTier(settings, 'family');
          expect(tier).toBe('FULL_READ');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('compareAccessTiers maintains strict ordering: NO_ACCESS < SUMMARY < FULL_READ < FULL_ACCESS', () => {
    fc.assert(
      fc.property(
        accessTierV2Arb,
        accessTierV2Arb,
        (tierA, tierB) => {
          const orderedTiers: AccessTierV2[] = ['NO_ACCESS', 'SUMMARY', 'FULL_READ', 'FULL_ACCESS'];
          const indexA = orderedTiers.indexOf(tierA);
          const indexB = orderedTiers.indexOf(tierB);
          const comparison = compareAccessTiers(tierA, tierB);

          if (indexA < indexB) {
            expect(comparison).toBeLessThan(0);
          } else if (indexA > indexB) {
            expect(comparison).toBeGreaterThan(0);
          } else {
            expect(comparison).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('a lower tier never grants more permissions than a higher tier', () => {
    fc.assert(
      fc.property(
        consentSettingsArb,
        userRoleArb,
        consentCategoryArb,
        memoryArb(),
        (settings, role, category, memory) => {
          const tier = getAccessTier(settings, role);
          const canAccess = canAccessV2(memory, settings, role, category);

          // If tier is NO_ACCESS and role is not senior, access should be denied
          if (tier === 'NO_ACCESS' && role !== 'senior') {
            expect(canAccess).toBe(false);
          }

          // Senior always has access regardless of tier
          if (role === 'senior') {
            expect(canAccess).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 19: Sensitive memory default consent ─────────────────────────────

describe('Feature: agent-model-v2, Property 19: Sensitive memory default consent', () => {
  it('memories with sensitive emotion tags default to all-revoked consent', () => {
    fc.assert(
      fc.property(
        memoryArb(
          fc
            .tuple(
              sensitiveEmotionArb,
              fc.array(fc.oneof(sensitiveEmotionArb, nonSensitiveEmotionArb), {
                minLength: 0,
                maxLength: 3,
              })
            )
            .map(([sensitive, others]) => [sensitive, ...others])
        ),
        (memory) => {
          expect(isSensitiveMemory(memory)).toBe(true);

          const defaults = getDefaultConsentSettingsV2(memory);
          expect(defaults.출판).toBe('revoked');
          expect(defaults.가족열람).toBe('revoked');
          expect(defaults.챗봇).toBe('revoked');
          expect(defaults.사후공개).toBe('revoked');
          expect(defaults.민감정보).toBe('revoked');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('memories without sensitive emotion tags default to all-granted consent', () => {
    fc.assert(
      fc.property(
        memoryArb(fc.array(nonSensitiveEmotionArb, { minLength: 0, maxLength: 4 })),
        (memory) => {
          expect(isSensitiveMemory(memory)).toBe(false);

          const defaults = getDefaultConsentSettingsV2(memory);
          expect(defaults.출판).toBe('granted');
          expect(defaults.가족열람).toBe('granted');
          expect(defaults.챗봇).toBe('granted');
          expect(defaults.사후공개).toBe('granted');
          expect(defaults.민감정보).toBe('granted');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 20: Consent change immediate consistency ─────────────────────────

describe('Feature: agent-model-v2, Property 20: Consent change immediate consistency', () => {
  it('updateConsentV2 immediately reflects in canAccessV2 checks', () => {
    fc.assert(
      fc.property(
        consentSettingsArb,
        consentCategoryArb,
        consentStatusArb,
        memoryArb(),
        (settings, category, newStatus, memory) => {
          // Update the consent for a specific category
          const updatedSettings = updateConsentV2(settings, category, newStatus);

          // Verify the updated settings reflect the change
          expect(updatedSettings[category]).toBe(newStatus);

          // Immediately check access with the updated settings
          const accessResult = canAccessV2(memory, updatedSettings, 'family', category);

          // If the category is revoked, family user should not have access for that category
          if (newStatus === 'revoked') {
            expect(accessResult).toBe(false);
          }

          // Senior always has access regardless
          const seniorAccess = canAccessV2(memory, updatedSettings, 'senior', category);
          expect(seniorAccess).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('updateConsentV2 immediately reflects in filterAccessibleMemoriesV2', () => {
    fc.assert(
      fc.property(
        fc.array(memoryArb(), { minLength: 1, maxLength: 5 }),
        consentCategoryArb,
        consentStatusArb,
        (memories, category, newStatus) => {
          // Create consent settings map - start with all granted
          const consentMap = new Map<string, ConsentSettingsV2>();
          for (const memory of memories) {
            consentMap.set(memory.id, {
              출판: 'granted',
              가족열람: 'granted',
              챗봇: 'granted',
              사후공개: 'granted',
              민감정보: 'granted',
            });
          }

          // Pick the first memory to update
          const targetMemory = memories[0];
          const originalSettings = consentMap.get(targetMemory.id)!;
          const updatedSettings = updateConsentV2(originalSettings, category, newStatus);
          consentMap.set(targetMemory.id, updatedSettings);

          // Immediately filter with the updated map
          const filtered = filterAccessibleMemoriesV2(memories, consentMap, 'family', category);

          // If the target memory's category was revoked, it should NOT be in filtered results
          if (newStatus === 'revoked') {
            const filteredIds = filtered.map((m) => m.id);
            expect(filteredIds).not.toContain(targetMemory.id);
          }

          // If the target memory's category is granted and access tier allows it,
          // it should be in filtered results
          if (newStatus === 'granted') {
            const tier = getAccessTier(updatedSettings, 'family');
            if (tier !== 'NO_ACCESS') {
              const filteredIds = filtered.map((m) => m.id);
              expect(filteredIds).toContain(targetMemory.id);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('consent changes do not require refresh - immediate consistency', () => {
    fc.assert(
      fc.property(
        consentSettingsArb,
        consentCategoryArb,
        memoryArb(),
        (settings, category, memory) => {
          // First revoke, then grant - verify each state is immediately consistent
          const revokedSettings = updateConsentV2(settings, category, 'revoked');
          const revokedAccess = canAccessV2(memory, revokedSettings, 'family', category);
          expect(revokedAccess).toBe(false);

          // Now grant the same category
          const grantedSettings = updateConsentV2(revokedSettings, category, 'granted');
          const grantedAccess = canAccessV2(memory, grantedSettings, 'family', category);

          // Access depends on overall tier (가족열람 must be granted for family access)
          const tier = getAccessTier(grantedSettings, 'family');
          if (tier === 'NO_ACCESS') {
            expect(grantedAccess).toBe(false);
          } else {
            expect(grantedAccess).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
