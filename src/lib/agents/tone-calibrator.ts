/**
 * Tone Calibrator Agent
 *
 * Learns and applies the senior user's speech patterns to AI-generated text.
 * Uses GPT-4o-mini to analyze transcripts and rewrite text matching the user's voice.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */

import type { SpeechProfile, ProfileStatus } from '../types';
import { useStore } from '../../store';
import { getOpenAIClient } from '../openai-client';

/**
 * Analyzes speech patterns from interview transcripts using GPT-4o-mini.
 * Extracts sentence endings, vocabulary preferences, filler words,
 * characteristic expressions, and dialect.
 */
export async function analyzeSpeechPatterns(transcripts: string[]): Promise<SpeechProfile> {
  const systemPrompt = `당신은 한국어 화법 분석 전문가입니다.
주어진 인터뷰 녹취록들을 분석하여 화자의 고유한 말투 패턴을 추출해주세요.

다음 JSON 형식으로만 응답하세요:
{
  "sentenceEndings": ["문장 끝맺음 패턴들 (예: ~했지, ~란다, ~거든)"],
  "vocabularyPreferences": {"표준어": "화자가 선호하는 표현"},
  "fillerWords": ["습관적으로 사용하는 군말들 (예: 그래가지고, 인자, 뭐시기)"],
  "characteristicExpressions": ["화자만의 특징적인 표현이나 관용구"],
  "dialect": "감지된 방언 (경상도, 전라도, 충청도, 강원도, 제주도 등) 또는 null"
}

분석 지침:
- 반복적으로 나타나는 패턴에 집중하세요.
- 문장 끝맺음은 화자가 자주 사용하는 종결어미를 추출하세요.
- 어휘 선호는 표준어 대신 화자가 선호하는 단어/표현 매핑입니다.
- 군말은 의미 없이 습관적으로 사용하는 말입니다.
- 특징적 표현은 화자만의 독특한 비유, 감탄사, 관용구입니다.
- 방언이 명확하지 않으면 null로 설정하세요.`;

  const userPrompt = `다음 인터뷰 녹취록들에서 화자의 말투 패턴을 분석해주세요:\n\n${transcripts.map((t, i) => `[녹취록 ${i + 1}]\n${t}`).join('\n\n')}`;

  try {
    const response = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      return getDefaultProfile(transcripts.length);
    }

    const parsed = JSON.parse(content);

    return {
      sentenceEndings: validateStringArray(parsed.sentenceEndings),
      vocabularyPreferences: validateVocabularyMap(parsed.vocabularyPreferences),
      fillerWords: validateStringArray(parsed.fillerWords),
      characteristicExpressions: validateStringArray(parsed.characteristicExpressions),
      dialect: typeof parsed.dialect === 'string' ? parsed.dialect : null,
      sessionCount: transcripts.length,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Tone Calibrator: Error analyzing speech patterns:', error);
    return getDefaultProfile(transcripts.length);
  }
}

/**
 * Incrementally updates an existing speech profile with patterns from a new transcript.
 * NEVER discards existing patterns — new patterns are merged (union of arrays, merge of maps).
 */
export async function updateProfile(
  existingProfile: SpeechProfile,
  newTranscript: string
): Promise<SpeechProfile> {
  const systemPrompt = `당신은 한국어 화법 분석 전문가입니다.
새로운 인터뷰 녹취록에서 추가적인 말투 패턴을 추출해주세요.
기존에 이미 발견된 패턴과 중복되지 않는 새로운 패턴만 추출하세요.

기존 프로필:
- 문장 끝맺음: ${JSON.stringify(existingProfile.sentenceEndings)}
- 어휘 선호: ${JSON.stringify(existingProfile.vocabularyPreferences)}
- 군말: ${JSON.stringify(existingProfile.fillerWords)}
- 특징적 표현: ${JSON.stringify(existingProfile.characteristicExpressions)}
- 방언: ${existingProfile.dialect ?? '미감지'}

다음 JSON 형식으로 새로 발견된 패턴만 응답하세요:
{
  "sentenceEndings": ["새로 발견된 문장 끝맺음만"],
  "vocabularyPreferences": {"새로 발견된 표준어": "선호 표현"},
  "fillerWords": ["새로 발견된 군말만"],
  "characteristicExpressions": ["새로 발견된 특징적 표현만"],
  "dialect": "새로 감지된 방언 또는 null (기존과 동일하면 null)"
}`;

  const userPrompt = `다음 새 녹취록에서 추가 말투 패턴을 추출해주세요:\n\n${newTranscript}`;

  try {
    const response = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      // On failure, return existing profile with incremented session count
      return {
        ...existingProfile,
        sessionCount: existingProfile.sessionCount + 1,
        lastUpdated: new Date().toISOString(),
      };
    }

    const parsed = JSON.parse(content);

    const newSentenceEndings = validateStringArray(parsed.sentenceEndings);
    const newVocabularyPreferences = validateVocabularyMap(parsed.vocabularyPreferences);
    const newFillerWords = validateStringArray(parsed.fillerWords);
    const newCharacteristicExpressions = validateStringArray(parsed.characteristicExpressions);
    const newDialect = typeof parsed.dialect === 'string' ? parsed.dialect : null;

    // Merge: union of arrays (deduplicated), merge of vocabulary maps
    return {
      sentenceEndings: mergeArrays(existingProfile.sentenceEndings, newSentenceEndings),
      vocabularyPreferences: {
        ...existingProfile.vocabularyPreferences,
        ...newVocabularyPreferences,
      },
      fillerWords: mergeArrays(existingProfile.fillerWords, newFillerWords),
      characteristicExpressions: mergeArrays(
        existingProfile.characteristicExpressions,
        newCharacteristicExpressions
      ),
      dialect: newDialect ?? existingProfile.dialect,
      sessionCount: existingProfile.sessionCount + 1,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Tone Calibrator: Error updating profile:', error);
    // On error, preserve existing profile with incremented session count
    return {
      ...existingProfile,
      sessionCount: existingProfile.sessionCount + 1,
      lastUpdated: new Date().toISOString(),
    };
  }
}

/**
 * Rewrites text to match the speech profile using GPT-4o-mini.
 * Applies sentence endings, vocabulary preferences, filler words,
 * characteristic expressions, and dialect to the input text.
 */
export async function applyProfile(text: string, profile: SpeechProfile): Promise<string> {
  const systemPrompt = `당신은 텍스트를 특정 화자의 말투로 변환하는 전문가입니다.
주어진 텍스트를 아래 화법 프로필에 맞게 자연스럽게 다시 작성해주세요.

화법 프로필:
- 문장 끝맺음: ${JSON.stringify(profile.sentenceEndings)}
- 어휘 선호: ${JSON.stringify(profile.vocabularyPreferences)}
- 군말: ${JSON.stringify(profile.fillerWords)}
- 특징적 표현: ${JSON.stringify(profile.characteristicExpressions)}
- 방언: ${profile.dialect ?? '표준어'}

변환 지침:
- 문장 끝맺음을 프로필의 종결어미 스타일로 변경하세요.
- 표준어를 화자가 선호하는 어휘로 대체하세요.
- 적절한 위치에 군말을 자연스럽게 삽입하세요 (과도하지 않게).
- 화자의 특징적 표현을 적절히 활용하세요.
- 방언이 있다면 해당 방언의 어투를 반영하세요.
- 원문의 의미와 사실 내용은 절대 변경하지 마세요.
- 변환된 텍스트만 반환하세요 (설명 없이).`;

  try {
    const response = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      temperature: 0.6,
    });

    return response.choices[0].message.content || text;
  } catch (error) {
    console.error('Tone Calibrator: Error applying profile:', error);
    // On failure, return original text unchanged
    return text;
  }
}

/**
 * Returns the current profile status based on session count from the Zustand store.
 * Returns 'insufficient_data' if sessionCount < 3, otherwise 'active'.
 */
export function getProfileStatus(): ProfileStatus {
  const { speechProfile } = useStore.getState();
  if (speechProfile.sessionCount < 3) {
    return 'insufficient_data';
  }
  return 'active';
}

// ─── Pure Speech Profile Update (Monotonic Growth) ───────────────────────────

/**
 * Extracted new patterns from a transcript for merging into an existing profile.
 * Used as input to the pure `updateSpeechProfile` function.
 */
export interface ExtractedPatterns {
  sentenceEndings: string[];
  vocabularyPreferences: Record<string, string>;
  fillerWords: string[];
  characteristicExpressions: string[];
  dialect: string | null;
}

/**
 * Pure function that updates a SpeechProfile with newly extracted patterns,
 * maintaining the monotonic growth property (superset on updates):
 *
 * - sentenceEndings: only grows (union of existing + new, deduplicated)
 * - fillerWords: only grows (union of existing + new, deduplicated)
 * - characteristicExpressions: only grows (union of existing + new, deduplicated)
 * - vocabularyPreferences: only adds new keys (never removes existing ones)
 * - sessionCount: increments by exactly 1
 * - dialect: updated only if new dialect is non-null (existing preserved otherwise)
 *
 * This function is applicable to all text generation agents (Ghostwriter, Digital Twin,
 * Interviewer) since the output SpeechProfile is the shared format consumed by all agents.
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4
 */
export function updateSpeechProfile(
  existingProfile: SpeechProfile,
  newPatterns: ExtractedPatterns
): SpeechProfile {
  return {
    sentenceEndings: mergeArrays(existingProfile.sentenceEndings, newPatterns.sentenceEndings),
    vocabularyPreferences: {
      ...existingProfile.vocabularyPreferences,
      ...newPatterns.vocabularyPreferences,
    },
    fillerWords: mergeArrays(existingProfile.fillerWords, newPatterns.fillerWords),
    characteristicExpressions: mergeArrays(
      existingProfile.characteristicExpressions,
      newPatterns.characteristicExpressions
    ),
    dialect: newPatterns.dialect ?? existingProfile.dialect,
    sessionCount: existingProfile.sessionCount + 1,
    lastUpdated: new Date().toISOString(),
  };
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Validates that a value is an array of strings.
 * Returns empty array if invalid.
 */
function validateStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

/**
 * Validates that a value is a Record<string, string>.
 * Returns empty object if invalid.
 */
function validateVocabularyMap(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(value)) {
    if (typeof key === 'string' && typeof val === 'string') {
      result[key] = val;
    }
  }
  return result;
}

/**
 * Merges two string arrays, removing duplicates.
 * Preserves all items from the existing array and adds new unique items.
 */
function mergeArrays(existing: string[], additions: string[]): string[] {
  const set = new Set(existing);
  for (const item of additions) {
    set.add(item);
  }
  return Array.from(set);
}

/**
 * Returns a default empty speech profile when analysis fails.
 */
function getDefaultProfile(sessionCount: number): SpeechProfile {
  return {
    sentenceEndings: [],
    vocabularyPreferences: {},
    fillerWords: [],
    characteristicExpressions: [],
    dialect: null,
    sessionCount,
    lastUpdated: new Date().toISOString(),
  };
}
