import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { useStore } from '../../store';
import { createConsentManager } from './manager';
import type { Memory, MemoryConsent, AccessTier, UserRole } from '../types';

/**
 * Feature: memoir-platform-enhancement, Property 8: Access Control Enforcement
 *
 * Validates: Requirements 7.2, 7.3
 *
 * For any memory with an access tier and any user attempting access, the `canAccess`
 * function SHALL return `true` only when: (a) the user is the senior owner, OR (b) the
 * tier is "전체 가족" and the user is a family member, OR (c) the tier is "지정 가족" and
 * the user's ID is in the memory's `designatedFamilyIds` list. For tier "본인만", only
 * the senior owner SHALL have access.
 */
describe('Property 8: Access Control Enforcement', () => {
  // ─── Generators ──────────────────────────────────────────────────────────────

  const accessTierArb: fc.Arbitrary<AccessTier> = fc.constantFrom('본인만', '지정 가족', '전체 가족');

  const userRoleArb: fc.Arbitrary<UserRole> = fc.constantFrom('senior', 'guardian');

  const userIdArb: fc.Arbitrary<string> = fc.uuid();

  const designatedFamilyIdsArb: fc.Arbitrary<string[]> = fc.array(fc.uuid(), {
    minLength: 0,
    maxLength: 5,
  });

  // Safe date string generator that avoids Invalid Date issues
  const dateStringArb = fc
    .tuple(
      fc.integer({ min: 2000, max: 2030 }),
      fc.integer({ min: 1, max: 12 }),
      fc.integer({ min: 1, max: 28 })
    )
    .map(([y, m, d]) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);

  const isoDateTimeArb = dateStringArb.map((d) => `${d}T00:00:00.000Z`);

  const memoryConsentArb = (
    tierOverride?: fc.Arbitrary<AccessTier>,
    designatedOverride?: fc.Arbitrary<string[]>
  ): fc.Arbitrary<MemoryConsent> =>
    fc.record({
      status: fc.constant('granted' as const),
      accessTier: tierOverride ?? accessTierArb,
      designatedFamilyIds: designatedOverride ?? designatedFamilyIdsArb,
      lastModified: isoDateTimeArb,
    });

  const memoryArb = (
    consentOverride?: fc.Arbitrary<MemoryConsent>
  ): fc.Arbitrary<Memory> =>
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
        emotions: fc.array(fc.constantFrom('기쁨', '평온', '감사'), { minLength: 0, maxLength: 2 }),
        timePeriod: fc.string({ minLength: 1, maxLength: 10 }),
      }),
      privacy: fc.constantFrom('public' as const, 'family' as const, 'private' as const),
      confidenceLabel: fc.constantFrom('확인됨' as const, '추정' as const, '추가 확인 필요' as const),
      contradictions: fc.array(fc.uuid(), { minLength: 0, maxLength: 2 }),
      consent: consentOverride ?? memoryConsentArb(),
      embedding: fc.constant(null),
    });

  // ─── Setup ───────────────────────────────────────────────────────────────────

  beforeEach(() => {
    useStore.setState({
      memories: [],
      ragIndex: { entries: [], lastUpdated: '' },
      speechProfile: { profile: null, sessionCount: 0 },
      autobiography: { currentStructure: null, narratives: [], lastGenerated: null },
      posthumousPolicy: { policy: 'maintain_current', confirmedAt: null },
    });
  });

  // ─── Sub-property 1: Senior users ALWAYS have access regardless of access tier ──

  it('senior users ALWAYS have access regardless of access tier', () => {
    fc.assert(
      fc.property(
        memoryArb(),
        userIdArb,
        (memory, userId) => {
          useStore.setState({ memories: [memory] });

          const manager = createConsentManager();
          const result = manager.canAccess(memory.id, userId, 'senior');

          expect(result).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  // ─── Sub-property 2: For tier "본인만", family users NEVER have access ──────────

  it('for tier "본인만", family users NEVER have access', () => {
    fc.assert(
      fc.property(
        memoryArb(
          memoryConsentArb(fc.constant('본인만' as AccessTier))
        ),
        userIdArb,
        (memory, userId) => {
          useStore.setState({ memories: [memory] });

          const manager = createConsentManager();
          const result = manager.canAccess(memory.id, userId, 'family');

          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  // ─── Sub-property 3: For tier "지정 가족", family users have access ONLY if in designatedFamilyIds ──

  it('for tier "지정 가족", family users have access ONLY if their userId is in designatedFamilyIds', () => {
    fc.assert(
      fc.property(
        // Generate a list of designated family IDs and a user ID
        fc.tuple(
          fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
          fc.boolean()
        ).chain(([designatedIds, userIsDesignated]) => {
          // Either pick a user from the designated list or generate a new one
          const userIdGen = userIsDesignated
            ? fc.constantFrom(...designatedIds)
            : fc.uuid().filter((id) => !designatedIds.includes(id));

          return fc.tuple(
            fc.constant(designatedIds),
            userIdGen,
            fc.constant(userIsDesignated)
          );
        }),
        ([designatedIds, userId, userIsDesignated]) => {
          const consent: MemoryConsent = {
            status: 'granted',
            accessTier: '지정 가족',
            designatedFamilyIds: designatedIds,
            lastModified: new Date().toISOString(),
          };

          const memory: Memory = {
            id: 'test-memory-id',
            date: '2024-01-01',
            topic: 'test topic',
            originalTranscript: 'test',
            cleanedTranscript: 'test',
            publishVersion: 'test',
            tags: { people: [], places: [], emotions: [], timePeriod: '2024' },
            privacy: 'public',
            confidenceLabel: '확인됨',
            contradictions: [],
            consent,
            embedding: null,
          };

          useStore.setState({ memories: [memory] });

          const manager = createConsentManager();
          const result = manager.canAccess(memory.id, userId, 'family');

          if (userIsDesignated) {
            expect(result).toBe(true);
          } else {
            expect(result).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // ─── Sub-property 4: For tier "전체 가족", ALL family users have access ──────────

  it('for tier "전체 가족", ALL family users have access', () => {
    fc.assert(
      fc.property(
        memoryArb(
          memoryConsentArb(fc.constant('전체 가족' as AccessTier))
        ),
        userIdArb,
        (memory, userId) => {
          useStore.setState({ memories: [memory] });

          const manager = createConsentManager();
          const result = manager.canAccess(memory.id, userId, 'family');

          expect(result).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
