/**
 * K1 Pattern Data Types and Category Grouping Utilities
 * 
 * Task 4.1: Define K1 pattern data types and category grouping utilities
 * - Pattern type mirroring K1_PATTERNS with id, name, category, icon, description
 * - Category union types for Static|Audio-Reactive|Beat-Reactive
 * - Pure functions to group patterns by category and stable-sort by name
 * - ID lookup helpers for UI rendering
 */

// Pattern category types
export type PatternCategory = 'Static' | 'Audio-Reactive' | 'Beat-Reactive';

// Pattern interface matching K1 firmware structure
export interface K1Pattern {
  id: string;
  name: string;
  category: PatternCategory;
  icon: string; // Lucide icon name or emoji
  description: string;
  firmwareIndex?: number; // For reliable selection via /api/select { index }
  isAudioReactive?: boolean;
  computeCost?: 'low' | 'medium' | 'high';
}

// Grouped patterns by category
export interface GroupedPatterns {
  category: PatternCategory;
  patterns: K1Pattern[];
}

// K1 Pattern definitions (16 patterns total - SYNCED WITH FIRMWARE)
export const K1_PATTERNS: K1Pattern[] = [
  // Static Patterns (3)
  {
    id: 'departure',
    name: 'Departure',
    category: 'Static',
    icon: '🚀',
    description: 'Transformation: earth → light → growth',
    firmwareIndex: 0,
    isAudioReactive: false,
    computeCost: 'low'
  },
  {
    id: 'lava',
    name: 'Lava',
    category: 'Static',
    icon: '🌋',
    description: 'Intensity: black → red → orange → white',
    firmwareIndex: 1,
    isAudioReactive: false,
    computeCost: 'low'
  },
  {
    id: 'twilight',
    name: 'Twilight',
    category: 'Static',
    icon: '🌆',
    description: 'Peace: amber → purple → blue',
    firmwareIndex: 2,
    isAudioReactive: false,
    computeCost: 'medium'
  },

  // Audio-Reactive Patterns (4)
  {
    id: 'spectrum',
    name: 'Spectrum',
    category: 'Audio-Reactive',
    icon: '📊',
    description: 'Frequency visualization',
    firmwareIndex: 3,
    isAudioReactive: true,
    computeCost: 'high'
  },
  {
    id: 'octave',
    name: 'Octave',
    category: 'Audio-Reactive',
    icon: '🎼',
    description: 'Octave band response',
    firmwareIndex: 4,
    isAudioReactive: true,
    computeCost: 'medium'
  },
  {
    id: 'bloom',
    name: 'Bloom',
    category: 'Audio-Reactive',
    icon: '🌸',
    description: 'VU-meter with persistence',
    firmwareIndex: 5,
    isAudioReactive: true,
    computeCost: 'high'
  },
  {
    id: 'bloom_mirror',
    name: 'Bloom Mirror',
    category: 'Audio-Reactive',
    icon: '🪞',
    description: 'Chromagram-fed bidirectional bloom',
    firmwareIndex: 6,
    isAudioReactive: true,
    computeCost: 'high'
  },

  // Beat-Reactive Patterns (8)
  {
    id: 'pulse',
    name: 'Pulse',
    category: 'Beat-Reactive',
    icon: '💓',
    description: 'Beat-synchronized radial waves',
    firmwareIndex: 7,
    isAudioReactive: true,
    computeCost: 'medium'
  },
  {
    id: 'tempiscope',
    name: 'Tempiscope',
    category: 'Beat-Reactive',
    icon: '⏱️',
    description: 'Tempo visualization with phase',
    firmwareIndex: 8,
    isAudioReactive: true,
    computeCost: 'high'
  },
  {
    id: 'beat_tunnel',
    name: 'Beat Tunnel',
    category: 'Beat-Reactive',
    icon: '🌀',
    description: 'Animated tunnel with beat persistence',
    firmwareIndex: 9,
    isAudioReactive: true,
    computeCost: 'high'
  },
  {
    id: 'beat_tunnel_variant',
    name: 'Beat Tunnel (Variant)',
    category: 'Beat-Reactive',
    icon: '🎪',
    description: 'Experimental beat tunnel using behavioral drift',
    firmwareIndex: 10,
    isAudioReactive: true,
    computeCost: 'high'
  },
  {
    id: 'perlin',
    name: 'Perlin',
    category: 'Beat-Reactive',
    icon: '🌊',
    description: 'Organic perlin noise with beat gating',
    firmwareIndex: 11,
    isAudioReactive: true,
    computeCost: 'medium'
  },
  {
    id: 'analog',
    name: 'Analog',
    category: 'Beat-Reactive',
    icon: '📻',
    description: 'Analog meter with beat response',
    firmwareIndex: 12,
    isAudioReactive: true,
    computeCost: 'low'
  },
  {
    id: 'metronome',
    name: 'Metronome',
    category: 'Beat-Reactive',
    icon: '⏱️',
    description: 'Tempo detection and beat synchronization',
    firmwareIndex: 13,
    isAudioReactive: true,
    computeCost: 'medium'
  },
  {
    id: 'hype',
    name: 'Hype',
    category: 'Beat-Reactive',
    icon: '🔥',
    description: 'High-energy beat-driven show effect',
    firmwareIndex: 14,
    isAudioReactive: true,
    computeCost: 'high'
  },
  {
    id: 'snapwave',
    name: 'Snapwave',
    category: 'Beat-Reactive',
    icon: '⚡',
    description: 'Snappy beat flashes with harmonic accents',
    firmwareIndex: 15,
    isAudioReactive: true,
    computeCost: 'low'
  },

  // New Patterns (2)
  {
    id: 'tunnel_glow',
    name: 'Tunnel Glow',
    category: 'Beat-Reactive',
    icon: '🌀',
    description: 'Audio-reactive glowing tunnel with energy response',
    firmwareIndex: 16,
    isAudioReactive: true,
    computeCost: 'high'
  },
  {
    id: 'startup_intro',
    name: 'Startup Intro',
    category: 'Static',
    icon: '✨',
    description: 'Choreographed startup sequence with tunable parameters',
    firmwareIndex: 17,
    isAudioReactive: false,
    computeCost: 'medium'
  }
];

/**
 * Group patterns by category with stable sorting
 * @returns Array of grouped patterns sorted by category order and pattern name
 */
export function groupPatternsByCategory(): GroupedPatterns[] {
  // Define category order for consistent display
  const categoryOrder: PatternCategory[] = ['Static', 'Audio-Reactive', 'Beat-Reactive'];
  
  const grouped = new Map<PatternCategory, K1Pattern[]>();
  
  // Initialize groups
  categoryOrder.forEach(category => {
    grouped.set(category, []);
  });
  
  // Group patterns by category
  K1_PATTERNS.forEach(pattern => {
    const categoryPatterns = grouped.get(pattern.category);
    if (categoryPatterns) {
      categoryPatterns.push(pattern);
    }
  });
  
  // Sort patterns within each category by name (stable sort)
  grouped.forEach(patterns => {
    patterns.sort((a, b) => a.name.localeCompare(b.name));
  });
  
  // Return as ordered array
  return categoryOrder.map(category => ({
    category,
    patterns: grouped.get(category) || []
  })).filter(group => group.patterns.length > 0);
}

/**
 * Get pattern by ID
 * @param id Pattern ID to lookup
 * @returns Pattern object or undefined if not found
 */
export function getPatternById(id: string): K1Pattern | undefined {
  return K1_PATTERNS.find(pattern => pattern.id === id);
}

/**
 * Get pattern by firmware index
 * @param index Firmware index to lookup
 * @returns Pattern object or undefined if not found
 */
export function getPatternByIndex(index: number): K1Pattern | undefined {
  return K1_PATTERNS.find(pattern => pattern.firmwareIndex === index);
}

/**
 * Get all pattern IDs as array
 * @returns Array of all pattern IDs
 */
export function getAllPatternIds(): string[] {
  return K1_PATTERNS.map(pattern => pattern.id);
}

/**
 * Get patterns by category
 * @param category Category to filter by
 * @returns Array of patterns in the specified category
 */
export function getPatternsByCategory(category: PatternCategory): K1Pattern[] {
  return K1_PATTERNS.filter(pattern => pattern.category === category);
}

/**
 * Get category display name with count
 * @param category Category to get display name for
 * @returns Formatted category name with pattern count
 */
export function getCategoryDisplayName(category: PatternCategory): string {
  const count = getPatternsByCategory(category).length;
  return `${category} (${count})`;
}

/**
 * Validate pattern ID exists
 * @param id Pattern ID to validate
 * @returns True if pattern exists, false otherwise
 */
export function isValidPatternId(id: string): boolean {
  return K1_PATTERNS.some(pattern => pattern.id === id);
}

/**
 * Get pattern statistics
 * @returns Object with pattern counts and categories
 */
export function getPatternStats() {
  const grouped = groupPatternsByCategory();
  return {
    totalPatterns: K1_PATTERNS.length,
    categories: grouped.length,
    audioReactiveCount: K1_PATTERNS.filter(p => p.isAudioReactive).length,
    staticCount: K1_PATTERNS.filter(p => !p.isAudioReactive).length,
    categoryBreakdown: grouped.map(group => ({
      category: group.category,
      count: group.patterns.length
    }))
  };
}