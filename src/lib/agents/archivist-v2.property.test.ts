import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  generateDiffRecord,
  applyDiffRecord,
  extractNERTags,
  assignEmotionTags,
  assignConfidenceLabel,
  generateTimelineEntry,
} from './archivist';

/**
 * Feature: agent-model-v2, Property 4: Diff record round-trip
 *
 * Validates: Requirements 2.1
 *
 * For any original transcript and its refined version, applying the diff record's
 * changes to the original transcript SHALL produce the refined version exactly
 * (round-trip property: applyDiff(original, diffRecord) === refined).
 */
describe('Property 4: Diff record round-trip', () => {
  const transcriptArb = fc.string({ minLength: 0, maxLength: 500 });

  it('applying the diff record to the original produces the refined version exactly', () => {
    fc.assert(
      fc.property(transcriptArb, transcriptArb, (original, refined) => {
        const diffRecord = generateDiffRecord(original, refined);
        const result = applyDiffRecord(diffRecord);
        expect(result).toBe(refined);
      }),
      { numRuns: 100 }
    );
  });

  it('diff record preserves original and refined text fields', () => {
    fc.assert(
      fc.property(transcriptArb, transcriptArb, (original, refined) => {
        const diffRecord = generateDiffRecord(original, refined);
        expect(diffRecord.original).toBe(original);
        expect(diffRecord.refined).toBe(refined);
      }),
      { numRuns: 100 }
    );
  });

  it('when original equals refined, changes array is empty', () => {
    fc.assert(
      fc.property(transcriptArb, (text) => {
        const diffRecord = generateDiffRecord(text, text);
        expect(diffRecord.changes).toEqual([]);
        expect(applyDiffRecord(diffRecord)).toBe(text);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: agent-model-v2, Property 5: NER tag category validation
 *
 * Validates: Requirements 2.2
 *
 * For any NER tag extracted by the Archivist Agent, the tag's category SHALL be
 * exactly one of: 'event', 'person', 'place', or 'time'.
 */
describe('Property 5: NER tag category validation', () => {
  const validCategories = ['event', 'person', 'place', 'time'];

  const transcriptArb = fc.string({ minLength: 1, maxLength: 300 });

  const tagsArb = fc.record({
    people: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 5 }),
    places: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 5 }),
    emotions: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 5 }),
    timePeriod: fc.string({ minLength: 0, maxLength: 30 }),
  });

  it('every extracted NER tag has a category from the valid set', () => {
    fc.assert(
      fc.property(transcriptArb, tagsArb, (transcript, tags) => {
        const nerTags = extractNERTags(transcript, tags);
        for (const tag of nerTags) {
          expect(validCategories).toContain(tag.category);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('every NER tag has required fields (text, category, startIndex, endIndex)', () => {
    fc.assert(
      fc.property(transcriptArb, tagsArb, (transcript, tags) => {
        const nerTags = extractNERTags(transcript, tags);
        for (const tag of nerTags) {
          expect(typeof tag.text).toBe('string');
          expect(validCategories).toContain(tag.category);
          expect(typeof tag.startIndex).toBe('number');
          expect(typeof tag.endIndex).toBe('number');
          expect(tag.startIndex).toBeGreaterThanOrEqual(0);
          expect(tag.endIndex).toBeGreaterThanOrEqual(0);
        }
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: agent-model-v2, Property 6: Emotion tag category validation
 *
 * Validates: Requirements 2.3
 *
 * For any emotion tag assigned by the Archivist Agent, the tag SHALL be exactly
 * one of: '자부심', '후회', '상실', or '감사'.
 */
describe('Property 6: Emotion tag category validation', () => {
  const validEmotionTags = ['자부심', '후회', '상실', '감사'];

  const transcriptArb = fc.string({ minLength: 1, maxLength: 300 });

  const existingEmotionsArb = fc.array(
    fc.string({ minLength: 1, maxLength: 20 }),
    { minLength: 0, maxLength: 5 }
  );

  it('every assigned emotion tag is from the valid set', () => {
    fc.assert(
      fc.property(transcriptArb, existingEmotionsArb, (transcript, existingEmotions) => {
        const emotionTags = assignEmotionTags(transcript, existingEmotions);
        for (const tag of emotionTags) {
          expect(validEmotionTags).toContain(tag);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('emotion tags array contains no duplicates', () => {
    fc.assert(
      fc.property(transcriptArb, existingEmotionsArb, (transcript, existingEmotions) => {
        const emotionTags = assignEmotionTags(transcript, existingEmotions);
        const uniqueTags = new Set(emotionTags);
        expect(uniqueTags.size).toBe(emotionTags.length);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: agent-model-v2, Property 7: Archivist output completeness and confidence label
 *
 * Validates: Requirements 2.4, 2.5
 *
 * For any transcript processed by the Archivist Agent, the output SHALL contain
 * exactly one Confidence_Label from {CONFIRMED, ESTIMATED, UNVERIFIED}, a valid
 * Memory_Chunk with all required fields, and a timeline entry linking the memory
 * to its temporal context.
 */
describe('Property 7: Archivist output completeness and confidence label', () => {
  const validConfidenceLabels = ['CONFIRMED', 'ESTIMATED', 'UNVERIFIED'];

  const transcriptArb = fc.string({ minLength: 1, maxLength: 300 });
  const memoryIdArb = fc.string({ minLength: 1, maxLength: 50 });
  const topicArb = fc.string({ minLength: 1, maxLength: 50 });
  const timePeriodArb = fc.string({ minLength: 0, maxLength: 30 });

  it('assignConfidenceLabel returns exactly one valid confidence label', () => {
    fc.assert(
      fc.property(transcriptArb, (transcript) => {
        const label = assignConfidenceLabel(transcript);
        expect(validConfidenceLabels).toContain(label);
      }),
      { numRuns: 100 }
    );
  });

  it('generateTimelineEntry returns an entry with all required fields', () => {
    fc.assert(
      fc.property(memoryIdArb, topicArb, timePeriodArb, transcriptArb, (memoryId, topic, timePeriod, transcript) => {
        const entry = generateTimelineEntry(memoryId, topic, timePeriod, transcript);

        // Verify all required fields exist
        expect(entry).toHaveProperty('memoryId');
        expect(entry).toHaveProperty('timePeriod');
        expect(entry).toHaveProperty('date');
        expect(entry).toHaveProperty('summary');

        // Verify field types
        expect(typeof entry.memoryId).toBe('string');
        expect(typeof entry.timePeriod).toBe('string');
        expect(typeof entry.date).toBe('string');
        expect(typeof entry.summary).toBe('string');

        // Verify memoryId is preserved
        expect(entry.memoryId).toBe(memoryId);

        // Verify timePeriod is non-empty (defaults to '시기 미상' if empty)
        expect(entry.timePeriod.length).toBeGreaterThan(0);

        // Verify date is a valid date string
        expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

        // Verify summary is non-empty
        expect(entry.summary.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('confidence label combined with timeline entry provides complete archivist output', () => {
    fc.assert(
      fc.property(memoryIdArb, topicArb, timePeriodArb, transcriptArb, (memoryId, topic, timePeriod, transcript) => {
        const label = assignConfidenceLabel(transcript);
        const entry = generateTimelineEntry(memoryId, topic, timePeriod, transcript);

        // Confidence label is valid
        expect(validConfidenceLabels).toContain(label);

        // Timeline entry links to the memory
        expect(entry.memoryId).toBe(memoryId);

        // Both outputs are present and well-formed
        expect(typeof label).toBe('string');
        expect(typeof entry).toBe('object');
      }),
      { numRuns: 100 }
    );
  });
});
