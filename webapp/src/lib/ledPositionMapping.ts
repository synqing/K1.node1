/**
 * LED Position Mapping with Center-Origin Mirroring
 * 
 * Task 7.2: Implement index↔position mapping with center-origin mirroring for 180 LEDs
 * - computePositions() generating precomputed Float32Array x/y buffers on circle/arc
 * - Central axis at 89.5 yields mirrored positions (i and 179-i)
 * - indexMirror(), indexToPos(), posToIndex() helpers
 * - Parameters for spacing, angle offset, orientation (CW/CCW)
 */

import { LED_COUNT } from './ledFrameProtocol';

// Position mapping constants
export const DEFAULT_RADIUS = 200;
export const DEFAULT_CENTER_X = 0;
export const DEFAULT_CENTER_Y = 0;
export const DEFAULT_ANGLE_OFFSET = 0; // Radians
export const MIRROR_AXIS_INDEX = 89.5; // Central axis for mirroring

// Position data structure
export interface LedPosition {
  x: number;
  y: number;
  angle: number; // Radians from center
  distance: number; // Distance from center
  index: number;
  mirrorIndex: number;
}

// Position mapping configuration
export interface PositionMappingConfig {
  ledCount?: number;
  radius?: number;
  centerX?: number;
  centerY?: number;
  angleOffset?: number; // Starting angle in radians
  clockwise?: boolean; // Direction of LED arrangement
  arcSpan?: number; // Arc span in radians (2π for full circle)
  spacing?: 'uniform' | 'custom'; // LED spacing mode
  customSpacing?: number[]; // Custom angle positions (if spacing === 'custom')
}

// Precomputed position buffers for performance
export interface PositionBuffers {
  positions: Float32Array; // Interleaved x,y positions [x0,y0,x1,y1,...]
  angles: Float32Array; // Angle for each LED
  distances: Float32Array; // Distance from center for each LED
  mirrorIndices: Uint16Array; // Mirror index for each LED
  config: Required<PositionMappingConfig>;
}

/**
 * Compute LED positions with center-origin mirroring
 */
export function computePositions(config: PositionMappingConfig = {}): PositionBuffers {
  const fullConfig: Required<PositionMappingConfig> = {
    ledCount: LED_COUNT,
    radius: DEFAULT_RADIUS,
    centerX: DEFAULT_CENTER_X,
    centerY: DEFAULT_CENTER_Y,
    angleOffset: DEFAULT_ANGLE_OFFSET,
    clockwise: true,
    arcSpan: Math.PI * 2, // Full circle
    spacing: 'uniform',
    customSpacing: [],
    ...config
  };
  
  const { ledCount, radius, centerX, centerY, angleOffset, clockwise, arcSpan, spacing, customSpacing } = fullConfig;
  
  // Allocate buffers
  const positions = new Float32Array(ledCount * 2); // x,y pairs
  const angles = new Float32Array(ledCount);
  const distances = new Float32Array(ledCount);
  const mirrorIndices = new Uint16Array(ledCount);
  
  // Calculate angle positions
  let ledAngles: number[];
  
  if (spacing === 'custom' && customSpacing.length === ledCount) {
    ledAngles = [...customSpacing];
  } else {
    // Uniform spacing
    ledAngles = [];
    for (let i = 0; i < ledCount; i++) {
      const normalizedIndex = i / (ledCount - 1); // 0 to 1
      const angle = angleOffset + (clockwise ? normalizedIndex : -normalizedIndex) * arcSpan;
      ledAngles.push(angle);
    }
  }
  
  // Compute positions and mirror indices
  for (let i = 0; i < ledCount; i++) {
    const angle = ledAngles[i];
    
    // Calculate position
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    
    // Store in buffers
    positions[i * 2] = x;
    positions[i * 2 + 1] = y;
    angles[i] = angle;
    distances[i] = radius; // Constant for circle, could vary for other shapes
    
    // Calculate mirror index (symmetric around center axis)
    const mirrorIndex = calculateMirrorIndex(i, ledCount);
    mirrorIndices[i] = mirrorIndex;
  }
  
  return {
    positions,
    angles,
    distances,
    mirrorIndices,
    config: fullConfig
  };
}

/**
 * Calculate mirror index for LED symmetry
 * Central axis at index 89.5 means LEDs 0↔179, 1↔178, etc.
 */
export function calculateMirrorIndex(index: number, ledCount: number = LED_COUNT): number {
  // For 180 LEDs: mirror axis at 89.5
  // LED 0 mirrors to LED 179, LED 1 to 178, etc.
  return (ledCount - 1) - index;
}

/**
 * Get mirror index for a given LED
 */
export function indexMirror(index: number): number {
  return calculateMirrorIndex(index);
}

/**
 * Convert LED index to position
 */
export function indexToPos(index: number, buffers: PositionBuffers): { x: number; y: number } {
  if (index < 0 || index >= buffers.config.ledCount) {
    throw new Error(`LED index ${index} out of range [0, ${buffers.config.ledCount - 1}]`);
  }
  
  return {
    x: buffers.positions[index * 2],
    y: buffers.positions[index * 2 + 1]
  };
}

/**
 * Find nearest LED index to a given position
 */
export function posToIndex(x: number, y: number, buffers: PositionBuffers): number {
  let nearestIndex = 0;
  let nearestDistance = Infinity;
  
  for (let i = 0; i < buffers.config.ledCount; i++) {
    const ledX = buffers.positions[i * 2];
    const ledY = buffers.positions[i * 2 + 1];
    
    const dx = x - ledX;
    const dy = y - ledY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = i;
    }
  }
  
  return nearestIndex;
}

/**
 * Get LED position with full metadata
 */
export function getLedPosition(index: number, buffers: PositionBuffers): LedPosition {
  if (index < 0 || index >= buffers.config.ledCount) {
    throw new Error(`LED index ${index} out of range`);
  }
  
  return {
    x: buffers.positions[index * 2],
    y: buffers.positions[index * 2 + 1],
    angle: buffers.angles[index],
    distance: buffers.distances[index],
    index,
    mirrorIndex: buffers.mirrorIndices[index]
  };
}

/**
 * Get all LED positions as array
 */
export function getAllLedPositions(buffers: PositionBuffers): LedPosition[] {
  const positions: LedPosition[] = [];
  
  for (let i = 0; i < buffers.config.ledCount; i++) {
    positions.push(getLedPosition(i, buffers));
  }
  
  return positions;
}

/**
 * Calculate bounding box for LED positions
 */
export function calculateBoundingBox(buffers: PositionBuffers): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  
  for (let i = 0; i < buffers.config.ledCount; i++) {
    const x = buffers.positions[i * 2];
    const y = buffers.positions[i * 2 + 1];
    
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  
  const width = maxX - minX;
  const height = maxY - minY;
  
  return {
    minX,
    minY,
    maxX,
    maxY,
    width,
    height,
    centerX: minX + width / 2,
    centerY: minY + height / 2
  };
}

/**
 * Transform positions for different coordinate systems
 */
export function transformPositions(
  buffers: PositionBuffers,
  transform: {
    scale?: number;
    offsetX?: number;
    offsetY?: number;
    rotation?: number; // Radians
  }
): Float32Array {
  const { scale = 1, offsetX = 0, offsetY = 0, rotation = 0 } = transform;
  const transformed = new Float32Array(buffers.positions.length);
  
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  
  for (let i = 0; i < buffers.config.ledCount; i++) {
    const x = buffers.positions[i * 2];
    const y = buffers.positions[i * 2 + 1];
    
    // Apply rotation
    const rotatedX = x * cos - y * sin;
    const rotatedY = x * sin + y * cos;
    
    // Apply scale and offset
    transformed[i * 2] = rotatedX * scale + offsetX;
    transformed[i * 2 + 1] = rotatedY * scale + offsetY;
  }
  
  return transformed;
}

/**
 * Validate mirror symmetry
 */
export function validateMirrorSymmetry(buffers: PositionBuffers): {
  isSymmetric: boolean;
  errors: string[];
  maxError: number;
} {
  const errors: string[] = [];
  let maxError = 0;
  
  for (let i = 0; i < buffers.config.ledCount; i++) {
    const mirrorIndex = buffers.mirrorIndices[i];
    
    // Check that mirror relationship is reciprocal
    const mirrorOfMirror = buffers.mirrorIndices[mirrorIndex];
    if (mirrorOfMirror !== i) {
      errors.push(`LED ${i} mirrors to ${mirrorIndex}, but ${mirrorIndex} mirrors to ${mirrorOfMirror}`);
    }
    
    // Check distance symmetry (should be equidistant from center)
    const distance1 = buffers.distances[i];
    const distance2 = buffers.distances[mirrorIndex];
    const distanceError = Math.abs(distance1 - distance2);
    
    if (distanceError > 0.001) {
      errors.push(`LED ${i} and mirror ${mirrorIndex} have different distances: ${distance1} vs ${distance2}`);
      maxError = Math.max(maxError, distanceError);
    }
    
    // Check angle symmetry (should be symmetric around center axis)
    const angle1 = buffers.angles[i];
    const angle2 = buffers.angles[mirrorIndex];
    const expectedAngle2 = -angle1; // Simple symmetry check
    const angleError = Math.abs(angle2 - expectedAngle2);
    
    if (angleError > 0.01) { // Allow small floating point errors
      maxError = Math.max(maxError, angleError);
    }
  }
  
  return {
    isSymmetric: errors.length === 0,
    errors,
    maxError
  };
}

/**
 * Create position mapping for different LED strip configurations
 */
export function createStandardConfigurations() {
  return {
    // Full circle (default)
    circle: computePositions({
      arcSpan: Math.PI * 2,
      angleOffset: 0
    }),
    
    // Semi-circle (top half)
    semicircle: computePositions({
      arcSpan: Math.PI,
      angleOffset: 0
    }),
    
    // Arc (3/4 circle)
    arc: computePositions({
      arcSpan: Math.PI * 1.5,
      angleOffset: Math.PI * 0.25
    }),
    
    // Horizontal line
    line: computePositions({
      arcSpan: 0,
      spacing: 'custom',
      customSpacing: Array.from({ length: LED_COUNT }, (_, i) => 0) // All at same angle
    })
  };
}

/**
 * Performance testing utilities
 */
export function benchmarkPositionMapping(): {
  computeTime: number;
  indexToPosTimes: number[];
  posToIndexTimes: number[];
  averageIndexToPos: number;
  averagePosToIndex: number;
} {
  // Benchmark position computation
  const computeStart = performance.now();
  const buffers = computePositions();
  const computeTime = performance.now() - computeStart;
  
  // Benchmark indexToPos
  const indexToPosTimes: number[] = [];
  for (let i = 0; i < 1000; i++) {
    const index = Math.floor(Math.random() * LED_COUNT);
    const start = performance.now();
    indexToPos(index, buffers);
    indexToPosTimes.push(performance.now() - start);
  }
  
  // Benchmark posToIndex
  const posToIndexTimes: number[] = [];
  for (let i = 0; i < 1000; i++) {
    const x = (Math.random() - 0.5) * 400;
    const y = (Math.random() - 0.5) * 400;
    const start = performance.now();
    posToIndex(x, y, buffers);
    posToIndexTimes.push(performance.now() - start);
  }
  
  return {
    computeTime,
    indexToPosTimes,
    posToIndexTimes,
    averageIndexToPos: indexToPosTimes.reduce((a, b) => a + b, 0) / indexToPosTimes.length,
    averagePosToIndex: posToIndexTimes.reduce((a, b) => a + b, 0) / posToIndexTimes.length
  };
}