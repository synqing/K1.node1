import { useState } from 'react';
import { Copy, Download, Code2, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { toast } from 'sonner';
import { GraphState } from '../../lib/types';

interface CodeExportProps {
  open: boolean;
  onClose: () => void;
  graphState: GraphState;
  patternName?: string;
}

export function CodeExport({ open, onClose, graphState, patternName = 'CustomPattern' }: CodeExportProps) {
  const [copied, setCopied] = useState(false);

  const generateCppCode = (): string => {
    if (graphState.nodes.length === 0) {
      return '// Empty graph - add nodes to generate code';
    }

    const code = `// Auto-generated graph pattern - ${patternName}
// Generated: ${new Date().toISOString()}

#include "pattern_graph.h"

// Node configuration
static const NodeDefinition nodes[] = {
${graphState.nodes
  .map(
    (node, idx) => `  // ${idx}: ${node.name} (${node.type})
  {
    .type = "${node.type}",
    .category = "${node.category}",
    .computeCost = "${node.computeCost}",
    .inputCount = ${node.inputs.length},
    .outputCount = ${node.outputs.length},
  },`
  )
  .join('\n')}
};

// Connections
static const ConnectionDefinition connections[] = {
${
  graphState.connections.length > 0
    ? graphState.connections
        .map(
          (conn) =>
            `  {
    .sourceNodeId = ${
              graphState.nodes.findIndex((n) => n.id === conn.source.nodeId)
            },
    .sourcePortId = "${conn.source.portId}",
    .targetNodeId = ${
              graphState.nodes.findIndex((n) => n.id === conn.target.nodeId)
            },
    .targetPortId = "${conn.target.portId}",
  },`
        )
        .join('\n')
    : '  // No connections'
}
};

// Pattern initialization
void init_${patternName.toLowerCase()}(PatternContext* ctx) {
  // Initialize node graph with ${graphState.nodes.length} nodes
  ctx->nodeCount = sizeof(nodes) / sizeof(NodeDefinition);
  ctx->nodes = nodes;

  ctx->connectionCount = sizeof(connections) / sizeof(ConnectionDefinition);
  ctx->connections = connections;

  // Validate graph
  graph_validate(ctx);
}

// Pattern execution
void execute_${patternName.toLowerCase()}(PatternContext* ctx, FrameContext* frame) {
  // Execute node graph with current audio/time data
  graph_execute(ctx, frame);

  // Nodes will process in dependency order
  // Final output node(s) will populate frame->output
}

// Node parameters
static const NodeParameters params[] = {
${graphState.nodes
  .filter((node) => node.parameters && Object.keys(node.parameters).length > 0)
  .map(
    (node) => `  // ${node.name}
${Object.entries(node.parameters || {})
  .map(
    ([key, value]) =>
      `  .${key} = ${typeof value === 'string' ? `"${value}"` : value},`
  )
  .join('\n')}`
  )
  .join('\n\n')}
};
`;

    return code;
  };

  const generatedCode = generateCppCode();

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    toast.success('Code copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([generatedCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${patternName.toLowerCase()}_pattern.h`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Code downloaded');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[var(--prism-bg-surface)] border-[var(--prism-bg-elevated)] max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[var(--prism-text-primary)]">
            <Code2 className="w-5 h-5" />
            Generated C++ Code
          </DialogTitle>
          <DialogDescription className="text-[var(--prism-text-secondary)]">
            Export your graph as C++ firmware code
          </DialogDescription>
        </DialogHeader>

        {graphState.nodes.length === 0 && (
          <div className="flex items-start gap-3 p-4 bg-[var(--prism-bg-canvas)] border border-[var(--prism-warning)] rounded-lg">
            <AlertCircle className="w-5 h-5 text-[var(--prism-warning)] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-[var(--prism-text-primary)]">
                Empty Graph
              </p>
              <p className="text-xs text-[var(--prism-text-secondary)] mt-1">
                Add nodes to your graph to generate meaningful code
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-xs font-medium text-[var(--prism-text-secondary)]">
                Pattern Name
              </label>
              <div className="mt-1 px-3 py-2 bg-[var(--prism-bg-elevated)] rounded text-sm text-[var(--prism-text-primary)] font-jetbrains">
                {patternName}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--prism-text-secondary)]">
                Nodes
              </label>
              <div className="mt-1 px-3 py-2 bg-[var(--prism-bg-elevated)] rounded text-sm text-[var(--prism-text-primary)] font-jetbrains">
                {graphState.nodes.length}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--prism-text-secondary)]">
                Connections
              </label>
              <div className="mt-1 px-3 py-2 bg-[var(--prism-bg-elevated)] rounded text-sm text-[var(--prism-text-primary)] font-jetbrains">
                {graphState.connections.length}
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--prism-text-secondary)] block mb-2">
              Generated Code
            </label>
            <div className="relative">
              <pre className="p-4 bg-[var(--prism-bg-canvas)] border border-[var(--prism-bg-elevated)] rounded-lg overflow-auto max-h-96 text-xs text-[var(--prism-text-primary)] font-jetbrains whitespace-pre-wrap break-words">
                {generatedCode}
              </pre>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="absolute top-2 right-2 h-7 px-2 text-[var(--prism-text-secondary)] hover:text-[var(--prism-text-primary)] hover:bg-[var(--prism-bg-elevated)]"
              >
                <Copy className="w-3 h-3" />
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleCopy}
              className="flex-1 bg-[var(--prism-info)] hover:bg-[var(--prism-info-dark)] text-white"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy Code
            </Button>
            <Button
              onClick={handleDownload}
              variant="outline"
              className="flex-1 border-[var(--prism-bg-elevated)] text-[var(--prism-text-primary)] hover:bg-[var(--prism-bg-elevated)]"
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
