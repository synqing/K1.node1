/**
 * K1.node1 Workflow Type Definitions
 *
 * Defines TypeScript types for workflows and tasks specific to K1 pattern compilation,
 * asset processing, CI/CD, and analytics.
 */

// ============================================================================
// Pattern Compilation Workflow Types
// ============================================================================

export interface PatternCompilationInput {
  patternName: string;
  patternCode: string;  // Pattern graph definition
  targetDevice?: string;
  optimizationLevel?: 'O0' | 'O1' | 'O2' | 'O3';
}

export interface PatternCompilationOutput {
  success: boolean;
  compiledCode?: string;
  binaryPath?: string;
  errors?: string[];
  benchmarks?: {
    compileTimeMs: number;
    binarySize: number;
    memoryUsage: number;
  };
}

export interface PatternTestInput {
  binaryPath: string;
  testSuites: string[];
  deviceId?: string;
}

export interface PatternTestOutput {
  success: boolean;
  testResults: {
    suite: string;
    passed: number;
    failed: number;
    errors: string[];
  }[];
  coveragePercent?: number;
}

export interface PatternBenchmarkInput {
  binaryPath: string;
  deviceId?: string;
  benchmarkType: 'fps' | 'memory' | 'latency' | 'all';
}

export interface PatternBenchmarkOutput {
  fps?: number;
  memoryUsageMb?: number;
  latencyMs?: number;
  powerConsumptionMw?: number;
}

// ============================================================================
// Asset Processing Workflow Types
// ============================================================================

export interface AudioAssetInput {
  audioFileUrl: string;
  targetFormat: 'wav' | 'mp3' | 'flac';
  sampleRate?: number;
  bitDepth?: number;
}

export interface AudioAssetOutput {
  success: boolean;
  processedFileUrl?: string;
  metadata?: {
    duration: number;
    channels: number;
    sampleRate: number;
  };
  errors?: string[];
}

export interface PresetGenerationInput {
  sourcePattern: string;
  variationCount: number;
  parameterRanges: Record<string, { min: number; max: number }>;
}

export interface PresetGenerationOutput {
  success: boolean;
  presets: Array<{
    name: string;
    parameters: Record<string, number>;
  }>;
}

// ============================================================================
// CI/CD Workflow Types
// ============================================================================

export interface BuildInput {
  repository: string;
  branch: string;
  commit: string;
  target: 'firmware' | 'webapp' | 'both';
  environment?: 'dev' | 'staging' | 'production';
}

export interface BuildOutput {
  success: boolean;
  firmwareBinary?: string;
  webappBundle?: string;
  buildLogs: string;
  warnings: string[];
  errors: string[];
}

export interface DeploymentInput {
  buildArtifacts: {
    firmware?: string;
    webapp?: string;
  };
  targetEnvironment: 'dev' | 'staging' | 'production';
  deviceIds?: string[];
  rolloutStrategy?: 'immediate' | 'canary' | 'blue-green';
}

export interface DeploymentOutput {
  success: boolean;
  deployedDevices: string[];
  failedDevices: string[];
  rollbackAvailable: boolean;
}

// ============================================================================
// Analytics Workflow Types
// ============================================================================

export interface TelemetryCollectionInput {
  deviceIds: string[];
  startTime: string;
  endTime: string;
  metrics: string[];
}

export interface TelemetryCollectionOutput {
  success: boolean;
  dataPoints: number;
  storageUrl: string;
  summary: Record<string, {
    avg: number;
    min: number;
    max: number;
    p95: number;
  }>;
}

export interface AnalyticsReportInput {
  telemetryUrl: string;
  reportType: 'usage' | 'performance' | 'errors' | 'comprehensive';
  outputFormat: 'json' | 'pdf' | 'html';
}

export interface AnalyticsReportOutput {
  success: boolean;
  reportUrl: string;
  insights: string[];
  recommendations: string[];
}

// ============================================================================
// Workflow Execution Types
// ============================================================================

export interface WorkflowExecutionRequest {
  workflowName: string;
  input: unknown;
  correlationId?: string;
  priority?: number;
  tags?: Record<string, string>;
}

export interface WorkflowExecutionResponse {
  workflowId: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PAUSED';
  output?: unknown;
  error?: string;
}

export interface WorkflowStatusResponse {
  workflowId: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PAUSED' | 'TERMINATED';
  input: unknown;
  output?: unknown;
  startTime: string;
  endTime?: string;
  tasks: Array<{
    taskName: string;
    status: string;
    startTime: string;
    endTime?: string;
  }>;
}
