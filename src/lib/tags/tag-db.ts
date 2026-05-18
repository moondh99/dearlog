import type {
  Memory,
  MemoryTagLink,
  PhotoAnalysisResult,
  PhotoMetadata,
  TagCategory,
  TagDatabase,
  TagRecord,
} from '../types';

const categoryLabelMap: Record<TagCategory, string> = {
  person: '인물',
  place: '장소',
  emotion: '감정',
  time: '시기',
  event: '사건',
  object: '사물',
};

function normalizeLabel(label: string): string {
  return label.replace(/\s+/g, ' ').trim();
}

export function createTagId(category: TagCategory, label: string): string {
  return `${category}:${normalizeLabel(label).toLowerCase()}`;
}

function upsertTag(
  tags: Map<string, TagRecord>,
  category: TagCategory,
  rawLabel: string,
  source: TagRecord['source']
) {
  const label = normalizeLabel(rawLabel);
  if (!label) return null;

  const id = createTagId(category, label);
  const existing = tags.get(id);
  if (existing) {
    existing.usageCount += 1;
    if (existing.source !== source) existing.source = 'derived';
    return existing;
  }

  const tag: TagRecord = {
    id,
    label,
    category,
    usageCount: 1,
    source,
  };
  tags.set(id, tag);
  return tag;
}

function linkMemory(
  links: MemoryTagLink[],
  memoryId: string,
  tagId: string,
  source: MemoryTagLink['source'],
  confidence: number
) {
  if (links.some((link) => link.memoryId === memoryId && link.tagId === tagId)) return;
  links.push({ memoryId, tagId, source, confidence });
}

export function buildTagDatabaseFromMemories(memories: Memory[]): TagDatabase {
  const tags = new Map<string, TagRecord>();
  const memoryTagLinks: MemoryTagLink[] = [];

  for (const memory of memories) {
    const candidates: Array<[TagCategory, string]> = [
      ...memory.tags.people.map((label): [TagCategory, string] => ['person', label]),
      ...memory.tags.places.map((label): [TagCategory, string] => ['place', label]),
      ...memory.tags.emotions.map((label): [TagCategory, string] => ['emotion', label]),
      ['time', memory.tags.timePeriod],
      ['event', memory.topic],
    ];

    for (const [category, label] of candidates) {
      const tag = upsertTag(tags, category, label, 'memory');
      if (tag) linkMemory(memoryTagLinks, memory.id, tag.id, 'memory', 1);
    }
  }

  return {
    tags: [...tags.values()].sort((a, b) => b.usageCount - a.usageCount || a.label.localeCompare(b.label)),
    memoryTagLinks,
  };
}

export function buildPhotoDerivedTags(input: {
  analysis: PhotoAnalysisResult | null;
  metadata?: PhotoMetadata;
}): Array<{ category: TagCategory; label: string; confidence: number }> {
  const tags: Array<{ category: TagCategory; label: string; confidence: number }> = [];

  if (input.analysis) {
    tags.push(...input.analysis.people.map((label) => ({ category: 'person' as const, label, confidence: 0.85 })));
    tags.push(...input.analysis.places.map((label) => ({ category: 'place' as const, label, confidence: 0.85 })));
    tags.push(...input.analysis.objects.map((label) => ({ category: 'object' as const, label, confidence: 0.8 })));
    tags.push({ category: 'time', label: input.analysis.estimatedEra, confidence: 0.65 });
  }

  if (input.metadata?.capturedAt) {
    tags.push({ category: 'time', label: input.metadata.capturedAt.slice(0, 10), confidence: 0.9 });
  }
  if (input.metadata?.inferredPlace) {
    tags.push({ category: 'place', label: input.metadata.inferredPlace, confidence: 0.55 });
  }
  if (input.metadata?.cameraModel) {
    tags.push({ category: 'object', label: input.metadata.cameraModel, confidence: 0.5 });
  }
  if (typeof input.metadata?.gpsLatitude === 'number' && typeof input.metadata.gpsLongitude === 'number') {
    tags.push({
      category: 'place',
      label: 'GPS 공개 전 확인 필요',
      confidence: 0.75,
    });
  }

  return tags.filter((tag) => normalizeLabel(tag.label));
}

export function describeTagCategory(category: TagCategory): string {
  return categoryLabelMap[category];
}
