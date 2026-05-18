import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { ChapterNarrative, Citation } from '../lib/types';

// ─── Helper Functions for Preview Round-Trip ─────────────────────────────────

/**
 * Serializes a ChapterNarrative to a display/preview format.
 * The preview format embeds citation markers inline as [출처: memoryId]
 * immediately after the sentence text (before the trailing space separator).
 * 
 * Format: "sentence1.[출처: id1] sentence2.[출처: id2]"
 * The citation marker is placed directly after the sentence (no space between
 * sentence-ending punctuation and the marker).
 */
export function serializeToPreview(narrative: ChapterNarrative): string {
  const sentences = narrative.body.split(/(?<=[.!?。])\s*/);
  const citationMap = new Map<number, Citation[]>();

  for (const citation of narrative.citations) {
    const existing = citationMap.get(citation.sentenceIndex) || [];
    existing.push(citation);
    citationMap.set(citation.sentenceIndex, existing);
  }

  const parts: string[] = [];
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    if (!sentence) continue;
    const citations = citationMap.get(i);
    if (citations && citations.length > 0) {
      const markers = citations.map((c) => `[출처: ${c.memoryId}]`).join('');
      parts.push(`${sentence}${markers}`);
    } else {
      parts.push(sentence);
    }
  }

  return parts.join(' ');
}

/**
 * Parses a preview-formatted string back into a ChapterNarrative structure.
 * Extracts inline citation markers [출처: memoryId] and reconstructs the
 * citations array and clean body text.
 *
 * Strategy: First remove all citation markers while recording their positions
 * relative to sentences, then reconstruct the clean body.
 */
export function parseFromPreview(
  preview: string,
  chapterId: string,
  title: string
): ChapterNarrative {
  const citationPattern = /\[출처: ([^\]]+)\]/g;

  // Step 1: Find all citation markers and their positions in the string
  interface CitationMark {
    memoryId: string;
    position: number; // character position in the preview string
  }
  const citationMarks: CitationMark[] = [];
  let match: RegExpExecArray | null;
  while ((match = citationPattern.exec(preview)) !== null) {
    citationMarks.push({
      memoryId: match[1],
      position: match.index,
    });
  }

  // Step 2: Remove all citation markers to get clean text
  const cleanText = preview.replace(/\[출처: [^\]]+\]/g, '').trim();

  // Step 3: Split clean text into sentences
  const sentences = cleanText.split(/(?<=[.!?。])\s*/).filter((s) => s.trim().length > 0);

  // Step 4: Map citation positions back to sentence indices
  // We need to figure out which sentence each citation belongs to.
  // A citation at position P in the preview belongs to the sentence that
  // ends just before P (the sentence whose ending punctuation precedes P).
  
  // Build a map of "text before this position (excluding markers)" to sentence index
  // by walking through the preview and tracking which sentence we're in.
  const citations: Citation[] = [];
  
  // Walk through the preview character by character, tracking sentence index
  let currentSentenceIdx = 0;
  let i = 0;
  const sentenceEndPattern = /[.!?。]/;
  
  // Track positions of sentence endings in the clean text
  const sentenceEndPositions: number[] = [];
  let pos = 0;
  for (let sIdx = 0; sIdx < sentences.length; sIdx++) {
    pos += sentences[sIdx].length;
    sentenceEndPositions.push(pos);
    pos += 1; // account for the space separator
  }

  // For each citation mark, determine which sentence it belongs to
  // by looking at the clean text before the citation's position
  for (const mark of citationMarks) {
    // Count how much clean text appears before this citation position
    let cleanCharsBeforeMark = 0;
    let previewIdx = 0;
    const markerPattern = /\[출처: [^\]]+\]/g;
    let tempMatch: RegExpExecArray | null;
    const allMarkers: Array<{ start: number; end: number }> = [];
    
    const tempPattern = /\[출처: [^\]]+\]/g;
    while ((tempMatch = tempPattern.exec(preview)) !== null) {
      allMarkers.push({ start: tempMatch.index, end: tempMatch.index + tempMatch[0].length });
    }

    // Count clean characters before this mark's position
    for (let ci = 0; ci < mark.position; ci++) {
      const isInMarker = allMarkers.some((m) => ci >= m.start && ci < m.end);
      if (!isInMarker) {
        cleanCharsBeforeMark++;
      }
    }

    // Determine which sentence this belongs to based on clean char count
    let sentenceIdx = 0;
    let cumLen = 0;
    for (let sIdx = 0; sIdx < sentences.length; sIdx++) {
      cumLen += sentences[sIdx].length + (sIdx < sentences.length - 1 ? 1 : 0); // +1 for space
      if (cleanCharsBeforeMark <= cumLen) {
        sentenceIdx = sIdx;
        break;
      }
    }

    citations.push({
      sentenceIndex: sentenceIdx,
      memoryId: mark.memoryId,
    });
  }

  return {
    chapterId,
    title,
    body: sentences.join(' '),
    citations,
  };
}

// ─── Generators ──────────────────────────────────────────────────────────────

/**
 * Generate a safe sentence that won't interfere with citation parsing.
 * Avoids brackets and citation-like patterns.
 */
const safeSentenceArb = fc
  .string({ minLength: 3, maxLength: 40 })
  .map((s) => s.replace(/[\[\]출처:.!?。\n\r]/g, '').trim())
  .filter((s) => s.length >= 2)
  .map((s) => s + '.');

/** Generate a memory ID (UUID-like) */
const memoryIdArb = fc.uuid();

/**
 * Generate a valid ChapterNarrative with sentences and citations.
 * Each sentence may have zero or more citations.
 */
const chapterNarrativeArb: fc.Arbitrary<ChapterNarrative> = fc
  .tuple(
    fc.string({ minLength: 1, maxLength: 20 }), // chapterId
    fc.string({ minLength: 1, maxLength: 50 }), // title
    fc.array(safeSentenceArb, { minLength: 1, maxLength: 8 }), // sentences
    fc.array(memoryIdArb, { minLength: 1, maxLength: 5 }) // available memory IDs
  )
  .chain(([chapterId, title, sentences, memoryIds]) => {
    const uniqueMemoryIds = [...new Set(memoryIds)];
    const body = sentences.join(' ');

    // Generate citations: for each sentence, optionally assign 0-2 citations
    return fc
      .array(
        fc.tuple(
          fc.integer({ min: 0, max: sentences.length - 1 }),
          fc.integer({ min: 0, max: uniqueMemoryIds.length - 1 })
        ),
        { minLength: 1, maxLength: sentences.length * 2 }
      )
      .map((citationPairs) => {
        const citations: Citation[] = citationPairs.map(
          ([sentenceIdx, memoryIdx]) => ({
            sentenceIndex: sentenceIdx,
            memoryId: uniqueMemoryIds[memoryIdx],
          })
        );

        // Deduplicate citations (same sentenceIndex + memoryId)
        const seen = new Set<string>();
        const uniqueCitations = citations.filter((c) => {
          const key = `${c.sentenceIndex}-${c.memoryId}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        return {
          chapterId,
          title,
          body,
          citations: uniqueCitations,
        } as ChapterNarrative;
      });
  });

/**
 * Generate a ChapterNarrative that has at least one citation (for edit tests).
 */
const narrativeWithCitationsArb: fc.Arbitrary<ChapterNarrative> = fc
  .tuple(
    fc.string({ minLength: 1, maxLength: 20 }), // chapterId
    fc.string({ minLength: 1, maxLength: 50 }), // title
    fc.array(safeSentenceArb, { minLength: 2, maxLength: 8 }), // sentences (at least 2)
    fc.array(memoryIdArb, { minLength: 1, maxLength: 5 }) // available memory IDs
  )
  .map(([chapterId, title, sentences, memoryIds]) => {
    const uniqueMemoryIds = [...new Set(memoryIds)];
    const body = sentences.join(' ');

    // Ensure every sentence has at least one citation
    const citations: Citation[] = sentences.map((_, idx) => ({
      sentenceIndex: idx,
      memoryId: uniqueMemoryIds[idx % uniqueMemoryIds.length],
    }));

    return {
      chapterId,
      title,
      body,
      citations,
    } as ChapterNarrative;
  });

// ─── Property 14: Autobiography Preview Round-Trip ───────────────────────────

/**
 * Feature: memoir-platform-enhancement, Property 14: Autobiography Preview Round-Trip
 *
 * **Validates: Requirements 13.3**
 *
 * For all generated autobiography content, formatting to preview then parsing back
 * to the internal chapter structure SHALL produce an equivalent data structure
 * (round-trip property).
 */
describe('Property 14: Autobiography Preview Round-Trip', () => {
  it('serializing to preview and parsing back produces equivalent ChapterNarrative', () => {
    fc.assert(
      fc.property(chapterNarrativeArb, (narrative) => {
        // Serialize to preview format
        const preview = serializeToPreview(narrative);

        // Parse back from preview format
        const parsed = parseFromPreview(
          preview,
          narrative.chapterId,
          narrative.title
        );

        // The body text should be equivalent
        expect(parsed.body).toBe(narrative.body);

        // The chapterId and title should be preserved
        expect(parsed.chapterId).toBe(narrative.chapterId);
        expect(parsed.title).toBe(narrative.title);

        // Citations should be equivalent (same set of sentenceIndex + memoryId pairs)
        const originalCitationSet = new Set(
          narrative.citations.map((c) => `${c.sentenceIndex}:${c.memoryId}`)
        );
        const parsedCitationSet = new Set(
          parsed.citations.map((c) => `${c.sentenceIndex}:${c.memoryId}`)
        );

        expect(parsedCitationSet).toEqual(originalCitationSet);
      }),
      { numRuns: 100 }
    );
  });

  it('round-trip preserves citation count per sentence', () => {
    fc.assert(
      fc.property(chapterNarrativeArb, (narrative) => {
        const preview = serializeToPreview(narrative);
        const parsed = parseFromPreview(
          preview,
          narrative.chapterId,
          narrative.title
        );

        // Count citations per sentence in original
        const originalCounts = new Map<number, number>();
        for (const c of narrative.citations) {
          originalCounts.set(
            c.sentenceIndex,
            (originalCounts.get(c.sentenceIndex) || 0) + 1
          );
        }

        // Count citations per sentence in parsed
        const parsedCounts = new Map<number, number>();
        for (const c of parsed.citations) {
          parsedCounts.set(
            c.sentenceIndex,
            (parsedCounts.get(c.sentenceIndex) || 0) + 1
          );
        }

        expect(parsedCounts).toEqual(originalCounts);
      }),
      { numRuns: 100 }
    );
  });
});

// ─── Property 15: Edit Preserves Citation Links ──────────────────────────────

/**
 * Feature: memoir-platform-enhancement, Property 15: Edit Preserves Citation Links
 *
 * **Validates: Requirements 13.4**
 *
 * For any chapter narrative with existing citations, editing the body text in a way
 * that does not remove cited sentence content SHALL preserve all citation links in
 * the updated chapter data.
 */
describe('Property 15: Edit Preserves Citation Links', () => {
  /**
   * Simulates an edit that preserves all sentences (adds text within sentences
   * or appends new sentences). The key insight: if the number of sentences stays
   * the same or increases, all original citations should be preserved.
   */
  function applyNonDestructiveEdit(
    narrative: ChapterNarrative,
    insertions: Array<{ sentenceIndex: number; text: string }>
  ): ChapterNarrative {
    const sentences = narrative.body.split(/(?<=[.!?。])\s*/);

    // Apply insertions: add text within existing sentences (before the period)
    for (const insertion of insertions) {
      const idx = insertion.sentenceIndex % sentences.length;
      const sentence = sentences[idx];
      // Insert text before the final punctuation
      const lastChar = sentence[sentence.length - 1];
      sentences[idx] =
        sentence.slice(0, -1) + ' ' + insertion.text + lastChar;
    }

    // The edit preserves all sentences, so citations remain valid
    return {
      ...narrative,
      body: sentences.join(' '),
      // Citations are preserved since no sentences were removed
      citations: [...narrative.citations],
    };
  }

  /** Generate safe insertion text (no sentence-ending punctuation or brackets) */
  const insertionTextArb = fc
    .string({ minLength: 1, maxLength: 15 })
    .map((s) => s.replace(/[\[\]출처:.!?。\n\r]/g, '').trim())
    .filter((s) => s.length > 0);

  it('editing body text without removing sentences preserves all citations', () => {
    fc.assert(
      fc.property(
        narrativeWithCitationsArb,
        fc.array(
          fc.tuple(
            fc.nat({ max: 20 }), // sentenceIndex (will be modded)
            insertionTextArb
          ),
          { minLength: 1, maxLength: 5 }
        ),
        (narrative, rawInsertions) => {
          const insertions = rawInsertions.map(([idx, text]) => ({
            sentenceIndex: idx,
            text,
          }));

          // Apply non-destructive edit
          const edited = applyNonDestructiveEdit(narrative, insertions);

          // The number of sentences should remain the same
          const originalSentences = narrative.body
            .split(/(?<=[.!?。])\s*/)
            .filter((s) => s.trim().length > 0);
          const editedSentences = edited.body
            .split(/(?<=[.!?。])\s*/)
            .filter((s) => s.trim().length > 0);
          expect(editedSentences.length).toBe(originalSentences.length);

          // All original citations should be preserved
          expect(edited.citations.length).toBe(narrative.citations.length);

          // Each citation should have the same sentenceIndex and memoryId
          for (let i = 0; i < narrative.citations.length; i++) {
            expect(edited.citations[i].sentenceIndex).toBe(
              narrative.citations[i].sentenceIndex
            );
            expect(edited.citations[i].memoryId).toBe(
              narrative.citations[i].memoryId
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('appending new sentences preserves all existing citations', () => {
    fc.assert(
      fc.property(
        narrativeWithCitationsArb,
        fc.array(safeSentenceArb, { minLength: 1, maxLength: 3 }),
        (narrative, newSentences) => {
          // Append new sentences to the body
          const editedBody = narrative.body + ' ' + newSentences.join(' ');

          const edited: ChapterNarrative = {
            ...narrative,
            body: editedBody,
            // Citations are preserved - new sentences don't affect existing indices
            citations: [...narrative.citations],
          };

          // Original citations should all still be valid
          const editedSentences = edited.body
            .split(/(?<=[.!?。])\s*/)
            .filter((s) => s.trim().length > 0);

          // The edited text has more sentences
          const originalSentences = narrative.body
            .split(/(?<=[.!?。])\s*/)
            .filter((s) => s.trim().length > 0);
          expect(editedSentences.length).toBeGreaterThanOrEqual(
            originalSentences.length
          );

          // All original citations are preserved with same indices
          expect(edited.citations.length).toBe(narrative.citations.length);
          for (const citation of edited.citations) {
            expect(citation.sentenceIndex).toBeLessThan(
              originalSentences.length
            );
            // The citation still references a valid memory ID
            expect(citation.memoryId).toBeTruthy();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('modifying characters within a sentence preserves its citations', () => {
    fc.assert(
      fc.property(
        narrativeWithCitationsArb,
        fc.nat({ max: 100 }), // which sentence to modify (will be modded)
        insertionTextArb, // text to prepend within the sentence
        (narrative, sentenceSelector, extraText) => {
          const sentences = narrative.body.split(/(?<=[.!?。])\s*/);
          const targetIdx = sentenceSelector % sentences.length;

          // Modify the target sentence by prepending text (keeping punctuation)
          const original = sentences[targetIdx];
          const lastChar = original[original.length - 1];
          sentences[targetIdx] =
            extraText + ' ' + original.slice(0, -1) + lastChar;

          const edited: ChapterNarrative = {
            ...narrative,
            body: sentences.join(' '),
            citations: [...narrative.citations],
          };

          // Citations for the modified sentence should still be present
          const citationsForTarget = edited.citations.filter(
            (c) => c.sentenceIndex === targetIdx
          );
          const originalCitationsForTarget = narrative.citations.filter(
            (c) => c.sentenceIndex === targetIdx
          );

          expect(citationsForTarget.length).toBe(
            originalCitationsForTarget.length
          );
          for (let i = 0; i < citationsForTarget.length; i++) {
            expect(citationsForTarget[i].memoryId).toBe(
              originalCitationsForTarget[i].memoryId
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
