'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Activity,
  Car,
  GitBranch,
  Maximize2,
  Minimize2,
  RefreshCw,
  Search,
  User,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { entitiesApi, intelligenceApi } from '@/lib/api';
import type { EntityGraph, GraphNode, GraphEdge, EntityProfile } from '@/types';

interface NodePosition {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export default function GraphExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [profiles, setProfiles] = useState<EntityProfile[]>([]);
  const [graph, setGraph] = useState<EntityGraph | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<string>('');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const positionsRef = useRef<Map<string, NodePosition>>(new Map());
  const animFrameRef = useRef<number>(0);
  const isDragging = useRef(false);
  const dragNode = useRef<string | null>(null);
  const lastMouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const profs = await intelligenceApi.listProfiles({ limit: 50 }).catch(() => []);
        setProfiles(profs);
      } catch {
        // API not available
      } finally {
        setLoading(false);
      }
    };
    fetchProfiles();
  }, []);

  const loadGraph = useCallback(async (entityId: string) => {
    if (!entityId) return;
    setLoading(true);
    try {
      const g = await entitiesApi.getGraph(entityId, 2);
      setGraph(g);

      // Initialize positions with force-directed layout seed
      const positions = new Map<string, NodePosition>();
      const cx = 400;
      const cy = 300;
      g.nodes.forEach((node, i) => {
        const angle = (2 * Math.PI * i) / g.nodes.length;
        const radius = 120 + Math.random() * 80;
        positions.set(node.id, {
          x: cx + radius * Math.cos(angle),
          y: cy + radius * Math.sin(angle),
          vx: 0,
          vy: 0,
        });
      });
      positionsRef.current = positions;
    } catch {
      setGraph({ nodes: [], edges: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedEntity) {
      loadGraph(selectedEntity);
    }
  }, [selectedEntity, loadGraph]);

  // Force-directed layout simulation
  const simulate = useCallback(() => {
    if (!graph || graph.nodes.length === 0) return;
    const positions = positionsRef.current;
    const k = 50; // spring constant
    const repulsion = 5000;
    const damping = 0.85;
    const cx = 400;
    const cy = 300;

    // Repulsion between all nodes
    for (const nodeA of graph.nodes) {
      const posA = positions.get(nodeA.id);
      if (!posA) continue;
      for (const nodeB of graph.nodes) {
        if (nodeA.id === nodeB.id) continue;
        const posB = positions.get(nodeB.id);
        if (!posB) continue;

        const dx = posA.x - posB.x;
        const dy = posA.y - posB.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = repulsion / (dist * dist);
        posA.vx += (dx / dist) * force;
        posA.vy += (dy / dist) * force;
      }
    }

    // Attraction along edges
    for (const edge of graph.edges) {
      const posS = positions.get(edge.source);
      const posT = positions.get(edge.target);
      if (!posS || !posT) continue;

      const dx = posT.x - posS.x;
      const dy = posT.y - posS.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const force = (dist - k) * 0.01;
      posS.vx += (dx / dist) * force;
      posS.vy += (dy / dist) * force;
      posT.vx -= (dx / dist) * force;
      posT.vy -= (dy / dist) * force;
    }

    // Center gravity
    for (const node of graph.nodes) {
      const pos = positions.get(node.id);
      if (!pos) continue;
      pos.vx += (cx - pos.x) * 0.001;
      pos.vy += (cy - pos.y) * 0.001;
      pos.vx *= damping;
      pos.vy *= damping;
      if (dragNode.current !== node.id) {
        pos.x += pos.vx;
        pos.y += pos.vy;
      }
    }
  }, [graph]);

  // Canvas rendering
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !graph) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const positions = positionsRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);

    // Draw edges
    for (const edge of graph.edges) {
      const posS = positions.get(edge.source);
      const posT = positions.get(edge.target);
      if (!posS || !posT) continue;

      const weight = Number(edge.properties.weight || edge.properties.count || 1);
      const lineWidth = Math.min(Math.max(weight * 0.5, 0.5), 4);

      ctx.beginPath();
      ctx.moveTo(posS.x, posS.y);
      ctx.lineTo(posT.x, posT.y);
      ctx.strokeStyle = edge.type === 'CO_OCCURRED_WITH'
        ? 'rgba(139, 92, 246, 0.4)'
        : edge.type === 'SEEN_AT'
        ? 'rgba(59, 130, 246, 0.4)'
        : 'rgba(107, 114, 128, 0.3)';
      ctx.lineWidth = lineWidth;
      ctx.stroke();

      // Edge label
      if (edge.type) {
        const mx = (posS.x + posT.x) / 2;
        const my = (posS.y + posT.y) / 2;
        ctx.fillStyle = 'rgba(156, 163, 175, 0.6)';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(edge.type.replace(/_/g, ' '), mx, my - 4);
      }
    }

    // Draw nodes
    for (const node of graph.nodes) {
      const pos = positions.get(node.id);
      if (!pos) continue;

      const isEntity = node.labels.includes('Entity');
      const isLocation = node.labels.includes('Location');
      const isSelected = selectedNode?.id === node.id;
      const radius = isSelected ? 18 : isEntity ? 14 : 10;

      // Node circle
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = isSelected
        ? 'rgba(0, 255, 157, 0.3)'
        : isEntity
        ? 'rgba(0, 255, 157, 0.15)'
        : isLocation
        ? 'rgba(59, 130, 246, 0.15)'
        : 'rgba(139, 92, 246, 0.15)';
      ctx.fill();
      ctx.strokeStyle = isSelected
        ? '#00ff9d'
        : isEntity
        ? 'rgba(0, 255, 157, 0.6)'
        : isLocation
        ? 'rgba(59, 130, 246, 0.6)'
        : 'rgba(139, 92, 246, 0.6)';
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.stroke();

      // Node label
      const label = String(
        node.properties.entity_id || node.properties.name || node.properties.location_name || node.id
      ).slice(0, 16);
      ctx.fillStyle = isSelected ? '#00ff9d' : '#e5e7eb';
      ctx.font = `${isSelected ? 'bold ' : ''}11px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(label, pos.x, pos.y + radius + 14);
    }

    ctx.restore();
  }, [graph, zoom, panOffset, selectedNode]);

  // Animation loop
  useEffect(() => {
    let running = true;
    const loop = () => {
      if (!running) return;
      simulate();
      render();
      animFrameRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [simulate, render]);

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !graph) return;

    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - panOffset.x) / zoom;
    const my = (e.clientY - rect.top - panOffset.y) / zoom;

    // Check if clicking on a node
    for (const node of graph.nodes) {
      const pos = positionsRef.current.get(node.id);
      if (!pos) continue;
      const dist = Math.sqrt((mx - pos.x) ** 2 + (my - pos.y) ** 2);
      if (dist < 18) {
        dragNode.current = node.id;
        setSelectedNode(node);
        break;
      }
    }

    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging.current) return;

    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };

    if (dragNode.current) {
      const pos = positionsRef.current.get(dragNode.current);
      if (pos) {
        pos.x += dx / zoom;
        pos.y += dy / zoom;
        pos.vx = 0;
        pos.vy = 0;
      }
    } else {
      setPanOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    dragNode.current = null;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((prev) => Math.min(Math.max(prev * delta, 0.3), 3));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-intel-accent" />
            Graph Explorer
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Interactive relationship graph with decay-weighted edges
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedEntity}
            onChange={(e) => setSelectedEntity(e.target.value)}
            className="px-4 py-2 bg-intel-card border border-intel-border rounded-lg text-sm text-white focus:outline-none focus:border-intel-accent"
          >
            <option value="">Select Entity...</option>
            {profiles.map((p) => (
              <option key={p.entity_id} value={p.entity_id}>
                {p.entity_id} ({p.entity_type})
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1 bg-intel-card border border-intel-border rounded-lg">
            <button
              onClick={() => setZoom((z) => Math.min(z * 1.2, 3))}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(z * 0.8, 0.3))}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Canvas */}
        <div className="lg:col-span-3 bg-intel-card border border-intel-border rounded-xl overflow-hidden">
          {!selectedEntity ? (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <GitBranch className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">Select an entity to explore its relationship graph</p>
              </div>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-96">
              <div className="w-8 h-8 border-2 border-intel-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              width={800}
              height={600}
              className="w-full cursor-grab active:cursor-grabbing"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
            />
          )}
        </div>

        {/* Side Panel */}
        <div className="space-y-4">
          {/* Legend */}
          <div className="bg-intel-card border border-intel-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Legend</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 rounded-full bg-intel-accent/40 border border-intel-accent" />
                <span className="text-gray-400">Entity</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 rounded-full bg-blue-500/40 border border-blue-500" />
                <span className="text-gray-400">Location</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-6 h-0.5 bg-purple-400/60" />
                <span className="text-gray-400">Co-occurred</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-6 h-0.5 bg-blue-400/60" />
                <span className="text-gray-400">Seen at</span>
              </div>
            </div>
          </div>

          {/* Selected Node Details */}
          {selectedNode && (
            <div className="bg-intel-card border border-intel-border rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Node Details</h3>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-gray-500">ID:</span>
                  <span className="text-white ml-2">{selectedNode.id}</span>
                </div>
                <div>
                  <span className="text-gray-500">Type:</span>
                  <span className="text-white ml-2">{selectedNode.labels.join(', ')}</span>
                </div>
                {Object.entries(selectedNode.properties).map(([key, val]) => (
                  <div key={key}>
                    <span className="text-gray-500">{key}:</span>
                    <span className="text-white ml-2">{String(val)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Graph Stats */}
          {graph && (
            <div className="bg-intel-card border border-intel-border rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Graph Stats</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Nodes</span>
                  <span className="text-white">{graph.nodes.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Edges</span>
                  <span className="text-white">{graph.edges.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Zoom</span>
                  <span className="text-white">{(zoom * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
