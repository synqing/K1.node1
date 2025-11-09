import { useRef, useState, useCallback } from 'react';
import { GraphState, GraphConnection } from '../../lib/types';
import { Node } from './Node';

interface CanvasProps {
  graphState: GraphState;
  showGrid: boolean;
  onNodeMove: (nodeId: string, position: { x: number; y: number }) => void;
  onNodeMoveEnd: () => void;
  onNodeSelect: (nodeId: string) => void;
  onNodeDelete: (nodeId: string) => void;
  onCanvasClick: () => void;
  onPanChange: (pan: { x: number; y: number }) => void;
  onConnectionCreate?: (connection: GraphConnection) => void;
  onConnectionDelete?: (connectionId: string) => void;
}

export function Canvas({
  graphState,
  showGrid,
  onNodeMove,
  onNodeMoveEnd,
  onNodeSelect,
  onNodeDelete,
  onCanvasClick,
  onPanChange,
  onConnectionCreate,
  onConnectionDelete,
}: CanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains('canvas-background')) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - graphState.pan.x, y: e.clientY - graphState.pan.y });
      onCanvasClick();
    }
  }, [graphState.pan, onCanvasClick]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      onPanChange({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  }, [isPanning, panStart, onPanChange]);
  
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);
  
  return (
    <div
      ref={canvasRef}
      className="relative w-full h-full overflow-hidden bg-[var(--prism-bg-canvas)] cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Grid Pattern */}
      {showGrid && (
        <div
          className="canvas-background absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(var(--prism-bg-elevated), 0.3) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(var(--prism-bg-elevated), 0.3) 1px, transparent 1px)
            `,
            backgroundSize: `${20 * graphState.zoom}px ${20 * graphState.zoom}px`,
            backgroundPosition: `${graphState.pan.x}px ${graphState.pan.y}px`,
          }}
        />
      )}

      {/* Connections SVG */}
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{
          zIndex: 1,
        }}
      >
        <defs>
          <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgb(66, 153, 225)" stopOpacity={0.6} />
            <stop offset="100%" stopColor="rgb(72, 187, 120)" stopOpacity={0.6} />
          </linearGradient>
        </defs>
        {graphState.connections.map((conn) => {
          const sourceNode = graphState.nodes.find(n => n.id === conn.source.nodeId);
          const targetNode = graphState.nodes.find(n => n.id === conn.target.nodeId);
          if (!sourceNode || !targetNode) return null;

          const x1 = (sourceNode.position.x + 250) * graphState.zoom + graphState.pan.x;
          const y1 = (sourceNode.position.y + 75) * graphState.zoom + graphState.pan.y;
          const x2 = targetNode.position.x * graphState.zoom + graphState.pan.x;
          const y2 = (targetNode.position.y + 75) * graphState.zoom + graphState.pan.y;

          return (
            <path
              key={conn.id}
              d={`M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`}
              stroke="url(#connectionGradient)"
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
            />
          );
        })}
      </svg>

      {/* Nodes */}
      <div
        style={{
          transform: `translate(${graphState.pan.x}px, ${graphState.pan.y}px) scale(${graphState.zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {graphState.nodes.map((node) => (
          <Node
            key={node.id}
            node={node}
            isSelected={graphState.selectedNodeIds.includes(node.id)}
            onMove={onNodeMove}
            onMoveEnd={onNodeMoveEnd}
            onSelect={onNodeSelect}
            onDelete={onNodeDelete}
          />
        ))}
      </div>
      
      {/* Empty State */}
      {graphState.nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-[var(--prism-bg-surface)] border border-[var(--prism-bg-elevated)] rounded-lg p-8 max-w-md text-center">
            <h3 className="text-lg font-medium text-[var(--prism-text-primary)] mb-2">
              Empty Graph
            </h3>
            <p className="text-sm text-[var(--prism-text-secondary)] mb-4">
              Press <kbd className="px-2 py-1 bg-[var(--prism-bg-elevated)] rounded font-jetbrains text-xs">/</kbd> to add your first node
            </p>
            <p className="text-xs text-[var(--prism-text-secondary)]">
              Or import an existing graph from the top-right corner
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
