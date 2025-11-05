import { useState, useCallback, useEffect } from 'react';
import { GraphNode, NodePortType } from '../../lib/types';
import { Badge } from '../ui/badge';
import { Grip } from 'lucide-react';

interface NodeProps {
  node: GraphNode;
  isSelected: boolean;
  onMove: (nodeId: string, position: { x: number; y: number }) => void;
  onMoveEnd: () => void;
  onSelect: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
}

export function Node({ node, isSelected, onMove, onMoveEnd, onSelect, onDelete }: NodeProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.node-port')) return;
    e.stopPropagation();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - node.position.x,
      y: e.clientY - node.position.y,
    });
    onSelect(node.id);
  }, [node.position, node.id, onSelect]);
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      onMove(node.id, {
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }, [isDragging, node.id, dragStart, onMove]);
  
  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      onMoveEnd();
    }
  }, [isDragging, onMoveEnd]);
  
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);
  
  const getPortColor = (type: NodePortType) => {
    switch (type) {
      case 'scalar': return 'var(--prism-scalar)';
      case 'field': return 'var(--prism-field)';
      case 'color': return 'var(--prism-color)';
      case 'output': return 'var(--prism-output)';
    }
  };
  
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'input': return 'var(--prism-info)';
      case 'effect': return 'var(--prism-gold)';
      case 'math': return 'var(--prism-scalar)';
      case 'color': return 'var(--prism-color)';
      case 'output': return 'var(--prism-output)';
      default: return 'var(--prism-text-secondary)';
    }
  };
  
  return (
    <div
      className={`absolute w-64 bg-[var(--prism-bg-surface)] border-2 rounded-lg shadow-lg transition-all cursor-move ${
        isSelected
          ? 'border-[var(--prism-gold)] shadow-[0_0_16px_rgba(255,184,77,0.3)]'
          : 'border-[var(--prism-bg-elevated)]'
      }`}
      style={{
        left: node.position.x,
        top: node.position.y,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="p-3 border-b border-[var(--prism-bg-elevated)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Grip className="w-4 h-4 text-[var(--prism-text-secondary)]" />
          <div>
            <div className="text-sm font-medium text-[var(--prism-text-primary)]">{node.name}</div>
            <div className="text-xs text-[var(--prism-text-secondary)] capitalize">{node.category}</div>
          </div>
        </div>
        <Badge
          variant="outline"
          className="text-xs border-current"
          style={{ color: getCategoryColor(node.category) }}
        >
          {node.type}
        </Badge>
      </div>
      
      {/* Inputs */}
      {node.inputs.length > 0 && (
        <div className="p-2 space-y-1">
          {node.inputs.map((port) => (
            <div key={port.id} className="flex items-center gap-2 text-xs node-port">
              <div
                className="w-2 h-2 rounded-full border-2 border-current"
                style={{ color: getPortColor(port.type) }}
              />
              <span className="text-[var(--prism-text-secondary)]">{port.name}</span>
            </div>
          ))}
        </div>
      )}
      
      {/* Outputs */}
      {node.outputs.length > 0 && (
        <div className="p-2 space-y-1 border-t border-[var(--prism-bg-elevated)]">
          {node.outputs.map((port) => (
            <div key={port.id} className="flex items-center justify-end gap-2 text-xs node-port">
              <span className="text-[var(--prism-text-secondary)]">{port.name}</span>
              <div
                className="w-2 h-2 rounded-full border-2 border-current"
                style={{ color: getPortColor(port.type) }}
              />
            </div>
          ))}
        </div>
      )}
      
      {/* Compute Cost Indicator */}
      <div className="px-3 py-1.5 border-t border-[var(--prism-bg-elevated)] flex items-center justify-between text-xs">
        <span className="text-[var(--prism-text-secondary)]">Cost:</span>
        <span
          className="font-jetbrains capitalize"
          style={{
            color:
              node.computeCost === 'low'
                ? 'var(--prism-success)'
                : node.computeCost === 'medium'
                ? 'var(--prism-warning)'
                : 'var(--prism-error)',
          }}
        >
          {node.computeCost}
        </span>
      </div>
    </div>
  );
}
