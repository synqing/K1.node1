import { Settings, Info, Zap, Gauge, Palette, Sparkles } from 'lucide-react';
import { Slider } from '../ui/slider';
import { Label } from '../ui/label';
import { useEffect, useState, useCallback } from 'react';
import { Switch } from '../ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

interface GlobalSettingsProps {
  onSettingChange: (setting: string, value: number) => void;
  initial?: { brightness?: number; background?: number; softness?: number; warmth?: number; dithering?: boolean };
  deviceIp?: string;
  performanceMode?: 'performance' | 'quality' | 'balanced';
  showAdvancedControls?: boolean;
}

export function GlobalSettings({ 
  onSettingChange, 
  initial, 
  deviceIp = '', 
  performanceMode = 'balanced',
  showAdvancedControls = false 
}: GlobalSettingsProps) {
  const [brightness, setBrightness] = useState(initial?.brightness ?? 85);
  const [background, setBackground] = useState(initial?.background ?? 0);
  const [blur, setBlur] = useState(20);
  const [softness, setSoftness] = useState(initial?.softness ?? 40);
  const [warmth, setWarmth] = useState(initial?.warmth ?? 50);
  const [dithering, setDithering] = useState<boolean>(initial?.dithering ?? false);
  
  // Keep local slider state in sync with firmware updates
  useEffect(() => {
    if (typeof initial?.brightness === 'number') setBrightness(initial.brightness);
    if (typeof initial?.background === 'number') setBackground(initial.background);
    if (typeof initial?.softness === 'number') {
      setSoftness(initial.softness);
      setBlur(initial.softness);
    }
    if (typeof initial?.warmth === 'number') setWarmth(initial.warmth);
    if (typeof initial?.dithering === 'boolean') setDithering(initial.dithering);
  }, [initial?.brightness, initial?.background, initial?.softness, initial?.warmth, initial?.dithering]);

  const handleChange = useCallback((setting: string, value: number, setter: (v: number) => void) => {
    setter(value);
    onSettingChange(setting, value);
  }, [onSettingChange]);
  
  const getParameterIcon = (param: string) => {
    switch (param) {
      case 'brightness': return <Zap className="w-4 h-4 text-yellow-500" />;
      case 'background': return <Sparkles className="w-4 h-4 text-blue-500" />;
      case 'softness': return <Gauge className="w-4 h-4 text-green-500" />;
      case 'warmth': return <Palette className="w-4 h-4 text-purple-500" />;
      default: return <Settings className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Settings className="w-4 h-4 text-[var(--prism-gold)]" />
        <h3 className="text-sm font-medium text-[var(--prism-text-primary)]">Global Settings</h3>
        {showAdvancedControls && (
          <Badge variant="outline" className="text-xs">
            Enhanced
          </Badge>
        )}
      </div>
      
      <div className="space-y-5">
        {/* Dithering Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="dithering" className="text-xs text-[var(--prism-text-primary)]">
              Dithering
            </Label>
            <span className="text-[10px] text-[var(--prism-text-secondary)]">Reduce banding at low brightness</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-jetbrains text-[var(--prism-text-primary)]">
              {dithering ? 'On' : 'Off'}
            </span>
            <Switch
              id="dithering"
              checked={dithering}
              onCheckedChange={(checked) => {
                setDithering(checked);
                onSettingChange('dithering', checked ? 1 : 0);
              }}
            />
          </div>
        </div>

        {/* Brightness Control */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getParameterIcon('brightness')}
              <Label htmlFor="brightness" className="text-xs text-[var(--prism-text-primary)]">
                Brightness
              </Label>
            </div>
            <span className="flex items-center gap-1 text-xs font-jetbrains text-[var(--prism-text-primary)]">
              {brightness}%
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 text-[var(--prism-text-secondary)]" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Global brightness scales all output (master dimmer).
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </span>
          </div>
          <Slider
            id="brightness"
            min={0}
            max={100}
            step={1}
            value={[brightness]}
            onValueChange={(v) => handleChange('brightness', v[0], setBrightness)}
          />
        </div>
        
        {/* Background Control */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getParameterIcon('background')}
              <Label htmlFor="background" className="text-xs text-[var(--prism-text-primary)]">
                Background
              </Label>
            </div>
            <span className="flex items-center gap-1 text-xs font-jetbrains text-[var(--prism-text-primary)]">
              {background}%
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 text-[var(--prism-text-secondary)]" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Controls base glow level; higher values increase ambient intensity.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </span>
          </div>
          <Slider
            id="background"
            min={0}
            max={100}
            step={1}
            value={[background]}
            onValueChange={(v) => handleChange('background', v[0], setBackground)}
          />
        </div>
        
        {/* Softness Control */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getParameterIcon('softness')}
              <Label htmlFor="softness" className="text-xs text-[var(--prism-text-primary)]">
                Softness
              </Label>
            </div>
            <span className="flex items-center gap-1 text-xs font-jetbrains text-[var(--prism-text-primary)]">
              {softness}%
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 text-[var(--prism-text-secondary)]" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Adjusts motion persistence/trail decay; higher values produce smoother trails.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </span>
          </div>
          <Slider
            id="softness"
            min={0}
            max={100}
            step={1}
            value={[softness]}
            onValueChange={(v) => handleChange('softness', v[0], setSoftness)}
          />
        </div>
        
        {/* Warmth Control */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getParameterIcon('warmth')}
              <Label htmlFor="warmth" className="text-xs text-[var(--prism-text-primary)]">
                Color Warmth
              </Label>
            </div>
            <span className="flex items-center gap-1 text-xs font-jetbrains text-[var(--prism-text-primary)]">
              {warmth}%
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 text-[var(--prism-text-secondary)]" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Shifts palette toward warm/cool tones (if supported by firmware).
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </span>
          </div>
          <Slider
            id="warmth"
            min={0}
            max={100}
            step={1}
            value={[warmth]}
            onValueChange={(v) => handleChange('warmth', v[0], setWarmth)}
          />
          <div className="flex justify-between text-xs text-[var(--prism-text-secondary)]">
            <span>Cool</span>
            <span>Warm</span>
          </div>
        </div>

        {/* Enhanced Features Info */}
        {showAdvancedControls && (
          <div className="p-3 bg-[var(--prism-bg-elevated)]/30 rounded border text-xs">
            <h4 className="font-medium text-[var(--prism-text-secondary)] mb-2">Enhanced Architecture</h4>
            <div className="space-y-1 text-[var(--prism-text-secondary)]">
              <div>• Runtime visual property modifications</div>
              <div>• Dynamic motion system with performance optimization</div>
              <div>• Real-time adjustment system with error handling</div>
              <div>• Automated testing and validation</div>
              <div>• Performance mode: {performanceMode}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
