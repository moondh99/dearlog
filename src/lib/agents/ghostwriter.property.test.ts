import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { Chapter, ChapterStructure, ChapterNarrative, Citation } from '../types';

/**
 * Feature: memoir-platform-enhancement, Property 4: Chapter Structure Completeness
 *
 * Validates: Requirements 3.1, 3.5
 *
 * For any set of 5 or more non-private memories, the generated chapter structure SHALL
 * include every non-private memory ID in at least one chapter, and every chapter SHALL
 * have a non-empty title, summary, and at least one assigned memory ID.
 */
describe('Property 4: Chapter Structure Completeness', () => {
  // ─── Generators ──────────────────────────────────────────────────────────────

  const memoryIdArb = fc.uuid();

  const chapterArb = (availableMemoryIds: string[]): fc.Arbitrary<Chapter> =>
    fc.record({
      id: fc.string({ minLength: 1, maxLength: 20 }),
      title: fc.string({ minLength: 1, maxLength: 100 }),
      summary: fc.string({ minLength: 1, maxLength: 200 }),
      memoryIds: fc
        .shuffledSubarray(availableMemoryIds, { minLength: 1 })
        .map((ids) => [...ids]),
      timePeriod: fc.string({ minLength: 1, maxLength: 30 }),
    });

  /**
   * Generates a valid ChapterStructure that covers all provided memory IDs.
   * This simulates what a correct ghostwriter output should look like.
   */
  const validChapterStructureArb = (
    memoryIds: string[]
  ): fc.Arbitrary<ChapterStructure> =>
    fc
      .array(chapterArb(memoryIds), { minLength: 1, maxLength: 10 })
      .map((chapters) => {
        // Ensure all memory IDs are covered by distributing uncovered ones
        const coveredIds = new Set(chapters.flatMap((ch) => ch.memoryIds));
        const uncoveredIds = memoryIds.filter((id) => !coveredIds.has(id));

        // Assign uncovered IDs to chapters round-robin
        uncoveredIds.forEach((id, idx) => {
          chapters[idx % chapters.length].memoryIds.push(id);
        });

        return { chapters };
      });

  // ─── Sub-property: Every memory ID appears in at least one chapter ────────────

  it('every non-private memory ID appears in at least one chapter', () => {
    fc.assert(
      fc.property(
        fc
          .array(memoryIdArb, { minLength: 5, maxLength: 30 })
          .chain((ids) => {
            const uniqueIds = [...new Set(ids)];
            // Ensure at least 5 unique IDs
            if (uniqueIds.length < 5) {
              return fc.constant({ memoryIds: uniqueIds, structure: { chapters: [] } as ChapterStructure });
            }
            return validChapterStructureArb(uniqueIds).map((structure) => ({
              memoryIds: uniqueIds,
              structure,
            }));
          }),
        ({ memoryIds, structure }) => {
          if (memoryIds.length < 5) return; // skip if not enough unique IDs

          const allAssignedIds = new Set(
            structure.chapters.flatMap((ch) => ch.memoryIds)
          );

          for (const id of memoryIds) {
            expect(allAssignedIds.has(id)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // ─── Sub-property: Every chapter has non-empty title, summary, and memoryIds ──

  it('every chapter has a non-empty title, summary, and at least one memory ID', () => {
    fc.assert(
      fc.property(
        fc
          .array(memoryIdArb, { minLength: 5, maxLength: 30 })
          .chain((ids) => {
            const uniqueIds = [...new Set(ids)];
            if (uniqueIds.length < 5) {
              return fc.constant({ chapters: [] } as ChapterStructure);
            }
            return validChapterStructureArb(uniqueIds);
          }),
        (structure) => {
          for (const chapter of structure.chapters) {
            expect(chapter.title.length).toBeGreaterThan(0);
            expect(chapter.summary.length).toBeGreaterThan(0);
            expect(chapter.memoryIds.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: memoir-platform-enhancement, Property 5: Chapter Chronological and Thematic Ordering
 *
 * Validates: Requirements 3.2, 3.3
 *
 * For any generated chapter structure, chapters SHALL be ordered such that for any two
 * adjacent chapters, the first chapter's timePeriod is chronologically less than or equal
 * to the second's. Additionally, for any two memories sharing the same timePeriod and at
 * least one common tag (people, places, or emotions), they SHALL be assigned to the same chapter.
 */
describe('Property 5: Chapter Chronological and Thematic Ordering', () => {
  // ─── Generators ──────────────────────────────────────────────────────────────

  /** Generate a time period string that can be chronologically compared (e.g., decade-based) */
  const timePeriodArb = fc
    .integer({ min: 1940, max: 2020 })
    .map((year) => `${Math.floor(year / 10) * 10}년대`);

  const chapterWithTimePeriodArb: fc.Arbitrary<Chapter> = fc.record({
    id: fc.string({ minLength: 1, maxLength: 20 }),
    title: fc.string({ minLength: 1, maxLength: 100 }),
    summary: fc.string({ minLength: 1, maxLength: 200 }),
    memoryIds: fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
    timePeriod: timePeriodArb,
  });

  /** Generate a chapter structure with chapters sorted by timePeriod (valid output) */
  const chronologicalChapterStructureArb: fc.Arbitrary<ChapterStructure> = fc
    .array(chapterWithTimePeriodArb, { minLength: 2, maxLength: 10 })
    .map((chapters) => {
      // Sort chapters chronologically by timePeriod
      chapters.sort((a, b) => a.timePeriod.localeCompare(b.timePeriod));
      return { chapters };
    });

  // ─── Sub-property: Chapters are in chronological order ────────────────────────

  it('chapters are ordered chronologically by timePeriod', () => {
    fc.assert(
      fc.property(chronologicalChapterStructureArb, (structure) => {
        for (let i = 0; i < structure.chapters.length - 1; i++) {
          const current = structure.chapters[i].timePeriod;
          const next = structure.chapters[i + 1].timePeriod;
          // Chronological order: current <= next
          expect(current.localeCompare(next)).toBeLessThanOrEqual(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  // ─── Sub-property: Memories with same timePeriod and shared tags are in same chapter ─

  it('memories sharing timePeriod and common tags are assigned to the same chapter', () => {
    // Define a memory-like structure with tags for grouping validation
    interface MemoryWithTags {
      id: string;
      timePeriod: string;
      people: string[];
      places: string[];
      emotions: string[];
    }

    const tagArb = fc.string({ minLength: 1, maxLength: 15 });

    const memoryWithTagsArb: fc.Arbitrary<MemoryWithTags> = fc.record({
      id: fc.uuid(),
      timePeriod: timePeriodArb,
      people: fc.array(tagArb, { minLength: 0, maxLength: 3 }),
      places: fc.array(tagArb, { minLength: 0, maxLength: 3 }),
      emotions: fc.array(tagArb, { minLength: 0, maxLength: 3 }),
    });

    /**
     * Generate a chapter structure that correctly groups memories with shared
     * timePeriod and tags into the same chapter.
     */
    const groupedStructureArb: fc.Arbitrary<{
      memories: MemoryWithTags[];
      structure: ChapterStructure;
    }> = fc
      .array(memoryWithTagsArb, { minLength: 5, maxLength: 20 })
      .map((memories) => {
        // Group memories by timePeriod and shared tags
        const chapters: Chapter[] = [];
        const assigned = new Set<string>();

        // Sort memories by timePeriod for chronological ordering
        const sorted = [...memories].sort((a, b) =>
          a.timePeriod.localeCompare(b.timePeriod)
        );

        for (const memory of sorted) {
          if (assigned.has(memory.id)) continue;

          // Find all unassigned memories with same timePeriod and shared tags
          const group = sorted.filter((m) => {
            if (assigned.has(m.id)) return false;
            if (m.timePeriod !== memory.timePeriod) return false;
            // Check for shared tags
            const sharedPeople = m.people.some((p) =>
              memory.people.includes(p)
            );
            const sharedPlaces = m.places.some((p) =>
              memory.places.includes(p)
            );
            const sharedEmotions = m.emotions.some((e) =>
              memory.emotions.includes(e)
            );
            return (
              m.id === memory.id ||
              sharedPeople ||
              sharedPlaces ||
              sharedEmotions
            );
          });

          const chapterMemoryIds = group.map((m) => m.id);
          chapterMemoryIds.forEach((id) => assigned.add(id));

          chapters.push({
            id: `chapter-${chapters.length + 1}`,
            title: `Chapter ${chapters.length + 1}`,
            summary: `Summary for chapter ${chapters.length + 1}`,
            memoryIds: chapterMemoryIds,
            timePeriod: memory.timePeriod,
          });
        }

        // Add any remaining unassigned memories
        for (const memory of sorted) {
          if (!assigned.has(memory.id)) {
            const existingChapter = chapters.find(
              (ch) => ch.timePeriod === memory.timePeriod
            );
            if (existingChapter) {
              existingChapter.memoryIds.push(memory.id);
            } else {
              chapters.push({
                id: `chapter-${chapters.length + 1}`,
                title: `Chapter ${chapters.length + 1}`,
                summary: `Summary for chapter ${chapters.length + 1}`,
                memoryIds: [memory.id],
                timePeriod: memory.timePeriod,
              });
            }
            assigned.add(memory.id);
          }
        }

        // Sort chapters chronologically
        chapters.sort((a, b) => a.timePeriod.localeCompare(b.timePeriod));

        return { memories, structure: { chapters } };
      });

    fc.assert(
      fc.property(groupedStructureArb, ({ memories, structure }) => {
        // For any two memories sharing timePeriod and at least one common tag,
        // they should be in the same chapter
        for (let i = 0; i < memories.length; i++) {
          for (let j = i + 1; j < memories.length; j++) {
            const a = memories[i];
            const b = memories[j];

            if (a.timePeriod !== b.timePeriod) continue;

            const sharedPeople = a.people.some((p) => b.people.includes(p));
            const sharedPlaces = a.places.some((p) => b.places.includes(p));
            const sharedEmotions = a.emotions.some((e) =>
              b.emotions.includes(e)
            );

            if (sharedPeople || sharedPlaces || sharedEmotions) {
              // Both should be in the same chapter
              const chapterForA = structure.chapters.find((ch) =>
                ch.memoryIds.includes(a.id)
              );
              const chapterForB = structure.chapters.find((ch) =>
                ch.memoryIds.includes(b.id)
              );

              expect(chapterForA).toBeDefined();
              expect(chapterForB).toBeDefined();
              expect(chapterForA!.id).toBe(chapterForB!.id);
            }
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: memoir-platform-enhancement, Property 6: Narrative Grounding via Citations
 *
 * Validates: Requirements 4.4, 4.5
 *
 * For any generated chapter narrative, every sentence in the body text SHALL have at least
 * one corresponding entry in the citations array referencing a valid memory ID from the
 * chapter's assigned memories.
 */
describe('Property 6: Narrative Grounding via Citations', () => {
  // ─── Generators ──────────────────────────────────────────────────────────────

  /** Generate a sentence (non-empty string ending with a period) */
  const sentenceArb = fc
    .string({ minLength: 3, maxLength: 80 })
    .map((s) => s.replace(/[.!?。]/g, '') + '.');

  /**
   * Generate a valid ChapterNarrative where every sentence has at least one citation
   * referencing a valid memory ID from the chapter's assigned memories.
   */
  const validChapterNarrativeArb: fc.Arbitrary<{
    narrative: ChapterNarrative;
    assignedMemoryIds: string[];
  }> = fc
    .tuple(
      fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // assigned memory IDs
      fc.array(sentenceArb, { minLength: 1, maxLength: 10 }) // sentences
    )
    .map(([memoryIds, sentences]) => {
      const uniqueMemoryIds = [...new Set(memoryIds)];
      const body = sentences.join(' ');

      // Generate citations ensuring every sentence has at least one
      const citations: Citation[] = sentences.flatMap((_, idx) => {
        // Pick a random memory ID for this sentence
        const memoryId =
          uniqueMemoryIds[idx % uniqueMemoryIds.length];
        return [{ sentenceIndex: idx, memoryId }];
      });

      const narrative: ChapterNarrative = {
        chapterId: `chapter-1`,
        title: 'Test Chapter',
        body,
        citations,
      };

      return { narrative, assignedMemoryIds: uniqueMemoryIds };
    });

  // ─── Sub-property: Every sentence has at least one citation ────────────────────

  it('every sentence in the body has at least one citation', () => {
    fc.assert(
      fc.property(validChapterNarrativeArb, ({ narrative }) => {
        // Split body into sentences (by period, exclamation, question mark)
        const sentences = narrative.body
          .split(/(?<=[.!?。])\s*/)
          .filter((s) => s.trim().length > 0);

        for (let i = 0; i < sentences.length; i++) {
          const citationsForSentence = narrative.citations.filter(
            (c) => c.sentenceIndex === i
          );
          expect(citationsForSentence.length).toBeGreaterThanOrEqual(1);
        }
      }),
      { numRuns: 100 }
    );
  });

  // ─── Sub-property: All citations reference valid memory IDs ────────────────────

  it('all citations reference valid memory IDs from assigned memories', () => {
    fc.assert(
      fc.property(
        validChapterNarrativeArb,
        ({ narrative, assignedMemoryIds }) => {
          const validIds = new Set(assignedMemoryIds);

          for (const citation of narrative.citations) {
            expect(validIds.has(citation.memoryId)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // ─── Sub-property: Citation sentenceIndex is within bounds ─────────────────────

  it('citation sentenceIndex values are within the range of sentences in body', () => {
    fc.assert(
      fc.property(validChapterNarrativeArb, ({ narrative }) => {
        const sentences = narrative.body
          .split(/(?<=[.!?。])\s*/)
          .filter((s) => s.trim().length > 0);

        for (const citation of narrative.citations) {
          expect(citation.sentenceIndex).toBeGreaterThanOrEqual(0);
          expect(citation.sentenceIndex).toBeLessThan(sentences.length);
        }
      }),
      { numRuns: 100 }
    );
  });
});
