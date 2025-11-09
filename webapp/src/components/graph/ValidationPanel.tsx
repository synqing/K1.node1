import { AlertCircle, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { Button } from '../ui/button';
import { GraphState, GraphError } from '../../lib/types';

interface ValidationPanelProps {
  errors: GraphError[];
  graphState: GraphState;
  onErrorClick?: (nodeId: string) => void;
  onClearErrors?: () => void;
}

export function ValidationPanel({
  errors,
  graphState,
  onErrorClick,
  onClearErrors,
}: ValidationPanelProps) {
  const validateGraph = (): GraphError[] => {
    const issues: GraphError[] = [];
    const nodeMap = new Map(graphState.nodes.map((n) => [n.id, n]));

    // Check for orphaned nodes
    graphState.nodes.forEach((node) => {
      const hasInput = graphState.connections.some((c) => c.target.nodeId === node.id);
      const hasOutput = graphState.connections.some((c) => c.source.nodeId === node.id);
      const isInputNode = node.category === 'input';
      const isOutputNode = node.category === 'output';

      if (!isInputNode && !hasInput && graphState.nodes.length > 1) {
        issues.push({
          id: `orphan-${node.id}`,
          nodeId: node.id,
          severity: 'warning',
          message: 'Node has no incoming connections',
        });
      }

      if (!isOutputNode && !hasOutput && graphState.nodes.length > 1) {
        issues.push({
          id: `unconnected-${node.id}`,
          nodeId: node.id,
          severity: 'warning',
          message: 'Node output is not used',
        });
      }
    });

    // Check for invalid connections
    graphState.connections.forEach((conn) => {
      const source = nodeMap.get(conn.source.nodeId);
      const target = nodeMap.get(conn.target.nodeId);

      if (!source || !target) {
        issues.push({
          id: `invalid-conn-${conn.id}`,
          nodeId: conn.source.nodeId,
          severity: 'error',
          message: 'Connection references deleted node',
        });
      }
    });

    // Check for circular dependencies (simplified)
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const outgoing = graphState.connections.filter((c) => c.source.nodeId === nodeId);
      for (const conn of outgoing) {
        const targetId = conn.target.nodeId;
        if (!visited.has(targetId)) {
          if (hasCycle(targetId)) return true;
        } else if (recursionStack.has(targetId)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    graphState.nodes.forEach((node) => {
      if (!visited.has(node.id) && hasCycle(node.id)) {
        issues.push({
          id: `cycle-${node.id}`,
          nodeId: node.id,
          severity: 'error',
          message: 'Circular dependency detected',
        });
      }
    });

    return issues;
  };

  const allIssues = [...errors, ...validateGraph()];
  const errorCount = allIssues.filter((e) => e.severity === 'error').length;
  const warningCount = allIssues.filter((e) => e.severity === 'warning').length;

  if (allIssues.length === 0) {
    return (
      <div className="p-4 bg-[var(--prism-bg-canvas)] border-t border-[var(--prism-bg-elevated)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-[var(--prism-success)]" />
          <span className="text-sm text-[var(--prism-text-secondary)]">
            No errors detected
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-h-48 overflow-y-auto bg-[var(--prism-bg-canvas)] border-t border-[var(--prism-bg-elevated)]">
      <div className="p-3 border-b border-[var(--prism-bg-elevated)] flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs">
          {errorCount > 0 && (
            <div className="flex items-center gap-1">
              <AlertCircle className="w-3 h-3 text-[var(--prism-error)]" />
              <span className="text-[var(--prism-error)] font-medium">
                {errorCount} {errorCount === 1 ? 'error' : 'errors'}
              </span>
            </div>
          )}
          {warningCount > 0 && (
            <div className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-[var(--prism-warning)]" />
              <span className="text-[var(--prism-warning)] font-medium">
                {warningCount} {warningCount === 1 ? 'warning' : 'warnings'}
              </span>
            </div>
          )}
        </div>
        {onClearErrors && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearErrors}
            className="h-6 w-6 p-0 text-[var(--prism-text-secondary)] hover:text-[var(--prism-text-primary)]"
          >
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>

      <div className="divide-y divide-[var(--prism-bg-elevated)]">
        {allIssues.map((issue) => (
          <button
            key={issue.id}
            onClick={() => onErrorClick?.(issue.nodeId)}
            className="w-full p-3 text-left hover:bg-[var(--prism-bg-elevated)] transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                {issue.severity === 'error' ? (
                  <AlertCircle className="w-4 h-4 text-[var(--prism-error)]" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-[var(--prism-warning)]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[var(--prism-text-primary)]">
                  {issue.message}
                </p>
                <p className="text-xs text-[var(--prism-text-secondary)] mt-0.5">
                  Node: {graphState.nodes.find((n) => n.id === issue.nodeId)?.name || 'Unknown'}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
