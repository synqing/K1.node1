import React, { createContext, useContext, useMemo, useState } from 'react';
import type { GraphState } from '../lib/types';

type GraphAuthoringContextValue = {
  graphState: GraphState;
  setGraphState: React.Dispatch<React.SetStateAction<GraphState>>;
};

const defaultGraphState: GraphState = {
  nodes: [],
  connections: [],
  selectedNodeIds: [],
  zoom: 1,
  pan: { x: 0, y: 0 },
};

const GraphAuthoringContext = createContext<GraphAuthoringContextValue | null>(null);

export function GraphAuthoringProvider({ children }: { children: React.ReactNode }) {
  const [graphState, setGraphState] = useState<GraphState>(defaultGraphState);
  const value = useMemo(() => ({ graphState, setGraphState }), [graphState]);
  return <GraphAuthoringContext.Provider value={value}>{children}</GraphAuthoringContext.Provider>;
}

export function useGraphAuthoring(): GraphAuthoringContextValue {
  const ctx = useContext(GraphAuthoringContext);
  if (!ctx) throw new Error('useGraphAuthoring must be used within GraphAuthoringProvider');
  return ctx;
}

// Simple serializer: convert authoring graph to a compilable source representation.
// For now, we encode nodes + connections as JSON to be consumed by the compiler service.
export function serializeGraphToPatternCode(state: GraphState): string {
  const payload = {
    nodes: state.nodes,
    connections: state.connections,
    metadata: {
      createdAt: new Date().toISOString(),
      nodeCount: state.nodes.length,
      connectionCount: state.connections.length,
      zoom: state.zoom,
      pan: state.pan,
    },
  };
  return JSON.stringify(payload, null, 2);
}

