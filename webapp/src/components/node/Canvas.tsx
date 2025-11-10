import { useRef, useState, useCallback } from 'react';
import { NodeState } from '../../lib/types';
import { Node } from './Node';

interface CanvasProps {
  nodeState: NodeState;
  showGrid: boolean;
  onNodeMove: (nodeId: string, position: { x: number; y: number }) => void;
  onNodeMoveEnd: () => void;
  onNodeSelect: (nodeId: string) => void;
  onNodeDelete: (nodeId: string) => void;
  onCanvasClick: () => void;
  onPanChange: (pan: { x: number; y: number }) => void;
  onCreateConnection: (
    sourceNodeId: string,
    sourcePortId: string,
    targetNodeId: string,
    targetPortId: string
  ) => void;
  onParameterChange: (nodeId: string, parameterName: string, value: any) => void;
}

export function Canvas({
  nodeState,
  showGrid,
  onNodeMove,
  onNodeMoveEnd,
  onNodeSelect,
  onNodeDelete,
  onCanvasClick,
  onPanChange,
  onCreateConnection,
  onParameterChange,
}: CanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [connecting, setConnecting] = useState<
    | null
    | {
        sourceNodeId: string;
        sourcePortId: string;
        current: { x: number; y: number };
      }
  >(null);
  
  const NODE_WIDTH = 256; // Tailwind w-64
  const HEADER_HEIGHT = 48;
  const PORT_ROW_HEIGHT = 22;
  const SECTION_PADDING = 12;
  
  const getPortAnchor = (
    nodeId: string,
    portId: string,
    side: 'input' | 'output'
  ) => {
    const node = nodeState.nodes.find(n => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };
    const ports = side === 'input' ? node.inputs : node.outputs;
    const idx = ports.findIndex(p => p.id === portId);
    const inputsSectionHeight = node.inputs.length > 0
      ? node.inputs.length * PORT_ROW_HEIGHT + SECTION_PADDING * 2
      : 0;
    const baseY = side === 'input'
      ? HEADER_HEIGHT + SECTION_PADDING + idx * PORT_ROW_HEIGHT + PORT_ROW_HEIGHT / 2
      : HEADER_HEIGHT + inputsSectionHeight + SECTION_PADDING + idx * PORT_ROW_HEIGHT + PORT_ROW_HEIGHT / 2;
    const x = side === 'input' ? node.position.x : node.position.x + NODE_WIDTH;
    const y = node.position.y + baseY;
    return { x, y };
  };
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains('canvas-background')) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - nodeState.pan.x, y: e.clientY - nodeState.pan.y });
      onCanvasClick();
    }
  }, [nodeState.pan, onCanvasClick]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (connecting) {
      // Convert to canvas coordinates
      const canvasX = (e.clientX - nodeState.pan.x) / nodeState.zoom;
      const canvasY = (e.clientY - nodeState.pan.y) / nodeState.zoom;
      setConnecting(prev => prev ? { ...prev, current: { x: canvasX, y: canvasY } } : prev);
      return;
    }
    if (isPanning) {
      onPanChange({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  }, [connecting, isPanning, panStart, onPanChange, nodeState.pan.x, nodeState.pan.y, nodeState.zoom]);
  
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setConnecting(null);
  }, []);
  
  const startConnect = useCallback((sourceNodeId: string, sourcePortId: string) => {
    const anchor = getPortAnchor(sourceNodeId, sourcePortId, 'output');
    setConnecting({ sourceNodeId, sourcePortId, current: anchor });
  }, [nodeState.nodes]);
  
  const completeConnect = useCallback((targetNodeId: string, targetPortId: string) => {
    if (!connecting) return;
    onCreateConnection(connecting.sourceNodeId, connecting.sourcePortId, targetNodeId, targetPortId);
    setConnecting(null);
  }, [connecting, onCreateConnection]);
  
  const renderConnectionPath = (
    sx: number,
    sy: number,
    tx: number,
    ty: number,
    key?: string
  ) => {
    const dx = Math.max(40, Math.abs(tx - sx) / 2);
    const path = `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`;
    return (
      <path
        key={key}
        d={path}
        fill="none"
        stroke="var(--prism-text-secondary)"
        strokeWidth={2}
      />
    );
  };
  
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
            backgroundSize: `${20 * nodeState.zoom}px ${20 * nodeState.zoom}px`,
            backgroundPosition: `${nodeState.pan.x}px ${nodeState.pan.y}px`,
          }}
        />
      )}
      
      {/* Connections (SVG) + Nodes */}
      <div
        style={{
          transform: `translate(${nodeState.pan.x}px, ${nodeState.pan.y}px) scale(${nodeState.zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {/* SVG overlay for connections */}
        <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
          {nodeState.connections.map((conn) => {
            const sourceAnchor = getPortAnchor(conn.source.nodeId, conn.source.portId, 'output');
            const targetAnchor = getPortAnchor(conn.target.nodeId, conn.target.portId, 'input');
            return renderConnectionPath(sourceAnchor.x, sourceAnchor.y, targetAnchor.x, targetAnchor.y, conn.id);
          })}
          {connecting && (() => {
            const s = getPortAnchor(connecting.sourceNodeId, connecting.sourcePortId, 'output');
            return renderConnectionPath(s.x, s.y, connecting.current.x, connecting.current.y, 'connecting');
          })()}
        </svg>
        
        {nodeState.nodes.map((node) => (
          <Node
            key={node.id}
            node={node}
            isSelected={nodeState.selectedNodeIds.includes(node.id)}
            onMove={onNodeMove}
            onMoveEnd={onNodeMoveEnd}
            onSelect={onNodeSelect}
            onDelete={onNodeDelete}
            onStartConnect={(portId) => startConnect(node.id, portId)}
            onCompleteConnect={(portId) => completeConnect(node.id, portId)}
            onParameterChange={onParameterChange}
          />
        ))}
      </div>
      
      {/* Empty State */}
      {nodeState.nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-[var(--prism-bg-surface)] border border-[var(--prism-bg-elevated)] rounded-lg p-8 max-w-md text-center">
            <h3 className="text-lg font-medium text-[var(--prism-text-primary)] mb-2">
              Empty Node
            </h3>
            <p className="text-sm text-[var(--prism-text-secondary)] mb-4">
              Press <kbd className="px-2 py-1 bg-[var(--prism-bg-elevated)] rounded font-jetbrains text-xs">/</kbd> to add your first node
            </p>
            <p className="text-xs text-[var(--prism-text-secondary)]">
              Or import an existing node from the top-right corner
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
