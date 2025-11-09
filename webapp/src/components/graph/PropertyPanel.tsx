import { useState, useEffect } from 'react';
import { ChevronDown, Copy, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';
import { GraphNode } from '../../lib/types';
import { toast } from 'sonner';

interface PropertyPanelProps {
  node: GraphNode | null;
  onParameterChange?: (nodeId: string, parameters: Record<string, any>) => void;
  onClose?: () => void;
}

export function PropertyPanel({ node, onParameterChange, onClose }: PropertyPanelProps) {
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    inputs: true,
    outputs: true,
    parameters: true,
    metadata: true,
  });

  useEffect(() => {
    if (node?.parameters) {
      setParameters(node.parameters);
    }
  }, [node]);

  const handleParameterChange = (key: string, value: any) => {
    const updated = { ...parameters, [key]: value };
    setParameters(updated);
    if (node && onParameterChange) {
      onParameterChange(node.id, updated);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const copyNodeId = () => {
    if (node) {
      navigator.clipboard.writeText(node.id);
      toast.success('Node ID copied');
    }
  };

  if (!node) {
    return (
      <div className="h-full bg-[var(--prism-bg-surface)] border-l border-[var(--prism-bg-elevated)] p-4 flex flex-col items-center justify-center text-center">
        <p className="text-sm text-[var(--prism-text-secondary)]">
          Select a node to view and edit its properties
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[var(--prism-bg-surface)] border-l border-[var(--prism-bg-elevated)]">
      {/* Header */}
      <div className="p-4 border-b border-[var(--prism-bg-elevated)] flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-[var(--prism-text-primary)] mb-1">
            {node.name}
          </h3>
          <p className="text-xs text-[var(--prism-text-secondary)]">
            Type: {node.type}
          </p>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-6 w-6 p-0 text-[var(--prism-text-secondary)] hover:text-[var(--prism-text-primary)]"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Inputs Section */}
        {node.inputs.length > 0 && (
          <div className="border-b border-[var(--prism-bg-elevated)]">
            <button
              onClick={() => toggleSection('inputs')}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--prism-bg-elevated)] transition-colors"
            >
              <span className="text-xs font-medium text-[var(--prism-text-primary)]">
                INPUTS ({node.inputs.length})
              </span>
              <ChevronDown
                className="w-4 h-4 text-[var(--prism-text-secondary)] transition-transform"
                style={{
                  transform: expandedSections.inputs ? 'rotate(0)' : 'rotate(-90deg)',
                }}
              />
            </button>
            {expandedSections.inputs && (
              <div className="px-4 py-2 space-y-2 bg-[var(--prism-bg-canvas)]">
                {node.inputs.map((input) => (
                  <div key={input.id} className="text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor:
                            input.type === 'scalar'
                              ? 'var(--prism-scalar)'
                              : input.type === 'field'
                              ? 'var(--prism-field)'
                              : input.type === 'color'
                              ? 'var(--prism-color)'
                              : 'var(--prism-output)',
                        }}
                      />
                      <span className="text-[var(--prism-text-secondary)]">{input.name}</span>
                      {input.connected && (
                        <span className="ml-auto text-[var(--prism-success)]">connected</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Outputs Section */}
        {node.outputs.length > 0 && (
          <div className="border-b border-[var(--prism-bg-elevated)]">
            <button
              onClick={() => toggleSection('outputs')}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--prism-bg-elevated)] transition-colors"
            >
              <span className="text-xs font-medium text-[var(--prism-text-primary)]">
                OUTPUTS ({node.outputs.length})
              </span>
              <ChevronDown
                className="w-4 h-4 text-[var(--prism-text-secondary)] transition-transform"
                style={{
                  transform: expandedSections.outputs ? 'rotate(0)' : 'rotate(-90deg)',
                }}
              />
            </button>
            {expandedSections.outputs && (
              <div className="px-4 py-2 space-y-2 bg-[var(--prism-bg-canvas)]">
                {node.outputs.map((output) => (
                  <div key={output.id} className="text-xs">
                    <div className="flex items-center justify-end gap-2 mb-1">
                      {output.connected && (
                        <span className="text-[var(--prism-success)]">connected</span>
                      )}
                      <span className="text-[var(--prism-text-secondary)]">{output.name}</span>
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor:
                            output.type === 'scalar'
                              ? 'var(--prism-scalar)'
                              : output.type === 'field'
                              ? 'var(--prism-field)'
                              : output.type === 'color'
                              ? 'var(--prism-color)'
                              : 'var(--prism-output)',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Parameters Section */}
        {Object.keys(parameters).length > 0 && (
          <div className="border-b border-[var(--prism-bg-elevated)]">
            <button
              onClick={() => toggleSection('parameters')}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--prism-bg-elevated)] transition-colors"
            >
              <span className="text-xs font-medium text-[var(--prism-text-primary)]">
                PARAMETERS ({Object.keys(parameters).length})
              </span>
              <ChevronDown
                className="w-4 h-4 text-[var(--prism-text-secondary)] transition-transform"
                style={{
                  transform: expandedSections.parameters ? 'rotate(0)' : 'rotate(-90deg)',
                }}
              />
            </button>
            {expandedSections.parameters && (
              <div className="px-4 py-3 space-y-3 bg-[var(--prism-bg-canvas)]">
                {Object.entries(parameters).map(([key, value]) => (
                  <div key={key}>
                    <Label className="text-xs text-[var(--prism-text-secondary)] capitalize mb-1.5 block">
                      {key}
                    </Label>
                    {typeof value === 'boolean' ? (
                      <select
                        value={value ? 'true' : 'false'}
                        onChange={(e) =>
                          handleParameterChange(key, e.target.value === 'true')
                        }
                        className="w-full px-2 py-1.5 text-xs bg-[var(--prism-bg-elevated)] border border-[var(--prism-bg-elevated)] rounded text-[var(--prism-text-primary)] focus:outline-none focus:border-[var(--prism-info)]"
                      >
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    ) : typeof value === 'number' ? (
                      <Input
                        type="number"
                        value={value}
                        onChange={(e) =>
                          handleParameterChange(key, parseFloat(e.target.value) || 0)
                        }
                        className="h-7 text-xs bg-[var(--prism-bg-elevated)] border-[var(--prism-bg-elevated)] text-[var(--prism-text-primary)]"
                      />
                    ) : (
                      <Input
                        type="text"
                        value={value}
                        onChange={(e) => handleParameterChange(key, e.target.value)}
                        className="h-7 text-xs bg-[var(--prism-bg-elevated)] border-[var(--prism-bg-elevated)] text-[var(--prism-text-primary)]"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Metadata Section */}
        <div className="border-b border-[var(--prism-bg-elevated)]">
          <button
            onClick={() => toggleSection('metadata')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--prism-bg-elevated)] transition-colors"
          >
            <span className="text-xs font-medium text-[var(--prism-text-primary)]">
              METADATA
            </span>
            <ChevronDown
              className="w-4 h-4 text-[var(--prism-text-secondary)] transition-transform"
              style={{
                transform: expandedSections.metadata ? 'rotate(0)' : 'rotate(-90deg)',
              }}
            />
          </button>
          {expandedSections.metadata && (
            <div className="px-4 py-3 space-y-2 bg-[var(--prism-bg-canvas)] text-xs">
              <div>
                <div className="text-[var(--prism-text-secondary)] mb-1">Node ID</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-2 py-1 bg-[var(--prism-bg-elevated)] rounded text-[var(--prism-text-primary)] font-jetbrains break-all">
                    {node.id}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyNodeId}
                    className="h-6 w-6 p-0 text-[var(--prism-text-secondary)] hover:text-[var(--prism-text-primary)]"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              <div>
                <div className="text-[var(--prism-text-secondary)] mb-1">Category</div>
                <div className="px-2 py-1 bg-[var(--prism-bg-elevated)] rounded text-[var(--prism-text-primary)] capitalize">
                  {node.category}
                </div>
              </div>

              <div>
                <div className="text-[var(--prism-text-secondary)] mb-1">Compute Cost</div>
                <div
                  className="px-2 py-1 bg-[var(--prism-bg-elevated)] rounded capitalize font-medium"
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
                </div>
              </div>

              <div>
                <div className="text-[var(--prism-text-secondary)] mb-1">Position</div>
                <div className="px-2 py-1 bg-[var(--prism-bg-elevated)] rounded text-[var(--prism-text-primary)] font-jetbrains">
                  ({Math.round(node.position.x)}, {Math.round(node.position.y)})
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
