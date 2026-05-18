import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import type { StoredPhoto, MemoryV2, Memory } from '../types';

// ─── Mock OpenAI ─────────────────────────────────────────────────────────────

vi.mock('openai', () => ({
  default: class MockOpenAI {
    constructor() {}
    chat = {
      completions: {
        create: vi.fn().mockImplementation(async () => ({
          choices: [{ message: { content: '{}' } }],
        })),
      },
    };
    embeddings = {
      create: vi.fn().mockImplementation(async () => ({
        data: [{ embedding: Array(1536).fill(0) }],
      })),
    };
  },
}));

import { linkMemoryToPhoto, getPhotoById, getPhotosByMemoryId } from './photo-recall';
import { useStore } from '../../store';

/**
 * Property tests for Photo Recall Agent (Agent ⑩)
 *
 * Property 27: Photo-memory bidirectional link integrity
 *
 * For any photo-memory link created by the Photo Recall Agent, the photo's
 * linkedMemoryIds SHALL contain the memory ID AND the memory's linkedPhotoIds
 * SHALL contain the photo ID. Navigating Photo→Memory→Photo SHALL return the
 * original photo ID.
 *
 * **Validates: Requirements 10.5, 12.2**
 */

// ─── Generators ────────────────────────────────────────────────────────────────

/** Generate a unique photo ID */
const photoIdArb: fc.Arbitrary<string> = fc.stringMatching(/^photo_[a-z0-9]{4,12}$/);

/** Generate a unique memory ID */
const memoryIdArb: fc.Arbitrary<string> = fc.stringMatching(/^mem_[a-z0-9]{4,12}$/);

/** Create a StoredPhoto object for testing */
function createTestPhoto(id: string): StoredPhoto {
  return {
    id,
    url: `https://example.com/photos/${id}.jpg`,
    uploadedAt: new Date().toISOString(),
    analysis: null,
    linkedMemoryIds: [],
  };
}

/** Create a MemoryV2 object for testing */
function createTestMemory(id: string): MemoryV2 {
  return {
    id,
    date: '2024-01-01',
    topic: '테스트 기억',
    originalTranscript: '원본 텍스트입니다.',
    cleanedTranscript: '정제된 텍스트입니다.',
    publishVersion: '',
    tags: { people: [], places: [], emotions: [], timePeriod: '' },
    privacy: 'private',
    confidenceLabel: '확인됨',
    contradictions: [],
    consent: {
      status: 'granted',
      accessTier: '본인만',
      designatedFamilyIds: [],
      lastModified: '2024-01-01T00:00:00.000Z',
    },
    embedding: null,
    nerTags: [],
    emotionTags: [],
    diffRecord: null,
    linkedPhotoIds: [],
    sourceSessionId: '',
  };
}

// ─── Helper: Reset store before each test ────────────────────────────────────

beforeEach(() => {
  useStore.setState({
    memories: [],
    photos: { photos: [], lastUpdated: '' },
  });
});

// ─── Property 27: Photo-memory bidirectional link integrity ──────────────────

describe('Feature: agent-model-v2, Property 27: Photo-memory bidirectional link integrity', () => {
  it('After linkMemoryToPhoto(photoId, memoryId), the photo linkedMemoryIds contains memoryId', () => {
    fc.assert(
      fc.property(photoIdArb, memoryIdArb, (photoId, memoryId) => {
        // Setup: add photo and memory to store
        const photo = createTestPhoto(photoId);
        const memory = createTestMemory(memoryId);

        useStore.setState({
          memories: [memory] as Memory[],
          photos: { photos: [photo], lastUpdated: '' },
        });

        // Act: create bidirectional link
        linkMemoryToPhoto(photoId, memoryId);

        // Assert: photo's linkedMemoryIds contains memoryId
        const updatedPhoto = getPhotoById(photoId);
        expect(updatedPhoto).not.toBeNull();
        expect(updatedPhoto!.linkedMemoryIds).toContain(memoryId);
      }),
      { numRuns: 100 },
    );
  });

  it('After linkMemoryToPhoto(photoId, memoryId), the memory linkedPhotoIds contains photoId', () => {
    fc.assert(
      fc.property(photoIdArb, memoryIdArb, (photoId, memoryId) => {
        // Setup: add photo and memory to store
        const photo = createTestPhoto(photoId);
        const memory = createTestMemory(memoryId);

        useStore.setState({
          memories: [memory] as Memory[],
          photos: { photos: [photo], lastUpdated: '' },
        });

        // Act: create bidirectional link
        linkMemoryToPhoto(photoId, memoryId);

        // Assert: memory's linkedPhotoIds contains photoId
        const updatedMemory = useStore.getState().memories.find((m) => m.id === memoryId) as MemoryV2 | undefined;
        expect(updatedMemory).toBeDefined();
        expect(updatedMemory!.linkedPhotoIds).toContain(photoId);
      }),
      { numRuns: 100 },
    );
  });

  it('Navigating Photo→Memory→Photo returns the original photo ID (round-trip)', () => {
    fc.assert(
      fc.property(photoIdArb, memoryIdArb, (photoId, memoryId) => {
        // Setup: add photo and memory to store
        const photo = createTestPhoto(photoId);
        const memory = createTestMemory(memoryId);

        useStore.setState({
          memories: [memory] as Memory[],
          photos: { photos: [photo], lastUpdated: '' },
        });

        // Act: create bidirectional link
        linkMemoryToPhoto(photoId, memoryId);

        // Navigate: Photo → get linkedMemoryIds → pick memoryId → get memory → get linkedPhotoIds → find photoId
        const storedPhoto = getPhotoById(photoId);
        expect(storedPhoto).not.toBeNull();

        // Photo → Memory: get the linked memory ID from the photo
        const linkedMemoryId = storedPhoto!.linkedMemoryIds[0];
        expect(linkedMemoryId).toBe(memoryId);

        // Memory → Photo: get the linked photo IDs from the memory
        const linkedMemory = useStore.getState().memories.find((m) => m.id === linkedMemoryId) as MemoryV2 | undefined;
        expect(linkedMemory).toBeDefined();
        expect(linkedMemory!.linkedPhotoIds).toContain(photoId);

        // Round-trip: the original photo ID is reachable
        const photosFromMemory = getPhotosByMemoryId(linkedMemoryId);
        const originalPhotoFound = photosFromMemory.some((p) => p.id === photoId);
        expect(originalPhotoFound).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('getPhotosByMemoryId(memoryId) returns photos that include the linked photo', () => {
    fc.assert(
      fc.property(photoIdArb, memoryIdArb, (photoId, memoryId) => {
        // Setup: add photo and memory to store
        const photo = createTestPhoto(photoId);
        const memory = createTestMemory(memoryId);

        useStore.setState({
          memories: [memory] as Memory[],
          photos: { photos: [photo], lastUpdated: '' },
        });

        // Act: create bidirectional link
        linkMemoryToPhoto(photoId, memoryId);

        // Assert: getPhotosByMemoryId returns the linked photo
        const photos = getPhotosByMemoryId(memoryId);
        const foundPhoto = photos.find((p) => p.id === photoId);
        expect(foundPhoto).toBeDefined();
        expect(foundPhoto!.linkedMemoryIds).toContain(memoryId);
      }),
      { numRuns: 100 },
    );
  });

  it('Calling linkMemoryToPhoto multiple times with the same pair does not create duplicates', () => {
    fc.assert(
      fc.property(
        photoIdArb,
        memoryIdArb,
        fc.integer({ min: 2, max: 10 }),
        (photoId, memoryId, repeatCount) => {
          // Setup: add photo and memory to store
          const photo = createTestPhoto(photoId);
          const memory = createTestMemory(memoryId);

          useStore.setState({
            memories: [memory] as Memory[],
            photos: { photos: [photo], lastUpdated: '' },
          });

          // Act: call linkMemoryToPhoto multiple times with the same pair
          for (let i = 0; i < repeatCount; i++) {
            linkMemoryToPhoto(photoId, memoryId);
          }

          // Assert: no duplicates in photo's linkedMemoryIds
          const updatedPhoto = getPhotoById(photoId);
          expect(updatedPhoto).not.toBeNull();
          const memoryIdOccurrences = updatedPhoto!.linkedMemoryIds.filter((id) => id === memoryId);
          expect(memoryIdOccurrences.length).toBe(1);

          // Assert: no duplicates in memory's linkedPhotoIds
          const updatedMemory = useStore.getState().memories.find((m) => m.id === memoryId) as MemoryV2 | undefined;
          expect(updatedMemory).toBeDefined();
          const photoIdOccurrences = updatedMemory!.linkedPhotoIds.filter((id) => id === photoId);
          expect(photoIdOccurrences.length).toBe(1);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 28: Photo analysis result serialization round-trip ──────────────

/**
 * Property 28: Photo analysis result serialization round-trip
 *
 * For any valid PhotoAnalysisResult object, serializing it to JSON (JSON.stringify)
 * and deserializing back (JSON.parse) SHALL produce an object deeply equal to the
 * original, with all fields (photoId, people, places, objects, estimatedEra,
 * description) preserved without data loss.
 *
 * **Validates: Requirements 12.1, 12.3**
 */

import type { PhotoAnalysisResult } from '../types';

// ─── Generators for PhotoAnalysisResult ──────────────────────────────────────

/** Generate Korean/English name strings */
const koreanNameArb: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom('할머니', '할아버지', '어머니', '아버지', '삼촌', '이모', '젊은 남성', '아이'),
  fc.stringMatching(/^[가-힣]{2,5}$/),
  fc.string({ minLength: 1, maxLength: 20 }),
);

/** Generate Korean/English place strings */
const koreanPlaceArb: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom('시골 마을', '학교 운동장', '서울역', '부산 해운대', '고향집', '시장'),
  fc.stringMatching(/^[가-힣]{2,6}$/),
  fc.string({ minLength: 1, maxLength: 30 }),
);

/** Generate Korean/English object strings */
const koreanObjectArb: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom('자전거', '한복', '졸업장', '카메라', '우산', '가방'),
  fc.stringMatching(/^[가-힣]{1,5}$/),
  fc.string({ minLength: 1, maxLength: 20 }),
);

/** Generate Korean era strings */
const koreanEraArb: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom('1950년대', '1960년대', '1970년대', '1980년대', '1990년대', '2000년대'),
  fc.stringMatching(/^[0-9]{4}년대( [초중후]반)?$/),
  fc.string({ minLength: 0, maxLength: 30 }),
);

/** Generate Korean description strings */
const koreanDescriptionArb: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom(
    '가족이 함께 찍은 사진입니다.',
    '졸업식 날 운동장에서 찍은 기념 사진.',
    '시골 마을에서의 어린 시절 모습.',
    '',
  ),
  fc.stringMatching(/^[가-힣\s.,!?]{0,50}$/),
  fc.string({ minLength: 0, maxLength: 100 }),
);

/** Generate a valid PhotoAnalysisResult */
const photoAnalysisResultArb: fc.Arbitrary<PhotoAnalysisResult> = fc.record({
  photoId: fc.stringMatching(/^photo_[a-z0-9]{4,12}$/),
  people: fc.array(koreanNameArb, { minLength: 0, maxLength: 10 }),
  places: fc.array(koreanPlaceArb, { minLength: 0, maxLength: 5 }),
  objects: fc.array(koreanObjectArb, { minLength: 0, maxLength: 10 }),
  estimatedEra: koreanEraArb,
  description: koreanDescriptionArb,
});

describe('Feature: agent-model-v2, Property 28: Photo analysis result serialization round-trip', () => {
  it('JSON.parse(JSON.stringify(result)) deeply equals the original PhotoAnalysisResult', () => {
    fc.assert(
      fc.property(photoAnalysisResultArb, (result) => {
        const serialized = JSON.stringify(result);
        const deserialized = JSON.parse(serialized);

        expect(deserialized).toEqual(result);
      }),
      { numRuns: 100 },
    );
  });

  it('All fields (photoId, people, places, objects, estimatedEra, description) are preserved', () => {
    fc.assert(
      fc.property(photoAnalysisResultArb, (result) => {
        const deserialized: PhotoAnalysisResult = JSON.parse(JSON.stringify(result));

        expect(deserialized.photoId).toBe(result.photoId);
        expect(deserialized.people).toEqual(result.people);
        expect(deserialized.places).toEqual(result.places);
        expect(deserialized.objects).toEqual(result.objects);
        expect(deserialized.estimatedEra).toBe(result.estimatedEra);
        expect(deserialized.description).toBe(result.description);
      }),
      { numRuns: 100 },
    );
  });

  it('Array ordering is preserved (people, places, objects maintain their order)', () => {
    fc.assert(
      fc.property(photoAnalysisResultArb, (result) => {
        const deserialized: PhotoAnalysisResult = JSON.parse(JSON.stringify(result));

        // Verify element-by-element ordering
        for (let i = 0; i < result.people.length; i++) {
          expect(deserialized.people[i]).toBe(result.people[i]);
        }
        for (let i = 0; i < result.places.length; i++) {
          expect(deserialized.places[i]).toBe(result.places[i]);
        }
        for (let i = 0; i < result.objects.length; i++) {
          expect(deserialized.objects[i]).toBe(result.objects[i]);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('Empty arrays and empty strings are preserved correctly', () => {
    fc.assert(
      fc.property(
        fc.record({
          photoId: fc.stringMatching(/^photo_[a-z0-9]{4,12}$/),
          people: fc.constant([] as string[]),
          places: fc.constant([] as string[]),
          objects: fc.constant([] as string[]),
          estimatedEra: fc.constant(''),
          description: fc.constant(''),
        }),
        (result: PhotoAnalysisResult) => {
          const deserialized: PhotoAnalysisResult = JSON.parse(JSON.stringify(result));

          expect(deserialized.people).toEqual([]);
          expect(deserialized.places).toEqual([]);
          expect(deserialized.objects).toEqual([]);
          expect(deserialized.estimatedEra).toBe('');
          expect(deserialized.description).toBe('');
          expect(Array.isArray(deserialized.people)).toBe(true);
          expect(Array.isArray(deserialized.places)).toBe(true);
          expect(Array.isArray(deserialized.objects)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Unicode characters (Korean text) survive the round-trip', () => {
    fc.assert(
      fc.property(
        fc.record({
          photoId: fc.stringMatching(/^photo_[a-z0-9]{4,12}$/),
          people: fc.array(fc.stringMatching(/^[가-힣]{2,5}$/), { minLength: 1, maxLength: 5 }),
          places: fc.array(fc.stringMatching(/^[가-힣]{2,6}$/), { minLength: 1, maxLength: 3 }),
          objects: fc.array(fc.stringMatching(/^[가-힣]{1,5}$/), { minLength: 1, maxLength: 5 }),
          estimatedEra: fc.stringMatching(/^[0-9]{4}년대$/),
          description: fc.stringMatching(/^[가-힣\s]{5,30}$/),
        }),
        (result: PhotoAnalysisResult) => {
          const deserialized: PhotoAnalysisResult = JSON.parse(JSON.stringify(result));

          // Verify Korean characters are preserved byte-for-byte
          expect(deserialized).toEqual(result);

          // Verify each Korean string field individually
          result.people.forEach((person, i) => {
            expect(deserialized.people[i]).toBe(person);
          });
          result.places.forEach((place, i) => {
            expect(deserialized.places[i]).toBe(place);
          });
          result.objects.forEach((obj, i) => {
            expect(deserialized.objects[i]).toBe(obj);
          });
          expect(deserialized.estimatedEra).toBe(result.estimatedEra);
          expect(deserialized.description).toBe(result.description);
        },
      ),
      { numRuns: 100 },
    );
  });
});
