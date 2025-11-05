import { Check } from 'lucide-react';
import { Effect, EffectType } from '../../lib/types';
import { EFFECTS } from '../../lib/mockData';

interface EffectSelectorProps {
  effects?: Effect[];
  selectedEffect: EffectType;
  onSelectEffect: (effect: EffectType) => void;
  isSyncing: boolean;
}

export function EffectSelector({ effects, selectedEffect, onSelectEffect, isSyncing }: EffectSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--prism-text-primary)]">Effect Selection</h3>
        {isSyncing && (
          <span className="text-xs text-[var(--prism-info)] font-jetbrains">Syncing...</span>
        )}
      </div>
      
      <div className="grid grid-cols-3 gap-2">
        {(effects || EFFECTS).map((effect) => (
          <button
            key={effect.id}
            onClick={() => onSelectEffect(effect.id)}
            className={`
              relative p-3 rounded-lg border transition-all
              ${selectedEffect === effect.id
                ? 'bg-[var(--prism-info)]/10 border-[var(--prism-info)] shadow-[0_0_12px_var(--prism-info)]/20'
                : 'bg-[var(--prism-bg-elevated)] border-[var(--prism-bg-elevated)] hover:border-[var(--prism-text-secondary)]/30'
              }
            `}
          >
            {selectedEffect === effect.id && (
              <div className="absolute top-2 right-2">
                <Check className="w-3 h-3 text-[var(--prism-info)]" />
              </div>
            )}
            <div className={`font-bebas text-base tracking-wide ${
              selectedEffect === effect.id ? 'text-[var(--prism-info)]' : 'text-[var(--prism-text-primary)]'
            }`}>
              {effect.name}
            </div>
            <div className="text-xs text-[var(--prism-text-secondary)] mt-1 line-clamp-2">
              {effect.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
