// Curated visual tuning presets per effect/pattern.
// Values are firmware-native floats in [0,1]. Keep conservative background and high saturation.
import { FirmwareParams } from './api';

export type Preset = Partial<FirmwareParams>;

const BASELINE: Preset = {
  brightness: 0.85,
  softness: 0.35,
  saturation: 0.90,
  warmth: 0.15,
  background: 0,
};

const OVERRIDES: Record<string, Preset> = {
  // Common analyzer modes
  'Spectrum': { speed: 0.65, softness: 0.30 },
  'Analog': { speed: 0.50, softness: 0.40 },
  'Octave': { speed: 0.55, softness: 0.28 },
  // Beat/reactive styles
  'Metronome': { speed: 0.75, softness: 0.20 },
  'Spectronome': { speed: 0.70, softness: 0.26 },
  'Hype': { speed: 0.80, softness: 0.22 },
  // Motion/particle styles
  'Bloom': { speed: 0.60, softness: 0.38 },
  'Pulse': { speed: 0.76, softness: 0.18 },
  'Sparkle': { speed: 0.68, softness: 0.12 },
  // Generic names present in some firmware builds
  'Rainbow': { speed: 0.55, softness: 0.35 },
  'Wave': { speed: 0.62, softness: 0.30 },
  'Fade': { speed: 0.45, softness: 0.40 },
};

// Merge helper with current firmware params to avoid setting unsupported fields
function filterSupported(preset: Preset, current: FirmwareParams | null): Preset {
  if (!current) return preset;
  const result: Preset = {};
  for (const [k, v] of Object.entries(preset) as Array<[keyof FirmwareParams, number]>) {
    if (typeof current[k] === 'number') {
      (result as any)[k] = v;
    }
  }
  return result;
}

export function getPresetForEffect(effectId: string, current: FirmwareParams | null): Preset | null {
  const id = String(effectId || '').trim();
  const preset: Preset = { ...BASELINE, ...(OVERRIDES[id] || {}) };
  const filtered = filterSupported(preset, current);
  return Object.keys(filtered).length ? filtered : null;
}

