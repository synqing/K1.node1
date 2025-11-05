import { Download, Filter } from 'lucide-react';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { EffectType } from '../../lib/types';
import { EFFECTS } from '../../lib/mockData';

interface ProfilingFiltersProps {
  selectedEffect: EffectType | 'all';
  onEffectChange: (effect: EffectType | 'all') => void;
  timeRange: number;
  onTimeRangeChange: (range: number) => void;
  showPhaseComparison: boolean;
  onPhaseComparisonToggle: (show: boolean) => void;
  onExport: () => void;
}

export function ProfilingFilters({
  selectedEffect,
  onEffectChange,
  timeRange,
  onTimeRangeChange,
  showPhaseComparison,
  onPhaseComparisonToggle,
  onExport,
}: ProfilingFiltersProps) {
  return (
    <div className="bg-[var(--prism-bg-surface)] rounded-lg border border-[var(--prism-bg-elevated)] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[var(--prism-info)]" />
          <h3 className="text-sm font-medium text-[var(--prism-text-primary)]">Profiling Filters</h3>
        </div>
        
        <Button
          onClick={onExport}
          size="sm"
          variant="outline"
          className="border-[var(--prism-gold)] text-[var(--prism-gold)] hover:bg-[var(--prism-gold)]/10"
        >
          <Download className="w-3 h-3 mr-2" />
          Export CSV
        </Button>
      </div>
      
      <div className="grid grid-cols-4 gap-4 mt-4">
        <div className="space-y-2">
          <Label className="text-xs text-[var(--prism-text-secondary)]">Effect Filter</Label>
          <Select value={selectedEffect} onValueChange={(v) => onEffectChange(v as EffectType | 'all')}>
            <SelectTrigger className="bg-[var(--prism-bg-canvas)] border-[var(--prism-bg-elevated)] text-[var(--prism-text-primary)] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[var(--prism-bg-elevated)] border-[var(--prism-bg-canvas)]">
              <SelectItem value="all" className="text-[var(--prism-text-primary)]">All Effects</SelectItem>
              {EFFECTS.map((effect) => (
                <SelectItem key={effect.id} value={effect.id} className="text-[var(--prism-text-primary)]">
                  {effect.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label className="text-xs text-[var(--prism-text-secondary)]">Time Range</Label>
          <Select value={String(timeRange)} onValueChange={(v) => onTimeRangeChange(Number(v))}>
            <SelectTrigger className="bg-[var(--prism-bg-canvas)] border-[var(--prism-bg-elevated)] text-[var(--prism-text-primary)] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[var(--prism-bg-elevated)] border-[var(--prism-bg-canvas)]">
              <SelectItem value="100" className="text-[var(--prism-text-primary)]">Last 100 frames</SelectItem>
              <SelectItem value="500" className="text-[var(--prism-text-primary)]">Last 500 frames</SelectItem>
              <SelectItem value="1000" className="text-[var(--prism-text-primary)]">Last 1000 frames</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="phase-comparison" className="text-xs text-[var(--prism-text-secondary)]">
            Phase Comparison
          </Label>
          <div className="flex items-center h-9">
            <Switch
              id="phase-comparison"
              checked={showPhaseComparison}
              onCheckedChange={onPhaseComparisonToggle}
            />
            <span className="ml-2 text-xs text-[var(--prism-text-primary)]">
              {showPhaseComparison ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label className="text-xs text-[var(--prism-text-secondary)]">Status</Label>
          <div className="flex items-center h-9">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[var(--prism-success)] shadow-[0_0_6px_var(--prism-success)]" />
              <span className="text-xs text-[var(--prism-text-primary)]">Recording</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
