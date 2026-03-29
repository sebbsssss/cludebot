/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/refs */
import { useEffect, useRef, useCallback } from 'react';
// @ts-expect-error 3d-force-graph callable vs new mismatch
import ForceGraph3D from '3d-force-graph';
import * as THREE from 'three';
import type { MemoryLink } from '../types/memory';

interface GraphNode {
  id: number;
  type: string;
  summary: string;
  content: string;
  tags: string[];
  importance: number;
  decay: number;
  valence: number;
  accessCount: number;
  source: string;
  createdAt: string;
}

interface FGNode extends GraphNode {
  x?: number;
  y?: number;
  z?: number;
  fx?: number | null;
  fy?: number | null;
  fz?: number | null;
}

interface FGLink extends MemoryLink {
  source: any;
  target: any;
}

const TYPE_COLORS_CSS: Record<string, string> = {
  episodic: '#4466ff',
  semantic: '#10b981',
  procedural: '#f59e0b',
  self_model: '#8b5cf6',
};

const LINK_COLORS: Record<string, string> = {
  supports: '#10b981',
  contradicts: '#ef4444',
  elaborates: '#4466ff',
  causes: '#f59e0b',
  follows: '#06b6d4',
  relates: '#333344',
  resolves: '#8b5cf6',
  happens_before: '#a78bfa',
  happens_after: '#a78bfa',
  concurrent_with: '#ec4899',
};

interface SearchResult {
  id: number;
  _score?: number;
  [key: string]: any;
}

interface Props {
  nodes: GraphNode[];
  links: MemoryLink[];
  highlightedIds: Set<number>;
  searchResults: SearchResult[];
  narrativeChain: number[];
  revealQueue: number[]; // IDs revealed one-by-one during streaming
  controlsEnabled: boolean;
  selectedId: number | null;
  onNodeClick: (node: GraphNode) => void;
  onBackgroundClick: () => void;
}

export function MemoryGraph3D({ nodes, links, highlightedIds, searchResults, narrativeChain, revealQueue, controlsEnabled, selectedId, onNodeClick, onBackgroundClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const highlightRef = useRef<Set<number>>(highlightedIds);
  const selectedRef = useRef<number | null>(selectedId);
  const pinnedNodesRef = useRef<Set<number>>(new Set());

  highlightRef.current = highlightedIds;
  selectedRef.current = selectedId;
  const narrativeRef = useRef<number[]>(narrativeChain);
  narrativeRef.current = narrativeChain;
  const revealedCountRef = useRef(0);

  // Initialize graph
  useEffect(() => {
    const container = containerRef.current;
    if (!container || graphRef.current) return;

    // Wait a frame for layout to compute
    requestAnimationFrame(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;

      const graph = ForceGraph3D()(container)
        .width(w)
        .height(h)
        .backgroundColor('rgba(0,0,0,0)')
        .showNavInfo(false)
        .nodeId('id')
        .linkSource('source_id')
        .linkTarget('target_id')
        // ── Nodes ──
        .nodeColor((node: any) => {
          const n = node as FGNode;
          const hl = highlightRef.current;
          const sel = selectedRef.current;
          if (n.id === sel) return '#ffffff'; // selected = white
          if (hl.size > 0 && !hl.has(n.id)) return 'rgba(120,120,140,0.25)'; // dimmed but visible
          return TYPE_COLORS_CSS[n.type] || '#6b7280';
        })
        .nodeVal((node: any) => {
          const n = node as FGNode;
          const sel = selectedRef.current;
          if (n.id === sel) return 4 + n.importance * 12; // selected = bigger
          return 1 + n.importance * 6;
        })
        .nodeOpacity(0.85)
        .nodeResolution(12)
        .nodeLabel((node: any) => {
          const n = node as FGNode;
          const s = n.summary || '';
          return `<div style="max-width:280px;font-size:11px;font-family:monospace;padding:4px 8px;background:rgba(10,10,15,0.92);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:rgba(255,255,255,0.8)">${s.length > 120 ? s.slice(0, 120) + '...' : s}</div>`;
        })
        // ── Links ──
        .linkColor((link: any) => {
          const l = link as FGLink;
          if (l.link_type === '__narrative__') return '#4466ff'; // narrative chain = app blue
          const hl = highlightRef.current;
          if (hl.size > 0) {
            const srcId = typeof l.source === 'object' ? l.source.id : l.source;
            const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
            if (!hl.has(srcId) || !hl.has(tgtId)) return 'rgba(30,30,50,0.02)';
          }
          return LINK_COLORS[l.link_type] || '#222233';
        })
        .linkWidth((link: any) => {
          const l = link as FGLink;
          if (l.link_type === '__narrative__') return 2; // narrative chain
          const hl = highlightRef.current;
          if (hl.size > 0) {
            const srcId = typeof l.source === 'object' ? l.source.id : l.source;
            const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
            if (hl.has(srcId) && hl.has(tgtId)) return 1 + l.strength * 2;
          }
          return 0.2 + l.strength * 0.6;
        })
        .linkOpacity(0.6)
        .linkDirectionalArrowLength((link: any) => {
          return (link as FGLink).link_type === '__narrative__' ? 4 : 0;
        })
        .linkDirectionalArrowRelPos(1)
        .linkDirectionalArrowColor((link: any) => {
          return (link as FGLink).link_type === '__narrative__' ? '#4466ff' : '#6b7280';
        })
        .linkDirectionalParticles((link: any) => {
          const l = link as FGLink;
          if (l.link_type === '__narrative__') return 4; // flowing particles on chain
          const hl = highlightRef.current;
          if (hl.size === 0) return 0;
          const srcId = typeof l.source === 'object' ? l.source.id : l.source;
          const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
          return (hl.has(srcId) && hl.has(tgtId)) ? 2 : 0;
        })
        .linkDirectionalParticleWidth((link: any) => {
          return (link as FGLink).link_type === '__narrative__' ? 3 : 1.5;
        })
        .linkDirectionalParticleSpeed(0.008)
        .linkDirectionalParticleColor((link: any) => {
          const l = link as FGLink;
          if (l.link_type === '__narrative__') return '#7799ff';
          return LINK_COLORS[l.link_type] || '#6b7280';
        })
        // ── Interaction ──
        .onNodeClick((node: any) => onNodeClick(node as GraphNode))
        .onBackgroundClick(() => onBackgroundClick())
        .onNodeHover((node: any) => {
          if (container) container.style.cursor = node ? 'pointer' : 'default';
        })
        .onNodeDragEnd((node: any) => {
          // Keep pinned chain nodes fixed after drag
          const n = node as FGNode;
          if (pinnedNodesRef.current.has(n.id)) {
            n.fx = n.x;
            n.fy = n.y;
            n.fz = n.z;
          }
        })
        .enableNodeDrag(true)
        // ── Physics ──
        .d3AlphaDecay(0.02)
        .d3VelocityDecay(0.3)
        .warmupTicks(80)
        .cooldownTime(4000);

      // Tune forces
      const charge = graph.d3Force('charge');
      if (charge && typeof charge.strength === 'function') {
        charge.strength(-40);
      }
      const link = graph.d3Force('link');
      if (link && typeof link.distance === 'function') {
        link.distance(30);
      }

      // Add fog for depth
      const scene = graph.scene();
      scene.fog = new THREE.FogExp2(0x0a0a0f, 0.003);

      // Ambient dust particles
      const dustGeo = new THREE.BufferGeometry();
      const dustPos = new Float32Array(400 * 3);
      for (let i = 0; i < 400; i++) {
        dustPos[i * 3] = (Math.random() - 0.5) * 500;
        dustPos[i * 3 + 1] = (Math.random() - 0.5) * 500;
        dustPos[i * 3 + 2] = (Math.random() - 0.5) * 500;
      }
      dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
      const dustMat = new THREE.PointsMaterial({
        size: 0.4,
        color: 0x334466,
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      scene.add(new THREE.Points(dustGeo, dustMat));

      graphRef.current = graph;

      // Set initial data if available
      if (nodes.length > 0) {
        graph.graphData({
          nodes: nodes.map(n => ({ ...n })),
          links: links.map(l => ({ ...l })),
        });
      }
    });

    const handleResize = () => {
      if (graphRef.current && container) {
        graphRef.current.width(container.clientWidth);
        graphRef.current.height(container.clientHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (graphRef.current) {
        graphRef.current._destructor();
        graphRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update data when nodes/links/chain change
  useEffect(() => {
    if (!graphRef.current || nodes.length === 0) return;

    // Build narrative chain links (directional, bright)
    const chainLinks: any[] = [];
    for (let i = 0; i < narrativeChain.length - 1; i++) {
      chainLinks.push({
        source_id: narrativeChain[i],
        target_id: narrativeChain[i + 1],
        link_type: '__narrative__',
        strength: 1,
      });
    }

    graphRef.current.graphData({
      nodes: nodes.map(n => ({ ...n })),
      links: [...links.map(l => ({ ...l })), ...chainLinks],
    });
  }, [nodes, links, narrativeChain]);

  // Refresh visuals on search change
  useEffect(() => {
    if (!graphRef.current) return;
    const g = graphRef.current;
    g.nodeColor(g.nodeColor())
     .linkColor(g.linkColor())
     .linkWidth(g.linkWidth())
     .linkDirectionalParticles(g.linkDirectionalParticles())
     .refresh();
  }, [highlightedIds]);

  // ── Search chain: pin results in narrative order horizontally ──
  const arrangeChain = useCallback(() => {
    if (!graphRef.current) return;
    const chain = narrativeRef.current;
    if (chain.length === 0) return;
    const g = graphRef.current;
    const graphData = g.graphData();

    // Use narrative chain order (as LLM referenced them)
    const ids = new Set(chain);

    // Horizontal layout along X axis, centered at origin, fixed Y=0
    const spacing = 30;
    const totalWidth = (chain.length - 1) * spacing;
    const startX = -totalWidth / 2;

    for (const node of graphData.nodes) {
      const n = node as FGNode;
      if (ids.has(n.id)) {
        const idx = chain.indexOf(n.id);
        n.fx = startX + idx * spacing;
        n.fy = 0; // flat horizontal plane
        n.fz = 0;
        pinnedNodesRef.current.add(n.id);
      } else if (pinnedNodesRef.current.has(n.id)) {
        n.fx = null; n.fy = null; n.fz = null;
        pinnedNodesRef.current.delete(n.id);
      }
    }

    g.d3ReheatSimulation();

    // Camera: pull back enough to see the full chain comfortably
    const viewDist = Math.max(totalWidth * 1.5, 200);
    g.cameraPosition(
      { x: 0, y: viewDist * 0.4, z: viewDist * 0.7 }, // further back, slightly above
      { x: 0, y: 0, z: 0 },
      1200,
    );
  }, []);

  const releaseChain = useCallback(() => {
    if (!graphRef.current) return;
    const graphData = graphRef.current.graphData();
    for (const node of graphData.nodes) {
      const n = node as FGNode;
      if (pinnedNodesRef.current.has(n.id)) {
        n.fx = null; n.fy = null; n.fz = null;
      }
    }
    pinnedNodesRef.current.clear();
    graphRef.current.d3ReheatSimulation();
  }, []);

  useEffect(() => {
    if (!graphRef.current) return;
    if (searchResults.length > 0) {
      setTimeout(() => arrangeChain(), 300);
    } else {
      releaseChain();
    }
  }, [searchResults, arrangeChain, releaseChain]);

  // ── Reveal nodes one-by-one during streaming ──
  useEffect(() => {
    if (!graphRef.current || revealQueue.length === 0) return;
    if (revealQueue.length <= revealedCountRef.current) return;

    const g = graphRef.current;
    const graphData = g.graphData();
    const spacing = 30;

    // Process each new ID that hasn't been revealed yet
    for (let i = revealedCountRef.current; i < revealQueue.length; i++) {
      const id = revealQueue[i];
      const node = graphData.nodes.find((n: any) => n.id === id) as FGNode | undefined;
      if (!node) continue;

      const idx = i;
      const totalWidth = (revealQueue.length - 1) * spacing;
      const targetX = -totalWidth / 2 + idx * spacing;

      // Pin node to its chain position
      node.fx = targetX;
      node.fy = 0;
      node.fz = 0;
      pinnedNodesRef.current.add(id);
    }

    revealedCountRef.current = revealQueue.length;

    // Rebuild narrative links for revealed nodes so far
    const chainLinks: any[] = [];
    for (let i = 0; i < revealQueue.length - 1; i++) {
      chainLinks.push({
        source_id: revealQueue[i],
        target_id: revealQueue[i + 1],
        link_type: '__narrative__',
        strength: 1,
      });
    }

    // Update graph with new chain links
    g.graphData({
      nodes: graphData.nodes,
      links: [...links.map(l => ({ ...l })), ...chainLinks],
    });

    // Refresh visuals
    g.nodeColor(g.nodeColor())
     .linkColor(g.linkColor())
     .linkWidth(g.linkWidth())
     .linkDirectionalParticles(g.linkDirectionalParticles())
     .linkDirectionalArrowLength(g.linkDirectionalArrowLength())
     .refresh();

    // Camera: pull back to see growing chain
    const totalWidth = Math.max((revealQueue.length - 1) * spacing, 30);
    const viewDist = Math.max(totalWidth * 1.5, 150);
    g.cameraPosition(
      { x: 0, y: viewDist * 0.3, z: viewDist * 0.6 },
      { x: 0, y: 0, z: 0 },
      800,
    );
  }, [revealQueue, links]);

  // ── Toggle orbit controls ──
  useEffect(() => {
    if (!graphRef.current) return;
    const controls = graphRef.current.controls();
    if (controls) {
      controls.enabled = controlsEnabled;
    }
  }, [controlsEnabled]);

  // ── Reset reveal counter when chain is cleared ──
  useEffect(() => {
    if (revealQueue.length === 0) {
      revealedCountRef.current = 0;
    }
  }, [revealQueue]);

  // Focus on selected node + refresh visuals
  useEffect(() => {
    if (!graphRef.current) return;
    const g = graphRef.current;
    // Refresh colors/sizes to reflect new selection
    g.nodeColor(g.nodeColor())
     .nodeVal(g.nodeVal())
     .refresh();

    if (!selectedId) return;
    const graphData = g.graphData();
    const node = graphData.nodes.find((n: any) => n.id === selectedId);
    if (!node) return;
    g.cameraPosition(
      { x: (node.x || 0) + 50, y: (node.y || 0) + 30, z: (node.z || 0) + 50 },
      { x: node.x || 0, y: node.y || 0, z: node.z || 0 },
      800,
    );
  }, [selectedId]);

  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
    />
  );
}
