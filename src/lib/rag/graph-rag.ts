import type { SearchResult } from '../types';

export interface GraphNode {
  id: string; // unique entity name/id, e.g., "김영자"
  type: 'person' | 'place' | 'time' | 'event' | 'object' | string;
  description?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string; // e.g., "자녀", "고향", "결혼"
}

export class KnowledgeGraph {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: GraphEdge[] = [];

  addNode(node: GraphNode): void {
    this.nodes.set(node.id.toLowerCase(), node);
  }

  addEdge(edge: GraphEdge): void {
    const srcLower = edge.source.toLowerCase();
    const tgtLower = edge.target.toLowerCase();
    
    // Auto-create nodes if they don't exist
    if (!this.nodes.has(srcLower)) {
      this.addNode({ id: edge.source, type: 'unknown' });
    }
    if (!this.nodes.has(tgtLower)) {
      this.addNode({ id: edge.target, type: 'unknown' });
    }
    
    // Prevent duplicate edges
    const exists = this.edges.some(
      e => e.source.toLowerCase() === srcLower && 
           e.target.toLowerCase() === tgtLower && 
           e.type === edge.type
    );
    if (!exists) {
      this.edges.push(edge);
    }
  }

  getNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  getEdges(): GraphEdge[] {
    return this.edges;
  }

  findNode(id: string): GraphNode | undefined {
    return this.nodes.get(id.toLowerCase());
  }

  /**
   * Finds 1-hop neighbors of a given node.
   * Returns matching edges and the neighboring nodes.
   */
  getNeighbors(nodeId: string): { edge: GraphEdge; node: GraphNode }[] {
    const lowerId = nodeId.toLowerCase();
    const neighbors: { edge: GraphEdge; node: GraphNode }[] = [];

    for (const edge of this.edges) {
      const srcLower = edge.source.toLowerCase();
      const tgtLower = edge.target.toLowerCase();

      if (srcLower === lowerId) {
        const neighborNode = this.nodes.get(tgtLower);
        if (neighborNode) {
          neighbors.push({ edge, node: neighborNode });
        }
      } else if (tgtLower === lowerId) {
        const neighborNode = this.nodes.get(srcLower);
        if (neighborNode) {
          neighbors.push({ edge, node: neighborNode });
        }
      }
    }

    return neighbors;
  }

  clear(): void {
    this.nodes.clear();
    this.edges = [];
  }
}

/**
 * Extracts entities present in the query based on nodes registered in the graph.
 */
export function extractEntities(query: string, graph: KnowledgeGraph): string[] {
  const queryLower = query.toLowerCase();
  const matched: string[] = [];
  
  for (const node of graph.getNodes()) {
    if (node.id.length >= 2 && queryLower.includes(node.id.toLowerCase())) {
      matched.push(node.id);
    }
  }
  
  return matched;
}

/**
 * Formats a 1-hop relationship into a readable string.
 */
export function formatEdge(edge: GraphEdge): string {
  return `- ${edge.source} -(${edge.type})-> ${edge.target}`;
}

/**
 * Combines Vector Search results with Graph RAG 1-hop relationship context.
 */
export function buildHybridContext(
  query: string,
  vectorResults: SearchResult[],
  graph: KnowledgeGraph
): string {
  const matchedEntities = extractEntities(query, graph);
  
  // Collect 1-hop edges for all matched entities
  const relevantEdgesMap = new Map<string, GraphEdge>();
  
  for (const entity of matchedEntities) {
    const neighbors = graph.getNeighbors(entity);
    for (const { edge } of neighbors) {
      // Create a unique key for the edge to avoid duplicates
      const key = [
        edge.source.toLowerCase(),
        edge.target.toLowerCase(),
        edge.type
      ].sort().join('::');
      relevantEdgesMap.set(key, edge);
    }
  }
  
  const relevantEdges = Array.from(relevantEdgesMap.values());

  const sections: string[] = [];

  sections.push('### [Vector RAG Context]');
  if (vectorResults.length > 0) {
    vectorResults.forEach((res, idx) => {
      sections.push(`${idx + 1}. [Memory ID: ${res.memoryId}] (Similarity: ${(res.score * 100).toFixed(1)}%)`);
      sections.push(res.text);
      sections.push('');
    });
  } else {
    sections.push('No relevant memories found in vector search.');
    sections.push('');
  }

  sections.push('### [Graph RAG Context]');
  if (matchedEntities.length > 0) {
    sections.push(`Detected Entities: ${matchedEntities.join(', ')}`);
    if (relevantEdges.length > 0) {
      sections.push('Relationships:');
      relevantEdges.forEach(edge => {
        sections.push(formatEdge(edge));
      });
    } else {
      sections.push('No direct relationships found for detected entities.');
    }
  } else {
    sections.push('No entities matching the knowledge graph were detected in the query.');
  }

  return sections.join('\n').trim();
}
