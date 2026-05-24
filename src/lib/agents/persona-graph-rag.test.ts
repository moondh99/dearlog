import { describe, it, expect } from 'vitest';
import { buildGraphFromMemories } from './persona';
import type { Memory } from '../types';

const createMockMemory = (overrides: Partial<Memory> & { id: string }): Memory => ({
  id: overrides.id,
  date: overrides.date ?? '2024-01-01',
  topic: overrides.topic ?? '테스트 기억',
  originalTranscript: overrides.originalTranscript ?? '',
  cleanedTranscript: overrides.cleanedTranscript ?? '',
  publishVersion: overrides.publishVersion ?? '',
  tags: overrides.tags ?? { people: [], places: [], emotions: [], timePeriod: '' },
  privacy: overrides.privacy ?? 'private',
  confidenceLabel: overrides.confidenceLabel ?? '확인됨',
  contradictions: overrides.contradictions ?? [],
  consent: overrides.consent ?? {
    status: 'granted',
    accessTier: '본인만',
    designatedFamilyIds: [],
    lastModified: '',
  },
  embedding: overrides.embedding ?? null,
});

describe('buildGraphFromMemories', () => {
  it('should create person nodes from memory tags', () => {
    const memories: Memory[] = [
      createMockMemory({
        id: 'mem_1',
        tags: { people: ['김영자', '김민수'], places: [], emotions: [], timePeriod: '' },
      }),
    ];

    const graph = buildGraphFromMemories(memories);
    const nodes = graph.getNodes();

    expect(nodes.length).toBe(2);
    expect(graph.findNode('김영자')).toBeDefined();
    expect(graph.findNode('김영자')?.type).toBe('person');
    expect(graph.findNode('김민수')).toBeDefined();
  });

  it('should create place nodes from memory tags', () => {
    const memories: Memory[] = [
      createMockMemory({
        id: 'mem_1',
        tags: { people: [], places: ['부산', '영도'], emotions: [], timePeriod: '' },
      }),
    ];

    const graph = buildGraphFromMemories(memories);

    expect(graph.findNode('부산')).toBeDefined();
    expect(graph.findNode('부산')?.type).toBe('place');
    expect(graph.findNode('영도')).toBeDefined();
  });

  it('should create co-occurrence edges between people in the same memory', () => {
    const memories: Memory[] = [
      createMockMemory({
        id: 'mem_1',
        tags: { people: ['김영자', '김민수', '박순이'], places: [], emotions: [], timePeriod: '' },
      }),
    ];

    const graph = buildGraphFromMemories(memories);
    const edges = graph.getEdges();

    // 3 people → C(3,2) = 3 co-occurrence edges
    expect(edges.filter(e => e.type === '함께 등장').length).toBe(3);
  });

  it('should create person-to-place edges', () => {
    const memories: Memory[] = [
      createMockMemory({
        id: 'mem_1',
        tags: { people: ['김영자'], places: ['부산'], emotions: [], timePeriod: '' },
      }),
    ];

    const graph = buildGraphFromMemories(memories);
    const edges = graph.getEdges();

    expect(edges.length).toBe(1);
    expect(edges[0].source).toBe('김영자');
    expect(edges[0].target).toBe('부산');
    expect(edges[0].type).toBe('관련 장소');
  });

  it('should deduplicate nodes and edges across multiple memories', () => {
    const memories: Memory[] = [
      createMockMemory({
        id: 'mem_1',
        tags: { people: ['김영자', '김민수'], places: ['부산'], emotions: [], timePeriod: '' },
      }),
      createMockMemory({
        id: 'mem_2',
        tags: { people: ['김영자', '김민수'], places: ['부산'], emotions: [], timePeriod: '' },
      }),
    ];

    const graph = buildGraphFromMemories(memories);

    // Should still have 3 unique nodes
    expect(graph.getNodes().length).toBe(3);

    // Should have no duplicate edges
    const edges = graph.getEdges();
    const edgeKeys = edges.map(
      (e) => `${e.source.toLowerCase()}-${e.target.toLowerCase()}-${e.type}`
    );
    expect(new Set(edgeKeys).size).toBe(edgeKeys.length);
  });

  it('should return an empty graph for memories with no tags', () => {
    const memories: Memory[] = [
      createMockMemory({
        id: 'mem_1',
        tags: { people: [], places: [], emotions: [], timePeriod: '' },
      }),
    ];

    const graph = buildGraphFromMemories(memories);

    expect(graph.getNodes().length).toBe(0);
    expect(graph.getEdges().length).toBe(0);
  });

  it('should handle neighbors lookup after building from memories', () => {
    const memories: Memory[] = [
      createMockMemory({
        id: 'mem_1',
        tags: { people: ['김영자', '김민수'], places: ['부산'], emotions: [], timePeriod: '' },
      }),
    ];

    const graph = buildGraphFromMemories(memories);
    const neighbors = graph.getNeighbors('김영자');

    // 김민수 (함께 등장) + 부산 (관련 장소)
    expect(neighbors.length).toBe(2);
    const neighborIds = neighbors.map(n => n.node.id);
    expect(neighborIds).toContain('김민수');
    expect(neighborIds).toContain('부산');
  });
});
