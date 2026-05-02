import { useEffect, useMemo, useRef, useState } from 'react';
import {
  GRAPH_NODES as MOCK_GRAPH_NODES,
  GRAPH_EDGES as MOCK_GRAPH_EDGES,
  TOPICS as MOCK_TOPICS,
  CLUSTER_COLORS,
  CLUSTER_LABELS,
  BOND_COLORS,
  type GraphNode,
  type GraphEdge,
  type Cluster,
  type BondKind,
  type Topic,
} from './wiki-data';

export type GraphLayout = 'force' | 'tree' | 'grid';

interface GraphTabProps {
  layout?: GraphLayout;
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  topics?: Topic[];
}

export function GraphTab({ layout = 'force', nodes, edges, topics }: GraphTabProps) {
  const graphNodes = nodes && nodes.length > 0 ? nodes : MOCK_GRAPH_NODES;
  const graphEdges = edges && edges.length > 0 ? edges : MOCK_GRAPH_EDGES;
  const topicList = topics && topics.length > 0 ? topics : MOCK_TOPICS;

  const initialSelected = graphNodes[0]?.id ?? null;
  const [selected, setSelected] = useState<string | null>(initialSelected);
  const [hovered, setHovered] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const positioned = useMemo(
    () => computeLayout(graphNodes, graphEdges, layout),
    [graphNodes, graphEdges, layout],
  );

  const sel = selected ? positioned.find((n) => n.id === selected) ?? null : null;

  const neighborIds = useMemo(() => {
    if (!selected) return new Set<string>();
    return new Set(
      graphEdges
        .filter((e) => e.source === selected || e.target === selected)
        .map((e) => (e.source === selected ? e.target : e.source)),
    );
  }, [selected, graphEdges]);

  // Non-passive wheel handler so we can preventDefault and zoom in place
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.92 : 1.08;
      setZoom((z) => Math.max(0.4, Math.min(3, z * delta)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setPan({ x: dragRef.current.panX + dx, y: dragRef.current.panY + dy });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
  };

  return (
    <div className="wk-graph">
      <div
        ref={canvasRef}
        className="wk-graph__canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <svg className="wk-graph__svg" viewBox="0 0 1000 720" preserveAspectRatio="xMidYMid meet">
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {graphEdges.map((e, i) => {
              const a = positioned.find((n) => n.id === e.source);
              const b = positioned.find((n) => n.id === e.target);
              if (!a || !b) return null;
              const isActive = e.source === selected || e.target === selected;
              const isHovered = hovered != null && (e.source === hovered || e.target === hovered);
              return (
                <line
                  key={i}
                  className={`wk-graph__edge ${isActive ? 'is-active' : ''}`}
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={BOND_COLORS[e.kind]}
                  strokeWidth={Math.max(0.5, e.weight * 2.4) * (isActive || isHovered ? 1.6 : 1)}
                  strokeOpacity={isActive ? 0.9 : (selected ? 0.18 : 0.45)}
                  strokeDasharray={e.kind === 'contradicts' ? '4 3' : '0'}
                />
              );
            })}

            {positioned.map((n) => {
              const isSelected = n.id === selected;
              const isNeighbor = neighborIds.has(n.id);
              const dim = selected != null && !isSelected && !isNeighbor;
              const color = CLUSTER_COLORS[n.cluster];
              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x}, ${n.y})`}
                  style={{ opacity: dim ? 0.32 : 1, transition: 'opacity 180ms ease' }}
                  onMouseEnter={() => setHovered(n.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setSelected(n.id);
                  }}
                >
                  {isSelected && (
                    <circle r={n.r + 10} fill="none" stroke={color} strokeWidth="1" strokeOpacity="0.4" strokeDasharray="2 3" />
                  )}
                  <circle
                    className="wk-graph__node-circle"
                    r={n.r}
                    fill={n.kind === 'entity' ? 'var(--bg)' : color}
                    stroke={color}
                    strokeWidth={isSelected ? 3 : (isNeighbor ? 2 : 1.5)}
                  />
                  {n.kind === 'entity' && (
                    <text
                      textAnchor="middle"
                      dy="4"
                      style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, fill: color }}
                    >
                      {n.label.charAt(0).toUpperCase()}
                    </text>
                  )}
                  <text className="wk-graph__node-label" textAnchor="middle" dy={n.r + 14}>
                    {n.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        <div className="wk-graph__overlay">
          <div className="wk-graph__chip">
            <span className="wk-cdot" style={{ background: '#10b981', width: 8, height: 8, borderRadius: '50%' }} />
            <span>{positioned.length} NODES · {graphEdges.length} EDGES</span>
          </div>
          <div className="wk-graph__chip">
            <span style={{ opacity: 0.6 }}>LAYOUT</span>
            <span style={{ color: 'var(--text)' }}>{layout.toUpperCase()}</span>
          </div>
        </div>

        <div className="wk-graph__legend">
          {(Object.entries(CLUSTER_COLORS) as [Cluster, string][]).map(([k, c]) => (
            <div key={k} className="wk-graph__legend-row">
              <span className="wk-cdot" style={{ background: c, width: 8, height: 8, borderRadius: '50%' }} />
              <span>{CLUSTER_LABELS[k]}</span>
            </div>
          ))}
        </div>

        <div className="wk-graph__zoom">
          <button onClick={() => setZoom((z) => Math.min(3, z * 1.2))} title="Zoom in">+</button>
          <button onClick={() => setZoom((z) => Math.max(0.4, z * 0.85))} title="Zoom out">−</button>
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} title="Reset">◎</button>
        </div>
      </div>

      {sel && (
        <GraphSide
          node={sel}
          edges={graphEdges}
          positioned={positioned}
          topics={topicList}
          onSelect={setSelected}
        />
      )}
    </div>
  );
}

function GraphSide({
  node, edges, positioned, topics, onSelect,
}: {
  node: GraphNode;
  edges: GraphEdge[];
  positioned: GraphNode[];
  topics: Topic[];
  onSelect: (id: string) => void;
}) {
  const matchedTopic = topics.find((t) => t.id === node.id);
  const summary = matchedTopic?.summary ?? 'Entity in the brain map.';
  const sources = matchedTopic?.count ?? node.weight;
  const color = CLUSTER_COLORS[node.cluster];

  const neighbors = edges
    .filter((e) => e.source === node.id || e.target === node.id)
    .map((e) => ({
      id: e.source === node.id ? e.target : e.source,
      bond: e.kind,
      weight: e.weight,
    }))
    .sort((a, b) => b.weight - a.weight);

  return (
    <div className="wk-graph__side">
      <div>
        <div className="wk-eyebrow" style={{ marginBottom: 8 }}>
          {CLUSTER_LABELS[node.cluster]} · {node.kind === 'entity' ? 'Entity' : 'Topic'}
        </div>
        <h3 className="wk-graph__sel-title">
          <span className="wk-cdot" style={{ background: color, width: 12, height: 12, borderRadius: '50%' }} />
          {matchedTopic?.name ?? node.label}
        </h3>
        <div className="wk-graph__sel-meta">
          <span>{sources} sources</span>
          <span style={{ color: 'var(--text-faint)' }}>·</span>
          <span>degree {neighbors.length}</span>
        </div>
        <div className="wk-graph__sel-summary">{summary}</div>
        <button className="wk-mini-btn wk-mini-btn--brand" style={{ width: '100%', padding: 8 }}>
          Open in Wiki →
        </button>
      </div>

      <div>
        <div className="wk-eyebrow" style={{ marginBottom: 10 }}>Connections · {neighbors.length}</div>
        <div className="wk-graph__neighbors">
          {neighbors.map((n) => {
            const target = positioned.find((p) => p.id === n.id);
            if (!target) return null;
            return (
              <div key={n.id} className="wk-graph__neighbor" onClick={() => onSelect(n.id)}>
                <span className="wk-cdot" style={{ background: CLUSTER_COLORS[target.cluster], width: 8, height: 8, borderRadius: '50%' }} />
                <span className="wk-graph__neighbor-name">{target.label}</span>
                <span className="wk-graph__neighbor-bond" style={{ color: BOND_COLORS[n.bond] }}>
                  {n.bond}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div className="wk-eyebrow" style={{ marginBottom: 10 }}>Bond legend</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {(Object.entries(BOND_COLORS) as [BondKind, string][]).map(([k, c]) => (
            <div key={k} className="wk-graph__bond-legend">
              <span className="wk-graph__bond-legend-line" style={{ background: c }} />
              <span style={{ letterSpacing: '0.06em' }}>{k}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────── Layout algorithms ───────────

function computeLayout(nodes: GraphNode[], edges: GraphEdge[], kind: GraphLayout): GraphNode[] {
  if (kind === 'tree') return treeLayout(nodes);
  if (kind === 'grid') return gridLayout(nodes);
  return forceLayout(nodes, edges);
}

function forceLayout(nodes: GraphNode[], edges: GraphEdge[]): GraphNode[] {
  const W = 1000;
  const H = 720;
  // Clone positions; keep velocities in parallel arrays so the GraphNode shape stays clean.
  const out = nodes.map((node) => ({ ...node }));
  const vx = new Float32Array(out.length);
  const vy = new Float32Array(out.length);
  const idx = new Map(out.map((node, i) => [node.id, i]));

  for (let step = 0; step < 90; step++) {
    // repulsion
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i];
        const b = out[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist2 = dx * dx + dy * dy + 0.01;
        const dist = Math.sqrt(dist2);
        const force = 4200 / dist2;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        vx[i] += fx; vy[i] += fy;
        vx[j] -= fx; vy[j] -= fy;
      }
    }
    // attraction along edges
    for (const e of edges) {
      const ai = idx.get(e.source);
      const bi = idx.get(e.target);
      if (ai == null || bi == null) continue;
      const a = out[ai];
      const b = out[bi];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;
      const target = 130;
      const k = (dist - target) * 0.04 * (e.weight + 0.4);
      const fx = (dx / dist) * k;
      const fy = (dy / dist) * k;
      vx[ai] += fx; vy[ai] += fy;
      vx[bi] -= fx; vy[bi] -= fy;
    }
    for (let i = 0; i < out.length; i++) {
      vx[i] *= 0.6; vy[i] *= 0.6;
      out[i].x = Math.max(60, Math.min(W - 60, out[i].x + vx[i]));
      out[i].y = Math.max(60, Math.min(H - 60, out[i].y + vy[i]));
    }
  }
  return out;
}

function treeLayout(nodes: GraphNode[]): GraphNode[] {
  const centers: Record<Cluster, { x: number; y: number }> = {
    architecture: { x: 320, y: 280 },
    research:     { x: 720, y: 280 },
    product:      { x: 320, y: 520 },
    self:         { x: 720, y: 520 },
  };
  const grouped: Record<string, GraphNode[]> = {};
  nodes.forEach((n) => {
    (grouped[n.cluster] = grouped[n.cluster] || []).push(n);
  });

  const out: GraphNode[] = [];
  for (const [cluster, list] of Object.entries(grouped) as [Cluster, GraphNode[]][]) {
    const c = centers[cluster];
    list.forEach((n, i) => {
      if (i === 0) {
        out.push({ ...n, x: c.x, y: c.y });
      } else {
        const angle = (i / Math.max(1, list.length - 1)) * Math.PI * 2;
        const radius = 110;
        out.push({ ...n, x: c.x + Math.cos(angle) * radius, y: c.y + Math.sin(angle) * radius });
      }
    });
  }
  return out;
}

function gridLayout(nodes: GraphNode[]): GraphNode[] {
  const grouped: Record<string, GraphNode[]> = {};
  nodes.forEach((n) => {
    (grouped[n.cluster] = grouped[n.cluster] || []).push(n);
  });
  const out: GraphNode[] = [];
  const order: Cluster[] = ['architecture', 'research', 'product', 'self'];
  let rowOffset = 0;
  for (const cluster of order) {
    const list = grouped[cluster] || [];
    list.forEach((n, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      out.push({ ...n, x: 200 + col * 200, y: 130 + (rowOffset + row) * 150 });
    });
    rowOffset += Math.ceil(list.length / 4);
  }
  return out;
}
