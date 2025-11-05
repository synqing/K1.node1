// Lightweight per-effect parameter registry that maps UI sliders
// to firmware parameter fields. Values are expressed in UI percent (0–100)
// and converted to firmware-native floats (0.0–1.0) when posting.

import { EffectParameter } from './types';
import { FirmwareParams } from './api';

export type ParamBinding = {
  def: EffectParameter;
  sendKey: keyof FirmwareParams;
  // How to scale UI value to firmware value
  scale?: 'percent';
};

// Curated parameter definitions per effect. Use firmware-safe percent ranges.
const REGISTRY: Record<string, ParamBinding[]> = {
  Spectrum: [
    { def: { name: 'Glow Strength', value: 40, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'background', scale: 'percent' },
    { def: { name: 'Glow Softness', value: 50, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'softness', scale: 'percent' },
  ],
  Analog: [
    { def: { name: 'Line Thickness', value: 40, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'custom_param_2', scale: 'percent' },
    { def: { name: 'Reactive Gain', value: 70, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'custom_param_3', scale: 'percent' },
    { def: { name: 'Glow Strength', value: 40, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'background', scale: 'percent' },
    { def: { name: 'Glow Softness', value: 50, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'softness', scale: 'percent' },
  ],
  Octave: [
    { def: { name: 'Glow Strength', value: 40, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'background', scale: 'percent' },
    { def: { name: 'Glow Softness', value: 50, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'softness', scale: 'percent' },
  ],
  Metronome: [
    { def: { name: 'Pulse Width', value: 50, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'custom_param_2', scale: 'percent' },
    { def: { name: 'Accent Level', value: 60, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'custom_param_3', scale: 'percent' },
    { def: { name: 'Glow Strength', value: 40, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'background', scale: 'percent' },
    { def: { name: 'Glow Softness', value: 50, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'softness', scale: 'percent' },
  ],
  Spectronome: [
    { def: { name: 'Spectrum Mix', value: 50, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'custom_param_2', scale: 'percent' },
    { def: { name: 'Beat Sensitivity', value: 65, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'custom_param_3', scale: 'percent' },
    { def: { name: 'Glow Strength', value: 40, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'background', scale: 'percent' },
    { def: { name: 'Glow Softness', value: 50, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'softness', scale: 'percent' },
  ],
  Hype: [
    { def: { name: 'Build Rate', value: 70, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'custom_param_2', scale: 'percent' },
    { def: { name: 'Release Aggression', value: 55, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'custom_param_3', scale: 'percent' },
    { def: { name: 'Glow Strength', value: 40, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'background', scale: 'percent' },
    { def: { name: 'Glow Softness', value: 50, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'softness', scale: 'percent' },
  ],
  Bloom: [
    { def: { name: 'Glow Strength', value: 45, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'background', scale: 'percent' },
    { def: { name: 'Glow Softness', value: 55, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'softness', scale: 'percent' },
    { def: { name: 'Low-level boost', value: 60, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'custom_param_3', scale: 'percent' },
  ],
  Pulse: [
    { def: { name: 'Pulse Density', value: 50, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'custom_param_2', scale: 'percent' },
    { def: { name: 'Decay', value: 40, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'custom_param_3', scale: 'percent' },
    { def: { name: 'Glow Strength', value: 40, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'background', scale: 'percent' },
    { def: { name: 'Glow Softness', value: 50, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'softness', scale: 'percent' },
  ],
  Sparkle: [
    { def: { name: 'Sparkle Rate', value: 68, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'custom_param_2', scale: 'percent' },
    { def: { name: 'Trail Fade', value: 30, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'custom_param_3', scale: 'percent' },
  ],
  // Requested patterns — provide at least 3 controls each
  'Beat Tunnel': [
    { def: { name: 'Tunnel Depth', value: 60, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'custom_param_2', scale: 'percent' },
    { def: { name: 'Beat Sensitivity', value: 70, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'custom_param_3', scale: 'percent' },
    { def: { name: 'Glow Strength', value: 50, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'background', scale: 'percent' },
    { def: { name: 'Glow Softness', value: 50, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'softness', scale: 'percent' },
  ],
  'Bloom Mirror': [
    { def: { name: 'Trail Persistence', value: 60, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'softness', scale: 'percent' },
    { def: { name: 'Glow Strength', value: 55, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'background', scale: 'percent' },
    { def: { name: 'Low-level boost', value: 60, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'custom_param_3', scale: 'percent' },
  ],
  Tempiscope: [
    { def: { name: 'Beat Reactivity', value: 65, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'custom_param_2', scale: 'percent' },
    { def: { name: 'Tempo Smoothing', value: 40, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'custom_param_3', scale: 'percent' },
    { def: { name: 'Motion Depth', value: 55, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'softness', scale: 'percent' },
    { def: { name: 'Glow Strength', value: 45, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'background', scale: 'percent' },
  ],
  Perlin: [
    { def: { name: 'Noise Scale', value: 50, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'custom_param_2', scale: 'percent' },
    { def: { name: 'Flow Rate', value: 60, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'custom_param_3', scale: 'percent' },
    { def: { name: 'Contrast', value: 45, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'background', scale: 'percent' },
    { def: { name: 'Glow Softness', value: 50, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'softness', scale: 'percent' },
  ],
  'Void Trail': [
    { def: { name: 'Trail Length', value: 55, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'custom_param_1', scale: 'percent' },
    { def: { name: 'Fade Strength', value: 50, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'custom_param_2', scale: 'percent' },
    { def: { name: 'Reactivity', value: 60, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' }, sendKey: 'custom_param_3', scale: 'percent' },
  ],
};

// Map common uppercase or alias names to canonical registry keys
const ALIASES: Record<string, string> = {
  'SPECTRUM': 'Spectrum',
  'ANALOG': 'Analog',
  'OCTAVE': 'Octave',
  'METRONOME': 'Metronome',
  'SPECTRONOME': 'Spectronome',
  'HYPE': 'Hype',
  'BLOOM': 'Bloom',
  'PULSE': 'Pulse',
  'SPARKLE': 'Sparkle',
  'BEAT TUNNEL': 'Beat Tunnel',
  'BEAT_TUNNEL': 'Beat Tunnel',
  'TEMPISCOPE': 'Tempiscope',
  'TEMPSCOPE': 'Tempiscope',
  'TEMPOSCOPE': 'Tempiscope',
  'TEMPO SCOPE': 'Tempiscope',
  'PERLIN': 'Perlin',
  'VOID TRAIL': 'Void Trail',
};

function normalizeKey(key: string | undefined): string | undefined {
  if (!key) return undefined;
  const trimmed = key.trim();
  if (!trimmed) return undefined;
  // Prefer alias match if present
  const upper = trimmed.toUpperCase();
  if (ALIASES[upper]) return ALIASES[upper];
  // Case-insensitive direct match to registry keys
  const lower = trimmed.toLowerCase();
  const found = Object.keys(REGISTRY).find(k => k.toLowerCase() === lower);
  return found || trimmed;
}

export function getParamsForEffect(effectIdOrName: string): EffectParameter[] {
  const key = normalizeKey(effectIdOrName);
  const defs = key ? REGISTRY[key] : undefined;
  return defs ? defs.map((b) => b.def) : [];
}

export function getBinding(effectIdOrName: string, paramName: string): ParamBinding | undefined {
  const key = normalizeKey(effectIdOrName);
  const defs = key ? REGISTRY[key] : undefined;
  if (!defs) return undefined;
  // Match parameter name case-insensitively
  const target = paramName.trim().toLowerCase();
  return defs.find((b) => b.def.name.trim().toLowerCase() === target);
}
