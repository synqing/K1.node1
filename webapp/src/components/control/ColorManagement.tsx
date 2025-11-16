import { useEffect, useMemo, useState } from 'react';
import { Palette } from 'lucide-react';
import type { ColorPalette, RgbColor } from '../../lib/types';
import { COLOR_PALETTES } from '../../lib/mockData';
import { UI_PRESET_ORDER, getEffectivePresetMapping, setPresetMapping } from '../../lib/paletteMapping';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const DEFAULT_SWATCH: RgbColor[] = [
  { r: 153, g: 153, b: 153 },
  { r: 119, g: 119, b: 119 },
  { r: 85, g: 85, b: 85 },
  { r: 51, g: 51, b: 51 },
  { r: 17, g: 17, b: 17 },
];

interface ColorManagementProps {
  palettes?: ColorPalette[];
  initialPaletteId?: number;
  initialHsv?: { h: number; s: number; v: number };
  onColorChange: (paletteId: number | null, hsv?: { h: number; s: number; v: number }) => void;
}

export function ColorManagement({ palettes, initialPaletteId, initialHsv, onColorChange }: ColorManagementProps) {
  const [selectedPalette, setSelectedPalette] = useState<number | null>(initialPaletteId ?? null);
  const [hue, setHue] = useState(initialHsv?.h ?? 180);
  const [saturation, setSaturation] = useState(initialHsv?.s ?? 80);
  const [value, setValue] = useState(initialHsv?.v ?? 90);
  const [editMapping, setEditMapping] = useState(false);
  const [presetMap, setPresetMapState] = useState<Record<string, number>>(getEffectivePresetMapping());
  
  useEffect(() => {
    const availablePalettes = palettes && palettes.length ? palettes : COLOR_PALETTES;
    if (availablePalettes.length && selectedPalette === null) {
      setSelectedPalette(availablePalettes[0].id);
    }
  }, [palettes, selectedPalette]);
  
  const handlePaletteSelect = (paletteId: number) => {
    setSelectedPalette(paletteId);
    onColorChange(paletteId);
  };
  
  const handleManualChange = (h?: number, s?: number, v?: number) => {
    if (h !== undefined) setHue(h);
    if (s !== undefined) setSaturation(s);
    if (v !== undefined) setValue(v);
    setSelectedPalette(null);
  };

  const commitManualChange = () => {
    onColorChange(null, { h: hue, s: saturation, v: value });
  };
  
  const effectivePalettes = useMemo<ColorPalette[]>(() => {
    const firmwareById = new Map<number, ColorPalette>((palettes ?? []).map((p) => [Number(p.id), { ...p, id: Number(p.id) }]));
    const fallbackByName = new Map(COLOR_PALETTES.map((p) => [p.name, p]));
    return UI_PRESET_ORDER.map((uiName, idx) => {
      const fwId = presetMap[uiName];
      const firmwarePalette = fwId !== undefined ? firmwareById.get(Number(fwId)) : undefined;
      if (firmwarePalette) {
        return { id: firmwarePalette.id, name: uiName, colors: firmwarePalette.colors };
      }
      const fallback = fallbackByName.get(uiName);
      if (fallback) {
        return { id: presetMap[uiName] ?? fallback.id, name: uiName, colors: fallback.colors };
      }
      return {
        id: presetMap[uiName] ?? -(idx + 1),
        name: uiName,
        colors: DEFAULT_SWATCH.map((c) => ({ ...c })),
      };
    });
  }, [palettes, presetMap]);

  const firmwarePaletteOptions = useMemo(
    () => (palettes ?? []).map((p) => ({ id: String(p.id), name: p.name })),
    [palettes],
  );

  const handlePresetRemap = (presetName: string, fwIdStr: string) => {
    const fwId = Number(fwIdStr);
    setPresetMapping(presetName, fwId);
    setPresetMapState(getEffectivePresetMapping());
  };
  const colorToCss = (c: RgbColor) => `rgb(${c.r}, ${c.g}, ${c.b})`;

  // Derive the current preview color from manual HSV controls
  const hsvToRgb = (h: number, s: number, v: number): RgbColor => {
    const hh = h % 360;
    const ss = Math.max(0, Math.min(100, s)) / 100;
    const vv = Math.max(0, Math.min(100, v)) / 100;
    const c = vv * ss;
    const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
    const m = vv - c;
    let rp = 0, gp = 0, bp = 0;
    if (hh < 60) { rp = c; gp = x; bp = 0; }
    else if (hh < 120) { rp = x; gp = c; bp = 0; }
    else if (hh < 180) { rp = 0; gp = c; bp = x; }
    else if (hh < 240) { rp = 0; gp = x; bp = c; }
    else if (hh < 300) { rp = x; gp = 0; bp = c; }
    else { rp = c; gp = 0; bp = x; }
    return {
      r: Math.round((rp + m) * 255),
      g: Math.round((gp + m) * 255),
      b: Math.round((bp + m) * 255),
    };
  };

  const rgbToHex = (r: number, g: number, b: number): string => {
    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  const currentColor = useMemo(() => {
    const rgb = hsvToRgb(hue, saturation, value);
    return rgbToHex(rgb.r, rgb.g, rgb.b);
  }, [hue, saturation, value]);
  
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Palette className="w-4 h-4 text-[var(--prism-color)]" />
        <h3 className="text-sm font-medium text-[var(--prism-text-primary)]">Color Management</h3>
      </div>
      
      <div className="space-y-3">
        <div className="text-xs text-[var(--prism-text-secondary)]">Preset Palettes</div>
        <div className="grid grid-cols-4 gap-2">
          {effectivePalettes.map((palette) => (
            <button
              key={`${palette.name}-${palette.id}`}
              onClick={() => handlePaletteSelect(palette.id)}
              className={`
                p-2 rounded-lg border transition-all
                ${selectedPalette === palette.id
                  ? 'border-[var(--prism-color)] shadow-[0_0_8px_var(--prism-color)]/20'
                  : 'border-[var(--prism-bg-elevated)] hover:border-[var(--prism-text-secondary)]/30'
                }
              `}
            >
              <div className="flex gap-0.5 h-4 rounded overflow-hidden mb-1.5">
                {(palette.colors || []).map((color: RgbColor, idx: number) => (
                  <div
                    key={idx}
                    className="flex-1"
                    style={{ backgroundColor: colorToCss(color) }}
                  />
                ))}
              </div>
              <div className={`text-xs ${
                selectedPalette === palette.id
                  ? 'text-[var(--prism-color)]'
                  : 'text-[var(--prism-text-secondary)]'
              }`}>
                {palette.name}
              </div>
              {editMapping && firmwarePaletteOptions.length > 0 && (
                <div className="mt-1">
                  <Select 
                    value={String(presetMap[palette.name] ?? '')}
                    onValueChange={(v: string) => handlePresetRemap(palette.name, v)}
                  >
                    <SelectTrigger size="sm">
                      <SelectValue placeholder="Select firmware palette" />
                    </SelectTrigger>
                    <SelectContent>
                      {firmwarePaletteOptions.map((opt) => (
                        <SelectItem key={opt.id} value={opt.id}>{opt.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </button>
          ))}
        </div>
        <div className="flex justify-end">
          <Button 
            variant="outline"
            size="sm"
            className="border-[var(--prism-bg-elevated)] text-[var(--prism-text-secondary)]"
            onClick={() => setEditMapping(!editMapping)}
          >
            {editMapping ? 'Done' : 'Edit mapping'}
          </Button>
        </div>
      </div>
      
      <div className="pt-4 border-t border-[var(--prism-bg-elevated)] space-y-4">
        <div className="text-xs text-[var(--prism-text-secondary)]">Manual HSV Control</div>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="hue" className="text-xs text-[var(--prism-text-primary)]">Hue</Label>
              <span className="text-xs font-jetbrains text-[var(--prism-text-primary)]">{hue}°</span>
            </div>
            <Slider
              id="hue"
              min={0}
              max={360}
              step={1}
              value={[hue]}
              onValueChange={(v: number[]) => handleManualChange(v[0])}
              onValueCommit={commitManualChange}
              className="[&_[role=slider]]:border-2"
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="saturation" className="text-xs text-[var(--prism-text-primary)]">Saturation</Label>
              <span className="text-xs font-jetbrains text-[var(--prism-text-primary)]">{saturation}%</span>
            </div>
            <Slider
              id="saturation"
              min={0}
              max={100}
              step={1}
              value={[saturation]}
              onValueChange={(v: number[]) => handleManualChange(undefined, v[0])}
              onValueCommit={commitManualChange}
              className="[&_[role=slider]]:border-2"
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="value" className="text-xs text-[var(--prism-text-primary)]">Value</Label>
              <span className="text-xs font-jetbrains text-[var(--prism-text-primary)]">{value}%</span>
            </div>
            <Slider
              id="value"
              min={0}
              max={100}
              step={1}
              value={[value]}
              onValueChange={(v: number[]) => handleManualChange(undefined, undefined, v[0])}
              onValueCommit={commitManualChange}
              className="[&_[role=slider]]:border-2"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-3 p-3 bg-[var(--prism-bg-elevated)] rounded-lg">
          <div className="text-xs text-[var(--prism-text-secondary)]">Preview:</div>
          <div 
            className="flex-1 h-8 rounded border border-[var(--prism-bg-canvas)]"
            style={{ backgroundColor: currentColor }}
          />
          <div className="text-xs font-jetbrains text-[var(--prism-text-primary)]">
            {currentColor.toUpperCase()}
          </div>
        </div>
      </div>
    </div>
  );
}
