/**
 * Verification Module
 *
 * Detects contradictions between memories using RAG similarity search + LLM analysis.
 * Assigns confidence labels based on contradiction severity.
 * Classifies conflict types and outputs structured VerificationJSON.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 *
 * Flag-only policy: This module NEVER deletes or modifies existing memories.
 * It only attaches flags (contradiction reports) to new memories.
 */

import type {
  Memory,
  ContradictionReport,
  ConfidenceLabel,
  ConflictType,
  ConflictDetail,
  VerificationJSON,
} from '../types';
import type { RAGIndex } from '../rag/index';
import { getOpenAIClient } from '../openai-client';

export interface VerificationResult {
  contradictions: ContradictionReport[];
  confidenceLabel: ConfidenceLabel;
}

export interface VerificationResultV2 extends VerificationResult {
  verificationJSON: VerificationJSON;
}

// ─── Confidence Label Mapping (v1 Korean → v2 English) ───────────────────────

/**
 * Maps the v2 English confidence labels to the existing v1 Korean labels.
 */
export function mapConfidenceLabelToV2(label: ConfidenceLabel): 'CONFIRMED' | 'ESTIMATED' | 'UNVERIFIED' {
  switch (label) {
    case '확인됨':
      return 'CONFIRMED';
    case '추정':
      return 'ESTIMATED';
    case '추가 확인 필요':
      return 'UNVERIFIED';
    default:
      return 'UNVERIFIED';
  }
}

// ─── Conflict Type Classification ────────────────────────────────────────────

/**
 * Keywords and patterns used to classify conflict types.
 * These are used by the pure classifyConflictType function.
 */
const TIME_KEYWORDS = [
  '년', '월', '일', '시간', '날짜', '시기', '때', '연도',
  'date', 'time', 'year', 'month', 'period', 'era',
  '1950', '1960', '1970', '1980', '1990', '2000',
  '봄', '여름', '가을', '겨울', '아침', '저녁',
];

const PERSON_KEYWORDS = [
  '사람', '인물', '이름', '누구', '아버지', '어머니', '형', '동생',
  '친구', '선생', '사장', '부인', '남편', '아들', '딸',
  'person', 'people', 'name', 'who',
];

const DUPLICATE_KEYWORDS = [
  '동일', '같은', '중복', '반복', '유사', '비슷',
  'duplicate', 'same', 'identical', 'similar', 'repeated',
];

/**
 * Classifies a contradiction into a ConflictType based on conflicting fields and explanation.
 *
 * Classification rules (in priority order):
 * 1. DUPLICATE: If explanation or fields suggest the same event described twice
 * 2. TIME: If conflicting fields or explanation reference temporal information
 * 3. PERSON: If conflicting fields or explanation reference people/names
 * 4. FACT: Default fallback for general factual contradictions
 *
 * This is a pure function that can be tested without OpenAI.
 *
 * @param conflictingFields - Array of field names that conflict
 * @param explanation - Natural language explanation of the contradiction
 * @returns The classified ConflictType
 */
export function classifyConflictType(
  conflictingFields: string[],
  explanation: string
): ConflictType {
  const fieldsLower = conflictingFields.map((f) => f.toLowerCase());
  const explanationLower = explanation.toLowerCase();
  const combined = [...fieldsLower, explanationLower].join(' ');

  // Check for DUPLICATE first (highest specificity)
  if (DUPLICATE_KEYWORDS.some((kw) => combined.includes(kw))) {
    return 'DUPLICATE';
  }

  // Check for TIME conflicts
  if (TIME_KEYWORDS.some((kw) => combined.includes(kw))) {
    return 'TIME';
  }

  // Check for PERSON conflicts
  if (PERSON_KEYWORDS.some((kw) => combined.includes(kw))) {
    return 'PERSON';
  }

  // Default to FACT for general factual contradictions
  return 'FACT';
}

// ─── Uncertainty Detection ───────────────────────────────────────────────────

/**
 * Keywords that indicate uncertainty in a memory's content.
 * When detected, the ESTIMATED label should be applied.
 */
const UNCERTAINTY_KEYWORDS = [
  '아마', '것 같', '인 것 같', '였던 것 같', '글쎄', '확실하지',
  '기억이 잘', '정확히는', '대략', '쯤', '정도', '아닌가',
  '모르겠', '잘 모르', '가물가물', '흐릿', '어렴풋',
  'maybe', 'perhaps', 'probably', 'not sure', 'approximately',
  'around', 'roughly', 'I think', 'might have',
];

/**
 * Detects uncertainty in a memory's text content.
 * Returns true if uncertainty keywords are found, indicating the ESTIMATED label should be applied.
 *
 * This is a pure function that can be tested without OpenAI.
 *
 * @param text - The memory text to analyze for uncertainty
 * @returns true if uncertainty is detected
 */
export function detectUncertainty(text: string): boolean {
  const textLower = text.toLowerCase();
  return UNCERTAINTY_KEYWORDS.some((kw) => textLower.includes(kw));
}

// ─── Verification JSON Generation ────────────────────────────────────────────

/**
 * Generates a VerificationJSON output from contradiction reports and memory context.
 *
 * This is a pure function that assembles the structured output without any side effects.
 * It enforces the flag-only policy by only producing FLAG/PASS status without
 * any deletion or modification operations.
 *
 * Rules:
 * - status is 'FLAG' if there are any conflicts, 'PASS' otherwise
 * - confidenceLabel is determined by contradiction severity and uncertainty detection
 * - If uncertainty is detected in the memory text, label is at least ESTIMATED
 * - conflicts array contains classified ConflictDetail entries
 *
 * @param memoryId - The ID of the memory being verified
 * @param contradictions - Array of detected contradiction reports
 * @param memoryText - The memory's cleaned transcript (for uncertainty detection)
 * @param indexSize - The size of the RAG index
 * @returns A complete VerificationJSON object
 */
export function generateVerificationJSON(
  memoryId: string,
  contradictions: ContradictionReport[],
  memoryText: string,
  indexSize: number
): VerificationJSON {
  // Classify each contradiction into a ConflictDetail
  const conflicts: ConflictDetail[] = contradictions.map((c) => ({
    type: classifyConflictType(c.conflictingFields, c.explanation),
    relatedMemoryIds: [c.memoryIdB],
    explanation: c.explanation,
    severity: c.severity,
  }));

  // Determine confidence label
  const v1Label = assignConfidenceLabel(contradictions, indexSize);
  let v2Label = mapConfidenceLabelToV2(v1Label);

  // Apply automatic ESTIMATED label when uncertainty is detected (Requirement 3.5)
  // Only upgrade from CONFIRMED to ESTIMATED; don't downgrade UNVERIFIED
  if (v2Label === 'CONFIRMED' && detectUncertainty(memoryText)) {
    v2Label = 'ESTIMATED';
  }

  // Determine status: FLAG if any conflicts exist, PASS otherwise
  const status: 'PASS' | 'FLAG' = conflicts.length > 0 ? 'FLAG' : 'PASS';

  return {
    memoryId,
    status,
    conflicts,
    confidenceLabel: v2Label,
  };
}

// ─── Existing v1 Functions (preserved) ───────────────────────────────────────

/**
 * Assigns a confidence label based on contradiction reports and index size.
 *
 * Rules:
 * - If indexSize < 2, always return "확인됨" (skip contradiction detection)
 * - If contradictions array is empty → "확인됨"
 * - If all contradictions have severity 'soft' → "추정"
 * - If any contradiction has severity 'hard' → "추가 확인 필요"
 */
export function assignConfidenceLabel(
  contradictions: ContradictionReport[],
  indexSize?: number
): ConfidenceLabel {
  // If RAG index has fewer than 2 entries, skip contradiction detection
  if (indexSize !== undefined && indexSize < 2) {
    return '확인됨';
  }

  // No contradictions found
  if (contradictions.length === 0) {
    return '확인됨';
  }

  // Any hard contradiction → "추가 확인 필요"
  const hasHard = contradictions.some((c) => c.severity === 'hard');
  if (hasHard) {
    return '추가 확인 필요';
  }

  // All contradictions are soft → "추정"
  return '추정';
}

// ─── Main Verification Function (v2 enhanced) ────────────────────────────────

/**
 * Checks for contradictions between a new memory and existing memories in the RAG index.
 * Enhanced with v2 conflict type classification and VerificationJSON output.
 *
 * Flag-only policy (Requirements 3.3, 3.4):
 * - This function NEVER deletes or modifies existing memories
 * - It only reads existing memories for comparison and produces flags
 *
 * Process:
 * 1. Query RAG index for top-5 similar memories using cleanedTranscript
 * 2. If RAG index has fewer than 2 entries, skip detection and return PASS
 * 3. For each similar memory, use GPT-4o-mini to identify contradictions
 * 4. Classify each contradiction into a ConflictType
 * 5. Detect uncertainty in the memory text for ESTIMATED label
 * 6. Return VerificationResultV2 with VerificationJSON output
 */
export async function checkContradictions(
  newMemory: Memory,
  ragIndex: RAGIndex
): Promise<VerificationResultV2> {
  const indexSize = ragIndex.getIndexSize();

  // If fewer than 2 entries in RAG index, skip contradiction detection
  if (indexSize < 2) {
    const confidenceLabel = assignConfidenceLabel([], indexSize);
    return {
      contradictions: [],
      confidenceLabel,
      verificationJSON: generateVerificationJSON(
        newMemory.id,
        [],
        newMemory.cleanedTranscript,
        indexSize
      ),
    };
  }

  // Query RAG for top-5 similar memories
  const similarMemories = await ragIndex.search(newMemory.cleanedTranscript, 5);

  // Filter out the new memory itself from results
  const candidates = similarMemories.filter(
    (result) => result.memoryId !== newMemory.id
  );

  if (candidates.length === 0) {
    const confidenceLabel = assignConfidenceLabel([], indexSize);
    return {
      contradictions: [],
      confidenceLabel,
      verificationJSON: generateVerificationJSON(
        newMemory.id,
        [],
        newMemory.cleanedTranscript,
        indexSize
      ),
    };
  }

  const contradictions: ContradictionReport[] = [];

  const systemPrompt = `당신은 기억 검증 전문가입니다. 두 기억 사이의 모순을 분석합니다.
두 기억을 비교하여 사실적 모순(날짜, 장소, 인물, 사건의 충돌)을 찾아주세요.

응답은 반드시 다음 JSON 형식으로만 반환하세요:
{
  "contradictions": [
    {
      "conflictingFields": ["충돌하는 필드명1", "충돌하는 필드명2"],
      "severity": "soft" 또는 "hard",
      "explanation": "한국어로 된 모순 설명"
    }
  ]
}

severity 기준:
- "soft": 모호한 날짜, 대략적인 장소 차이, 기억의 세부사항 불일치 등 경미한 모순
- "hard": 직접적으로 충돌하는 사실 (같은 사건에 대해 완전히 다른 진술)

모순이 없으면 빈 배열을 반환하세요: {"contradictions": []}`;

  // Compare new memory against each similar memory
  // NOTE: Flag-only policy - we only READ existing memories, never modify them
  for (const candidate of candidates) {
    const userPrompt = `기억 A (새로운 기억):
${newMemory.cleanedTranscript}

기억 B (기존 기억, ID: ${candidate.memoryId}):
${candidate.text}

위 두 기억 사이의 모순을 분석해주세요.`;

    try {
      const response = await getOpenAIClient().chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
      });

      const content = response.choices[0].message.content;
      if (!content) continue;

      const parsed = JSON.parse(content);

      if (parsed.contradictions && Array.isArray(parsed.contradictions)) {
        for (const c of parsed.contradictions) {
          contradictions.push({
            memoryIdA: newMemory.id,
            memoryIdB: candidate.memoryId,
            conflictingFields: c.conflictingFields || [],
            severity: c.severity === 'hard' ? 'hard' : 'soft',
            explanation: c.explanation || '',
          });
        }
      }
    } catch (error) {
      // On LLM error for a single comparison, skip and continue
      console.error(
        `Verification: Error comparing memory ${newMemory.id} with ${candidate.memoryId}:`,
        error
      );
      continue;
    }
  }

  const confidenceLabel = assignConfidenceLabel(contradictions, indexSize);

  // Generate the v2 VerificationJSON output
  const verificationJSON = generateVerificationJSON(
    newMemory.id,
    contradictions,
    newMemory.cleanedTranscript,
    indexSize
  );

  return {
    contradictions,
    confidenceLabel,
    verificationJSON,
  };
}
