/**
 * Frame Queue with Backpressure Handling
 * 
 * Task 7.4: Implement backpressure handling with frame queue and drop-oldest policy
 * - Lock-free FrameQueue with capacity 2-3 that keeps latest ArrayBuffer/Uint8Array
 * - push() overwrites oldest when full; renderer's rAF loop calls popLatest()
 * - Maintain counters (received, rendered, dropped) for stats
 * - Reuse preallocated buffers to prevent GC churn
 */

import { type LedFrame } from './ledFrameProtocol';

// Frame queue configuration
export interface FrameQueueConfig {
  capacity?: number;
  enableBufferReuse?: boolean;
  maxBufferPoolSize?: number;
  dropPolicy?: 'oldest' | 'newest';
}

// Frame queue statistics
export interface FrameQueueStats {
  received: number;
  rendered: number;
  dropped: number;
  currentSize: number;
  capacity: number;
  dropRate: number;
  bufferPoolSize: number;
  memoryUsage: number; // Estimated bytes
}

// Internal frame wrapper for queue management
interface QueuedFrame {
  frame: LedFrame;
  timestamp: number;
  id: number;
}

/**
 * High-performance frame queue with backpressure handling
 */
export class FrameQueue {
  private config: Required<FrameQueueConfig>;
  private queue: QueuedFrame[] = [];
  private frameIdCounter = 0;
  
  // Statistics
  private stats: FrameQueueStats = {
    received: 0,
    rendered: 0,
    dropped: 0,
    currentSize: 0,
    capacity: 0,
    dropRate: 0,
    bufferPoolSize: 0,
    memoryUsage: 0
  };
  
  // Buffer pool for reuse (prevents GC churn)
  private bufferPool: Uint8Array[] = [];
  private readonly FRAME_SIZE = 540; // 180 LEDs × 3 bytes
  
  // Performance tracking
  private lastStatsUpdate = 0;
  private recentDrops = 0;
  private statsWindow = 1000; // 1 second window for drop rate calculation
  
  constructor(config: FrameQueueConfig = {}) {
    this.config = {
      capacity: 3,
      enableBufferReuse: true,
      maxBufferPoolSize: 10,
      dropPolicy: 'oldest',
      ...config
    };
    
    this.stats.capacity = this.config.capacity;
    
    // Pre-allocate buffer pool
    if (this.config.enableBufferReuse) {
      this.initializeBufferPool();
    }
  }
  
  /**
   * Push new frame to queue (producer side)
   */
  push(frame: LedFrame): boolean {
    const now = performance.now();
    this.stats.received++;
    
    // Create queued frame wrapper
    const queuedFrame: QueuedFrame = {
      frame: this.cloneFrame(frame),
      timestamp: now,
      id: this.frameIdCounter++
    };
    
    // Check if queue is full
    if (this.queue.length >= this.config.capacity) {
      this.handleOverflow(queuedFrame);
    } else {
      // Add to queue
      this.queue.push(queuedFrame);
    }
    
    this.updateStats();
    return true;
  }
  
  /**
   * Pop latest frame from queue (consumer side)
   */
  popLatest(): LedFrame | null {
    if (this.queue.length === 0) {
      return null;
    }
    
    // Get the most recent frame
    const queuedFrame = this.queue.pop()!;
    this.stats.rendered++;
    
    // Return buffer to pool if enabled
    if (this.config.enableBufferReuse) {
      this.returnBuffer(queuedFrame.frame.data);
    }
    
    this.updateStats();
    return queuedFrame.frame;
  }
  
  /**
   * Peek at latest frame without removing it
   */
  peekLatest(): LedFrame | null {
    if (this.queue.length === 0) {
      return null;
    }
    
    return this.queue[this.queue.length - 1].frame;
  }
  
  /**
   * Clear all frames from queue
   */
  clear(): void {
    // Return all buffers to pool
    if (this.config.enableBufferReuse) {
      this.queue.forEach(queuedFrame => {
        this.returnBuffer(queuedFrame.frame.data);
      });
    }
    
    this.queue.length = 0;
    this.updateStats();
  }
  
  /**
   * Get current queue statistics
   */
  getStats(): FrameQueueStats {
    return { ...this.stats };
  }
  
  /**
   * Reset statistics counters
   */
  resetStats(): void {
    this.stats.received = 0;
    this.stats.rendered = 0;
    this.stats.dropped = 0;
    this.stats.dropRate = 0;
    this.recentDrops = 0;
    this.lastStatsUpdate = performance.now();
  }
  
  /**
   * Get queue size
   */
  size(): number {
    return this.queue.length;
  }
  
  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }
  
  /**
   * Check if queue is full
   */
  isFull(): boolean {
    return this.queue.length >= this.config.capacity;
  }
  
  /**
   * Get frame age statistics
   */
  getFrameAges(): {
    oldestAge: number;
    newestAge: number;
    averageAge: number;
  } {
    if (this.queue.length === 0) {
      return { oldestAge: 0, newestAge: 0, averageAge: 0 };
    }
    
    const now = performance.now();
    const ages = this.queue.map(qf => now - qf.timestamp);
    
    return {
      oldestAge: Math.max(...ages),
      newestAge: Math.min(...ages),
      averageAge: ages.reduce((sum, age) => sum + age, 0) / ages.length
    };
  }
  
  /**
   * Handle queue overflow based on drop policy
   */
  private handleOverflow(newFrame: QueuedFrame): void {
    this.stats.dropped++;
    this.recentDrops++;
    
    if (this.config.dropPolicy === 'oldest') {
      // Remove oldest frame and add new one
      const dropped = this.queue.shift();
      if (dropped && this.config.enableBufferReuse) {
        this.returnBuffer(dropped.frame.data);
      }
      this.queue.push(newFrame);
    } else {
      // Drop the new frame (keep existing frames)
      if (this.config.enableBufferReuse) {
        this.returnBuffer(newFrame.frame.data);
      }
    }
  }
  
  /**
   * Clone frame with buffer reuse
   */
  private cloneFrame(frame: LedFrame): LedFrame {
    let dataBuffer: Uint8Array;
    
    if (this.config.enableBufferReuse) {
      dataBuffer = this.getBuffer();
      dataBuffer.set(frame.data);
    } else {
      dataBuffer = new Uint8Array(frame.data);
    }
    
    return {
      ...frame,
      data: dataBuffer,
      timestamp: performance.now() // Update to queue timestamp
    };
  }
  
  /**
   * Get buffer from pool or create new one
   */
  private getBuffer(): Uint8Array {
    if (this.bufferPool.length > 0) {
      return this.bufferPool.pop()!;
    }
    
    return new Uint8Array(this.FRAME_SIZE);
  }
  
  /**
   * Return buffer to pool for reuse
   */
  private returnBuffer(buffer: Uint8Array): void {
    if (this.bufferPool.length < this.config.maxBufferPoolSize) {
      this.bufferPool.push(buffer);
    }
    // If pool is full, let buffer be garbage collected
  }
  
  /**
   * Initialize buffer pool with pre-allocated buffers
   */
  private initializeBufferPool(): void {
    for (let i = 0; i < this.config.maxBufferPoolSize; i++) {
      this.bufferPool.push(new Uint8Array(this.FRAME_SIZE));
    }
  }
  
  /**
   * Update internal statistics
   */
  private updateStats(): void {
    const now = performance.now();
    
    this.stats.currentSize = this.queue.length;
    this.stats.bufferPoolSize = this.bufferPool.length;
    this.stats.memoryUsage = this.estimateMemoryUsage();
    
    // Update drop rate every second
    if (now - this.lastStatsUpdate >= this.statsWindow) {
      const timeWindow = now - this.lastStatsUpdate;
      this.stats.dropRate = (this.recentDrops * 1000) / timeWindow; // drops per second
      
      this.recentDrops = 0;
      this.lastStatsUpdate = now;
    }
  }
  
  /**
   * Estimate memory usage in bytes
   */
  private estimateMemoryUsage(): number {
    const frameSize = this.FRAME_SIZE + 64; // Frame data + overhead
    const queueMemory = this.queue.length * frameSize;
    const poolMemory = this.bufferPool.length * this.FRAME_SIZE;
    
    return queueMemory + poolMemory;
  }
}

/**
 * Adaptive frame queue that adjusts capacity based on performance
 */
export class AdaptiveFrameQueue extends FrameQueue {
  private performanceHistory: number[] = [];
  private lastCapacityAdjustment = 0;
  private adjustmentInterval = 5000; // 5 seconds
  private targetDropRate = 0.05; // 5% drop rate target
  
  constructor(config: FrameQueueConfig = {}) {
    super({
      capacity: 3, // Start with default
      ...config
    });
  }
  
  /**
   * Push with adaptive capacity adjustment
   */
  push(frame: LedFrame): boolean {
    const result = super.push(frame);
    this.considerCapacityAdjustment();
    return result;
  }
  
  /**
   * Consider adjusting queue capacity based on performance
   */
  private considerCapacityAdjustment(): void {
    const now = performance.now();
    
    if (now - this.lastCapacityAdjustment < this.adjustmentInterval) {
      return;
    }
    
    const stats = this.getStats();
    const currentDropRate = stats.dropRate;
    
    // Track performance history
    this.performanceHistory.push(currentDropRate);
    if (this.performanceHistory.length > 10) {
      this.performanceHistory.shift();
    }
    
    // Adjust capacity based on drop rate
    if (currentDropRate > this.targetDropRate * 2 && stats.capacity < 10) {
      // Increase capacity if drop rate is too high
      this.adjustCapacity(stats.capacity + 1);
    } else if (currentDropRate < this.targetDropRate * 0.5 && stats.capacity > 2) {
      // Decrease capacity if drop rate is very low (save memory)
      this.adjustCapacity(stats.capacity - 1);
    }
    
    this.lastCapacityAdjustment = now;
  }
  
  /**
   * Adjust queue capacity
   */
  private adjustCapacity(newCapacity: number): void {
    const oldCapacity = this.config.capacity;
    this.config.capacity = newCapacity;
    
    // If reducing capacity, remove excess frames
    while (this.queue.length > newCapacity) {
      const dropped = this.queue.shift();
      if (dropped && this.config.enableBufferReuse) {
        this.returnBuffer(dropped.frame.data);
      }
    }
    
    console.debug(`[AdaptiveFrameQueue] Capacity adjusted: ${oldCapacity} → ${newCapacity}`);
  }
}

/**
 * Factory function to create appropriate frame queue
 */
export function createFrameQueue(
  config: FrameQueueConfig & { adaptive?: boolean } = {}
): FrameQueue {
  
  if (config.adaptive) {
    return new AdaptiveFrameQueue(config);
  }
  
  return new FrameQueue(config);
}

/**
 * Performance testing utilities
 */
export function benchmarkFrameQueue(): {
  pushTimes: number[];
  popTimes: number[];
  averagePushTime: number;
  averagePopTime: number;
  memoryEfficiency: number;
} {
  const queue = new FrameQueue({ capacity: 3, enableBufferReuse: true });
  
  // Create test frame
  const testFrame: LedFrame = {
    header: { version: 1, type: 1, reserved: 0 },
    timestamp: performance.now(),
    data: new Uint8Array(540).fill(128) // Gray LEDs
  };
  
  const pushTimes: number[] = [];
  const popTimes: number[] = [];
  
  // Benchmark push operations
  for (let i = 0; i < 1000; i++) {
    const start = performance.now();
    queue.push(testFrame);
    pushTimes.push(performance.now() - start);
  }
  
  // Benchmark pop operations
  for (let i = 0; i < 1000; i++) {
    const start = performance.now();
    queue.popLatest();
    popTimes.push(performance.now() - start);
  }
  
  const stats = queue.getStats();
  const memoryEfficiency = stats.bufferPoolSize / (stats.bufferPoolSize + stats.currentSize);
  
  return {
    pushTimes,
    popTimes,
    averagePushTime: pushTimes.reduce((a, b) => a + b, 0) / pushTimes.length,
    averagePopTime: popTimes.reduce((a, b) => a + b, 0) / popTimes.length,
    memoryEfficiency
  };
}