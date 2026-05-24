import { describe, it, expect, beforeEach } from 'vitest';
import { KnowledgeGraph, extractEntities, buildHybridContext } from './graph-rag';
import type { SearchResult } from '../types';

describe('Graph RAG Module', () => {
  let graph: KnowledgeGraph;

  beforeEach(() => {
    graph = new KnowledgeGraph();
  });

  describe('KnowledgeGraph basics', () => {
    it('should add nodes and retrieve them', () => {
      graph.addNode({ id: '김영자', type: 'person', description: '주인공 어르신' });
      graph.addNode({ id: '부산', type: 'place', description: '고향 도시' });

      expect(graph.getNodes().length).toBe(2);
      expect(graph.findNode('김영자')).toBeDefined();
      expect(graph.findNode('김영자')?.type).toBe('person');
      expect(graph.findNode('부산')?.description).toBe('고향 도시');
    });

    it('should find nodes case-insensitively', () => {
      graph.addNode({ id: 'Seoul', type: 'place' });
      expect(graph.findNode('Seoul')).toBeDefined();
      expect(graph.findNode('seoul')).toBeDefined();
      expect(graph.findNode('SEOUL')).toBeDefined();
    });

    it('should auto-create nodes when adding an edge with unregistered entities', () => {
      graph.addEdge({ source: '김영자', target: '김민수', type: '가족' });

      expect(graph.getEdges().length).toBe(1);
      expect(graph.getNodes().length).toBe(2); // 양쪽 노드가 모두 등록됨
      expect(graph.findNode('김영자')?.type).toBe('unknown');
      expect(graph.findNode('김민수')?.type).toBe('unknown');
    });

    it('should prevent adding duplicate edges', () => {
      graph.addEdge({ source: '김영자', target: '부산', type: '고향' });
      graph.addEdge({ source: '김영자', target: '부산', type: '고향' }); // Duplicate
      graph.addEdge({ source: '김영자', target: '부산', type: '방문' }); // Different type

      expect(graph.getEdges().length).toBe(2);
    });

    it('should find 1-hop neighbors correctly (both incoming and outgoing)', () => {
      graph.addNode({ id: '김영자', type: 'person' });
      graph.addNode({ id: '김민수', type: 'person' });
      graph.addNode({ id: '부산', type: 'place' });

      graph.addEdge({ source: '김영자', target: '김민수', type: '자녀' }); // Outgoing from 김영자
      graph.addEdge({ source: '부산', target: '김영자', type: '고향' }); // Incoming to 김영자

      const neighbors = graph.getNeighbors('김영자');
      expect(neighbors.length).toBe(2);

      const targetIds = neighbors.map(n => n.node.id);
      expect(targetIds).toContain('김민수');
      expect(targetIds).toContain('부산');
    });
  });

  describe('Entity Extraction', () => {
    it('should extract registered entities from query string', () => {
      graph.addNode({ id: '김영자', type: 'person' });
      graph.addNode({ id: '부산', type: 'place' });
      graph.addNode({ id: '1970년', type: 'time' });

      const query = '김영자 어르신은 1970년에 부산으로 가셨나요?';
      const entities = extractEntities(query, graph);

      expect(entities.length).toBe(3);
      expect(entities).toContain('김영자');
      expect(entities).toContain('부산');
      expect(entities).toContain('1970년');
    });

    it('should skip very short entities to prevent noise', () => {
      graph.addNode({ id: '김', type: 'person' }); // Too short
      graph.addNode({ id: '김영자', type: 'person' });

      const query = '김영자 어르신';
      const entities = extractEntities(query, graph);

      expect(entities).toContain('김영자');
      expect(entities).not.toContain('김');
    });
  });

  describe('Hybrid Context Builder', () => {
    it('should format a complete hybrid context with vector results and graph relations', () => {
      // Seed graph
      graph.addNode({ id: '김영자', type: 'person' });
      graph.addNode({ id: '김민수', type: 'person' });
      graph.addEdge({ source: '김영자', target: '김민수', type: '자녀' });

      const vectorResults: SearchResult[] = [
        {
          memoryId: 'mem_01',
          score: 0.85,
          text: '김영자는 첫째 아들 김민수가 태어나던 날을 잊을 수 없다. 병원 창밖으로 눈이 내리고 있었다.'
        }
      ];

      const query = '김영자 어르신과 아들 김민수 이야기 들려줘';
      const context = buildHybridContext(query, vectorResults, graph);

      expect(context).toContain('### [Vector RAG Context]');
      expect(context).toContain('[Memory ID: mem_01]');
      expect(context).toContain('Similarity: 85.0%');
      expect(context).toContain('### [Graph RAG Context]');
      expect(context).toContain('Detected Entities: 김영자, 김민수');
      expect(context).toContain('- 김영자 -(자녀)-> 김민수');
    });

    it('should fallback gracefully when no vectors or no graph matches exist', () => {
      const query = '아무도 모르는 이야기';
      const context = buildHybridContext(query, [], graph);

      expect(context).toContain('No relevant memories found in vector search.');
      expect(context).toContain('No entities matching the knowledge graph were detected in the query.');
    });
  });
});
