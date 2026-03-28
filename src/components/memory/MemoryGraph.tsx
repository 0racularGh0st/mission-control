"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { MemoryEntry, MemoryEdge, MemoryType } from "@/src/types/memory";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GraphNode {
  id: string;
  name: string;
  memType: MemoryType;
  topics: string[];
  // Simulation state
  x: number;
  y: number;
  vx: number;
  vy: number;
  // Derived
  connections: number;
}

interface GraphEdgeInternal {
  source: string;
  target: string;
  edgeType: string;
  weight: number;
  label: string;
}

// ---------------------------------------------------------------------------
// Color / style helpers
// ---------------------------------------------------------------------------

const TYPE_COLORS: Record<MemoryType, string> = {
  user: "#38bdf8",      // sky-400
  feedback: "#fbbf24",  // amber-400
  project: "#34d399",   // emerald-400
  reference: "#a78bfa", // violet-400
};

const EDGE_STYLE: Record<string, { color: string; dash: number[] }> = {
  shared_topic: { color: "rgba(56,189,248,0.35)", dash: [] },
  reference: { color: "rgba(167,139,250,0.35)", dash: [6, 3] },
  same_agent: { color: "rgba(148,163,184,0.18)", dash: [2, 4] },
  temporal: { color: "rgba(148,163,184,0.12)", dash: [1, 6] },
};

// ---------------------------------------------------------------------------
// Force simulation
// ---------------------------------------------------------------------------

const REPULSION = 3000;
const ATTRACTION = 0.008;
const DAMPING = 0.88;
const CENTER_GRAVITY = 0.01;
const MIN_NODE_RADIUS = 8;
const MAX_NODE_RADIUS = 22;

function runSimulationStep(nodes: GraphNode[], edges: GraphEdgeInternal[], width: number, height: number) {
  const cx = width / 2;
  const cy = height / 2;

  // Repulsion between all node pairs
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = REPULSION / (dist * dist);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }
  }

  // Build id->node lookup
  const nodeMap = new Map<string, GraphNode>();
  for (const n of nodes) nodeMap.set(n.id, n);

  // Attraction along edges
  for (const edge of edges) {
    const a = nodeMap.get(edge.source);
    const b = nodeMap.get(edge.target);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const force = dist * ATTRACTION * edge.weight;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    a.vx += fx;
    a.vy += fy;
    b.vx -= fx;
    b.vy -= fy;
  }

  // Center gravity + velocity update
  for (const n of nodes) {
    n.vx += (cx - n.x) * CENTER_GRAVITY;
    n.vy += (cy - n.y) * CENTER_GRAVITY;
    n.vx *= DAMPING;
    n.vy *= DAMPING;
    n.x += n.vx;
    n.y += n.vy;
    // Clamp to canvas
    n.x = Math.max(30, Math.min(width - 30, n.x));
    n.y = Math.max(30, Math.min(height - 30, n.y));
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface MemoryGraphProps {
  entries: MemoryEntry[];
  edges: MemoryEdge[];
  selectedId: string | null;
  onSelect: (entry: MemoryEntry) => void;
}

export function MemoryGraph({ entries, edges, selectedId, onSelect }: MemoryGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdgeInternal[]>([]);
  const animRef = useRef<number>(0);
  const [size, setSize] = useState({ width: 800, height: 500 });

  // Track entries as graph nodes
  useEffect(() => {
    // Count connections per node
    const connCount = new Map<string, number>();
    for (const e of edges) {
      connCount.set(e.sourceId, (connCount.get(e.sourceId) ?? 0) + 1);
      connCount.set(e.targetId, (connCount.get(e.targetId) ?? 0) + 1);
    }

    // Preserve existing positions for nodes that already exist
    const existingMap = new Map<string, GraphNode>();
    for (const n of nodesRef.current) existingMap.set(n.id, n);

    const w = size.width;
    const h = size.height;

    nodesRef.current = entries.map((entry) => {
      const existing = existingMap.get(entry.id);
      return {
        id: entry.id,
        name: entry.name,
        memType: entry.memType,
        topics: entry.topics,
        x: existing?.x ?? w / 2 + (Math.random() - 0.5) * w * 0.6,
        y: existing?.y ?? h / 2 + (Math.random() - 0.5) * h * 0.6,
        vx: existing?.vx ?? 0,
        vy: existing?.vy ?? 0,
        connections: connCount.get(entry.id) ?? 0,
      };
    });

    edgesRef.current = edges.map((e) => ({
      source: e.sourceId,
      target: e.targetId,
      edgeType: e.edgeType,
      weight: e.weight,
      label: e.label,
    }));
  }, [entries, edges, size]);

  // ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setSize({ width: Math.floor(width), height: Math.floor(height) });
        }
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let running = true;
    const maxConnections = Math.max(1, ...nodesRef.current.map((n) => n.connections));

    function draw() {
      if (!running || !ctx) return;
      const { width, height } = size;
      ctx.clearRect(0, 0, width, height);

      const nodes = nodesRef.current;
      const graphEdges = edgesRef.current;

      runSimulationStep(nodes, graphEdges, width, height);

      // Build id->node lookup
      const nodeMap = new Map<string, GraphNode>();
      for (const n of nodes) nodeMap.set(n.id, n);

      // Draw edges
      for (const edge of graphEdges) {
        const a = nodeMap.get(edge.source);
        const b = nodeMap.get(edge.target);
        if (!a || !b) continue;
        const style = EDGE_STYLE[edge.edgeType] ?? EDGE_STYLE.temporal;
        ctx.beginPath();
        ctx.setLineDash(style.dash);
        ctx.strokeStyle = style.color;
        ctx.lineWidth = 1;
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw nodes
      for (const node of nodes) {
        const radius = MIN_NODE_RADIUS + (node.connections / maxConnections) * (MAX_NODE_RADIUS - MIN_NODE_RADIUS);
        const color = TYPE_COLORS[node.memType] ?? TYPE_COLORS.project;
        const isSelected = node.id === selectedId;

        // Glow for selected
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius + 4, 0, Math.PI * 2);
          ctx.fillStyle = color.replace(")", ",0.2)").replace("rgb", "rgba");
          ctx.fill();
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? color : color.replace(")", ",0.7)").replace("rgb", "rgba");
        ctx.fill();
        ctx.strokeStyle = isSelected ? color : "rgba(148,163,184,0.3)";
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.stroke();

        // Label
        ctx.fillStyle = "rgba(226,232,240,0.85)";
        ctx.font = `${isSelected ? "bold " : ""}11px ui-monospace, monospace`;
        ctx.textAlign = "center";
        ctx.fillText(
          node.name.length > 18 ? node.name.slice(0, 16) + "\u2026" : node.name,
          node.x,
          node.y + radius + 14,
        );
      }

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
    };
  }, [size, selectedId]);

  // Click handler
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const maxConnections = Math.max(1, ...nodesRef.current.map((n) => n.connections));

      for (const node of nodesRef.current) {
        const radius = MIN_NODE_RADIUS + (node.connections / maxConnections) * (MAX_NODE_RADIUS - MIN_NODE_RADIUS);
        const dx = node.x - x;
        const dy = node.y - y;
        if (dx * dx + dy * dy <= (radius + 4) * (radius + 4)) {
          const entry = entries.find((en) => en.id === node.id);
          if (entry) onSelect(entry);
          return;
        }
      }
    },
    [entries, onSelect],
  );

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border/60 bg-background/20 px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">No memory nodes to display.</p>
        <p className="mt-1 text-xs text-muted-foreground/60">Run a scan to discover agent memories.</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-[500px] w-full rounded-md border border-border/60 bg-background/20 overflow-hidden">
      <canvas
        ref={canvasRef}
        width={size.width}
        height={size.height}
        className="cursor-crosshair"
        onClick={handleClick}
      />
      {/* Legend */}
      <div className="absolute bottom-3 left-3 flex gap-3 text-[10px] text-muted-foreground">
        {(Object.entries(TYPE_COLORS) as [MemoryType, string][]).map(([type, color]) => (
          <span key={type} className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
            {type}
          </span>
        ))}
      </div>
    </div>
  );
}
