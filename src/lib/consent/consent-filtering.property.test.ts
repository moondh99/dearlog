import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { useStore } from '../../store';
import { createConsentManager, getDefaultConsentForMemory } from './manager';
import type { Memory, MemoryConsent, ConsentStatus, AccessTier } from '../types';

/**
 * Feature: memoir-platform-enhancement, Property 7: Consent Filtering Correctness
 *
 * Validates: Requirements 6.1, 6.2, 6.4
 *
 * For any set of memories with mixed consent statuses, the `filterAccessibleMemories`
 * function SHALL return only memories with `consent.status === 'granted'`. Furthermore,
 * for any memory whose emotion tags contain "슬픔", "분노", "후회", or "트라우마", the
 * default consent status SHALL be 'revoked'. Setting consent on one memory SHALL not
 * modify the consent of any other memory.
 */
describe('Property 7: Consent Filtering Correctness', () => {
  const SENSITIVE_EMOTIONS = ['슬픔', '분노', '후회', '트라우마'];

  // ─── Generators ──────────────────────────────────────────────────────────────

  const consentStatusArb: fc.Arbitrary<ConsentStatus> = fc.constantFrom('granted', 'revoked');

  const accessTierArb: fc.Arbitrary<AccessTier> = fc.constantFrom('본인만', '지정 가족', '전체 가족');

  const isoDateStringArb = fc.integer({ min: 0, max: 4102444800000 }).map((ts) => new Date(ts).toISOString());

  const dateDayStringArb = fc.integer({ min: 0, max: 4102444800000 }).map((ts) => new Date(ts).toISOString().split('T')[0]);

  const memoryConsentArb: fc.Arbitrary<MemoryConsent> = fc.record({
    status: consentStatusArb,
    accessTier: accessTierArb,
    designatedFamilyIds: fc.array(fc.uuid(), { minLength: 0, maxLength: 3 }),
    lastModified: isoDateStringArb,
  });

  // Generator for non-sensitive emotion tags
  const nonSensitiveEmotionArb = fc.constantFrom('기쁨', '평온', '감사', '설렘', '희망', '사랑');

  // Generator for sensitive emotion tags
  const sensitiveEmotionArb = fc.constantFrom(...SENSITIVE_EMOTIONS);

  // Generator for a Memory with configurable consent and emotions
  const memoryArb = (
    consentOverride?: fc.Arbitrary<MemoryConsent>,
    emotionsOverride?: fc.Arbitrary<string[]>
  ): fc.Arbitrary<Memory> =>
    fc.record({
      id: fc.uuid(),
      date: dateDayStringArb,
      topic: fc.string({ minLength: 1, maxLength: 30 }),
      originalTranscript: fc.string({ minLength: 1, maxLength: 100 }),
      cleanedTranscript: fc.string({ minLength: 1, maxLength: 100 }),
      publishVersion: fc.string({ minLength: 1, maxLength: 100 }),
      tags: fc.record({
        people: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 0, maxLength: 3 }),
        places: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 0, maxLength: 3 }),
        emotions: emotionsOverride ?? fc.array(nonSensitiveEmotionArb, { minLength: 0, maxLength: 3 }),
        timePeriod: fc.string({ minLength: 1, maxLength: 10 }),
      }),
      privacy: fc.constantFrom('public' as const, 'family' as const, 'private' as const),
      confidenceLabel: fc.constantFrom('확인됨' as const, '추정' as const, '추가 확인 필요' as const),
      contradictions: fc.array(fc.uuid(), { minLength: 0, maxLength: 2 }),
      consent: consentOverride ?? memoryConsentArb,
      embedding: fc.constant(null),
    });

  // Generator for a set of memories with mixed consent statuses (at least one granted, one revoked)
  const mixedConsentMemoriesArb = fc
    .tuple(
      // At least one granted memory
      fc.array(memoryArb(fc.constant<MemoryConsent>({
        status: 'granted',
        accessTier: '본인만',
        designatedFamilyIds: [],
        lastModified: new Date().toISOString(),
      })), { minLength: 1, maxLength: 5 }),
      // At least one revoked memory
      fc.array(memoryArb(fc.constant<MemoryConsent>({
        status: 'revoked',
        accessTier: '본인만',
        designatedFamilyIds: [],
        lastModified: new Date().toISOString(),
      })), { minLength: 1, maxLength: 5 })
    )
    .map(([granted, revoked]) => [...granted, ...revoked]);

  // ─── Setup ───────────────────────────────────────────────────────────────────

  beforeEach(() => {
    // Reset the store before each test
    useStore.setState({
      memories: [],
      ragIndex: { entries: [], lastUpdated: '' },
      speechProfile: { profile: null, sessionCount: 0 },
      autobiography: { currentStructure: null, narratives: [], lastGenerated: null },
      posthumousPolicy: { policy: 'maintain_current', confirmedAt: null },
    });
  });

  // ─── Sub-property 1: filterAccessibleMemories returns ONLY granted memories ──

  it('filterAccessibleMemories returns ONLY memories with consent.status === "granted" (no revoked memories in output)', () => {
    fc.assert(
      fc.property(
        mixedConsentMemoriesArb,
        (memories) => {
          // Set up the store with the generated memories
          useStore.setState({ memories });

          const manager = createConsentManager();

          // Use 'senior' role to isolate consent filtering from access tier logic
          const result = manager.filterAccessibleMemories(memories, 'senior-user-id', 'senior');

          // All returned memories must have consent.status === 'granted'
          for (const memory of result) {
            expect(memory.consent.status).toBe('granted');
          }

          // No revoked memories should appear in the result
          const revokedIds = memories
            .filter((m) => m.consent.status === 'revoked')
            .map((m) => m.id);
          const resultIds = result.map((m) => m.id);

          for (const revokedId of revokedIds) {
            expect(resultIds).not.toContain(revokedId);
          }

          // All granted memories should appear in the result (for senior user)
          const grantedIds = memories
            .filter((m) => m.consent.status === 'granted')
            .map((m) => m.id);

          for (const grantedId of grantedIds) {
            expect(resultIds).toContain(grantedId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // ─── Sub-property 2: getDefaultConsentForMemory returns 'revoked' for sensitive emotions ──

  it('getDefaultConsentForMemory returns "revoked" for memories with sensitive emotion tags', () => {
    fc.assert(
      fc.property(
        memoryArb(
          undefined,
          // Ensure at least one sensitive emotion is present
          fc.tuple(
            sensitiveEmotionArb,
            fc.array(fc.oneof(sensitiveEmotionArb, nonSensitiveEmotionArb), { minLength: 0, maxLength: 3 })
          ).map(([sensitive, others]) => [sensitive, ...others])
        ),
        (memory) => {
          const consent = getDefaultConsentForMemory(memory);
          expect(consent.status).toBe('revoked');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('getDefaultConsentForMemory returns "granted" for memories without sensitive emotion tags', () => {
    fc.assert(
      fc.property(
        memoryArb(
          undefined,
          fc.array(nonSensitiveEmotionArb, { minLength: 0, maxLength: 4 })
        ),
        (memory) => {
          const consent = getDefaultConsentForMemory(memory);
          expect(consent.status).toBe('granted');
        }
      ),
      { numRuns: 100 }
    );
  });

  // ─── Sub-property 3: Setting consent on one memory does not modify others ────

  it('setting consent on one memory does not modify any other memory consent', () => {
    fc.assert(
      fc.property(
        fc.array(memoryArb(), { minLength: 2, maxLength: 10 }),
        consentStatusArb,
        (memories, newStatus) => {
          // Ensure unique IDs
          const uniqueMemories = memories.map((m, i) => ({
            ...m,
            id: `memory-${i}-${m.id}`,
          }));

          // Set up the store with the generated memories
          useStore.setState({ memories: uniqueMemories });

          // Pick the first memory to modify
          const targetId = uniqueMemories[0].id;

          // Snapshot all other memories' consent before modification
          const otherMemoriesBefore = uniqueMemories
            .filter((m) => m.id !== targetId)
            .map((m) => ({ id: m.id, consent: { ...m.consent } }));

          // Modify the target memory's consent
          const manager = createConsentManager();
          manager.setConsent(targetId, newStatus);

          // Verify all other memories' consent is unchanged
          const stateAfter = useStore.getState().memories;
          for (const before of otherMemoriesBefore) {
            const after = stateAfter.find((m) => m.id === before.id);
            expect(after).toBeDefined();
            expect(after!.consent.status).toBe(before.consent.status);
            expect(after!.consent.accessTier).toBe(before.consent.accessTier);
            expect(after!.consent.designatedFamilyIds).toEqual(before.consent.designatedFamilyIds);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
