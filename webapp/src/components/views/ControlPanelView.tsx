import { useEffect, useMemo, useRef, useState } from 'react';
import { EffectType, VoidTrailMode, AudioReactivityMode, ConnectionState, Effect, ColorPalette } from '../../lib/types';
import { EFFECTS, COLOR_PALETTES } from '../../lib/mockData';
import { EffectSelector } from '../control/EffectSelector';
import { EffectParameters } from '../control/EffectParameters';
import { ColorManagement } from '../control/ColorManagement';
import { GlobalSettings } from '../control/GlobalSettings';
import { ModeSelectors } from '../control/ModeSelectors';
import { StatusBar } from '../control/StatusBar';
import {
  getPatterns,
  getPalettes,
  getParams,
  postParams,
  postSelect,
  FirmwareParams,
  getAudioConfig,
  postAudioConfig,
  postAudioNoiseCalibrate,
  FirmwareAudioConfig,
  FirmwarePattern,
  FirmwarePalette,
} from '../../lib/api';
import { getPresetForEffect } from '../../lib/presets';
import { getParamsForEffect, getBinding } from '../../lib/param_registry';
import { toast } from 'sonner';

type Props = { connectionState?: ConnectionState };

export function ControlPanelView({ connectionState }: Props) {
  const isConnected = !!connectionState?.connected && !!connectionState?.deviceIp;
  const deviceIp = connectionState?.deviceIp || '';
  const [effects, setEffects] = useState<Effect[]>(EFFECTS);
  const [palettes, setPalettes] = useState<ColorPalette[]>([]);
  const [selectedEffect, setSelectedEffect] = useState<EffectType>('Spectrum');
  const [isSyncing, setIsSyncing] = useState(false);
  
  const currentEffect = effects.find((e) => e.id === selectedEffect) || effects[0] || EFFECTS[0];

  const [animationSpeed, setAnimationSpeed] = useState<number>(50);
  const [fwParams, setFwParams] = useState<FirmwareParams | null>(null);
  const [initialAudioReactivityMode, setInitialAudioReactivityMode] = useState<AudioReactivityMode | undefined>(undefined);
  const [initialVuFloorPct, setInitialVuFloorPct] = useState<number | undefined>(undefined);

  // simple debounce utility
  function useDebouncedCallback<T extends (...args: any[]) => any>(fn: T, delayMs: number) {
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    return useMemo(() => {
      return (...args: Parameters<T>) => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          fn(...args);
        }, delayMs);
      };
    }, [fn, delayMs]);
  }

  type PatternsResponse = Awaited<ReturnType<typeof getPatterns>>;
  type PalettesResponse = Awaited<ReturnType<typeof getPalettes>>;

  const isFirmwarePattern = (value: unknown): value is FirmwarePattern =>
    !!value && typeof value === 'object' && ('id' in (value as FirmwarePattern) || 'index' in (value as FirmwarePattern));

  const isFirmwarePalette = (value: unknown): value is FirmwarePalette =>
    !!value && typeof value === 'object' && 'id' in (value as FirmwarePalette) && 'name' in (value as FirmwarePalette);

  const extractPatterns = (resp: PatternsResponse): FirmwarePattern[] => {
    if (Array.isArray(resp)) return resp.filter(isFirmwarePattern);
    if (resp && Array.isArray((resp as { patterns?: FirmwarePattern[] }).patterns)) {
      return (resp as { patterns?: FirmwarePattern[] }).patterns!.filter(isFirmwarePattern);
    }
    return [];
  };

  const extractPalettes = (resp: PalettesResponse): FirmwarePalette[] => {
    if (Array.isArray(resp)) return resp.filter(isFirmwarePalette);
    if (resp && Array.isArray((resp as { palettes?: FirmwarePalette[] }).palettes)) {
      return (resp as { palettes?: FirmwarePalette[] }).palettes!.filter(isFirmwarePalette);
    }
    return [];
  };

  const mapPatternToEffect = (pattern: FirmwarePattern): Effect => ({
    id: pattern.id || String(pattern.index ?? ''),
    name: pattern.name || (typeof pattern.index === 'number' ? `Pattern ${pattern.index}` : 'Unnamed Pattern'),
    description: pattern.description ?? '',
    // Inject curated parameter defs if we recognize the effect id/name
    parameters: getParamsForEffect(String(pattern.id || pattern.name || '')),
    firmwareIndex: typeof pattern.index === 'number' ? pattern.index : undefined,
  });

  const mapPaletteToColorPalette = (palette: FirmwarePalette): ColorPalette => ({
    id: Number(palette.id),
    name: palette.name,
    colors: (palette.colors || []).map((color) => ({
      r: Number(color?.r ?? 0),
      g: Number(color?.g ?? 0),
      b: Number(color?.b ?? 0),
    })),
  });

  useEffect(() => {
    let aborted = false;
    async function syncFromDevice() {
      if (!isConnected) {
        setEffects(EFFECTS);
        setPalettes(COLOR_PALETTES);
        return;
      }
      try {
        setIsSyncing(true);
        const [patternsResp, palettesResp, paramsResp, audioConfigResp] = await Promise.all([
          getPatterns(deviceIp),
          getPalettes(deviceIp),
          getParams(deviceIp),
          getAudioConfig(deviceIp),
        ]);
        const mappedEffects = extractPatterns(patternsResp).map(mapPatternToEffect);
        if (!aborted) {
          if (mappedEffects.length) {
            setEffects(mappedEffects);
            const currentIndex = Array.isArray(patternsResp)
              ? undefined
              : (patternsResp as any)?.current_pattern;
            if (typeof currentIndex === 'number') {
              const found = mappedEffects.find(e => Number.isInteger(e.firmwareIndex) && e.firmwareIndex === currentIndex);
              setSelectedEffect(found ? found.id : mappedEffects[0].id);
            } else {
              setSelectedEffect(mappedEffects[0].id);
            }
          } else {
            toast.error('Device returned no patterns', { description: 'Firmware /api/patterns responded without entries' });
          }
        }

        const mappedPalettes = extractPalettes(palettesResp).map(mapPaletteToColorPalette);
        if (!aborted) {
          setPalettes(mappedPalettes.length ? mappedPalettes : COLOR_PALETTES);
        }

        if (paramsResp && typeof paramsResp.speed === 'number') {
          setAnimationSpeed(Math.round(paramsResp.speed * 100));
        }
        if (paramsResp) {
          setFwParams(paramsResp as FirmwareParams);
        }

        if (audioConfigResp) {
          const ac = audioConfigResp as FirmwareAudioConfig;
          const mode: AudioReactivityMode = ac.active ? 'on' : 'off';
          setInitialAudioReactivityMode(mode);
          if (typeof ac.vu_floor_pct === 'number') {
            setInitialVuFloorPct(ac.vu_floor_pct);
          }
        }
      } catch (e) {
        console.warn('Device sync error', e);
        if (!aborted) {
          toast.error('Failed to sync from device', { description: 'Could not fetch patterns/palettes. Check device IP and API availability.' });
        }
      } finally {
        if (!aborted) setIsSyncing(false);
      }
    }
    syncFromDevice();
    return () => { aborted = true; };
  }, [isConnected, deviceIp]);
  
  const handleEffectChange = (effect: EffectType) => {
    setSelectedEffect(effect);
    if (isConnected) {
      const eff = effects.find((e) => e.id === effect) || EFFECTS.find((e) => e.id === effect);
      if (eff) {
        setIsSyncing(true);
        // Prefer selecting by numeric index if the id is numeric; otherwise fall back to id
        const numericId = Number(eff.id);
        const index = Number.isInteger(eff.firmwareIndex)
          ? eff.firmwareIndex
          : Number.isInteger(numericId)
            ? numericId
            : undefined;
        const payload: { id?: string; index?: number } =
          typeof index === 'number' ? { index } : { id: String(eff.id) };
        console.info('Effect click -> selecting', payload, eff);
        postSelect(deviceIp, payload)
          .then(async (result) => {
            if (!result.confirmed) {
              toast.info('Effect change awaiting firmware confirmation', {
                description: 'Command used a fallback transport; verify on device.',
              });
            }
            // Apply tuning preset after selection to tighten visuals
            const preset = getPresetForEffect(String(eff.id), fwParams);
            if (preset) {
              try {
                // Small settle delay to let pattern switch
                await new Promise(res => setTimeout(res, 450));
                const r = await postParams(deviceIp, preset);
                const data = r.data;
                if (data) setFwParams(data);
                toast.success('Applied visual tuning preset', {
                  description: `Preset for ${eff.name} applied to device`,
                });
              } catch (e) {
                console.warn('Preset application failed', e);
                toast.warning('Couldn’t apply tuning preset', { description: 'Check device connectivity/rate limits' });
              }
            }
          })
          .catch(e => {
            console.warn('Select effect failed', e);
            const msg = (e && e.message) ? e.message : 'Device did not accept selection';
            toast.error('Failed to change effect', { description: msg });
          })
          .finally(() => setIsSyncing(false));
      }
    }
  };
  
  function formatPct(n?: number) {
    if (typeof n !== 'number') return undefined;
    return Math.round(n * 100) / 100;
  }

  const debouncedPostParamsGeneral = useDebouncedCallback(async (partial: Partial<FirmwareParams>) => {
    try {
      const result = await postParams(deviceIp, partial);
      const data = result.data;
      if (data && typeof data.speed === 'number') {
        setAnimationSpeed(Math.round(data.speed * 100));
      }
      if (data) {
        setFwParams(data);
        // Clamp feedback: show toast for fields adjusted by firmware
        const adjusted: string[] = [];
        const keys = Object.keys(partial) as (keyof FirmwareParams)[];
        keys.forEach((k) => {
          const sent = partial[k];
          const got = data[k];
          if (typeof sent === 'number' && typeof got === 'number') {
            const delta = Math.abs(Number(sent) - Number(got));
            if (delta > 0.001) {
              if (k === 'palette_id') {
                adjusted.push(`palette → ${got}`);
              } else {
                adjusted.push(`${String(k)} ${formatPct(sent)} → ${formatPct(got)}`);
              }
            }
          }
        });
        if (adjusted.length) {
          toast.info('Firmware applied safe bounds', { description: adjusted.join(', ') });
        }
      } else if (!result.confirmed) {
        toast.info('Firmware did not confirm parameter update', {
          description: 'Command sent via opaque transport; verify on device.',
        });
      }
    } catch (e) {
      console.warn('Params update failed', e);
      toast.warning('Device rate-limited or unreachable', { description: 'Waiting before next update…' });
    } finally {
      setIsSyncing(false);
    }
  }, 375);

  // Slightly faster debounce for speed updates for smoother feel
  const debouncedPostParamsSpeed = useDebouncedCallback(async (partial: Partial<FirmwareParams>) => {
    try {
      const result = await postParams(deviceIp, partial);
      const data = result.data;
      if (data) {
        setFwParams(data);
        if (typeof data.speed === 'number') {
          setAnimationSpeed(Math.round(data.speed * 100));
        }
      } else if (!result.confirmed) {
        toast.info('Speed update awaiting firmware confirmation', {
          description: 'Check device logs to ensure the change applied.',
        });
      }
    } catch (e) {
      console.warn('Speed update failed', e);
    } finally {
      setIsSyncing(false);
    }
  }, 350);

  const handleParameterChange = (paramName: string, value: number) => {
    if (!isConnected) return;
    if (paramName.toLowerCase().includes('speed')) {
      const supportsSpeed = !!fwParams && typeof fwParams.speed === 'number';
      if (!supportsSpeed) {
        toast.warning('Speed not supported by device');
        return;
      }
      setIsSyncing(true);
      debouncedPostParamsSpeed({ speed: value / 100 });
      return;
    }
    // Per-effect parameter mapping via registry → firmware fields
    const effId = String(currentEffect?.id || selectedEffect);
    const binding = getBinding(effId, paramName);
    if (!binding) return;
    const key = binding.sendKey;
    const supported = !!fwParams && typeof (fwParams as any)[key] === 'number';
    if (!supported) {
      toast.warning(`${paramName} unsupported by current firmware`);
      return;
    }
    const toFirmware = (binding.scale === 'percent') ? (value / 100) : value;
    setIsSyncing(true);
    debouncedPostParamsGeneral({ [key]: toFirmware } as Partial<FirmwareParams>);
  };
  
  const handleColorChange = (paletteId: number | null, hsv?: { h: number; s: number; v: number }) => {
    if (!isConnected) return;
    setIsSyncing(true);
    if (paletteId !== null) {
      const supportsPalette = !!fwParams && typeof fwParams.palette_id === 'number';
      if (!supportsPalette) {
        setIsSyncing(false);
        toast.warning('Palettes unsupported by current firmware');
        return;
      }
      // Validate that the selected palette_id exists in current palettes
      const paletteExists = palettes?.some((p) => p.id === paletteId);
      if (!paletteExists && palettes && palettes.length > 0) {
        setIsSyncing(false);
        toast.warning('Palette not available', {
          description: `Palette ID ${paletteId} not found in device. Verify device palette list.`,
        });
        return;
      }
      // Send exact palette ID without remapping/clamping
      debouncedPostParamsGeneral({ palette_id: paletteId });
    } else if (hsv) {
      const supportsHSV = !!fwParams
        && typeof fwParams.color === 'number'
        && typeof fwParams.saturation === 'number'
        && typeof fwParams.brightness === 'number';
      if (!supportsHSV) {
        setIsSyncing(false);
        toast.warning('HSV controls unsupported by current firmware');
        return;
      }
      debouncedPostParamsGeneral({
        color: Number(hsv.h) / 360,
        saturation: Number(hsv.s) / 100,
        brightness: Number(hsv.v) / 100,
      });
    } else {
      setIsSyncing(false);
    }
  };
  
  const handleSettingChange = (setting: string, value: number) => {
    if (!isConnected) return;
    const name = setting.toLowerCase();
    const payload: Partial<FirmwareParams> = {};
    if (name.includes('brightness')) {
      if (!(fwParams && typeof fwParams.brightness === 'number')) { toast.warning('Brightness unsupported by firmware'); return; }
      payload.brightness = value / 100;
    } else if (name.includes('background')) {
      if (!(fwParams && typeof fwParams.background === 'number')) { toast.warning('Background unsupported by firmware'); return; }
      payload.background = value / 100;
    } else if (name.includes('softness')) {
      if (!(fwParams && typeof fwParams.softness === 'number')) { toast.warning('Softness unsupported by firmware'); return; }
      payload.softness = value / 100;
    } else if (name.includes('warmth')) {
      if (!(fwParams && typeof fwParams.warmth === 'number')) { toast.warning('Warmth unsupported by firmware'); return; }
      payload.warmth = value / 100;
    } else if (name.includes('dithering')) {
      if (!(fwParams && typeof fwParams.dithering === 'number')) { toast.warning('Dithering unsupported by firmware'); return; }
      payload.dithering = value ? 1 : 0;
    }
    else return;
    setIsSyncing(true);
    debouncedPostParamsGeneral(payload);
  };
  
  const handleVoidTrailChange = (mode: VoidTrailMode) => {
    if (!isConnected) return;
    if (!(fwParams && typeof fwParams.custom_param_1 === 'number')) {
      toast.warning('Void Trail not supported by firmware');
      return;
    }
    setIsSyncing(true);
    // Firmware expects float in [0.0,1.0]; <0.1 => OFF, then 3 bins across 0.1-1.0
    const mapModeToFloat = (m: VoidTrailMode) => {
      switch (m) {
        case 'off': return 0.05;      // Below OFF threshold
        case 'short': return 0.25;    // Bin 0 (0.1-0.4)
        case 'medium': return 0.55;   // Bin 1 (0.4-0.7)
        case 'long': return 0.85;     // Bin 2 (0.7-1.0)
      }
    };
    debouncedPostParamsGeneral({ custom_param_1: mapModeToFloat(mode) });
  };
  
  const handleAudioReactivityChange = async (mode: AudioReactivityMode) => {
    if (!isConnected) return;
    setIsSyncing(true);
    try {
      const active = mode !== 'off';
      const result = await postAudioConfig(deviceIp, { active });
      if (!result.confirmed) {
        toast.info('Audio reactivity update pending confirmation', {
          description: 'Firmware response unavailable; verify on device.',
        });
      }
    } catch (e: any) {
      const msg = (e && e.message) ? e.message : 'Device did not accept audio config';
      toast.error('Failed to update audio reactivity', { description: msg });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleVuFloorPctChange = async (pct: number) => {
    if (!isConnected) return;
    setIsSyncing(true);
    try {
      const result = await postAudioConfig(deviceIp, { vu_floor_pct: pct });
      if (!result.confirmed) {
        toast.info('Sensitivity update awaiting firmware confirmation', {
          description: 'Opaque transport used; verify on device.',
        });
      }
    } catch (e: any) {
      const msg = (e && e.message) ? e.message : 'Device did not accept sensitivity change';
      toast.error('Failed to update sensitivity', { description: msg });
    } finally {
      setIsSyncing(false);
    }
  };
  
  // Derive initial Void Trail mode from firmware param for UI sync
  function deriveVoidTrailModeFromFirmware(value?: number): VoidTrailMode | undefined {
    if (typeof value !== 'number') return undefined;
    // Firmware mapping: <0.1 => off; 0.1-0.4 => short; 0.4-0.7 => medium; 0.7-1.0 => long
    if (value < 0.1) return 'off';
    if (value < 0.4) return 'short';
    if (value < 0.7) return 'medium';
    return 'long';
  }
  
  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-[400px_1fr_320px] gap-6 p-6 h-full">
          {/* Left Column - Effect Selection */}
          <div className="space-y-6">
            <EffectSelector effects={effects} selectedEffect={selectedEffect} onSelectEffect={handleEffectChange} isSyncing={isSyncing} />
          </div>
          
          {/* Center Column - Effect Parameters */}
          <div className="bg-[var(--prism-bg-surface)] rounded-lg border border-[var(--prism-bg-elevated)] p-6">
            {isConnected && (
              <div className="mb-4">
                <label className="block text-xs mb-1">Animation Speed</label>
                <input type="range" min={0} max={100} value={animationSpeed}
                       onChange={(e) => {
                         const v = Number(e.target.value);
                         setAnimationSpeed(v);
                         handleParameterChange('animation_speed', v);
                       }} />
              </div>
            )}
            <EffectParameters
              effect={currentEffect}
              onParameterChange={handleParameterChange}
            />
          </div>
          
          {/* Right Column - Colors & Settings */}
          <div className="space-y-6">
            <div className="bg-[var(--prism-bg-surface)] rounded-lg border border-[var(--prism-bg-elevated)] p-4">
              <ColorManagement 
                palettes={palettes} 
                initialPaletteId={fwParams ? fwParams.palette_id : undefined}
                initialHsv={fwParams ? {
                  h: Math.round((fwParams.color || 0) * 360),
                  s: Math.round((fwParams.saturation || 0) * 100),
                  v: Math.round((fwParams.brightness || 0) * 100),
                } : undefined}
                onColorChange={handleColorChange} 
              />
            </div>
            
            <div className="bg-[var(--prism-bg-surface)] rounded-lg border border-[var(--prism-bg-elevated)] p-4">
              <GlobalSettings 
                onSettingChange={handleSettingChange}
                initial={{
                  brightness: fwParams ? Math.round((fwParams.brightness || 0) * 100) : undefined,
                  background: fwParams ? Math.round((fwParams.background || 0) * 100) : undefined,
                  softness: fwParams ? Math.round((fwParams.softness || 0) * 100) : undefined,
                  warmth: fwParams ? Math.round((fwParams.warmth || 0) * 100) : undefined,
                  dithering: fwParams ? ((fwParams.dithering || 0) >= 0.5) : undefined,
                }}
              />
            </div>
            
            <div className="bg-[var(--prism-bg-surface)] rounded-lg border border-[var(--prism-bg-elevated)] p-4">
              <ModeSelectors 
                onAudioReactivityChange={handleAudioReactivityChange}
                initialAudioReactivityMode={initialAudioReactivityMode}
                initialVuFloorPct={initialVuFloorPct}
                onVuFloorPctChange={handleVuFloorPctChange}
                onCalibrateNoise={async () => {
                  if (!isConnected) return;
                  setIsSyncing(true);
                  try {
                    const result = await postAudioNoiseCalibrate(deviceIp);
                    if (!result.confirmed) {
                      toast.info('Noise calibration started', {
                        description: 'Pending firmware confirmation; listen for ready signal.',
                      });
                    } else {
                      toast.success('Noise calibration started');
                    }
                  } catch (e: any) {
                    const msg = (e && e.message) ? String(e.message) : 'Device did not accept calibration command';
                    const is404 = msg.includes('404');
                    toast.error('Failed to start noise calibration', {
                      description: is404
                        ? 'Endpoint not found on target. Update firmware and verify device IP.'
                        : msg,
                    });
                  } finally {
                    setIsSyncing(false);
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>
      
      <StatusBar connectionState={connectionState || { connected: false, deviceIp: '', serialPort: '' }} />
    </div>
  );
}
