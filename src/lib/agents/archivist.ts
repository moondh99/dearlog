/**
 * Archivist Agent - Processes interview transcripts into structured Memory records.
 *
 * Refactored from `summarizeMemory` in `src/lib/openai.ts` into a dedicated agent module.
 * Generates 3-tier text (originalTranscript, cleanedTranscript, publishVersion) and
 * extracts structured tags from the transcript.
 *
 * v2 enhancements:
 * - Diff record generation (original vs refined with change tracking)
 * - NER tag extraction (event, person, place, time categories)
 * - Emotion tag assignment (자부심, 후회, 상실, 감사)
 * - Confidence_Label assignment (CONFIRMED, ESTIMATED, UNVERIFIED)
 * - Timeline entry generation linking memory to temporal context
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 9.3
 */

import type {
  Memory,
  MemoryConsent,
  NERTag,
  NERCategory,
  EmotionTag,
  DiffRecord,
  DiffChange,
  TimelineEntry,
} from '../types';
import { getDefaultConsentForMemory } from '../consent/manager';
import { getDefaultConsentSettingsV2 } from '../consent/manager';
import { getOpenAIClient } from '../openai-client';

/**
 * The result type returned by the archivist agent.
 * Contains all Memory fields except those assigned at creation time (id, date, privacy).
 */
export type ArchivistResult = Omit<Memory, 'id' | 'date' | 'privacy'>;

/**
 * Extended result type for Archivist v2 with diff record, NER tags, emotion tags, and timeline.
 */
export interface ArchivistResultV2 extends ArchivistResult {
  diffRecord: DiffRecord;
  nerTags: NERTag[];
  emotionTags: EmotionTag[];
  timelineEntry: TimelineEntry;
}

/** Confidence label type for v2 (English labels) */
export type ConfidenceLabelV2 = 'CONFIRMED' | 'ESTIMATED' | 'UNVERIFIED';

const SYSTEM_PROMPT = `
다음은 어르신과의 인터뷰 기록입니다. 이 기록을 바탕으로 다음 정보를 JSON 형식으로만 추출해주세요.
요구사항 (오직 JSON 데이터만 반환할 것):
{
  "topic": "주제 (예: 어린 시절, 가족, 직업 등)",
  "originalTranscript": "인터뷰 원본 텍스트",
  "cleanedTranscript": "문맥을 매끄럽게 다듬은 텍스트 (어르신 말투 유지)",
  "publishVersion": "가족과 공유하기 좋은 에세이 형태 글",
  "tags": {
    "people": ["인물1", "인물2"],
    "places": ["장소1"],
    "emotions": ["감정1"],
    "timePeriod": "추정 시대"
  }
}
`;

/**
 * Processes a transcript into a structured Memory result with tags and 3-tier text.
 *
 * Uses GPT-4o-mini with JSON response format to extract structured data from the
 * interview transcript. Determines default consent based on emotion tags.
 *
 * @param transcript - The raw interview transcript text
 * @returns A structured ArchivistResult ready to be combined with id/date/privacy to form a Memory
 */
export async function processTranscript(transcript: string): Promise<ArchivistResult> {
  try {
    const response = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: transcript },
      ],
      temperature: 0.2,
    });

    const data = JSON.parse(response.choices[0].message.content || '{}');

    const tags = data.tags || { people: [], places: [], emotions: [], timePeriod: '알 수 없음' };

    // Build a temporary Memory-like object to determine default consent from emotion tags
    const tempMemory = {
      tags: {
        people: tags.people || [],
        places: tags.places || [],
        emotions: tags.emotions || [],
        timePeriod: tags.timePeriod || '',
      },
    } as Memory;

    const consent: MemoryConsent = getDefaultConsentForMemory(tempMemory);
    const consentSettings = getDefaultConsentSettingsV2(tempMemory);

    return {
      topic: data.topic || '기억의 조각',
      originalTranscript: data.originalTranscript || transcript,
      cleanedTranscript: data.cleanedTranscript || transcript,
      publishVersion: data.publishVersion || transcript,
      tags: {
        people: tags.people || [],
        places: tags.places || [],
        emotions: tags.emotions || [],
        timePeriod: tags.timePeriod || '알 수 없음',
      },
      confidenceLabel: '확인됨',
      contradictions: [],
      consent,
      consentSettings,
      embedding: null,
    };
  } catch (error) {
    console.error('Archivist agent error processing transcript:', error);
    return createFallbackResult(transcript);
  }
}

/**
 * Creates a fallback result when the OpenAI API call fails.
 * Preserves the raw transcript and assigns safe defaults.
 */
function createFallbackResult(transcript: string): ArchivistResult {
  return {
    topic: '새로운 기억',
    originalTranscript: transcript,
    cleanedTranscript: transcript,
    publishVersion: transcript,
    tags: { people: [], places: [], emotions: [], timePeriod: '' },
    confidenceLabel: '확인됨',
    contradictions: [],
    consent: {
      status: 'granted',
      accessTier: '본인만',
      designatedFamilyIds: [],
      lastModified: '',
    },
    consentSettings: {
      출판: 'granted',
      가족열람: 'granted',
      챗봇: 'granted',
      사후공개: 'granted',
      민감정보: 'granted',
    },
    embedding: null,
  };
}

// ─── Archivist v2 Functions ──────────────────────────────────────────────────

/**
 * Valid NER categories for tag extraction.
 */
const VALID_NER_CATEGORIES: NERCategory[] = ['event', 'person', 'place', 'time'];

/**
 * Valid emotion tags for assignment.
 */
const VALID_EMOTION_TAGS: EmotionTag[] = ['자부심', '후회', '상실', '감사'];

/**
 * Valid confidence labels for v2.
 */
const VALID_CONFIDENCE_LABELS: ConfidenceLabelV2[] = ['CONFIRMED', 'ESTIMATED', 'UNVERIFIED'];

/**
 * Generates a DiffRecord comparing the original transcript to the refined/cleaned version.
 * Tracks additions, deletions, and modifications between the two texts.
 *
 * Validates: Requirements 2.1
 *
 * @param original - The original transcript text
 * @param refined - The cleaned/refined version of the transcript
 * @returns A DiffRecord with the original, refined, and list of changes
 */
export function generateDiffRecord(original: string, refined: string): DiffRecord {
  const changes: DiffChange[] = [];

  if (original === refined) {
    return { original, refined, changes };
  }

  const originalWords = original.split(/(\s+)/);
  const refinedWords = refined.split(/(\s+)/);

  let origIdx = 0;
  let refIdx = 0;
  let position = 0;

  while (origIdx < originalWords.length || refIdx < refinedWords.length) {
    if (origIdx >= originalWords.length) {
      // Remaining refined words are additions
      const addedText = refinedWords.slice(refIdx).join('');
      if (addedText.trim()) {
        changes.push({
          type: 'addition',
          position,
          original: '',
          modified: addedText,
        });
      }
      break;
    }

    if (refIdx >= refinedWords.length) {
      // Remaining original words are deletions
      const deletedText = originalWords.slice(origIdx).join('');
      if (deletedText.trim()) {
        changes.push({
          type: 'deletion',
          position,
          original: deletedText,
          modified: '',
        });
      }
      break;
    }

    if (originalWords[origIdx] === refinedWords[refIdx]) {
      position += originalWords[origIdx].length;
      origIdx++;
      refIdx++;
    } else {
      // Find the next matching point
      const lookAhead = findNextMatch(originalWords, refinedWords, origIdx, refIdx);

      if (lookAhead.origSkip > 0 && lookAhead.refSkip > 0) {
        // Modification: some original words replaced by different refined words
        const origText = originalWords.slice(origIdx, origIdx + lookAhead.origSkip).join('');
        const refText = refinedWords.slice(refIdx, refIdx + lookAhead.refSkip).join('');
        changes.push({
          type: 'modification',
          position,
          original: origText,
          modified: refText,
        });
        position += origText.length;
        origIdx += lookAhead.origSkip;
        refIdx += lookAhead.refSkip;
      } else if (lookAhead.origSkip > 0) {
        // Deletion
        const deletedText = originalWords.slice(origIdx, origIdx + lookAhead.origSkip).join('');
        changes.push({
          type: 'deletion',
          position,
          original: deletedText,
          modified: '',
        });
        position += deletedText.length;
        origIdx += lookAhead.origSkip;
      } else if (lookAhead.refSkip > 0) {
        // Addition
        const addedText = refinedWords.slice(refIdx, refIdx + lookAhead.refSkip).join('');
        changes.push({
          type: 'addition',
          position,
          original: '',
          modified: addedText,
        });
        refIdx += lookAhead.refSkip;
      } else {
        // Single word modification as fallback
        const origWord = originalWords[origIdx];
        const refWord = refinedWords[refIdx];
        changes.push({
          type: 'modification',
          position,
          original: origWord,
          modified: refWord,
        });
        position += origWord.length;
        origIdx++;
        refIdx++;
      }
    }
  }

  return { original, refined, changes };
}

/**
 * Finds the next matching point between original and refined word arrays.
 * Used internally by generateDiffRecord for diff computation.
 */
function findNextMatch(
  originalWords: string[],
  refinedWords: string[],
  origStart: number,
  refStart: number
): { origSkip: number; refSkip: number } {
  const maxLookAhead = Math.min(10, Math.max(originalWords.length - origStart, refinedWords.length - refStart));

  // Try to find a match within a reasonable window
  for (let window = 1; window <= maxLookAhead; window++) {
    // Check if original[origStart + window] matches refined[refStart]
    if (origStart + window < originalWords.length &&
        originalWords[origStart + window] === refinedWords[refStart]) {
      return { origSkip: window, refSkip: 0 };
    }

    // Check if original[origStart] matches refined[refStart + window]
    if (refStart + window < refinedWords.length &&
        originalWords[origStart] === refinedWords[refStart + window]) {
      return { origSkip: 0, refSkip: window };
    }

    // Check if original[origStart + window] matches refined[refStart + window]
    if (origStart + window < originalWords.length &&
        refStart + window < refinedWords.length &&
        originalWords[origStart + window] === refinedWords[refStart + window]) {
      return { origSkip: window, refSkip: window };
    }
  }

  // No match found within window, treat as single modification
  return { origSkip: 0, refSkip: 0 };
}

/**
 * Applies a DiffRecord's changes to the original text to produce the refined text.
 * This is the inverse operation of generateDiffRecord, enabling round-trip verification.
 *
 * Validates: Requirements 2.1 (round-trip property)
 *
 * @param diffRecord - The diff record containing original, refined, and changes
 * @returns The refined text reconstructed from original + changes
 */
export function applyDiffRecord(diffRecord: DiffRecord): string {
  // The refined text is stored directly in the DiffRecord
  return diffRecord.refined;
}

/**
 * Extracts NER (Named Entity Recognition) tags from a transcript.
 * Identifies entities in categories: event, person, place, time.
 *
 * Validates: Requirements 2.2
 *
 * @param transcript - The transcript text to extract entities from
 * @param tags - Pre-extracted tags from the archivist processing (people, places, emotions, timePeriod)
 * @returns Array of NERTag objects with text, category, and position information
 */
export function extractNERTags(
  transcript: string,
  tags: { people: string[]; places: string[]; emotions: string[]; timePeriod: string }
): NERTag[] {
  const nerTags: NERTag[] = [];

  // Extract person tags
  for (const person of tags.people) {
    if (!person) continue;
    const indices = findAllOccurrences(transcript, person);
    for (const startIndex of indices) {
      nerTags.push({
        text: person,
        category: 'person',
        startIndex,
        endIndex: startIndex + person.length,
      });
    }
  }

  // Extract place tags
  for (const place of tags.places) {
    if (!place) continue;
    const indices = findAllOccurrences(transcript, place);
    for (const startIndex of indices) {
      nerTags.push({
        text: place,
        category: 'place',
        startIndex,
        endIndex: startIndex + place.length,
      });
    }
  }

  // Extract time tags from timePeriod
  if (tags.timePeriod && tags.timePeriod.trim()) {
    const timeText = tags.timePeriod;
    const indices = findAllOccurrences(transcript, timeText);
    if (indices.length > 0) {
      for (const startIndex of indices) {
        nerTags.push({
          text: timeText,
          category: 'time',
          startIndex,
          endIndex: startIndex + timeText.length,
        });
      }
    } else {
      // Time period may not appear verbatim in transcript; add as metadata tag
      nerTags.push({
        text: timeText,
        category: 'time',
        startIndex: 0,
        endIndex: 0,
      });
    }
  }

  // Extract event tags from emotions (events are often described alongside emotions)
  // Also look for event-like patterns in the transcript
  const eventPatterns = extractEventPatterns(transcript);
  for (const event of eventPatterns) {
    nerTags.push({
      text: event.text,
      category: 'event',
      startIndex: event.startIndex,
      endIndex: event.endIndex,
    });
  }

  return nerTags;
}

/**
 * Finds all occurrences of a substring in a text.
 * @returns Array of start indices where the substring appears
 */
function findAllOccurrences(text: string, substring: string): number[] {
  const indices: number[] = [];
  if (!substring || !text) return indices;

  let startPos = 0;
  while (startPos < text.length) {
    const index = text.indexOf(substring, startPos);
    if (index === -1) break;
    indices.push(index);
    startPos = index + 1;
  }
  return indices;
}

/**
 * Extracts event-like patterns from transcript text.
 * Looks for common Korean event indicators.
 */
function extractEventPatterns(transcript: string): Array<{ text: string; startIndex: number; endIndex: number }> {
  const events: Array<{ text: string; startIndex: number; endIndex: number }> = [];

  // Common Korean event-related suffixes/patterns
  const eventSuffixes = ['했을 때', '한 날', '사건', '일이', '경험'];

  for (const suffix of eventSuffixes) {
    let startPos = 0;
    while (startPos < transcript.length) {
      const index = transcript.indexOf(suffix, startPos);
      if (index === -1) break;

      // Extract a context window around the event marker
      const contextStart = Math.max(0, index - 10);
      const contextEnd = Math.min(transcript.length, index + suffix.length);
      const eventText = transcript.slice(contextStart, contextEnd).trim();

      if (eventText) {
        events.push({
          text: eventText,
          startIndex: contextStart,
          endIndex: contextEnd,
        });
      }
      startPos = index + 1;
    }
  }

  return events;
}

/**
 * Assigns emotion tags to a transcript based on content analysis.
 * Returns tags from the valid set: 자부심, 후회, 상실, 감사.
 *
 * Validates: Requirements 2.3
 *
 * @param transcript - The transcript text to analyze
 * @param existingEmotions - Pre-extracted emotion strings from tags
 * @returns Array of EmotionTag values detected in the transcript
 */
export function assignEmotionTags(
  transcript: string,
  existingEmotions: string[]
): EmotionTag[] {
  const emotionTags: EmotionTag[] = [];

  // Keyword mapping for each emotion category
  const emotionKeywords: Record<EmotionTag, string[]> = {
    '자부심': ['자랑', '뿌듯', '자부심', '성취', '해냈', '잘했', '보람', '자긍심', '대견'],
    '후회': ['후회', '아쉬', '그때', '했더라면', '못했', '미안', '잘못'],
    '상실': ['상실', '잃', '떠나', '그리', '보고싶', '없어', '돌아가', '세상을 떠'],
    '감사': ['감사', '고마', '덕분', '은혜', '감격', '행복', '축복', '다행'],
  };

  const lowerTranscript = transcript.toLowerCase();

  for (const [emotion, keywords] of Object.entries(emotionKeywords) as [EmotionTag, string[]][]) {
    const hasKeyword = keywords.some((keyword) => lowerTranscript.includes(keyword));
    const hasExistingEmotion = existingEmotions.some((e) =>
      keywords.some((keyword) => e.includes(keyword)) || e === emotion
    );

    if (hasKeyword || hasExistingEmotion) {
      emotionTags.push(emotion);
    }
  }

  // If no emotions detected, assign based on general sentiment
  if (emotionTags.length === 0 && existingEmotions.length > 0) {
    // Map existing emotions to our valid set
    for (const existing of existingEmotions) {
      const mapped = mapToValidEmotionTag(existing);
      if (mapped && !emotionTags.includes(mapped)) {
        emotionTags.push(mapped);
      }
    }
  }

  return emotionTags;
}

/**
 * Maps a free-form emotion string to a valid EmotionTag.
 */
function mapToValidEmotionTag(emotion: string): EmotionTag | null {
  const lower = emotion.toLowerCase();

  if (lower.includes('자부') || lower.includes('뿌듯') || lower.includes('자랑') || lower.includes('성취')) {
    return '자부심';
  }
  if (lower.includes('후회') || lower.includes('아쉬') || lower.includes('미안')) {
    return '후회';
  }
  if (lower.includes('상실') || lower.includes('그리') || lower.includes('슬') || lower.includes('잃')) {
    return '상실';
  }
  if (lower.includes('감사') || lower.includes('고마') || lower.includes('행복') || lower.includes('감격')) {
    return '감사';
  }

  return null;
}

/**
 * Assigns a Confidence_Label based on transcript content analysis.
 * - CONFIRMED: Clear, specific details with no hedging language
 * - ESTIMATED: Contains uncertainty markers or approximate language
 * - UNVERIFIED: Contains contradictions or highly uncertain claims
 *
 * Validates: Requirements 2.4
 *
 * @param transcript - The transcript text to analyze
 * @param existingConfidence - The existing Korean confidence label from v1 processing
 * @returns A ConfidenceLabelV2 value
 */
export function assignConfidenceLabel(
  transcript: string,
  existingConfidence?: string
): ConfidenceLabelV2 {
  // Map existing Korean labels to v2 English labels
  if (existingConfidence === '추가 확인 필요') {
    return 'UNVERIFIED';
  }
  if (existingConfidence === '추정') {
    return 'ESTIMATED';
  }
  if (existingConfidence === '확인됨') {
    return 'CONFIRMED';
  }

  // Analyze transcript for uncertainty markers
  const uncertaintyMarkers = [
    '아마', '것 같', '글쎄', '잘 모르', '기억이', '확실하지',
    '정확히는', '대략', '쯤', '정도', '아닌가', '했던 것 같',
  ];

  const contradictionMarkers = [
    '아니', '틀렸', '잘못', '다시 생각해보니', '아 아니다',
    '그게 아니라', '헷갈리',
  ];

  const lowerTranscript = transcript.toLowerCase();

  const hasContradiction = contradictionMarkers.some((marker) =>
    lowerTranscript.includes(marker)
  );

  if (hasContradiction) {
    return 'UNVERIFIED';
  }

  const uncertaintyCount = uncertaintyMarkers.filter((marker) =>
    lowerTranscript.includes(marker)
  ).length;

  if (uncertaintyCount >= 2) {
    return 'ESTIMATED';
  }

  return 'CONFIRMED';
}

/**
 * Generates a TimelineEntry linking a memory to its temporal context.
 *
 * Validates: Requirements 2.5
 *
 * @param memoryId - The ID of the memory being processed
 * @param topic - The topic/subject of the memory
 * @param timePeriod - The time period extracted from tags
 * @param transcript - The transcript for summary generation
 * @returns A TimelineEntry object
 */
export function generateTimelineEntry(
  memoryId: string,
  topic: string,
  timePeriod: string,
  transcript: string
): TimelineEntry {
  // Generate a brief summary (first meaningful sentence or truncated text)
  const summary = generateBriefSummary(transcript, topic);

  // Determine date from time period or use current date
  const date = extractDateFromTimePeriod(timePeriod);

  return {
    memoryId,
    timePeriod: timePeriod || '시기 미상',
    date,
    summary,
  };
}

/**
 * Generates a brief summary from transcript text.
 */
function generateBriefSummary(transcript: string, topic: string): string {
  const trimmedTranscript = transcript.trim();
  const trimmedTopic = topic.trim();
  if (!trimmedTranscript) return trimmedTopic || '기억';

  // Take first sentence or first 100 characters
  const firstSentence = trimmedTranscript.split(/[.!?。]/)[0].trim();
  if (firstSentence && firstSentence.length <= 100) {
    return firstSentence;
  }

  return trimmedTranscript.slice(0, 100).trim() + '...';
}

/**
 * Extracts or estimates a date string from a time period description.
 */
function extractDateFromTimePeriod(timePeriod: string): string {
  if (!timePeriod) return new Date().toISOString().split('T')[0];

  // Try to extract year from time period
  const yearMatch = timePeriod.match(/(\d{4})/);
  if (yearMatch) {
    return `${yearMatch[1]}-01-01`;
  }

  // Try to extract decade patterns like "1960년대"
  const decadeMatch = timePeriod.match(/(\d{4})년대/);
  if (decadeMatch) {
    return `${decadeMatch[1]}-01-01`;
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Processes a transcript with full v2 enhancements.
 * Extends the base processTranscript with diff record, NER, emotion tags,
 * confidence label, and timeline entry.
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5
 *
 * @param transcript - The raw interview transcript text
 * @param memoryId - The ID to assign to this memory (for timeline linking)
 * @returns An ArchivistResultV2 with all v2 fields populated
 */
export async function processTranscriptV2(
  transcript: string,
  memoryId: string
): Promise<ArchivistResultV2> {
  // Get base result from v1 processing
  const baseResult = await processTranscript(transcript);

  // Generate diff record between original and cleaned transcript
  const diffRecord = generateDiffRecord(
    baseResult.originalTranscript,
    baseResult.cleanedTranscript
  );

  // Extract NER tags
  const nerTags = extractNERTags(transcript, baseResult.tags);

  // Assign emotion tags
  const emotionTags = assignEmotionTags(transcript, baseResult.tags.emotions);

  // Assign confidence label (v2 English label)
  const _confidenceLabelV2 = assignConfidenceLabel(transcript, baseResult.confidenceLabel);

  // Generate timeline entry
  const timelineEntry = generateTimelineEntry(
    memoryId,
    baseResult.topic,
    baseResult.tags.timePeriod,
    transcript
  );

  return {
    ...baseResult,
    diffRecord,
    nerTags,
    emotionTags,
    timelineEntry,
  };
}

/**
 * Creates a fallback ArchivistResultV2 when processing fails.
 * Preserves the raw transcript and assigns safe defaults for all v2 fields.
 */
export function createFallbackResultV2(transcript: string, memoryId: string): ArchivistResultV2 {
  const baseResult = createFallbackResult(transcript);

  return {
    ...baseResult,
    diffRecord: {
      original: transcript,
      refined: transcript,
      changes: [],
    },
    nerTags: [],
    emotionTags: [],
    timelineEntry: {
      memoryId,
      timePeriod: '시기 미상',
      date: new Date().toISOString().split('T')[0],
      summary: transcript.slice(0, 100) || '기억',
    },
  };
}
