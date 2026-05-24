/**
 * Persona Agent (Digital Twin) v3
 *
 * Generates responses as the senior user's digital persona, using RAG-retrieved
 * memories for context and applying the tone calibrator speech profile.
 *
 * v3 enhancements:
 * - Hybrid RAG context: Vector similarity + Knowledge Graph 1-hop relationships
 * - Question classification (사실확인형, 시기회상형, 가치관탐색형, 인물관련형)
 * - Memory search with time/person/emotion filters (intersection semantics)
 * - Evidence badges (근거 배지) with every response
 * - No response without supporting Memory_Chunk (chunk-없는-창작-금지)
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import type {
  ChatMessage,
  Memory,
  QuestionCategory,
  EvidenceBadge,
  DigitalTwinResponse,
  SearchResult,
} from '../types';
import { ragIndex } from '../rag/index';
import { KnowledgeGraph, buildHybridContext } from '../rag/graph-rag';
import { applyProfile, getProfileStatus } from './tone-calibrator';
import { useStore } from '../../store';
import { canAccessV2, getEffectiveConsentSettings } from '../consent/manager';
import { getOpenAIClient } from '../openai-client';
import { createDemoPersonaResponse } from '../demo/capstone-demo-data';

// ─── Question Classification Keywords ────────────────────────────────────────

const FACT_CHECK_KEYWORDS = [
  '사실', '정말', '맞', '진짜', '실제', '확인', '있었', '했었',
  '언제', '어디서', '누가', '무엇', '몇', '얼마',
];

const PERIOD_RECALL_KEYWORDS = [
  '시절', '때', '시기', '년대', '어렸', '젊었', '옛날', '과거',
  '그때', '당시', '무렵', '시대', '초등', '중학', '고등', '대학',
  '어린', '학창', '군대',
];

const VALUES_KEYWORDS = [
  '가치', '중요', '의미', '생각', '느낌', '왜', '어떻게 생각',
  '철학', '신념', '원칙', '교훈', '배운', '깨달', '후회',
  '감사', '행복', '소중',
];

const PERSON_KEYWORDS = [
  '아버지', '어머니', '할머니', '할아버지', '형', '누나', '동생',
  '아내', '남편', '아들', '딸', '친구', '선생님', '누구', '분',
  '사람', '이모', '삼촌', '고모', '사촌',
];

// ─── Pure, Testable Functions ────────────────────────────────────────────────

/**
 * Classifies a question into one of 4 categories based on keyword analysis.
 *
 * Categories:
 * - 사실확인형 (fact-checking): Questions about verifiable facts
 * - 시기회상형 (period-recall): Questions about specific time periods
 * - 가치관탐색형 (values-exploration): Questions about values, beliefs, lessons
 * - 인물관련형 (person-related): Questions about specific people
 *
 * Classification uses keyword matching with priority:
 * person > period > values > fact (default)
 */
export function classifyQuestion(question: string): QuestionCategory {
  const normalized = question.toLowerCase();

  // Count keyword matches for each category
  const personScore = PERSON_KEYWORDS.filter((kw) => normalized.includes(kw)).length;
  const periodScore = PERIOD_RECALL_KEYWORDS.filter((kw) => normalized.includes(kw)).length;
  const valuesScore = VALUES_KEYWORDS.filter((kw) => normalized.includes(kw)).length;
  const factScore = FACT_CHECK_KEYWORDS.filter((kw) => normalized.includes(kw)).length;

  // Find the category with the highest score
  const scores: [QuestionCategory, number][] = [
    ['인물관련형', personScore],
    ['시기회상형', periodScore],
    ['가치관탐색형', valuesScore],
    ['사실확인형', factScore],
  ];

  // Sort by score descending; ties resolved by priority order (person > period > values > fact)
  scores.sort((a, b) => b[1] - a[1]);

  // If the top score is 0, default to 사실확인형
  if (scores[0][1] === 0) {
    return '사실확인형';
  }

  return scores[0][0];
}

/**
 * Filters memories by time, person, and emotion criteria using intersection semantics.
 * All specified filters must match for a memory to be included.
 *
 * - time: matches against memory.tags.timePeriod (case-insensitive substring)
 * - person: matches against memory.tags.people array (case-insensitive substring on any person)
 * - emotion: matches against memory.tags.emotions array (case-insensitive substring on any emotion)
 */
export function filterMemories(
  memories: Memory[],
  filters: { time?: string; person?: string; emotion?: string }
): Memory[] {
  return memories.filter((memory) => {
    // Time filter: check if timePeriod contains the filter string
    if (filters.time) {
      const timePeriod = memory.tags.timePeriod.toLowerCase();
      if (!timePeriod.includes(filters.time.toLowerCase())) {
        return false;
      }
    }

    // Person filter: check if any person in the people array matches
    if (filters.person) {
      const personFilter = filters.person.toLowerCase();
      const hasMatch = memory.tags.people.some((p) =>
        p.toLowerCase().includes(personFilter)
      );
      if (!hasMatch) {
        return false;
      }
    }

    // Emotion filter: check if any emotion in the emotions array matches
    if (filters.emotion) {
      const emotionFilter = filters.emotion.toLowerCase();
      const hasMatch = memory.tags.emotions.some((e) =>
        e.toLowerCase().includes(emotionFilter)
      );
      if (!hasMatch) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Creates evidence badges from relevant memories.
 * Each badge contains the memory ID, a relevance score, and an excerpt.
 *
 * Relevance score is computed based on keyword overlap between the question
 * and the memory's content (publishVersion + topic + tags).
 * Score is normalized to [0, 1].
 */
export function generateEvidenceBadges(
  memories: Memory[],
  question: string
): EvidenceBadge[] {
  if (memories.length === 0) {
    return [];
  }

  const questionWords = question
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 1);

  return memories.map((memory) => {
    // Build searchable text from memory
    const memoryText = [
      memory.topic,
      memory.publishVersion,
      ...memory.tags.people,
      ...memory.tags.places,
      ...memory.tags.emotions,
      memory.tags.timePeriod,
    ]
      .join(' ')
      .toLowerCase();

    // Calculate relevance score based on keyword overlap
    const matchCount = questionWords.filter((word) =>
      memoryText.includes(word)
    ).length;
    const relevanceScore =
      questionWords.length > 0
        ? Math.min(1, matchCount / Math.max(1, questionWords.length))
        : 0.5; // Default score when no question words

    // Extract excerpt: first 50 characters of publishVersion
    const excerpt =
      memory.publishVersion.length > 50
        ? memory.publishVersion.substring(0, 50) + '...'
        : memory.publishVersion;

    return {
      memoryId: memory.id,
      relevanceScore: Math.round(relevanceScore * 100) / 100, // Round to 2 decimal places
      excerpt,
    };
  });
}

/**
 * Assembles the complete DigitalTwinResponse with evidence badges and linked memory cards.
 *
 * Enforces chunk-없는-창작-금지: if no memories are provided, returns a fallback
 * response indicating no supporting memories were found.
 */
export function buildDigitalTwinResponse(
  text: string,
  memories: Memory[],
  question: string
): DigitalTwinResponse {
  const questionCategory = classifyQuestion(question);
  const evidenceBadges = generateEvidenceBadges(memories, question);
  const linkedMemoryCards = memories.map((m) => m.id);

  // Enforce chunk-없는-창작-금지: must have at least one supporting memory
  if (memories.length === 0) {
    return {
      text: '그건 잘 기억이 안 나는구나. 관련된 기억이 없어서 답하기 어렵구나.',
      evidenceBadges: [],
      linkedMemoryCards: [],
      questionCategory,
    };
  }

  return {
    text,
    evidenceBadges,
    linkedMemoryCards,
    questionCategory,
  };
}

// ─── Knowledge Graph Builder ─────────────────────────────────────────────────

/**
 * Builds a KnowledgeGraph from stored memories by extracting
 * people and places from memory tags and creating relationship edges.
 */
export function buildGraphFromMemories(memories: Memory[]): KnowledgeGraph {
  const graph = new KnowledgeGraph();

  for (const memory of memories) {
    // Add person nodes
    for (const person of memory.tags.people) {
      if (person.trim()) {
        graph.addNode({ id: person.trim(), type: 'person' });
      }
    }

    // Add place nodes
    for (const place of memory.tags.places) {
      if (place.trim()) {
        graph.addNode({ id: place.trim(), type: 'place' });
      }
    }

    // Create person-to-person co-occurrence edges (appeared in same memory)
    const people = memory.tags.people.filter(p => p.trim());
    for (let i = 0; i < people.length; i++) {
      for (let j = i + 1; j < people.length; j++) {
        graph.addEdge({
          source: people[i].trim(),
          target: people[j].trim(),
          type: '함께 등장',
        });
      }
    }

    // Create person-to-place edges
    const places = memory.tags.places.filter(p => p.trim());
    for (const person of people) {
      for (const place of places) {
        graph.addEdge({
          source: person.trim(),
          target: place.trim(),
          type: '관련 장소',
        });
      }
    }
  }

  return graph;
}

// ─── Existing Functionality (preserved) ──────────────────────────────────────

/**
 * Maps internal ChatMessage format to OpenAI API message format.
 */
function mapHistory(history: ChatMessage[]) {
  return history.map((msg) => ({
    role: msg.role === 'model' ? ('assistant' as const) : ('user' as const),
    content: msg.text,
  }));
}

/**
 * Generates a persona response as the senior user's digital twin.
 *
 * v2 flow:
 * 1. Classifies the question into one of 4 categories
 * 2. Searches RAG index with the user's message to get top-5 relevant memories
 * 3. Gets the full memory objects from the store for those IDs
 * 4. Enforces chunk-없는-창작-금지 (no response without supporting Memory_Chunk)
 * 5. Builds the persona system prompt with the relevant memories as context
 * 6. Calls GPT-4o-mini to generate the response
 * 7. If speech profile is active (sessionCount >= 3), applies the profile to the response
 * 8. Assembles DigitalTwinResponse with evidence badges and linked memory cards
 */
export async function generatePersonaResponse(
  message: string,
  history: ChatMessage[]
): Promise<DigitalTwinResponse> {
  try {
    const store = useStore.getState();
    if (store.demo.offlineMode) {
      return createDemoPersonaResponse(message, store.memories);
    }

    // Step 1: Classify the question
    const questionCategory = classifyQuestion(message);

    // Step 2: Search RAG index for top-5 relevant memories
    const searchResults = await ragIndex.search(message, 5);

    // Step 3: Get full memory objects from the store
    const memories = useStore.getState().memories;
    const relevantMemoryIds = new Set(searchResults.map((r) => r.memoryId));
    const relevantMemories = memories.filter((m) =>
      relevantMemoryIds.has(m.id) &&
      canAccessV2(m, getEffectiveConsentSettings(m), 'family', '챗봇')
    );

    // Step 4: Enforce chunk-없는-창작-금지
    if (relevantMemories.length === 0) {
      return buildDigitalTwinResponse('', [], message);
    }

    // Step 5: Build hybrid RAG context (Vector + Knowledge Graph)
    const vectorResults: SearchResult[] = searchResults.map((r) => ({
      memoryId: r.memoryId,
      score: r.score,
      text: relevantMemories.find((m) => m.id === r.memoryId)?.publishVersion ?? r.text,
    }));

    const graph = buildGraphFromMemories(memories);
    const hybridContext = buildHybridContext(message, vectorResults, graph);

    const memoriesContext = relevantMemories
      .map(
        (m) =>
          `[기억 ID: ${m.id}] 주제: ${m.topic}\n내용: ${m.publishVersion}`
      )
      .join('\n\n');

    const systemInstruction = `
당신은 이 기억들의 주인공인 70대 어르신입니다.
따뜻하고 연륜이 묻어나는 말투로 대답하세요. (예: ~했지, ~란다, ~허허)
사용자(가족이나 후손)의 질문에 대답할 때, 제공된 '나의 기억들'과 '관계 정보'를 바탕으로 대답하세요.
기억을 인용할 때는 자연스럽게 이야기하되, 응답 끝에 인용한 기억의 ID를 [출처: 기억 ID] 형식으로 반드시 적어주세요.
기억에 없는 내용을 물어보면 "그건 잘 기억이 안 나는구나"라고 솔직하게 말씀하세요.
반드시 제공된 기억에 근거해서만 답변하세요. 기억에 없는 내용을 창작하지 마세요.

질문 유형: ${questionCategory}

나의 기억들:
${memoriesContext}

관계 정보 (하이브리드 RAG 컨텍스트):
${hybridContext}
`;

    // Step 6: Call GPT-4o-mini to generate the response
    const response = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemInstruction },
        ...mapHistory(history),
        { role: 'user', content: message },
      ],
      temperature: 0.7,
    });

    let result =
      response.choices[0].message.content ||
      '허허, 무슨 말을 해야 할지 모르겠구나.';

    // Step 7: If speech profile is active (sessionCount >= 3), apply the profile
    const profileStatus = getProfileStatus();
    if (profileStatus === 'active') {
      const { speechProfile } = useStore.getState();
      if (speechProfile.profile) {
        result = await applyProfile(result, speechProfile.profile);
      }
    }

    // Step 8: Assemble DigitalTwinResponse with evidence badges and linked memory cards
    return buildDigitalTwinResponse(result, relevantMemories, message);
  } catch (error) {
    console.error('Error generating persona response:', error);
    return {
      text: '아이고, 귀가 어두워서 잘 못 들었네. 다시 말해주겠니?',
      evidenceBadges: [],
      linkedMemoryCards: [],
      questionCategory: '사실확인형',
    };
  }
}
