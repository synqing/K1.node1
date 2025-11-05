// Mapping of the 12 UI preset names to firmware palette IDs (0-based)
// The IDs correspond to palette_names[] in firmware palettes.h
// These are selected to be close visual matches.

export const UI_TO_FIRMWARE_PALETTE_ID: Record<string, number> = {
  Sunset: 0,              // Sunset Real
  Ocean: 8,               // Ocean Breeze 068
  Cyber: 3,               // RGI 15
  Neon: 21,               // Fuschia 7
  Fire: 23,               // Sunset Yellow
  Forest: 12,             // Landscape 64
  Lavender: 20,           // Violette
  Depart: 11,             // Departure
  Vapor: 14,              // Rainbow Sherbet (vaporwave pastel)
  Lava: 4,                // Retro 2 (red/orange)
  Arctic: 2,              // Ocean Breeze 036 (icy blue)
  PRISM: 16,              // GR64 Hult (spectral gradient)
};

export const UI_PRESET_ORDER: string[] = [
  'Sunset', 'Ocean', 'Cyber', 'Neon', 'Fire', 'Forest',
  'Lavender', 'Depart', 'Vapor', 'Lava', 'Arctic', 'PRISM',
];

// Local storage key for palette overrides
const LS_KEY = 'k1_palette_mapping_overrides';

function readOverrides(): Record<string, number> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function writeOverrides(map: Record<string, number>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(map));
  } catch {}
}

export function getEffectivePresetMapping(): Record<string, number> {
  const base = { ...UI_TO_FIRMWARE_PALETTE_ID };
  const overrides = readOverrides();
  Object.keys(overrides).forEach((k) => {
    if (base[k] !== undefined) base[k] = overrides[k];
  });
  return base;
}

export function setPresetMapping(presetName: string, firmwarePaletteId: number) {
  const overrides = readOverrides();
  overrides[presetName] = Number(firmwarePaletteId);
  writeOverrides(overrides);
}

export function clearPresetMappings() {
  writeOverrides({});
}
