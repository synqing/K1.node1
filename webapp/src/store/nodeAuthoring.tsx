import React, { createContext, useContext, useMemo, useState } from 'react';
import type { NodeState } from '../lib/types';

type NodeAuthoringContextValue = {
  nodeState: NodeState;
  setNodeState: React.Dispatch<React.SetStateAction<NodeState>>;
};

const defaultNodeState: NodeState = {
  nodes: [],
  connections: [],
  selectedNodeIds: [],
  zoom: 1,
  pan: { x: 0, y: 0 },
};

const NodeAuthoringContext = createContext<NodeAuthoringContextValue | null>(null);

export function NodeAuthoringProvider({ children }: { children: React.ReactNode }) {
  const [nodeState, setNodeState] = useState<NodeState>(defaultNodeState);
  const value = useMemo(() => ({ nodeState, setNodeState }), [nodeState]);
  return <NodeAuthoringContext.Provider value={value}>{children}</NodeAuthoringContext.Provider>;
}

export function useNodeAuthoring(): NodeAuthoringContextValue {
  const ctx = useContext(NodeAuthoringContext);
  if (!ctx) throw new Error('useNodeAuthoring must be used within NodeAuthoringProvider');
  return ctx;
}

// Simple serializer: convert authoring node to a compilable source representation.
// For now, we encode nodes + connections as JSON to be consumed by the compiler service.
export function serializeNodeToPatternCode(state: NodeState): string {
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

