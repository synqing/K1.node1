import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orkesClient, executePatternCompilation, WorkflowStatusResponse, WorkflowExecutionResponse, PatternCompilationInput } from '../services/orkes';

// Hook: Execute any workflow by name
export function useExecuteWorkflow() {
  const qc = useQueryClient();
  return useMutation<WorkflowExecutionResponse, Error, { workflowName: string; input: unknown }>({
    mutationFn: async ({ workflowName, input }) => {
      return orkesClient.execute({ workflowName, input });
    },
    onSuccess: (resp) => {
      // Prime the cache with initial status to allow immediate polling
      qc.setQueryData(['workflow', 'status', resp.workflowId], {
        workflowId: resp.workflowId,
        status: resp.status,
        input: {},
        startTime: new Date().toISOString(),
        tasks: [],
      } as Partial<WorkflowStatusResponse>);
    },
  });
}

// Hook: Execute pattern compilation workflow
export function useExecutePatternCompilation() {
  const qc = useQueryClient();
  return useMutation<WorkflowExecutionResponse, Error, PatternCompilationInput>({
    mutationFn: async (input) => executePatternCompilation(input),
    onSuccess: (resp) => {
      qc.invalidateQueries({ queryKey: ['workflow', 'status', resp.workflowId] });
    },
  });
}

// Hook: Poll workflow status by ID
export function useWorkflowStatus(workflowId: string | null | undefined, pollMs: number = 2000) {
  return useQuery<WorkflowStatusResponse>({
    queryKey: ['workflow', 'status', workflowId],
    queryFn: async () => {
      if (!workflowId) throw new Error('workflowId required');
      return orkesClient.status(workflowId);
    },
    enabled: !!workflowId,
    refetchInterval: pollMs,
  });
}

// Hook: Pause/Resume/Retry helpers
export function useWorkflowControls(workflowId: string | null | undefined) {
  const qc = useQueryClient();
  const invalidate = () => {
    if (workflowId) qc.invalidateQueries({ queryKey: ['workflow', 'status', workflowId] });
  };
  return {
    pause: async () => {
      if (!workflowId) throw new Error('workflowId required');
      const res = await orkesClient.pause(workflowId);
      invalidate();
      return res;
    },
    resume: async () => {
      if (!workflowId) throw new Error('workflowId required');
      const res = await orkesClient.resume(workflowId);
      invalidate();
      return res;
    },
    retry: async (resumeSubworkflowTasks: boolean = false) => {
      if (!workflowId) throw new Error('workflowId required');
      const res = await orkesClient.retry(workflowId, resumeSubworkflowTasks);
      invalidate();
      return res;
    },
    terminate: async (reason?: string) => {
      if (!workflowId) throw new Error('workflowId required');
      const res = await orkesClient.terminate(workflowId, reason);
      invalidate();
      return res;
    },
  };
}

