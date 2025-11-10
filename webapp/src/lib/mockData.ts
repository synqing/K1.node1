// Mock data generators for PRISM.node2

import { Effect, ColorPalette, PerformanceMetrics, EffectType, Node, NodePortType, RgbColor } from './types';

export const EFFECTS: Effect[] = [
  {
    id: 'Analog',
    name: 'Analog',
    description: 'Classic waveform visualization with smooth transitions',
    parameters: [
      { name: 'Sensitivity', value: 75, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' },
      { name: 'Smoothing', value: 40, min: 0, max: 100, step: 1, unit: '%', type: 'field' },
      { name: 'Attack', value: 15, min: 1, max: 100, step: 1, unit: 'ms', type: 'scalar' },
      { name: 'Decay', value: 250, min: 10, max: 1000, step: 10, unit: 'ms', type: 'scalar' },
    ],
  },
  {
    id: 'Spectrum',
    name: 'Spectrum',
    description: 'Frequency spectrum analyzer across LED strip',
    parameters: [
      { name: 'Bins', value: 32, min: 8, max: 128, step: 8, type: 'field' },
      { name: 'Range', value: 60, min: 20, max: 100, step: 5, unit: 'dB', type: 'scalar' },
      { name: 'Smoothing', value: 30, min: 0, max: 100, step: 1, unit: '%', type: 'field' },
      { name: 'Falloff', value: 180, min: 50, max: 500, step: 10, unit: 'ms', type: 'scalar' },
    ],
  },
  {
    id: 'Octave',
    name: 'Octave',
    description: 'Octave-based frequency bands',
    parameters: [
      { name: 'Bands', value: 8, min: 4, max: 16, step: 1, type: 'field' },
      { name: 'Separation', value: 2, min: 0, max: 10, step: 1, unit: 'px', type: 'field' },
      { name: 'Attack', value: 20, min: 1, max: 100, step: 1, unit: 'ms', type: 'scalar' },
      { name: 'Release', value: 150, min: 10, max: 500, step: 10, unit: 'ms', type: 'scalar' },
    ],
  },
  {
    id: 'Metronome',
    name: 'Metronome',
    description: 'Beat-synchronized pulse pattern',
    parameters: [
      { name: 'BPM', value: 120, min: 60, max: 200, step: 1, unit: 'bpm', type: 'scalar' },
      { name: 'Subdivision', value: 4, min: 1, max: 16, step: 1, type: 'field' },
      { name: 'Pulse Width', value: 50, min: 10, max: 200, step: 10, unit: 'ms', type: 'scalar' },
      { name: 'Accent', value: 4, min: 0, max: 16, step: 1, type: 'field' },
    ],
  },
  {
    id: 'Spectronome',
    name: 'Spectronome',
    description: 'Hybrid spectrum + beat detection',
    parameters: [
      { name: 'Spectrum Mix', value: 50, min: 0, max: 100, step: 1, unit: '%', type: 'field' },
      { name: 'Beat Sens', value: 65, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' },
      { name: 'Cooldown', value: 100, min: 20, max: 500, step: 10, unit: 'ms', type: 'scalar' },
      { name: 'Threshold', value: -18, min: -40, max: 0, step: 1, unit: 'dB', type: 'scalar' },
    ],
  },
  {
    id: 'Hype',
    name: 'Hype',
    description: 'Energy-reactive buildup and release',
    parameters: [
      { name: 'Build Rate', value: 70, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' },
      { name: 'Threshold', value: 80, min: 50, max: 100, step: 1, unit: '%', type: 'scalar' },
      { name: 'Cooldown', value: 2000, min: 500, max: 5000, step: 100, unit: 'ms', type: 'scalar' },
      { name: 'Intensity', value: 85, min: 0, max: 100, step: 1, unit: '%', type: 'output' },
    ],
  },
  {
    id: 'Bloom',
    name: 'Bloom',
    description: 'Radial expansion from beat points',
    parameters: [
      { name: 'Spread Speed', value: 150, min: 50, max: 500, step: 10, unit: 'px/s', type: 'field' },
      { name: 'Fade Time', value: 800, min: 200, max: 2000, step: 100, unit: 'ms', type: 'scalar' },
      { name: 'Max Blooms', value: 3, min: 1, max: 8, step: 1, type: 'field' },
      { name: 'Beat Sens', value: 60, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' },
    ],
  },
  {
    id: 'PULSE',
    name: 'PULSE',
    description: 'High-energy strobe synchronized to transients',
    parameters: [
      { name: 'Intensity', value: 90, min: 0, max: 100, step: 1, unit: '%', type: 'output' },
      { name: 'Width', value: 30, min: 5, max: 100, step: 1, unit: 'ms', type: 'scalar' },
      { name: 'Min Gap', value: 150, min: 50, max: 500, step: 10, unit: 'ms', type: 'scalar' },
      { name: 'Threshold', value: -12, min: -30, max: 0, step: 1, unit: 'dB', type: 'scalar' },
    ],
  },
  {
    id: 'SPARKLE',
    name: 'SPARKLE',
    description: 'Random glitter effect with audio modulation',
    parameters: [
      { name: 'Density', value: 45, min: 0, max: 100, step: 1, unit: '%', type: 'field' },
      { name: 'Lifetime', value: 300, min: 50, max: 1000, step: 50, unit: 'ms', type: 'scalar' },
      { name: 'Audio Mod', value: 70, min: 0, max: 100, step: 1, unit: '%', type: 'scalar' },
      { name: 'Twinkle', value: 25, min: 0, max: 100, step: 1, unit: '%', type: 'output' },
    ],
  },
];

function hexToRgb(hex: string): RgbColor {
  const normalized = hex.replace('#', '');
  const bigint = parseInt(normalized, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

const HEX_COLOR_PALETTES: Array<{ id: number; name: string; colors: string[] }> = [
  { id: 1, name: 'Sunset', colors: ['#FF6B35', '#F7931E', '#FDC830', '#F37335', '#C73E1D'] },
  { id: 2, name: 'Ocean', colors: ['#006994', '#13A3B6', '#5BC9C5', '#7AD5D3', '#A8E6E3'] },
  { id: 3, name: 'Cyber', colors: ['#00F0FF', '#00D9FF', '#00C2FF', '#0099FF', '#0066FF'] },
  { id: 4, name: 'Neon', colors: ['#FF006E', '#FF00D4', '#C400FF', '#7700FF', '#4400FF'] },
  { id: 5, name: 'Fire', colors: ['#FF0000', '#FF4500', '#FF8C00', '#FFA500', '#FFD700'] },
  { id: 6, name: 'Forest', colors: ['#0B3D0B', '#1F5F1F', '#2D8B2D', '#3FB73F', '#52D452'] },
  { id: 7, name: 'Lavender', colors: ['#9D84B7', '#B39BC8', '#C9B3D9', '#DECBEA', '#F4E3FB'] },
  { id: 8, name: 'Depart', colors: ['#080300', '#A96326', '#FFFFFF', '#00FF00', '#003700'] },
  { id: 9, name: 'Vapor', colors: ['#FF71CE', '#01CDFE', '#05FFA1', '#B967FF', '#FFFB96'] },
  { id: 10, name: 'Lava', colors: ['#330000', '#990000', '#FF0000', '#FF6600', '#FFCC00'] },
  { id: 11, name: 'Arctic', colors: ['#E0F7FA', '#B2EBF2', '#80DEEA', '#4DD0E1', '#26C6DA'] },
  { id: 12, name: 'PRISM', colors: ['#6EE7F3', '#A78BFA', '#FFB84D', '#22DD88', '#EF4444'] },
];

export const COLOR_PALETTES: ColorPalette[] = HEX_COLOR_PALETTES.map((palette) => ({
  id: palette.id,
  name: palette.name,
  colors: palette.colors.map(hexToRgb),
}));

let frameCounter = 0;

export function generatePerformanceMetrics(effectType?: EffectType): PerformanceMetrics {
  frameCounter++;
  const time = Date.now();
  
  // Simulate realistic FPS variation (55-65 fps range)
  const baseFps = 60;
  const fpsVariation = Math.sin(frameCounter / 50) * 3 + Math.random() * 2;
  const fps = Math.max(55, Math.min(65, baseFps + fpsVariation));
  
  // Frame time is inverse of FPS
  const frameTime = 1000 / fps;
  
  // Component times (in microseconds)
  const effectTime = 150 + Math.random() * 100 + (effectType === 'Spectrum' ? 50 : 0);
  const gpuTime = 80 + Math.random() * 40;
  const driverTime = 30 + Math.random() * 20;
  const otherTime = 15 + Math.random() * 10;
  
  // CPU usage percentage
  const cpuUsage = 25 + Math.sin(frameCounter / 100) * 10 + Math.random() * 5;
  
  // Memory usage (50-70% range with slow drift)
  const memoryBase = 60;
  const memoryDrift = Math.sin(frameCounter / 200) * 5;
  const memoryUsage = memoryBase + memoryDrift + Math.random() * 3;
  
  return {
    fps: Math.round(fps * 10) / 10,
    frameTime: Math.round(frameTime * 100) / 100,
    effectTime: Math.round(effectTime),
    gpuTime: Math.round(gpuTime),
    driverTime: Math.round(driverTime),
    otherTime: Math.round(otherTime),
    cpuUsage: Math.round(cpuUsage * 10) / 10,
    memoryUsage: Math.round(memoryUsage * 10) / 10,
    timestamp: time,
  };
}

export function generateHistoricalMetrics(count: number, effectType?: EffectType): PerformanceMetrics[] {
  const metrics: PerformanceMetrics[] = [];
  for (let i = 0; i < count; i++) {
    metrics.push(generatePerformanceMetrics(effectType));
  }
  return metrics;
}

export const AVAILABLE_COMMANDS = [
  { cmd: 'p', desc: 'Print current effect parameters' },
  { cmd: 'k', desc: 'Kill effect and reset to idle' },
  { cmd: 'v', desc: 'Print firmware version' },
  { cmd: 'j', desc: 'Output JSON status' },
  { cmd: 'r', desc: 'Reboot device' },
  { cmd: 'c', desc: 'Clear error log' },
  { cmd: 's', desc: 'System diagnostics' },
  { cmd: 'help', desc: 'Show all commands' },
];

export function executeCommand(command: string): { output: string; type: 'success' | 'error' | 'info' } {
  const cmd = command.trim().toLowerCase();
  
  switch (cmd) {
    case 'p':
      return {
        output: `Effect: Spectrum\nBins: 32\nRange: 60dB\nSmoothing: 30%\nFalloff: 180ms\nColor: Palette #3 (Cyber)`,
        type: 'success'
      };
    case 'k':
      return {
        output: 'Effect terminated. LED strip reset to idle state.',
        type: 'info'
      };
    case 'v':
      return {
        output: 'PRISM.node2 Firmware v2.4.1\nBuild: 2024-10-15 18:32:00\nCore: ESP32-S3\nAudio DSP: v1.8.3',
        type: 'info'
      };
    case 'j':
      return {
        output: `{\n  "effect": "Spectrum",\n  "fps": 60.2,\n  "cpu": ${(25 + Math.random() * 10).toFixed(1)}%,\n  "mem": ${(60 + Math.random() * 5).toFixed(1)}%,\n  "uptime": 3847\n}`,
        type: 'success'
      };
    case 'r':
      return {
        output: 'Initiating system reboot...\n[OK] Saving state\n[OK] Closing connections\nRebooting in 3 seconds.',
        type: 'info'
      };
    case 'c':
      return {
        output: 'Error log cleared. 0 errors in buffer.',
        type: 'success'
      };
    case 's':
      return {
        output: `System Diagnostics:\n✓ Audio input: Active (48kHz, 16-bit)\n✓ LED driver: OK (300 LEDs detected)\n✓ WiFi: Connected (-42 dBm)\n✓ Temperature: 42°C\n⚠ Free heap: 47%`,
        type: 'success'
      };
    case 'help':
      return {
        output: AVAILABLE_COMMANDS.map(c => `${c.cmd.padEnd(8)} - ${c.desc}`).join('\n'),
        type: 'info'
      };
    case '':
      return {
        output: '',
        type: 'info'
      };
    default:
      return {
        output: `Unknown command: "${command}"\nType "help" for available commands.`,
        type: 'error'
      };
  }
}
