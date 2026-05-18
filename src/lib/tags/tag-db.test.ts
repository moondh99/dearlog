import { describe, expect, it } from 'vitest';
import { makeMemory } from '../../test-utils/store-fixtures';
import { buildPhotoDerivedTags, buildTagDatabaseFromMemories, createTagId } from './tag-db';

describe('tag database helpers', () => {
  it('normalizes memory tags into tag records and memory links', () => {
    const db = buildTagDatabaseFromMemories([
      makeMemory({ id: 'm1', tags: { people: ['어머니'], places: ['서울'], emotions: ['감사'], timePeriod: '1970년대' } }),
      makeMemory({ id: 'm2', topic: '서울 생활', tags: { people: ['어머니'], places: ['서울'], emotions: ['자부심'], timePeriod: '1970년대' } }),
    ]);

    expect(db.tags.find((tag) => tag.id === createTagId('person', '어머니'))).toMatchObject({
      label: '어머니',
      category: 'person',
      usageCount: 2,
    });
    expect(db.tags.find((tag) => tag.id === createTagId('place', '서울'))?.usageCount).toBe(2);
    expect(db.memoryTagLinks).toContainEqual({
      memoryId: 'm1',
      tagId: createTagId('time', '1970년대'),
      confidence: 1,
      source: 'memory',
    });
  });

  it('builds photo-derived tag candidates from analysis and metadata', () => {
    const tags = buildPhotoDerivedTags({
      analysis: {
        photoId: 'p1',
        people: ['아이'],
        places: ['욕실'],
        objects: ['젖병'],
        estimatedEra: '2020년대',
        description: '목욕을 거부하는 아이 사진',
      },
      metadata: {
        fileName: '20200102_욕실.jpg',
        fileType: 'image/jpeg',
        fileSize: 100,
        lastModified: '2024-01-01T00:00:00.000Z',
        capturedAt: '2020-01-02T00:00:00.000Z',
        inferredPlace: '집',
        cameraModel: 'EOS 80D',
        gpsLatitude: 37.5,
        gpsLongitude: 127,
      },
    });

    expect(tags).toEqual(expect.arrayContaining([
      { category: 'object', label: '젖병', confidence: 0.8 },
      { category: 'time', label: '2020-01-02', confidence: 0.9 },
      { category: 'place', label: '집', confidence: 0.55 },
      { category: 'object', label: 'EOS 80D', confidence: 0.5 },
      { category: 'place', label: 'GPS 공개 전 확인 필요', confidence: 0.75 },
    ]));
  });
});
