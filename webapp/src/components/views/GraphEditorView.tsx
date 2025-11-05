import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { GraphState, GraphNode, GraphError } from '../../lib/types';
import { Canvas } from '../graph/Canvas';
import { Toolbar } from '../graph/Toolbar';
const NodePaletteModal = lazy(() => import('../graph/NodePaletteModal').then(m => ({ default: m.NodePaletteModal })));
const ShortcutsModal = lazy(() => import('../graph/ShortcutsModal').then(m => ({ default: m.ShortcutsModal })));
import { ErrorPanel } from '../graph/ErrorPanel';
import { ImportExport } from '../graph/ImportExport';

export function GraphEditorView() {
  const [graphState, setGraphState] = useState<GraphState>({
    nodes: [],
    connections: [],
    selectedNodeIds: [],
    zoom: 1,
    pan: { x: 0, y: 0 },
  });
  
  const [history, setHistory] = useState<GraphState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showNodePalette, setShowNodePalette] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [errors, setErrors] = useState<GraphError[]>([]);
  
  const pushHistory = useCallback((newState: GraphState) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);
  
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setGraphState(history[historyIndex - 1]);
    }
  }, [history, historyIndex]);
  
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setGraphState(history[historyIndex + 1]);
    }
  }, [history, historyIndex]);
  
  const handleAddNode = useCallback((node: GraphNode) => {
    const newState = {
      ...graphState,
      nodes: [...graphState.nodes, node],
    };
    setGraphState(newState);
    pushHistory(newState);
    setShowNodePalette(false);
  }, [graphState, pushHistory]);
  
  const handleDeleteNode = useCallback((nodeId: string) => {
    const newState = {
      ...graphState,
      nodes: graphState.nodes.filter(n => n.id !== nodeId),
      connections: graphState.connections.filter(
        c => c.source.nodeId !== nodeId && c.target.nodeId !== nodeId
      ),
      selectedNodeIds: graphState.selectedNodeIds.filter(id => id !== nodeId),
    };
    setGraphState(newState);
    pushHistory(newState);
  }, [graphState, pushHistory]);
  
  const handleNodeMove = useCallback((nodeId: string, position: { x: number; y: number }) => {
    const newState = {
      ...graphState,
      nodes: graphState.nodes.map(n =>
        n.id === nodeId ? { ...n, position } : n
      ),
    };
    setGraphState(newState);
  }, [graphState]);
  
  const handleNodeMoveEnd = useCallback(() => {
    pushHistory(graphState);
  }, [graphState, pushHistory]);
  
  const handleZoomIn = useCallback(() => {
    setGraphState(prev => ({
      ...prev,
      zoom: Math.min(prev.zoom * 1.2, 3),
    }));
  }, []);
  
  const handleZoomOut = useCallback(() => {
    setGraphState(prev => ({
      ...prev,
      zoom: Math.max(prev.zoom / 1.2, 0.1),
    }));
  }, []);
  
  const handleZoomReset = useCallback(() => {
    setGraphState(prev => ({
      ...prev,
      zoom: 1,
    }));
  }, []);
  
  const handleFitToView = useCallback(() => {
    // Calculate bounds of all nodes
    if (graphState.nodes.length === 0) return;
    
    const bounds = graphState.nodes.reduce(
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
    
    setGraphState(prev => ({
      ...prev,
      zoom,
      pan: {
        x: viewWidth / 2 - centerX * zoom,
        y: viewHeight / 2 - centerY * zoom,
      },
    }));
  }, [graphState.nodes]);
  
  const handleImport = useCallback((data: any) => {
    try {
      const newState: GraphState = {
        nodes: data.nodes || [],
        connections: data.connections || [],
        selectedNodeIds: [],
        zoom: 1,
        pan: { x: 0, y: 0 },
      };
      setGraphState(newState);
      pushHistory(newState);
      setErrors([]);
    } catch (error) {
      console.error('Import error:', error);
    }
  }, [pushHistory]);
  
  const handleExport = useCallback(() => {
    return {
      nodes: graphState.nodes,
      connections: graphState.connections,
    };
  }, [graphState]);
  
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
      if (e.key === 'Delete' && graphState.selectedNodeIds.length > 0) {
        graphState.selectedNodeIds.forEach(handleDeleteNode);
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
    graphState.selectedNodeIds,
    handleDeleteNode,
    handleUndo,
    handleRedo,
    handleFitToView,
  ]);
  
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-[var(--prism-bg-elevated)] bg-[var(--prism-bg-surface)]">
        <h2 className="font-bebas text-lg tracking-wide text-[var(--prism-text-primary)]">
          Node Graph Editor
        </h2>
        <ImportExport onImport={handleImport} onExport={handleExport} />
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          <Toolbar
            zoom={graphState.zoom}
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
            graphState={graphState}
            showGrid={showGrid}
            onNodeMove={handleNodeMove}
            onNodeMoveEnd={handleNodeMoveEnd}
            onNodeSelect={(nodeId) => {
              setGraphState(prev => ({
                ...prev,
                selectedNodeIds: [nodeId],
              }));
            }}
            onNodeDelete={handleDeleteNode}
            onCanvasClick={() => {
              setGraphState(prev => ({
                ...prev,
                selectedNodeIds: [],
              }));
            }}
            onPanChange={(pan) => {
              setGraphState(prev => ({ ...prev, pan }));
            }}
          />
        </div>
        
        {errors.length > 0 && (
          <ErrorPanel
            errors={errors}
            onErrorClick={(nodeId) => {
              setGraphState(prev => ({
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
