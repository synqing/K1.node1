/**
 * Parameter Preset Manager
 *
 * Manage, save, load, and organize parameter presets
 */

import { useState, useEffect } from 'react';
import { ChevronDown, Plus, Trash2, Save } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ParameterPreset } from './types';
import { toast } from 'sonner';

interface PresetManagerProps {
  nodeType: string;
  currentValues: Record<string, any>;
  onLoadPreset: (preset: ParameterPreset) => void;
}

const PRESET_STORAGE_KEY = 'parameter-presets';

export function PresetManager({
  nodeType,
  currentValues,
  onLoadPreset,
}: PresetManagerProps) {
  const [presets, setPresets] = useState<ParameterPreset[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  // Load presets from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PRESET_STORAGE_KEY);
      if (stored) {
        const allPresets = JSON.parse(stored) as ParameterPreset[];
        const nodePresets = allPresets.filter((p) => p.nodeType === nodeType);
        setPresets(nodePresets);
      }
    } catch (error) {
      console.error('Failed to load presets:', error);
    }
  }, [nodeType]);

  // Save presets to localStorage
  const savePresetsToStorage = (toSave: ParameterPreset[]) => {
    try {
      const stored = localStorage.getItem(PRESET_STORAGE_KEY);
      const allPresets = stored ? JSON.parse(stored) : [];
      const otherPresets = allPresets.filter((p: ParameterPreset) => p.nodeType !== nodeType);
      const updated = [...otherPresets, ...toSave];
      localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save presets:', error);
      toast.error('Failed to save preset');
    }
  };

  const handleSavePreset = () => {
    if (!newPresetName.trim()) {
      toast.error('Please enter a preset name');
      return;
    }

    const preset: ParameterPreset = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: newPresetName,
      nodeType,
      values: { ...currentValues },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const updated = [...presets, preset];
    setPresets(updated);
    savePresetsToStorage(updated);
    setNewPresetName('');
    setIsCreating(false);
    toast.success(`Preset "${newPresetName}" saved`);
  };

  const handleLoadPreset = (preset: ParameterPreset) => {
    onLoadPreset(preset);
    toast.success(`Loaded preset "${preset.name}"`);
  };

  const handleDeletePreset = (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;

    const updated = presets.filter((p) => p.id !== presetId);
    setPresets(updated);
    savePresetsToStorage(updated);
    toast.success(`Preset "${preset.name}" deleted`);
  };

  return (
    <div className="border-t border-[var(--prism-bg-elevated)]">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--prism-bg-elevated)] transition-colors"
      >
        <span className="text-xs font-medium text-[var(--prism-text-primary)]">
          PRESETS ({presets.length})
        </span>
        <ChevronDown
          className="w-4 h-4 text-[var(--prism-text-secondary)] transition-transform"
          style={{
            transform: isExpanded ? 'rotate(0)' : 'rotate(-90deg)',
          }}
        />
      </button>

      {isExpanded && (
        <div className="px-4 py-3 space-y-2 bg-[var(--prism-bg-canvas)] border-t border-[var(--prism-bg-elevated)]">
          {isCreating ? (
            <div className="space-y-2 pb-2 border-b border-[var(--prism-bg-elevated)]">
              <Input
                type="text"
                placeholder="Preset name..."
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                className="h-7 text-xs bg-[var(--prism-bg-elevated)] border-[var(--prism-bg-elevated)] text-[var(--prism-text-primary)]"
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSavePreset}
                  className="flex-1 h-6 text-xs bg-[var(--prism-success)] text-white hover:bg-[var(--prism-success)]/80"
                >
                  <Save className="w-3 h-3 mr-1" />
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsCreating(false);
                    setNewPresetName('');
                  }}
                  className="flex-1 h-6 text-xs"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              onClick={() => setIsCreating(true)}
              className="w-full h-6 text-xs text-[var(--prism-info)] hover:bg-[var(--prism-bg-elevated)]"
            >
              <Plus className="w-3 h-3 mr-1" />
              Save Current
            </Button>
          )}

          {presets.length > 0 && (
            <div className="space-y-1 pt-2">
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  className="flex items-center gap-2 p-2 rounded hover:bg-[var(--prism-bg-elevated)] transition-colors group"
                >
                  <button
                    onClick={() => handleLoadPreset(preset)}
                    className="flex-1 text-left text-xs text-[var(--prism-text-primary)] hover:text-[var(--prism-info)] transition-colors truncate"
                  >
                    {preset.name}
                  </button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeletePreset(preset.id)}
                    className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-[var(--prism-error)] hover:text-[var(--prism-error)]"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {presets.length === 0 && !isCreating && (
            <p className="text-xs text-[var(--prism-text-secondary)] italic">
              No presets saved yet
            </p>
          )}
        </div>
      )}
    </div>
  );
}
