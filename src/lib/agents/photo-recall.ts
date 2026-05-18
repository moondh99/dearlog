/**
 * Photo Recall Agent (Agent ⑩)
 *
 * Analyzes uploaded photos using GPT-4o Vision to extract contextual information
 * (people, places, objects, estimated era) and generates interview questions
 * based on the analysis. Creates bidirectional links between photos and memories.
 *
 * Error handling: Analysis failure stores photo with `analysis: null`.
 * The photo is always persisted regardless of analysis success.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.5, 10.6, 12.1, 12.2, 12.3
 */

import type {
  PhotoAnalysisResult,
  StoredPhoto,
  MemoryV2,
} from '../types';
import { useStore } from '../../store';
import { getOpenAIClient } from '../openai-client';
import { extractPhotoMetadata } from '../photos/metadata';

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Stores a photo in the store and initiates analysis.
 *
 * The photo is saved immediately with `analysis: null`, then analysis is
 * attempted. If analysis succeeds, the stored photo is updated with the result.
 * If analysis fails, the photo remains stored with `analysis: null`.
 *
 * @param photoData - Base64 data URL string or File object representing the photo
 * @returns The stored photo (with or without analysis depending on success)
 *
 * Requirements: 10.1
 */
export async function storePhoto(photoData: string | File): Promise<StoredPhoto> {
  const photoId = `photo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const url = typeof photoData === 'string' ? photoData : URL.createObjectURL(photoData);
  const uploadedAt = new Date().toISOString();
  const metadata = await extractPhotoMetadata(photoData, new Date(uploadedAt));

  const photo: StoredPhoto = {
    id: photoId,
    url,
    uploadedAt,
    analysis: null,
    metadata,
    linkedMemoryIds: [],
  };

  // Store photo immediately (even before analysis)
  useStore.getState().addPhoto(photo);

  // Initiate analysis
  try {
    const analysis = await analyzePhoto(photoId);
    // Update stored photo with analysis result
    useStore.getState().updatePhoto(photoId, { analysis });
    return { ...photo, analysis };
  } catch (error) {
    console.error('Photo Recall: Analysis failed for photo', photoId, error);
    // Photo remains stored with analysis: null (error handling per design)
    return photo;
  }
}

/**
 * Analyzes a stored photo using GPT-4o Vision to extract people, places,
 * objects, and estimated era information.
 *
 * @param photoId - ID of the stored photo to analyze
 * @returns PhotoAnalysisResult with extracted information
 * @throws Error if photo is not found or GPT-4o Vision call fails
 *
 * Requirements: 10.2, 10.6, 12.1, 12.3
 */
export async function analyzePhoto(photoId: string): Promise<PhotoAnalysisResult> {
  const photo = getPhotoById(photoId);
  if (!photo) {
    throw new Error(`Photo not found: ${photoId}`);
  }

  const systemPrompt = `당신은 사진을 분석하여 기억 회상을 돕는 전문가입니다.
사진에서 다음 정보를 추출하여 JSON 형식으로 반환해주세요:

1. people: 사진에 보이는 인물들 (예: "젊은 남성", "할머니", "아이 2명")
2. places: 사진의 장소 또는 배경 (예: "시골 마을", "학교 운동장")
3. objects: 주요 사물들 (예: "자전거", "한복", "졸업장")
4. estimatedEra: 추정 시대 (예: "1970년대", "1980년대 초반")
5. description: 사진에 대한 간단한 설명 (1-2문장)

다음 JSON 형식으로만 응답하세요:
{
  "people": ["인물1", "인물2"],
  "places": ["장소1"],
  "objects": ["사물1", "사물2"],
  "estimatedEra": "추정 시대",
  "description": "사진 설명"
}`;

  const response = await getOpenAIClient().chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: photo.url },
          },
          {
            type: 'text',
            text: '이 사진을 분석해주세요.',
          },
        ],
      },
    ],
    temperature: 0.3,
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error('GPT-4o Vision returned empty response');
  }

  const parsed = JSON.parse(content);

  const result: PhotoAnalysisResult = {
    photoId,
    people: Array.isArray(parsed.people) ? parsed.people.filter((p: unknown): p is string => typeof p === 'string') : [],
    places: Array.isArray(parsed.places) ? parsed.places.filter((p: unknown): p is string => typeof p === 'string') : [],
    objects: Array.isArray(parsed.objects) ? parsed.objects.filter((o: unknown): o is string => typeof o === 'string') : [],
    estimatedEra: typeof parsed.estimatedEra === 'string' ? parsed.estimatedEra : '알 수 없음',
    description: typeof parsed.description === 'string' ? parsed.description : '',
  };

  return result;
}

/**
 * Generates contextual interview questions based on photo analysis results.
 * Questions follow the 인물→장소→감정→사건→시간 sequence pattern.
 *
 * @param analysis - PhotoAnalysisResult from a previously analyzed photo
 * @returns Array of interview question strings
 *
 * Requirements: 10.3
 */
export async function generateQuestions(analysis: PhotoAnalysisResult): Promise<string[]> {
  const systemPrompt = `당신은 어르신의 기억을 이끌어내는 따뜻한 인터뷰어입니다.
사진 분석 결과를 바탕으로 어르신에게 물어볼 인터뷰 질문을 생성해주세요.

규칙:
1. 질문은 인물→장소→감정→사건→시간 순서로 구성하세요.
2. 따뜻하고 공감적인 말투를 사용하세요.
3. 한 번에 하나의 질문만 포함하세요.
4. 어르신이 편안하게 답할 수 있는 열린 질문을 만드세요.
5. 정확히 5개의 질문을 생성하세요.
6. 사진에서 추출된 정보를 자연스럽게 질문에 반영하세요.

다음 JSON 형식으로만 응답하세요:
{
  "questions": ["질문1", "질문2", "질문3", "질문4", "질문5"]
}`;

  const userPrompt = `사진 분석 결과:
- 인물: ${analysis.people.length > 0 ? analysis.people.join(', ') : '확인 불가'}
- 장소: ${analysis.places.length > 0 ? analysis.places.join(', ') : '확인 불가'}
- 사물: ${analysis.objects.length > 0 ? analysis.objects.join(', ') : '확인 불가'}
- 추정 시대: ${analysis.estimatedEra}
- 설명: ${analysis.description}

이 사진에 대해 어르신의 기억을 이끌어낼 수 있는 인터뷰 질문 5개를 생성해주세요.`;

  try {
    const response = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      return createFallbackQuestions(analysis);
    }

    const parsed = JSON.parse(content);
    const questions: string[] = Array.isArray(parsed.questions)
      ? parsed.questions.filter((q: unknown): q is string => typeof q === 'string')
      : [];

    if (questions.length === 0) {
      return createFallbackQuestions(analysis);
    }

    return questions;
  } catch (error) {
    console.error('Photo Recall: Error generating questions:', error);
    return createFallbackQuestions(analysis);
  }
}

/**
 * Creates a bidirectional link between a photo and a memory.
 * Updates BOTH the photo's linkedMemoryIds AND the memory's linkedPhotoIds.
 *
 * This ensures bidirectional link integrity:
 * - Photo → Memory: photo.linkedMemoryIds contains memoryId
 * - Memory → Photo: memory.linkedPhotoIds contains photoId
 *
 * @param photoId - ID of the photo to link
 * @param memoryId - ID of the memory to link
 *
 * Requirements: 10.5, 12.2
 */
export function linkMemoryToPhoto(photoId: string, memoryId: string): void {
  const store = useStore.getState();

  // Update photo → memory link
  const photo = store.photos.photos.find((p) => p.id === photoId);
  if (photo && !photo.linkedMemoryIds.includes(memoryId)) {
    store.updatePhoto(photoId, {
      linkedMemoryIds: [...photo.linkedMemoryIds, memoryId],
    });
  }

  // Update memory → photo link (bidirectional)
  const memory = store.memories.find((m) => m.id === memoryId) as MemoryV2 | undefined;
  if (memory) {
    const linkedPhotoIds: string[] = (memory as MemoryV2).linkedPhotoIds ?? [];
    if (!linkedPhotoIds.includes(photoId)) {
      // Update memory with new linkedPhotoIds
      const updatedMemory = {
        ...memory,
        linkedPhotoIds: [...linkedPhotoIds, photoId],
      };
      // Use set to update the memory in the store
      useStore.setState((state) => ({
        memories: state.memories.map((m) =>
          m.id === memoryId ? updatedMemory : m
        ),
      }));
    }
  }
}

/**
 * Retrieves a stored photo by its ID.
 *
 * @param photoId - ID of the photo to retrieve
 * @returns The StoredPhoto if found, null otherwise
 */
export function getPhotoById(photoId: string): StoredPhoto | null {
  const { photos } = useStore.getState().photos;
  return photos.find((p) => p.id === photoId) ?? null;
}

/**
 * Retrieves all photos linked to a specific memory.
 *
 * @param memoryId - ID of the memory to find linked photos for
 * @returns Array of StoredPhoto objects linked to the memory
 */
export function getPhotosByMemoryId(memoryId: string): StoredPhoto[] {
  const { photos } = useStore.getState().photos;
  return photos.filter((p) => p.linkedMemoryIds.includes(memoryId));
}

// ─── Internal Helper Functions ───────────────────────────────────────────────

/**
 * Creates fallback interview questions when GPT-4o-mini fails to generate them.
 * Uses the photo analysis data to construct basic questions.
 */
function createFallbackQuestions(analysis: PhotoAnalysisResult): string[] {
  const questions: string[] = [];

  // 인물 (Person) question
  if (analysis.people.length > 0) {
    questions.push(`이 사진에 ${analysis.people[0]}이(가) 보이는데, 이분은 누구인가요?`);
  } else {
    questions.push('이 사진에 있는 분들은 누구인가요?');
  }

  // 장소 (Place) question
  if (analysis.places.length > 0) {
    questions.push(`이 사진은 ${analysis.places[0]}에서 찍은 것 같은데, 이곳에 대해 기억나시는 게 있으신가요?`);
  } else {
    questions.push('이 사진은 어디에서 찍은 건가요?');
  }

  // 감정 (Emotion) question
  questions.push('이 사진을 보시면 어떤 기분이 드시나요?');

  // 사건 (Event) question
  if (analysis.objects.length > 0) {
    questions.push(`사진에 ${analysis.objects[0]}이(가) 보이는데, 이것과 관련된 이야기가 있으신가요?`);
  } else {
    questions.push('이 사진을 찍게 된 특별한 계기가 있으신가요?');
  }

  // 시간 (Time) question
  if (analysis.estimatedEra && analysis.estimatedEra !== '알 수 없음') {
    questions.push(`이 사진이 ${analysis.estimatedEra}쯤으로 보이는데, 그때가 맞으신가요?`);
  } else {
    questions.push('이 사진은 대략 언제쯤 찍으신 건가요?');
  }

  return questions;
}
