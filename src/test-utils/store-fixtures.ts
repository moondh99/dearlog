import { createAuthenticatedAuthState, useStore } from '../store';
import type { Memory, StoredPhoto } from '../lib/types';

export function makeMemory(overrides: Partial<Memory> = {}): Memory {
  return {
    id: overrides.id ?? 'memory-1',
    date: overrides.date ?? '2024-01-01T00:00:00.000Z',
    topic: overrides.topic ?? '서울에 처음 올라온 날',
    originalTranscript: overrides.originalTranscript ?? '처음 서울에 왔을 때 참 낯설었지.',
    cleanedTranscript: overrides.cleanedTranscript ?? '처음 서울에 왔을 때 참 낯설었습니다.',
    publishVersion: overrides.publishVersion ?? '처음 서울에 올라온 날의 기억입니다.',
    tags: overrides.tags ?? {
      people: ['어머니'],
      places: ['서울'],
      emotions: ['감사'],
      timePeriod: '1970년대',
    },
    privacy: overrides.privacy ?? 'family',
    confidenceLabel: overrides.confidenceLabel ?? '확인됨',
    contradictions: overrides.contradictions ?? [],
    consent: overrides.consent ?? {
      status: 'granted',
      accessTier: '전체 가족',
      designatedFamilyIds: [],
      lastModified: '2024-01-01T00:00:00.000Z',
    },
    consentSettings: overrides.consentSettings ?? {
      출판: 'granted',
      가족열람: 'granted',
      챗봇: 'granted',
      사후공개: 'granted',
      민감정보: 'granted',
    },
    embedding: overrides.embedding ?? null,
  };
}

export function makePhoto(overrides: Partial<StoredPhoto> = {}): StoredPhoto {
  return {
    id: overrides.id ?? 'photo-1',
    url: overrides.url ?? 'data:image/png;base64,photo',
    uploadedAt: overrides.uploadedAt ?? '2024-01-01T00:00:00.000Z',
    analysis: overrides.analysis ?? {
      photoId: overrides.id ?? 'photo-1',
      people: ['어머니'],
      places: ['서울'],
      objects: ['가방'],
      estimatedEra: '1970년대',
      description: '서울역 앞에서 찍은 가족 사진',
    },
    metadata: overrides.metadata ?? {
      fileName: '19700501_서울역.png',
      fileType: 'image/png',
      fileSize: 1024,
      lastModified: '2024-01-01T00:00:00.000Z',
      capturedAt: '1970-05-01T00:00:00.000Z',
      inferredPlace: '서울역',
      capturedAtSource: 'fileName',
      cameraMake: 'Canon',
      cameraModel: 'EOS 80D',
      gpsLatitude: 37.5,
      gpsLongitude: 127,
    },
    linkedMemoryIds: overrides.linkedMemoryIds ?? ['memory-1'],
  };
}

export function resetStoreForTest() {
  window.localStorage.clear();
  useStore.setState({
    memories: [],
    ragIndex: { entries: [], lastUpdated: '' },
    speechProfile: { profile: null, sessionCount: 0 },
    autobiography: { currentStructure: null, narratives: [], lastGenerated: null },
    posthumousPolicy: { policy: 'maintain_current', confirmedAt: null },
    familyQuestions: { questions: [], lastUpdated: '' },
    calendar: { events: [], processedEventIds: [], lastSynced: '' },
    photos: { photos: [], lastUpdated: '' },
    auth: createAuthenticatedAuthState(),
    demo: { enabled: false, offlineMode: false, seededAt: null },
  });
}
