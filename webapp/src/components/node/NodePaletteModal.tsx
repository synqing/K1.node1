import { useState } from 'react';
import { Search } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { Node } from '../../lib/types';
import { NODE_TEMPLATES } from '../../lib/nodeMockData';

interface NodePaletteModalProps {
  open: boolean;
  onClose: () => void;
  onAddNode: (node: Node) => void;
}

export function NodePaletteModal({ open, onClose, onAddNode }: NodePaletteModalProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  
  const filteredTemplates = NODE_TEMPLATES.filter((template) => {
    const matchesSearch = template.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'all' || template.category === category;
    return matchesSearch && matchesCategory;
  });
  
  const handleAddNode = (template: typeof NODE_TEMPLATES[0]) => {
    const newNode: Node = {
      ...template,
      id: `node-${Date.now()}`,
      position: { x: 200, y: 200 },
    };
    onAddNode(newNode);
  };
  
  const getCostColor = (cost: string) => {
    switch (cost) {
      case 'low': return 'var(--prism-success)';
      case 'medium': return 'var(--prism-warning)';
      case 'high': return 'var(--prism-error)';
      default: return 'var(--prism-text-secondary)';
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[var(--prism-bg-surface)] border-[var(--prism-bg-elevated)] max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-[var(--prism-text-primary)]">Add Node</DialogTitle>
          <DialogDescription className="text-[var(--prism-text-secondary)]">
            Browse and add nodes to your node
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--prism-text-secondary)]" />
            <Input
              placeholder="Search nodes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-[var(--prism-bg-canvas)] border-[var(--prism-bg-elevated)] text-[var(--prism-text-primary)]"
            />
          </div>
          
          <Tabs value={category} onValueChange={setCategory}>
            <TabsList className="bg-[var(--prism-bg-elevated)]">
              <TabsTrigger value="all" className="data-[state=active]:bg-[var(--prism-bg-surface)]">All</TabsTrigger>
              <TabsTrigger value="input" className="data-[state=active]:bg-[var(--prism-bg-surface)]">Input</TabsTrigger>
              <TabsTrigger value="effect" className="data-[state=active]:bg-[var(--prism-bg-surface)]">Effect</TabsTrigger>
              <TabsTrigger value="math" className="data-[state=active]:bg-[var(--prism-bg-surface)]">Math</TabsTrigger>
              <TabsTrigger value="color" className="data-[state=active]:bg-[var(--prism-bg-surface)]">Color</TabsTrigger>
              <TabsTrigger value="output" className="data-[state=active]:bg-[var(--prism-bg-surface)]">Output</TabsTrigger>
            </TabsList>
            
            <TabsContent value={category} className="mt-4 max-h-96 overflow-y-auto">
              <div className="space-y-2">
                {filteredTemplates.map((template) => (
                  <button
                    key={template.type}
                    onClick={() => handleAddNode(template)}
                    className="w-full flex items-center justify-between p-3 rounded-lg bg-[var(--prism-bg-elevated)] hover:bg-[var(--prism-bg-canvas)] border border-transparent hover:border-[var(--prism-info)] transition-colors text-left"
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium text-[var(--prism-text-primary)]">{template.name}</div>
                      <div className="text-xs text-[var(--prism-text-secondary)] capitalize mt-0.5">{template.category} • {template.type}</div>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-xs capitalize"
                      style={{ color: getCostColor(template.computeCost), borderColor: getCostColor(template.computeCost) }}
                    >
                      {template.computeCost}
                    </Badge>
                  </button>
                ))}
                {filteredTemplates.length === 0 && (
                  <div className="text-center py-8 text-sm text-[var(--prism-text-secondary)]">
                    No nodes found
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
