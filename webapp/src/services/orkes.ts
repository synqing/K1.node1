/**
 * Orkes Workflow API Client
 *
 * Frontend client for interacting with the k1 Orkes Service REST endpoints.
 * Provides functions to execute workflows and poll status, plus helpers for pause/resume/retry.
 */

// Base URL resolution: prefer env override, fallback to localhost dev, else same-origin
let baseUrl: string = (() => {
  const fromEnv = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ORKES_SERVICE_BASE_URL) || undefined;
  if (fromEnv) return fromEnv;
  // Default to same-origin proxy path so Vite can forward `/api` → backend
  return '/api/workflows';
})();

function resolve(path: string): string {
  const root = String(baseUrl).replace(/\/$/, '');
  const sub = String(path).replace(/^\//, '');
  return `${root}/${sub}`;
}

// Types mirroring orkes-service/src/types/workflows.ts
export type WorkflowStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PAUSED' | 'TERMINATED';

export interface WorkflowExecutionRequest {
  workflowName: string;
  input: unknown;
  correlationId?: string;
  priority?: number;
  tags?: Record<string, string>;
}

export interface WorkflowExecutionResponse {
  workflowId: string;
  status: WorkflowStatus | 'RUNNING';
  output?: unknown;
  error?: string;
}

export interface WorkflowStatusResponse {
  workflowId: string;
  status: WorkflowStatus;
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

export const orkesClient = {
  getBaseUrl(): string {
    return baseUrl;
  },
  setBaseUrl(url: string): void {
    baseUrl = url;
  },
  async execute(req: WorkflowExecutionRequest): Promise<WorkflowExecutionResponse> {
    const res = await fetch(resolve('/execute'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`Execute failed: ${res.status}`);
    return res.json() as Promise<WorkflowExecutionResponse>;
  },
  async status(workflowId: string): Promise<WorkflowStatusResponse> {
    const res = await fetch(resolve(`/${workflowId}`));
    if (!res.ok) throw new Error(`Status failed: ${res.status}`);
    return res.json() as Promise<WorkflowStatusResponse>;
  },
  async terminate(workflowId: string, reason?: string): Promise<{ success: boolean; workflowId: string }> {
    const res = await fetch(resolve(`/${workflowId}`), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) throw new Error(`Terminate failed: ${res.status}`);
    return res.json() as Promise<{ success: boolean; workflowId: string }>;
  },
  async pause(workflowId: string): Promise<{ success: boolean; workflowId: string; status: 'PAUSED' }> {
    const res = await fetch(resolve(`/${workflowId}/pause`), { method: 'POST' });
    if (!res.ok) throw new Error(`Pause failed: ${res.status}`);
    return res.json() as Promise<{ success: boolean; workflowId: string; status: 'PAUSED' }>;
  },
  async resume(workflowId: string): Promise<{ success: boolean; workflowId: string; status: 'RUNNING' }> {
    const res = await fetch(resolve(`/${workflowId}/resume`), { method: 'POST' });
    if (!res.ok) throw new Error(`Resume failed: ${res.status}`);
    return res.json() as Promise<{ success: boolean; workflowId: string; status: 'RUNNING' }>;
  },
  async retry(workflowId: string, resumeSubworkflowTasks: boolean = false): Promise<{ success: boolean; workflowId: string; status: 'RUNNING' }> {
    const res = await fetch(resolve(`/${workflowId}/retry`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeSubworkflowTasks }),
    });
    if (!res.ok) throw new Error(`Retry failed: ${res.status}`);
    return res.json() as Promise<{ success: boolean; workflowId: string; status: 'RUNNING' }>;
  },
};

// Convenience helpers for the pattern compilation workflow
export interface PatternCompilationInput {
  patternName: string;
  patternCode: string;
  targetDevice?: string;
  optimizationLevel?: 'O0' | 'O1' | 'O2' | 'O3';
}

export function executePatternCompilation(input: PatternCompilationInput) {
  return orkesClient.execute({ workflowName: 'k1_pattern_compilation', input });
}
