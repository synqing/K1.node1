import { Volume2, AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AudioReactivityMode } from '../../lib/types';
import { Label } from '../ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

interface ModeSelectorsProps {
  onAudioReactivityChange: (mode: AudioReactivityMode) => void;
  initialAudioReactivityMode?: AudioReactivityMode;
  // New: sensitivity slider for VU floor multiplier
  initialVuFloorPct?: number; // 0.5 - 0.98
  onVuFloorPctChange?: (pct: number) => void;
  onCalibrateNoise?: () => Promise<void>;
}

export function ModeSelectors({ onAudioReactivityChange, initialAudioReactivityMode, initialVuFloorPct, onVuFloorPctChange, onCalibrateNoise }: ModeSelectorsProps) {
  const [audioReactivity, setAudioReactivity] = useState<AudioReactivityMode>('on');
  const [vuFloorPct, setVuFloorPct] = useState<number>(typeof initialVuFloorPct === 'number' ? Math.round(initialVuFloorPct * 100) : 90);
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(0);
  const [isCountingDown, setIsCountingDown] = useState<boolean>(false);
  const [countdownId, setCountdownId] = useState<number | null>(null);
  
  useEffect(() => {
    if (initialAudioReactivityMode) {
      setAudioReactivity(initialAudioReactivityMode);
    }
  }, [initialAudioReactivityMode]);
  useEffect(() => {
    if (typeof initialVuFloorPct === 'number') {
      setVuFloorPct(Math.round(initialVuFloorPct * 100));
    }
  }, [initialVuFloorPct]);
  
  const handleAudioReactivityChange = (mode: AudioReactivityMode) => {
    setAudioReactivity(mode);
    onAudioReactivityChange(mode);
  };
  
  // Removed Void Trail preview/label helpers; ModeSelectors only manages Audio Reactivity now.
  
  const getAudioReactivityColor = (mode: AudioReactivityMode) => {
    switch (mode) {
      case 'on': return 'var(--prism-success)';
      case 'off': return 'var(--prism-text-secondary)';
      case 'clipping': return 'var(--prism-error)';
    }
  };
  
  return (
    <div className="space-y-4">
      {/* Audio Reactivity */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4" style={{ color: getAudioReactivityColor(audioReactivity) }} />
          <Label className="text-xs text-[var(--prism-text-primary)]">Audio Reactivity</Label>
        </div>
        
        <div className="flex gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleAudioReactivityChange('on')}
                  className={`
                    flex-1 px-3 py-2 rounded-lg border transition-all text-xs font-medium
                    ${audioReactivity === 'on'
                      ? 'bg-[var(--prism-success)]/10 border-[var(--prism-success)] text-[var(--prism-success)]'
                      : 'bg-[var(--prism-bg-elevated)] border-[var(--prism-bg-elevated)] text-[var(--prism-text-secondary)] hover:border-[var(--prism-text-secondary)]/30'
                    }
                  `}
                >
                  On
                </button>
              </TooltipTrigger>
              <TooltipContent className="bg-[var(--prism-bg-elevated)] border-[var(--prism-bg-canvas)] text-[var(--prism-text-primary)]">
                Audio input active
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleAudioReactivityChange('off')}
                  className={`
                    flex-1 px-3 py-2 rounded-lg border transition-all text-xs font-medium
                    ${audioReactivity === 'off'
                      ? 'bg-[var(--prism-text-secondary)]/10 border-[var(--prism-text-secondary)] text-[var(--prism-text-secondary)]'
                      : 'bg-[var(--prism-bg-elevated)] border-[var(--prism-bg-elevated)] text-[var(--prism-text-secondary)] hover:border-[var(--prism-text-secondary)]/30'
                    }
                  `}
                >
                  Off
                </button>
              </TooltipTrigger>
              <TooltipContent className="bg-[var(--prism-bg-elevated)] border-[var(--prism-bg-canvas)] text-[var(--prism-text-primary)]">
                Audio input disabled
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleAudioReactivityChange('clipping')}
                  className={`
                    flex-1 px-3 py-2 rounded-lg border transition-all text-xs font-medium flex items-center justify-center gap-1.5
                    ${audioReactivity === 'clipping'
                      ? 'bg-[var(--prism-error)]/10 border-[var(--prism-error)] text-[var(--prism-error)]'
                      : 'bg-[var(--prism-bg-elevated)] border-[var(--prism-bg-elevated)] text-[var(--prism-text-secondary)] hover:border-[var(--prism-text-secondary)]/30'
                    }
                  `}
                >
                  <AlertCircle className="w-3 h-3" />
                  Clipping
                </button>
              </TooltipTrigger>
              <TooltipContent className="bg-[var(--prism-bg-elevated)] border-[var(--prism-bg-canvas)] text-[var(--prism-text-primary)]">
                Audio input clipping detected
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Sensitivity Slider (VU floor multiplier) */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-[var(--prism-text-primary)]">Quiet-level sensitivity</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger className="text-[10px] text-[var(--prism-text-secondary)]">what’s this?</TooltipTrigger>
              <TooltipContent className="bg-[var(--prism-bg-elevated)] border-[var(--prism-bg-canvas)] text-[var(--prism-text-primary)]">
                Lower value subtracts less floor → more responsive at low levels.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div className="ml-auto flex items-center gap-2">
            <button
              disabled={isCalibrating || isCountingDown}
              onClick={async () => {
                if (!onCalibrateNoise || isCalibrating || isCountingDown) return;
                // Begin 3-second countdown with cancel option
                setIsCountingDown(true);
                setCountdown(3);
                const id = window.setInterval(() => {
                  setCountdown((prev) => {
                    const next = prev - 1;
                    if (next <= 0) {
                      // Fire calibration and clear countdown
                      window.clearInterval(id);
                      setCountdownId(null);
                      setIsCountingDown(false);
                      setIsCalibrating(true);
                      // Fire and forget, manage state when done
                      (async () => {
                        try {
                          await onCalibrateNoise();
                        } finally {
                          setIsCalibrating(false);
                        }
                      })();
                      return 0;
                    }
                    return next;
                  });
                }, 1000);
                setCountdownId(id);
              }}
              className={`px-2 py-1 rounded border text-[10px] ${isCalibrating
                ? 'bg-[var(--prism-bg-elevated)] border-[var(--prism-bg-elevated)] text-[var(--prism-text-secondary)] opacity-70'
                : 'bg-[var(--prism-bg-elevated)] border-[var(--prism-bg-elevated)] text-[var(--prism-text-primary)] hover:border-[var(--prism-text-secondary)]/30'}`}
            >
              {isCalibrating ? 'Calibrating…' : isCountingDown ? `Starting in ${countdown}…` : 'Calibrate Noise'}
            </button>
            {isCountingDown && (
              <button
                onClick={() => {
                  if (countdownId !== null) window.clearInterval(countdownId);
                  setCountdownId(null);
                  setIsCountingDown(false);
                }}
                className="px-2 py-1 rounded border text-[10px] bg-[var(--prism-bg-elevated)] border-[var(--prism-bg-elevated)] text-[var(--prism-text-secondary)] hover:border-[var(--prism-text-secondary)]/30"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={50}
            max={98}
            step={1}
            value={vuFloorPct}
            onChange={(e) => setVuFloorPct(Number(e.target.value))}
            disabled={isCountingDown || isCalibrating}
            onMouseUp={() => onVuFloorPctChange?.(vuFloorPct / 100)}
            onTouchEnd={() => onVuFloorPctChange?.(vuFloorPct / 100)}
          />
          <div className="text-[10px] text-[var(--prism-text-secondary)] w-16">{(vuFloorPct/100).toFixed(2)}</div>
        </div>
        {isCountingDown && (
          <div className="text-[10px] text-[var(--prism-text-secondary)]">
            Turn off/mute audio now. Calibration starts in {countdown}s.
          </div>
        )}
      </div>
    </div>
  );
}
