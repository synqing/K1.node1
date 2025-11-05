import { Download, Upload } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';

interface ImportExportProps {
  onImport: (data: any) => void;
  onExport: () => any;
}

export function ImportExport({ onImport, onExport }: ImportExportProps) {
  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target?.result as string);
            onImport(data);
            toast.success('Graph imported successfully');
          } catch (error) {
            toast.error('Failed to import graph');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };
  
  const handleExport = () => {
    const data = onExport();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prism-graph-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Graph exported successfully');
  };
  
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleImport}
        className="border-[var(--prism-bg-elevated)] text-[var(--prism-text-primary)] hover:bg-[var(--prism-bg-elevated)]"
      >
        <Upload className="w-3 h-3 mr-2" />
        Import
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExport}
        className="border-[var(--prism-bg-elevated)] text-[var(--prism-text-primary)] hover:bg-[var(--prism-bg-elevated)]"
      >
        <Download className="w-3 h-3 mr-2" />
        Export
      </Button>
    </div>
  );
}
