/**
 * Consent Manager - Manages per-memory consent, access tiers, and posthumous policy.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 7.4, 8.1, 8.4
 */

import { useStore } from '../../store';
import type {
  Memory,
  MemoryConsent,
  ConsentStatus,
  AccessTier,
  PosthumousPolicy,
  UserRole,
  AccessTierV2,
  ConsentCategoryV2,
  ConsentSettingsV2,
} from '../types';

export type { AccessTierV2, ConsentCategoryV2, ConsentSettingsV2 };
type ConsentUserRole = UserRole | 'family';

/**
 * Ordered access tiers from least to most permissive.
 * Used for hierarchy enforcement.
 */
const ACCESS_TIER_ORDER: readonly AccessTierV2[] = [
  'NO_ACCESS',
  'SUMMARY',
  'FULL_READ',
  'FULL_ACCESS',
] as const;

// Sensitive emotion keywords that default to 'revoked' consent
const SENSITIVE_EMOTIONS = ['슬픔', '분노', '후회', '트라우마'];

// ─── Consent v2: Pure Functions ──────────────────────────────────────────────

/**
 * Determines access tier based on consent settings and user role.
 *
 * Logic:
 * - Senior users always get FULL_ACCESS
 * - Family users get tier based on 가족열람 consent:
 *   - If 가족열람 is revoked → NO_ACCESS
 *   - If 가족열람 is granted and 민감정보 is revoked → SUMMARY
 *   - If 가족열람 is granted and 민감정보 is granted → FULL_READ
 *   - FULL_ACCESS is reserved for senior users only
 */
export function getAccessTier(
  consentSettings: ConsentSettingsV2,
  userRole: ConsentUserRole
): AccessTierV2 {
  // Senior users always have full access
  if (userRole === 'senior') {
    return 'FULL_ACCESS';
  }

  // Family users: check 가족열람 consent first
  if (consentSettings.가족열람 === 'revoked') {
    return 'NO_ACCESS';
  }

  // 가족열람 is granted - check 민감정보
  if (consentSettings.민감정보 === 'revoked') {
    return 'SUMMARY';
  }

  // Both 가족열람 and 민감정보 are granted
  return 'FULL_READ';
}

/**
 * Checks if a user can access a memory for a specific purpose.
 *
 * Access is determined by:
 * 1. The user's role (senior always has access)
 * 2. The consent status for the specific access type category
 * 3. The overall access tier derived from consent settings
 *
 * Returns false if:
 * - The access type category consent is revoked
 * - The user's access tier is NO_ACCESS
 */
export function canAccessV2(
  memory: Memory,
  consentSettings: ConsentSettingsV2,
  userRole: ConsentUserRole,
  accessType: ConsentCategoryV2
): boolean {
  // Senior users always have access
  if (userRole === 'senior') {
    return true;
  }

  // Check if the specific category consent is granted
  if (consentSettings[accessType] === 'revoked') {
    return false;
  }

  // Check overall access tier
  const tier = getAccessTier(consentSettings, userRole);
  if (tier === 'NO_ACCESS') {
    return false;
  }

  return true;
}

/**
 * Checks if a memory should be tagged as sensitive.
 * A memory is sensitive if its emotion tags contain any sensitive keywords.
 */
export function isSensitiveMemory(memory: Memory): boolean {
  return memory.tags.emotions.some((emotion) =>
    SENSITIVE_EMOTIONS.some((sensitive) => emotion.includes(sensitive))
  );
}

/**
 * Returns default consent settings for a memory.
 * Sensitive memories default to all-revoked (private).
 * Non-sensitive memories default to all-granted.
 */
export function getDefaultConsentSettingsV2(memory: Memory): ConsentSettingsV2 {
  if (isSensitiveMemory(memory)) {
    return {
      출판: 'revoked',
      가족열람: 'revoked',
      챗봇: 'revoked',
      사후공개: 'revoked',
      민감정보: 'revoked',
    };
  }

  return {
    출판: 'granted',
    가족열람: 'granted',
    챗봇: 'granted',
    사후공개: 'granted',
    민감정보: 'granted',
  };
}

export function getEffectiveConsentSettings(memory: Memory): ConsentSettingsV2 {
  if (memory.consentSettings) {
    return memory.consentSettings;
  }

  if (memory.consent.status === 'revoked') {
    return {
      출판: 'revoked',
      가족열람: 'revoked',
      챗봇: 'revoked',
      사후공개: 'revoked',
      민감정보: 'revoked',
    };
  }

  return {
    출판: 'granted',
    가족열람: 'granted',
    챗봇: 'granted',
    사후공개: 'granted',
    민감정보: 'granted',
  };
}

/**
 * Updates a single consent category (pure function, immediate effect).
 * Returns a new ConsentSettingsV2 object with the updated category.
 */
export function updateConsentV2(
  settings: ConsentSettingsV2,
  category: ConsentCategoryV2,
  status: ConsentStatus
): ConsentSettingsV2 {
  return {
    ...settings,
    [category]: status,
  };
}

/**
 * Filters memories based on consent settings and user role for a specific access type.
 * Only returns memories where the user has access for the given purpose.
 */
export function filterAccessibleMemoriesV2(
  memories: Memory[],
  consentSettingsMap: Map<string, ConsentSettingsV2>,
  userRole: ConsentUserRole,
  accessType: ConsentCategoryV2
): Memory[] {
  return memories.filter((memory) => {
    const settings = consentSettingsMap.get(memory.id);
    // fail-closed: if no consent settings found, deny access
    if (!settings) {
      return userRole === 'senior';
    }
    return canAccessV2(memory, settings, userRole, accessType);
  });
}

/**
 * Compares two access tiers. Returns:
 * - negative if a < b (a is more restrictive)
 * - 0 if a === b
 * - positive if a > b (a is more permissive)
 */
export function compareAccessTiers(a: AccessTierV2, b: AccessTierV2): number {
  return ACCESS_TIER_ORDER.indexOf(a) - ACCESS_TIER_ORDER.indexOf(b);
}

/**
 * Determines the default consent for a memory based on its emotion tags.
 * Memories tagged with sensitive emotions default to 'revoked'.
 */
export function getDefaultConsentForMemory(memory: Memory): MemoryConsent {
  const hasSensitiveEmotion = memory.tags.emotions.some((emotion) =>
    SENSITIVE_EMOTIONS.some((sensitive) => emotion.includes(sensitive))
  );

  return {
    status: hasSensitiveEmotion ? 'revoked' : 'granted',
    accessTier: '본인만',
    designatedFamilyIds: [],
    lastModified: new Date().toISOString(),
  };
}

export interface ConsentManager {
  setConsent(memoryId: string, consent: ConsentStatus): void;
  revokeConsent(memoryId: string): void;
  getConsent(memoryId: string): ConsentStatus;
  setAccessTier(memoryId: string, tier: AccessTier): void;
  setDesignatedFamily(memoryId: string, familyIds: string[]): void;
  canAccess(memoryId: string, userId: string, userRole: ConsentUserRole): boolean;
  setPosthumousPolicy(policy: PosthumousPolicy): void;
  getPosthumousPolicy(): PosthumousPolicy;
  filterAccessibleMemories(memories: Memory[], userId: string, userRole: ConsentUserRole): Memory[];
}

/**
 * Creates a ConsentManager instance that reads/writes to the Zustand store.
 */
export function createConsentManager(): ConsentManager {
  function getMemory(memoryId: string): Memory | undefined {
    const state = useStore.getState();
    return state.memories.find((m) => m.id === memoryId);
  }

  function setConsent(memoryId: string, consent: ConsentStatus): void {
    const memory = getMemory(memoryId);
    if (!memory) return;

    const updatedConsent: MemoryConsent = {
      ...memory.consent,
      status: consent,
      lastModified: new Date().toISOString(),
    };

    useStore.getState().updateMemoryConsent(memoryId, updatedConsent);
  }

  function revokeConsent(memoryId: string): void {
    setConsent(memoryId, 'revoked');
  }

  function getConsent(memoryId: string): ConsentStatus {
    const memory = getMemory(memoryId);
    if (!memory) return 'revoked'; // fail-closed: default to most restrictive
    return memory.consent.status;
  }

  function setAccessTier(memoryId: string, tier: AccessTier): void {
    const memory = getMemory(memoryId);
    if (!memory) return;

    const updatedConsent: MemoryConsent = {
      ...memory.consent,
      accessTier: tier,
      lastModified: new Date().toISOString(),
    };

    useStore.getState().updateMemoryConsent(memoryId, updatedConsent);
  }

  function setDesignatedFamily(memoryId: string, familyIds: string[]): void {
    const memory = getMemory(memoryId);
    if (!memory) return;

    const updatedConsent: MemoryConsent = {
      ...memory.consent,
      designatedFamilyIds: familyIds,
      lastModified: new Date().toISOString(),
    };

    useStore.getState().updateMemoryConsent(memoryId, updatedConsent);
  }

  function canAccess(memoryId: string, userId: string, userRole: ConsentUserRole): boolean {
    const memory = getMemory(memoryId);
    if (!memory) return false;

    // Senior user (owner) always has access
    if (userRole === 'senior') return true;

    const { accessTier, designatedFamilyIds } = memory.consent;

    switch (accessTier) {
      case '본인만':
        // Only the senior owner has access
        return false;

      case '지정 가족':
        // Senior owner + specified family IDs
        return designatedFamilyIds.includes(userId);

      case '전체 가족':
        // Senior owner + any family user
        return userRole === 'family' || userRole === 'guardian';

      default:
        return false;
    }
  }

  function setPosthumousPolicy(policy: PosthumousPolicy): void {
    useStore.getState().setPosthumousPolicy(policy);
  }

  function getPosthumousPolicy(): PosthumousPolicy {
    return useStore.getState().posthumousPolicy.policy;
  }

  function filterAccessibleMemories(
    memories: Memory[],
    userId: string,
    userRole: ConsentUserRole
  ): Memory[] {
    return memories.filter((memory) => {
      // Only include memories with granted consent
      if (memory.consent.status !== 'granted') return false;

      // Check access tier
      return canAccess(memory.id, userId, userRole);
    });
  }

  return {
    setConsent,
    revokeConsent,
    getConsent,
    setAccessTier,
    setDesignatedFamily,
    canAccess,
    setPosthumousPolicy,
    getPosthumousPolicy,
    filterAccessibleMemories,
  };
}

/** Default singleton instance */
export const consentManager = createConsentManager();
