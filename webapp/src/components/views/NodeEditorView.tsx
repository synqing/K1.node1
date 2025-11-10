import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { NodeState, Node, NodeError } from '../../lib/types';
import { Canvas } from '../node/Canvas';
import { Toolbar } from '../node/Toolbar';
const NodePaletteModal = lazy(() => import('../node/NodePaletteModal').then(m => ({ default: m.NodePaletteModal })));
const ShortcutsModal = lazy(() => import('../node/ShortcutsModal').then(m => ({ default: m.ShortcutsModal })));
import { ErrorPanel } from '../node/ErrorPanel';
import { ImportExport } from '../node/ImportExport';
import { useNodeAuthoring } from '../../store/nodeAuthoring';

export function NodeEditorView() {
  const { nodeState, setNodeState } = useNodeAuthoring();
  
  const [history, setHistory] = useState<NodeState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showNodePalette, setShowNodePalette] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [errors, setErrors] = useState<NodeError[]>([]);
  
  const pushHistory = useCallback((newState: NodeState) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);
  
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setNodeState(history[historyIndex - 1]);
    }
  }, [history, historyIndex]);
  
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setNodeState(history[historyIndex + 1]);
    }
  }, [history, historyIndex]);
  
  const handleAddNode = useCallback((node: Node) => {
    const newState = {
      ...nodeState,
      nodes: [...nodeState.nodes, node],
    };
    setNodeState(newState);
    pushHistory(newState);
    setShowNodePalette(false);
  }, [nodeState, pushHistory, setNodeState]);
  
  const handleDeleteNode = useCallback((nodeId: string) => {
    const newState = {
      ...nodeState,
      nodes: nodeState.nodes.filter(n => n.id !== nodeId),
      connections: nodeState.connections.filter(
        c => c.source.nodeId !== nodeId && c.target.nodeId !== nodeId
      ),
      selectedNodeIds: nodeState.selectedNodeIds.filter(id => id !== nodeId),
    };
    setNodeState(newState);
    pushHistory(newState);
  }, [nodeState, pushHistory, setNodeState]);
  
  const handleNodeMove = useCallback((nodeId: string, position: { x: number; y: number }) => {
    const newState = {
      ...nodeState,
      nodes: nodeState.nodes.map(n =>
        n.id === nodeId ? { ...n, position } : n
      ),
    };
    setNodeState(newState);
  }, [nodeState, setNodeState]);
  
  const handleNodeMoveEnd = useCallback(() => {
    pushHistory(nodeState);
  }, [nodeState, pushHistory]);

  const handleCreateConnection = useCallback((sourceNodeId: string, sourcePortId: string, targetNodeId: string, targetPortId: string) => {
    // Validate same type
    const sourceNode = nodeState.nodes.find(n => n.id === sourceNodeId);
    const targetNode = nodeState.nodes.find(n => n.id === targetNodeId);
    if (!sourceNode || !targetNode) return;
    const sourcePort = sourceNode.outputs.find(p => p.id === sourcePortId);
    const targetPort = targetNode.inputs.find(p => p.id === targetPortId);
    if (!sourcePort || !targetPort) return;
    if (sourcePort.type !== targetPort.type) {
      // For now, reject mismatched types silently; could surface an error later
      return;
    }
    const newConnectionId = `${sourceNodeId}:${sourcePortId}->${targetNodeId}:${targetPortId}`;
    // Prevent duplicate connection
    if (nodeState.connections.some(c => c.id === newConnectionId)) return;
    const newState = {
      ...nodeState,
      connections: [
        ...nodeState.connections,
        {
          id: newConnectionId,
          source: { nodeId: sourceNodeId, portId: sourcePortId },
          target: { nodeId: targetNodeId, portId: targetPortId },
        },
      ],
      nodes: nodeState.nodes.map(n => {
        if (n.id === sourceNodeId) {
          return {
            ...n,
            outputs: n.outputs.map(p => p.id === sourcePortId ? { ...p, connected: true } : p),
          };
        }
        if (n.id === targetNodeId) {
          return {
            ...n,
            inputs: n.inputs.map(p => p.id === targetPortId ? { ...p, connected: true } : p),
          };
        }
        return n;
      }),
    };
    setNodeState(newState);
    pushHistory(newState);
  }, [nodeState, pushHistory, setNodeState]);
  
  const handleZoomIn = useCallback(() => {
    setNodeState(prev => ({
      ...prev,
      zoom: Math.min(prev.zoom * 1.2, 3),
    }));
  }, [setNodeState]);
  
  const handleZoomOut = useCallback(() => {
    setNodeState(prev => ({
      ...prev,
      zoom: Math.max(prev.zoom / 1.2, 0.1),
    }));
  }, [setNodeState]);
  
  const handleZoomReset = useCallback(() => {
    setNodeState(prev => ({
      ...prev,
      zoom: 1,
    }));
  }, [setNodeState]);
  
  const handleParameterChange = useCallback((nodeId: string, paramName: string, value: any) => {
    setNodeState(prev => ({
      ...prev,
      nodes: prev.nodes.map(n => {
        if (n.id === nodeId) {
          return {
            ...n,
            parameters: n.parameters?.map(p =>
              p.name === paramName ? { ...p, value } : p
            ),
          };
        }
        return n;
      }),
    }));
  }, [setNodeState]);
  
  const handleFitToView = useCallback(() => {
    // Calculate bounds of all nodes
    if (nodeState.nodes.length === 0) return;
    
    const bounds = nodeState.nodes.reduce(
      (acc, node) => ({
        minX: Math.min(acc.minX, node.position.x),
        maxX: Math.max(acc.maxX, node.position.x + 250),
        minY: Math.min(acc.minY, node.position.y),
        maxY: Math.max(acc.maxY, node.position.y + 150),
      }),
      { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
    );
    
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    
    const viewWidth = window.innerWidth - 400;
    const viewHeight = window.innerHeight - 200;
    
    const zoom = Math.min(viewWidth / width, viewHeight / height, 1) * 0.9;
    
    setNodeState(prev => ({
      ...prev,
      zoom,
      pan: {
        x: viewWidth / 2 - centerX * zoom,
        y: viewHeight / 2 - centerY * zoom,
      },
    }));
  }, [nodeState.nodes]);
  
  const handleImport = useCallback((data: any) => {
    try {
      const newState: NodeState = {
        nodes: data.nodes || [],
        connections: data.connections || [],
        selectedNodeIds: [],
        zoom: 1,
        pan: { x: 0, y: 0 },
      };
      setNodeState(newState);
      pushHistory(newState);
      setErrors([]);
    } catch (error) {
      console.error('Import error:', error);
    }
  }, [pushHistory]);
  
  const handleExport = useCallback(() => {
    return {
      nodes: nodeState.nodes,
      connections: nodeState.connections,
    };
  }, [nodeState]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !showNodePalette) {
        e.preventDefault();
        setShowNodePalette(true);
      }
      if (e.key === '?' && !showShortcuts) {
        e.preventDefault();
        setShowShortcuts(true);
      }
      if (e.key === 'Delete' && nodeState.selectedNodeIds.length > 0) {
        nodeState.selectedNodeIds.forEach(handleDeleteNode);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
      if (e.key === 'f') {
        e.preventDefault();
        handleFitToView();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    showNodePalette,
    showShortcuts,
    nodeState.selectedNodeIds,
    handleDeleteNode,
    handleUndo,
    handleRedo,
    handleFitToView,
  ]);
  
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-[var(--prism-bg-elevated)] bg-[var(--prism-bg-surface)]">
        <h2 className="font-bebas text-lg tracking-wide text-[var(--prism-text-primary)]">
          Node Node Editor
        </h2>
        <ImportExport onImport={handleImport} onExport={handleExport} />
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          <Toolbar
            zoom={nodeState.zoom}
            showGrid={showGrid}
            canUndo={historyIndex > 0}
            canRedo={historyIndex < history.length - 1}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onZoomReset={handleZoomReset}
            onFitToView={handleFitToView}
            onToggleGrid={() => setShowGrid(!showGrid)}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onShowShortcuts={() => setShowShortcuts(true)}
          />
          
          <Canvas
            nodeState={nodeState}
            showGrid={showGrid}
            onNodeMove={handleNodeMove}
            onNodeMoveEnd={handleNodeMoveEnd}
            onNodeSelect={(nodeId) => {
              setNodeState(prev => ({
                ...prev,
                selectedNodeIds: [nodeId],
              }));
            }}
            onNodeDelete={handleDeleteNode}
            onCanvasClick={() => {
              setNodeState(prev => ({
                ...prev,
                selectedNodeIds: [],
              }));
            }}
            onPanChange={(pan) => {
              setNodeState(prev => ({ ...prev, pan }));
            }}
            onCreateConnection={handleCreateConnection}
            onParameterChange={handleParameterChange}
          />
        </div>
        
        {errors.length > 0 && (
          <ErrorPanel
            errors={errors}
            onErrorClick={(nodeId) => {
              setNodeState(prev => ({
                ...prev,
                selectedNodeIds: [nodeId],
              }));
            }}
            onClearErrors={() => setErrors([])}
          />
        )}
      </div>
      
      {showNodePalette && (
        <Suspense fallback={null}>
          <NodePaletteModal
            open={showNodePalette}
            onClose={() => setShowNodePalette(false)}
            onAddNode={handleAddNode}
          />
        </Suspense>
      )}

      {showShortcuts && (
        <Suspense fallback={null}>
          <ShortcutsModal
            open={showShortcuts}
            onClose={() => setShowShortcuts(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
