/**
 * Ghostwriter Agent
 *
 * Generates chapter structure and narrative text grounded in source memories.
 * Uses GPT-4o-mini to organize memories into chapters by chronology and theme,
 * then writes flowing narrative with inline citations.
 *
 * v1: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 * v2: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */

import type {
  Memory,
  Chapter,
  ChapterStructure,
  ChapterNarrative,
  Citation,
  Autobiography,
  SpeechProfile,
  ChapterCategory,
  GhostwriterChapter,
  SourceChunkAnnotation,
  AutobiographyStyle,
} from '../types';
import { canAccessV2, getEffectiveConsentSettings } from '../consent/manager';
import { getOpenAIClient } from '../openai-client';

function canUseForPublication(memory: Memory): boolean {
  return canAccessV2(memory, getEffectiveConsentSettings(memory), 'family', '출판');
}

/**
 * Generates a chapter structure from memories, organizing them by chronology and theme.
 *
 * - Filters to non-private memories only
 * - Rejects with informative Korean message if fewer than 5 non-private memories
 * - Uses GPT-4o-mini with JSON response format to organize memories into chapters
 * - Validates that every non-private memory ID appears in at least one chapter
 */
export async function generateChapterStructure(memories: Memory[]): Promise<ChapterStructure> {
  const nonPrivateMemories = memories.filter((m) => m.privacy !== 'private' && canUseForPublication(m));

  if (nonPrivateMemories.length < 5) {
    throw new Error(
      `자서전을 생성하려면 최소 5개의 공개 기억이 필요합니다. 현재 ${nonPrivateMemories.length}개의 기억만 있습니다. 더 많은 인터뷰를 진행해 주세요.`
    );
  }

  const memorySummaries = nonPrivateMemories.map((m) => ({
    id: m.id,
    topic: m.topic,
    timePeriod: m.tags.timePeriod,
    people: m.tags.people,
    places: m.tags.places,
    emotions: m.tags.emotions,
    summary: m.cleanedTranscript.slice(0, 200),
  }));

  const systemPrompt = `당신은 자서전 구조를 설계하는 전문 편집자입니다.
주어진 기억들을 분석하여 자서전의 챕터 구조를 생성해주세요.

규칙:
1. 챕터는 시간순(timePeriod)으로 배열하세요.
2. 같은 시대(timePeriod)에 속하고 주제적으로 관련된 기억들(같은 인물, 장소, 감정 태그를 공유하는)은 같은 챕터에 묶으세요.
3. 모든 기억은 반드시 최소 하나의 챕터에 포함되어야 합니다.
4. 각 챕터에는 의미 있는 제목과 요약을 부여하세요.
5. 챕터 ID는 "chapter-1", "chapter-2" 형식으로 지정하세요.

다음 JSON 형식으로만 응답하세요:
{
  "chapters": [
    {
      "id": "chapter-1",
      "title": "챕터 제목",
      "summary": "이 챕터의 간략한 요약",
      "memoryIds": ["memory-id-1", "memory-id-2"],
      "timePeriod": "해당 시대"
    }
  ]
}`;

  const userPrompt = `다음 기억들을 자서전 챕터 구조로 조직해주세요:\n\n${JSON.stringify(memorySummaries, null, 2)}`;

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
    throw new Error('챕터 구조 생성에 실패했습니다. 다시 시도해 주세요.');
  }

  const parsed = JSON.parse(content);
  const chapters: Chapter[] = validateChapters(parsed.chapters);

  // Validate that every non-private memory appears in at least one chapter
  const allAssignedIds = new Set(chapters.flatMap((ch) => ch.memoryIds));
  const missingMemories = nonPrivateMemories.filter((m) => !allAssignedIds.has(m.id));

  if (missingMemories.length > 0) {
    // Assign missing memories to the most relevant chapter or create a catch-all chapter
    const lastChapter = chapters[chapters.length - 1];
    for (const missing of missingMemories) {
      // Try to find a chapter with matching timePeriod
      const matchingChapter = chapters.find((ch) => ch.timePeriod === missing.tags.timePeriod);
      if (matchingChapter) {
        matchingChapter.memoryIds.push(missing.id);
      } else {
        lastChapter.memoryIds.push(missing.id);
      }
    }
  }

  return { chapters };
}

/**
 * Writes narrative text for a single chapter, grounded in source memories.
 *
 * - Uses GPT-4o-mini to generate narrative text
 * - Includes inline citations referencing memory IDs
 * - Applies speech profile if provided
 * - Instructs LLM to use ONLY facts from source memories (no hallucination)
 */
export async function writeChapterNarrative(
  chapter: Chapter,
  memories: Memory[],
  speechProfile: SpeechProfile | null
): Promise<ChapterNarrative> {
  // Get the memories assigned to this chapter
  const chapterMemories = memories.filter((m) => chapter.memoryIds.includes(m.id));

  const memoriesContext = chapterMemories
    .map(
      (m) =>
        `[기억 ID: ${m.id}]\n주제: ${m.topic}\n시대: ${m.tags.timePeriod}\n원본: ${m.originalTranscript}\n정리본: ${m.cleanedTranscript}`
    )
    .join('\n\n---\n\n');

  let speechProfileInstruction = '';
  if (speechProfile) {
    speechProfileInstruction = `
화법 프로필을 적용하여 서술하세요:
- 문장 끝맺음: ${JSON.stringify(speechProfile.sentenceEndings)}
- 어휘 선호: ${JSON.stringify(speechProfile.vocabularyPreferences)}
- 특징적 표현: ${JSON.stringify(speechProfile.characteristicExpressions)}
- 방언: ${speechProfile.dialect ?? '표준어'}
`;
  }

  const systemPrompt = `당신은 어르신의 인생 이야기를 자서전으로 작성하는 전문 작가입니다.

핵심 규칙:
1. 오직 제공된 기억들에 있는 사실만 사용하세요. 새로운 사실, 사건, 인물, 장소를 절대 만들어내지 마세요.
2. 각 문장은 반드시 하나 이상의 출처 기억에 근거해야 합니다.
3. 자연스럽고 따뜻한 서사체로 작성하되, 원본의 진정성을 유지하세요.
4. 문장마다 출처를 표시하세요.
${speechProfileInstruction}

응답 형식 (JSON):
{
  "body": "서사 텍스트. 각 문장 끝에 [출처: memory-id] 형식으로 인용을 표시하세요.",
  "citations": [
    {"sentenceIndex": 0, "memoryId": "해당 기억 ID"},
    {"sentenceIndex": 1, "memoryId": "해당 기억 ID"}
  ]
}

- sentenceIndex는 body 텍스트에서 문장의 순서 (0부터 시작)입니다.
- 모든 문장에 대해 citations 항목이 있어야 합니다.`;

  const userPrompt = `다음 챕터의 서사를 작성해주세요.

챕터 제목: ${chapter.title}
챕터 요약: ${chapter.summary}

출처 기억들:
${memoriesContext}`;

  const response = await getOpenAIClient().chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.5,
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error(`챕터 "${chapter.title}" 서사 생성에 실패했습니다.`);
  }

  const parsed = JSON.parse(content);

  const body: string = typeof parsed.body === 'string' ? parsed.body : '';
  const citations: Citation[] = validateCitations(parsed.citations, chapter.memoryIds);

  return {
    chapterId: chapter.id,
    title: chapter.title,
    body,
    citations,
  };
}

/**
 * Generates a complete autobiography from memories.
 *
 * - Calls generateChapterStructure first
 * - Then calls writeChapterNarrative for each chapter
 * - Combines into a complete Autobiography object with title and generatedAt timestamp
 */
export async function generateFullAutobiography(
  memories: Memory[],
  speechProfile: SpeechProfile | null
): Promise<Autobiography> {
  const structure = await generateChapterStructure(memories);

  const chapterNarratives: ChapterNarrative[] = [];
  for (const chapter of structure.chapters) {
    const narrative = await writeChapterNarrative(chapter, memories, speechProfile);
    chapterNarratives.push(narrative);
  }

  // Generate a title based on the content
  const title = await generateTitle(memories);

  return {
    title,
    chapters: chapterNarratives,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Generates a title for the autobiography using GPT-4o-mini.
 */
async function generateTitle(memories: Memory[]): Promise<string> {
  const topics = memories
    .filter((m) => m.privacy !== 'private' && canUseForPublication(m))
    .map((m) => m.topic)
    .slice(0, 10)
    .join(', ');

  try {
    const response = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            '자서전의 제목을 하나만 생성해주세요. 따뜻하고 서정적인 한국어 제목으로, 10자 이내로 작성하세요. 제목만 반환하세요.',
        },
        {
          role: 'user',
          content: `다음 주제들을 담은 자서전의 제목을 지어주세요: ${topics}`,
        },
      ],
      temperature: 0.7,
    });

    return response.choices[0].message.content?.trim() || '나의 이야기';
  } catch {
    return '나의 이야기';
  }
}

/**
 * Validates and normalizes chapter data from LLM response.
 */
function validateChapters(rawChapters: unknown): Chapter[] {
  if (!Array.isArray(rawChapters)) {
    throw new Error('챕터 구조가 올바르지 않습니다.');
  }

  return rawChapters.map((ch, index) => ({
    id: typeof ch.id === 'string' ? ch.id : `chapter-${index + 1}`,
    title: typeof ch.title === 'string' ? ch.title : `챕터 ${index + 1}`,
    summary: typeof ch.summary === 'string' ? ch.summary : '',
    memoryIds: Array.isArray(ch.memoryIds)
      ? ch.memoryIds.filter((id: unknown): id is string => typeof id === 'string')
      : [],
    timePeriod: typeof ch.timePeriod === 'string' ? ch.timePeriod : '',
  }));
}

/**
 * Validates and normalizes citation data from LLM response.
 * Ensures citations reference valid memory IDs from the chapter.
 */
function validateCitations(rawCitations: unknown, validMemoryIds: string[]): Citation[] {
  if (!Array.isArray(rawCitations)) {
    return [];
  }

  const validIdSet = new Set(validMemoryIds);

  return rawCitations
    .filter(
      (c): c is { sentenceIndex: number; memoryId: string } =>
        typeof c === 'object' &&
        c !== null &&
        typeof c.sentenceIndex === 'number' &&
        typeof c.memoryId === 'string' &&
        validIdSet.has(c.memoryId)
    )
    .map((c) => ({
      sentenceIndex: c.sentenceIndex,
      memoryId: c.memoryId,
    }));
}

// ─── Ghostwriter v2: Chapter Categories, Style Ratio, Source Annotations ─────

/**
 * The 5 fixed chapter categories for the v2 autobiography structure.
 */
export const CHAPTER_CATEGORIES: ChapterCategory[] = [
  '어린시절',
  '가족',
  '직업',
  '전환점',
  '전하고싶은말',
];

export const AUTOBIOGRAPHY_STYLE_LABELS: Record<AutobiographyStyle, string> = {
  memoir: '회고문',
  news: '기사체',
  letter: '편지체',
  interview: '인터뷰체',
  diary: '일기체',
};

export function getStyleInstruction(style: AutobiographyStyle): string {
  const instructions: Record<AutobiographyStyle, string> = {
    memoir: '따뜻한 회고문처럼 자연스럽게 서술하세요.',
    news: '가족 신문 기사처럼 제목, 리드문, 사건 경과, 인용, 의미를 갖춘 기사체로 작성하세요. 예: "30개월 아이 목욕 거부 사건"처럼 작은 가족 사건도 보도 기사처럼 생생하게 다루세요.',
    letter: '가족에게 보내는 편지처럼 다정한 2인칭 문장과 당부를 담아 작성하세요.',
    interview: '질문과 답변이 이어지는 인터뷰 기사 형식으로 작성하세요.',
    diary: '그날의 장면을 일기처럼 날짜감, 감정, 짧은 회상을 담아 작성하세요.',
  };
  return instructions[style];
}

/**
 * Keywords and tag patterns used to categorize memories into chapter categories.
 * Each category has associated keywords that match against memory topics, tags, and transcripts.
 */
const CATEGORY_KEYWORDS: Record<ChapterCategory, { topics: string[]; timePeriods: string[]; emotions: string[] }> = {
  '어린시절': {
    topics: ['어린', '유년', '학교', '초등', '중학', '고등', '어릴', '소년', '소녀', '동네', '놀이', '친구'],
    timePeriods: ['1940', '1950', '1960', '유년', '소년', '학창'],
    emotions: [],
  },
  '가족': {
    topics: ['가족', '부모', '아버지', '어머니', '형제', '자매', '아들', '딸', '손자', '손녀', '결혼', '배우자', '남편', '아내'],
    timePeriods: [],
    emotions: ['감사', '상실'],
  },
  '직업': {
    topics: ['직장', '회사', '일', '직업', '사업', '근무', '퇴직', '동료', '상사', '승진', '월급'],
    timePeriods: [],
    emotions: ['자부심'],
  },
  '전환점': {
    topics: ['전환', '변화', '결정', '이사', '이민', '사고', '병', '위기', '기회', '도전', '극복'],
    timePeriods: [],
    emotions: ['후회', '상실'],
  },
  '전하고싶은말': {
    topics: ['전하', '유언', '당부', '조언', '바람', '소망', '감사', '사랑', '후회', '교훈', '지혜'],
    timePeriods: [],
    emotions: ['감사'],
  },
};

/**
 * Categorizes a set of memories into the 5 chapter categories based on their
 * content, tags, topics, and time periods.
 *
 * Every non-private memory is assigned to at least one category.
 * A memory may appear in multiple categories if it matches multiple patterns.
 *
 * @param memories - All memories to categorize
 * @returns A map from each ChapterCategory to the memory IDs assigned to it
 */
export function categorizeMemories(memories: Memory[]): Record<ChapterCategory, string[]> {
  const nonPrivateMemories = memories.filter((m) => m.privacy !== 'private');

  const result: Record<ChapterCategory, string[]> = {
    '어린시절': [],
    '가족': [],
    '직업': [],
    '전환점': [],
    '전하고싶은말': [],
  };

  for (const memory of nonPrivateMemories) {
    const assignedCategories: ChapterCategory[] = [];

    for (const category of CHAPTER_CATEGORIES) {
      if (matchesCategory(memory, category)) {
        assignedCategories.push(category);
      }
    }

    // If no category matched, assign to the most likely based on simple heuristics
    if (assignedCategories.length === 0) {
      const fallbackCategory = inferFallbackCategory(memory);
      assignedCategories.push(fallbackCategory);
    }

    for (const category of assignedCategories) {
      result[category].push(memory.id);
    }
  }

  return result;
}

/**
 * Checks if a memory matches a given chapter category based on keywords.
 */
function matchesCategory(memory: Memory, category: ChapterCategory): boolean {
  const keywords = CATEGORY_KEYWORDS[category];
  const searchText = `${memory.topic} ${memory.cleanedTranscript} ${memory.originalTranscript}`.toLowerCase();
  const timePeriod = memory.tags.timePeriod.toLowerCase();
  const emotions = memory.tags.emotions;

  // Check topic/content keywords
  const topicMatch = keywords.topics.some((kw) => searchText.includes(kw));
  if (topicMatch) return true;

  // Check time period keywords
  const timeMatch = keywords.timePeriods.some((kw) => timePeriod.includes(kw));
  if (timeMatch) return true;

  // Check emotion keywords
  const emotionMatch = keywords.emotions.some((kw) => emotions.includes(kw));
  if (emotionMatch) return true;

  return false;
}

/**
 * Infers a fallback category for a memory that didn't match any keyword patterns.
 * Uses time period as the primary heuristic.
 */
function inferFallbackCategory(memory: Memory): ChapterCategory {
  const timePeriod = memory.tags.timePeriod.toLowerCase();

  // Early time periods → 어린시절
  if (timePeriod.includes('194') || timePeriod.includes('195') || timePeriod.includes('196')) {
    return '어린시절';
  }

  // People-heavy memories → 가족
  if (memory.tags.people.length >= 2) {
    return '가족';
  }

  // Default to 전하고싶은말 as a catch-all
  return '전하고싶은말';
}

/**
 * Generates a single GhostwriterChapter (v2) for a given category and its assigned memories.
 *
 * Features:
 * - Emotional exaggeration suppression (grounded rewriting)
 * - 60% conversational / 40% literary style ratio enforcement
 * - Source chunk annotations referencing originating Memory_Chunk IDs
 * - Speech profile application if provided
 *
 * @param category - The chapter category
 * @param memoryIds - IDs of memories assigned to this category
 * @param memories - All available memories (for lookup)
 * @param speechProfile - Optional speech profile for tone matching
 * @returns A GhostwriterChapter with narrative, source annotations, and style ratio
 */
export async function generateChapterV2(
  category: ChapterCategory,
  memoryIds: string[],
  memories: Memory[],
  speechProfile: SpeechProfile | null,
  style: AutobiographyStyle = 'memoir'
): Promise<GhostwriterChapter> {
  const chapterMemories = memories.filter((m) => memoryIds.includes(m.id));

  if (chapterMemories.length === 0) {
    return {
      id: `chapter-v2-${category}`,
      category,
      title: getCategoryTitle(category),
      narrative: '',
      sourceChunks: [],
      styleRatio: { conversational: 0.6, literary: 0.4 },
    };
  }

  const memoriesContext = chapterMemories
    .map(
      (m, idx) =>
        `[기억 ${idx + 1}, ID: ${m.id}]\n주제: ${m.topic}\n시대: ${m.tags.timePeriod}\n원본: ${m.originalTranscript}\n정리본: ${m.cleanedTranscript}`
    )
    .join('\n\n---\n\n');

  let speechProfileInstruction = '';
  if (speechProfile) {
    speechProfileInstruction = `
화법 프로필을 적용하여 서술하세요:
- 문장 끝맺음: ${JSON.stringify(speechProfile.sentenceEndings)}
- 어휘 선호: ${JSON.stringify(speechProfile.vocabularyPreferences)}
- 특징적 표현: ${JSON.stringify(speechProfile.characteristicExpressions)}
- 방언: ${speechProfile.dialect ?? '표준어'}
`;
  }

  const systemPrompt = `당신은 어르신의 인생 이야기를 자서전으로 작성하는 전문 작가입니다.

이 챕터의 카테고리: "${category}"
선택한 문체: "${AUTOBIOGRAPHY_STYLE_LABELS[style]}"

핵심 규칙:
1. 오직 제공된 기억들에 있는 사실만 사용하세요. 새로운 사실, 사건, 인물, 장소를 절대 만들어내지 마세요.
2. 감정 과장을 억제하세요. 원본에 없는 감정적 표현을 추가하지 마세요. 사실에 근거한 담담한 서술을 유지하세요.
3. 문체 비율을 지켜주세요: 약 60%는 구어체(대화하듯 자연스러운 말투), 40%는 문어체(서사적이고 정돈된 문장).
4. 각 문장이 어떤 기억에서 왔는지 출처를 표시하세요.
5. 문체 지침을 반드시 따르세요: ${getStyleInstruction(style)}
${speechProfileInstruction}

감정 과장 억제 지침:
- "너무나 슬펐다", "가슴이 찢어지는 듯했다" 같은 과장된 표현 금지
- 원본 기억에 있는 감정 표현만 그대로 사용
- 사실 위주의 담담한 서술 유지

응답 형식 (JSON):
{
  "title": "이 챕터의 제목 (카테고리에 맞는 의미 있는 제목)",
  "narrative": "서사 텍스트. 문장들을 자연스럽게 이어서 작성하세요.",
  "sourceChunks": [
    {"sentenceRange": [0, 2], "memoryId": "해당 기억 ID"},
    {"sentenceRange": [3, 4], "memoryId": "해당 기억 ID"}
  ]
}

- sentenceRange는 [시작 문장 인덱스, 끝 문장 인덱스] (0부터 시작, 끝 포함)
- 모든 문장은 반드시 하나 이상의 sourceChunks에 포함되어야 합니다.
- memoryId는 반드시 제공된 기억의 ID 중 하나여야 합니다.`;

  const userPrompt = `다음 기억들을 바탕으로 "${category}" 챕터의 서사를 작성해주세요.

출처 기억들:
${memoriesContext}`;

  const response = await getOpenAIClient().chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.4,
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error(`챕터 "${category}" 서사 생성에 실패했습니다.`);
  }

  const parsed = JSON.parse(content);

  const title = typeof parsed.title === 'string' ? parsed.title : getCategoryTitle(category);
  const narrative = typeof parsed.narrative === 'string' ? parsed.narrative : '';
  const sourceChunks = validateSourceChunks(parsed.sourceChunks, memoryIds);

  return {
    id: `chapter-v2-${category}`,
    category,
    title,
    narrative,
    sourceChunks,
    styleRatio: { conversational: 0.6, literary: 0.4 },
  };
}

/**
 * Generates all 5 chapters (v2) from a set of memories.
 *
 * Process:
 * 1. Filters to non-private memories
 * 2. Categorizes memories into the 5 chapter categories
 * 3. Generates a GhostwriterChapter for each category that has assigned memories
 * 4. Ensures every non-private memory is assigned to at least one chapter
 *
 * @param memories - All memories to process
 * @param speechProfile - Optional speech profile for tone matching
 * @returns Array of GhostwriterChapter objects (one per category with content)
 */
export async function generateAllChaptersV2(
  memories: Memory[],
  speechProfile: SpeechProfile | null,
  style: AutobiographyStyle = 'memoir'
): Promise<GhostwriterChapter[]> {
  const nonPrivateMemories = memories.filter((m) => m.privacy !== 'private' && canUseForPublication(m));

  if (nonPrivateMemories.length === 0) {
    throw new Error('자서전을 생성하려면 최소 1개의 공개 기억이 필요합니다.');
  }

  const categorized = categorizeMemories(nonPrivateMemories);

  // Ensure every non-private memory is assigned to at least one category
  const allAssignedIds = new Set(
    Object.values(categorized).flat()
  );
  const unassigned = nonPrivateMemories.filter((m) => !allAssignedIds.has(m.id));
  for (const memory of unassigned) {
    categorized['전하고싶은말'].push(memory.id);
  }

  const chapters: GhostwriterChapter[] = [];

  for (const category of CHAPTER_CATEGORIES) {
    const memoryIds = categorized[category];
    if (memoryIds.length === 0) continue;

    const chapter = await generateChapterV2(category, memoryIds, memories, speechProfile, style);
    chapters.push(chapter);
  }

  return chapters;
}

/**
 * Converts GhostwriterChapter[] to a PDF-ready Autobiography structure.
 * This bridges the v2 chapter format to the existing PDF generator.
 *
 * @param chapters - Array of v2 GhostwriterChapters
 * @param title - Optional autobiography title (defaults to '나의 이야기')
 * @returns An Autobiography object compatible with the PDF generator
 */
export function toPDFReadyAutobiography(
  chapters: GhostwriterChapter[],
  title: string = '나의 이야기',
  style: AutobiographyStyle = 'memoir'
): Autobiography {
  const chapterNarratives: ChapterNarrative[] = chapters.map((ch) => ({
    chapterId: ch.id,
    title: style === 'news' ? `${ch.title} - 가족 뉴스` : ch.title,
    body: ch.narrative,
    citations: ch.sourceChunks.map((sc) => ({
      sentenceIndex: sc.sentenceRange[0],
      memoryId: sc.memoryId,
    })),
  }));

  return {
    title,
    chapters: chapterNarratives,
    generatedAt: new Date().toISOString(),
  };
}

// ─── v2 Helper Functions ─────────────────────────────────────────────────────

/**
 * Returns a default title for a chapter category.
 */
function getCategoryTitle(category: ChapterCategory): string {
  const titles: Record<ChapterCategory, string> = {
    '어린시절': '어린 시절의 기억',
    '가족': '가족과 함께한 시간',
    '직업': '일과 삶의 여정',
    '전환점': '인생의 전환점',
    '전하고싶은말': '전하고 싶은 말',
  };
  return titles[category];
}

/**
 * Validates and normalizes source chunk annotations from LLM response.
 * Ensures all referenced memory IDs are valid.
 */
function validateSourceChunks(
  rawChunks: unknown,
  validMemoryIds: string[]
): SourceChunkAnnotation[] {
  if (!Array.isArray(rawChunks)) {
    // If no valid chunks from LLM, create a default annotation covering all sentences
    // referencing the first valid memory
    if (validMemoryIds.length > 0) {
      return [{ sentenceRange: [0, 0], memoryId: validMemoryIds[0] }];
    }
    return [];
  }

  const validIdSet = new Set(validMemoryIds);

  const validated = rawChunks
    .filter(
      (chunk): chunk is { sentenceRange: [number, number]; memoryId: string } =>
        typeof chunk === 'object' &&
        chunk !== null &&
        Array.isArray(chunk.sentenceRange) &&
        chunk.sentenceRange.length === 2 &&
        typeof chunk.sentenceRange[0] === 'number' &&
        typeof chunk.sentenceRange[1] === 'number' &&
        chunk.sentenceRange[0] >= 0 &&
        chunk.sentenceRange[1] >= chunk.sentenceRange[0] &&
        typeof chunk.memoryId === 'string' &&
        validIdSet.has(chunk.memoryId)
    )
    .map((chunk) => ({
      sentenceRange: [chunk.sentenceRange[0], chunk.sentenceRange[1]] as [number, number],
      memoryId: chunk.memoryId,
    }));

  // If validation removed all chunks, create a fallback
  if (validated.length === 0 && validMemoryIds.length > 0) {
    return [{ sentenceRange: [0, 0], memoryId: validMemoryIds[0] }];
  }

  return validated;
}
