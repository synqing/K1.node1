import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useExecutePatternCompilation, useWorkflowStatus, useWorkflowControls } from '../hooks/useWorkflow';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { toast } from 'sonner';
import { postParams, postDeployBundle, postSelect, testConnection } from '../lib/api';
import { useNodeAuthoring, serializeNodeToPatternCode } from '../store/nodeAuthoring';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select.full';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { K1_PATTERNS, getPatternById } from '../lib/patterns';
import { GRAPH_TEMPLATES } from '../lib/nodeMockData';
import { NodeEditorView } from '../components/views/NodeEditorView';

export default function WorkflowDemo() {
  const { nodeState, setNodeState } = useNodeAuthoring();
  const [patternName, setPatternName] = useState('mono_pulse');
  const defaultIp = (import.meta.env.VITE_TARGET_DEVICE_IP as string) || '192.168.0.15';
  const [deviceIp, setDeviceIp] = useState(defaultIp.startsWith('http') ? defaultIp : `http://${defaultIp}`);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [autoDeploy, setAutoDeploy] = useState(true);
  const [selectedPatternId, setSelectedPatternId] = useState<string>(K1_PATTERNS[0]?.id || 'departure');
  const [deviceConnected, setDeviceConnected] = useState<boolean>(false);
  // Removed unused lastDeployResult state to clear diagnostics
  const exec = useExecutePatternCompilation();
  const statusQuery = useWorkflowStatus(workflowId, 2000);
  const controls = useWorkflowControls(workflowId);
  const getErrorMsg = useCallback((e: unknown) => (e instanceof Error ? e.message : String(e)), []);
  const hasDeployableOutput = useMemo(() => {
    const out = statusQuery.data?.output;
    return !!out && typeof out === 'object';
  }, [statusQuery.data?.output]);
  const hasCompleted = statusQuery.data?.status === 'COMPLETED';
  const deployInFlightRef = useRef(false);

  const execute = async () => {
    try {
      if (!nodeState.nodes || nodeState.nodes.length === 0) {
        toast.error('Node is empty', { description: 'Add nodes and connections before compiling.' });
        return;
      }
      const patternCode = serializeNodeToPatternCode(nodeState);
      const resp = await exec.mutateAsync({ patternName, patternCode, targetDevice: deviceIp });
      setWorkflowId(resp.workflowId);
      toast.success('Workflow started', { description: `ID: ${resp.workflowId}` });
    } catch (e: unknown) {
      toast.error('Failed to start workflow', { description: getErrorMsg(e) });
    }
  };

  const populateSampleNode = useCallback(() => {
    const nodes = GRAPH_TEMPLATES.beginner.nodes.map((n) => ({ ...n }));
    const connections = [
      {
        id: 'conn1',
        source: { nodeId: 'audio1', portId: 'amplitude' },
        target: { nodeId: 'color1', portId: 'value' },
      },
      {
        id: 'conn2',
        source: { nodeId: 'color1', portId: 'color' },
        target: { nodeId: 'output1', portId: 'colors' },
      },
    ];
    setNodeState((prev) => ({
      ...prev,
      nodes,
      connections,
      selectedNodeIds: ['output1'],
      zoom: 1,
      pan: { x: 0, y: 0 },
    }));
    toast.success('Sample node added', {
      description: 'Audio amplitude → HSV value → LED Output',
    });
  }, [setNodeState]);

  const applyBrightness = async (value: number) => {
    try {
      await postParams(deviceIp, { brightness: value });
      toast.success('Brightness applied', { description: `${value}` });
    } catch (e: unknown) {
      toast.error('Failed to apply brightness', { description: getErrorMsg(e) });
    }
  };

  const checkDeviceConnectivity = useCallback(async () => {
    const res = await testConnection(deviceIp);
    setDeviceConnected(res.connected);
    if (!res.connected && res.error) {
      toast.error('Device unreachable', { description: res.error });
    }
    return res.connected;
  }, [deviceIp]);

  useEffect(() => {
    checkDeviceConnectivity().catch(() => {});
  }, [checkDeviceConnectivity]);

  const deployBundle = useCallback(async () => {
    if (!statusQuery.data?.output || typeof statusQuery.data.output !== 'object') {
      toast.error('No deployable output found');
      return;
    }
    const ok = await checkDeviceConnectivity();
    if (!ok) return;
    try {
      deployInFlightRef.current = true;
      const result = await postDeployBundle(deviceIp, statusQuery.data.output as Record<string, unknown>);
      if (result.ok && result.confirmed) {
        toast.success('Bundle deployed');
      } else if (result.ok) {
        toast.success('Bundle deployed (opaque response)', { description: 'no-cors fallback' });
      }
    } catch (e: unknown) {
      toast.error('Deployment failed', { description: getErrorMsg(e) });
    } finally {
      deployInFlightRef.current = false;
    }
  }, [statusQuery.data?.output, checkDeviceConnectivity, deviceIp, getErrorMsg]);

  useEffect(() => {
    if (autoDeploy && hasCompleted && hasDeployableOutput && !deployInFlightRef.current) {
      deployBundle();
    }
  }, [autoDeploy, hasCompleted, hasDeployableOutput, deployBundle]);

  const selectPattern = async (patternId: string) => {
    const pat = getPatternById(patternId);
    if (!pat) {
      toast.error('Unknown pattern ID');
      return;
    }
    const ok = await checkDeviceConnectivity();
    if (!ok) return;
    try {
      const payload = pat.firmwareIndex != null ? { index: pat.firmwareIndex } : { id: pat.id };
      const res = await postSelect(deviceIp, payload);
      if (res.ok) {
        toast.success('Pattern selected', { description: `${pat.name}` });
      }
    } catch (e: unknown) {
      toast.error('Select failed', { description: getErrorMsg(e) });
    }
  };

  return (
    <div style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
      <h1>Workflow Demo: Pattern Compilation</h1>

      <Card style={{ padding: '1rem' }}>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <label htmlFor="patternNameInput">Pattern Name</label>
          <Input id="patternNameInput" value={patternName} onChange={(e) => setPatternName(e.target.value)} />
          <label htmlFor="deviceIpInput">Target Device IP (e.g., http://192.168.1.100)</label>
          <Input id="deviceIpInput" value={deviceIp} onChange={(e) => setDeviceIp(e.target.value)} />
          <div>
            <div>Authoring Node (serialized)</div>
            <pre style={{ width: '100%', fontFamily: 'monospace', background: '#0b0b0b', color: '#ddd', padding: '0.75rem', borderRadius: 8, maxHeight: 280, overflow: 'auto' }}>
              {serializeNodeToPatternCode(nodeState)}
            </pre>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button onClick={execute} disabled={exec.isPending || !nodeState.nodes || nodeState.nodes.length === 0}>
              {exec.isPending ? 'Starting…' : 'Execute Compilation'}
            </Button>
            <Button variant="outline" onClick={() => setWorkflowId(null)} disabled={!workflowId}>
              Clear
            </Button>
            <label style={{ display: 'inline-flex', gap: 8 }}>
              <input type="checkbox" checked={autoDeploy} onChange={(e) => setAutoDeploy(e.target.checked)} />
              Auto-deploy on success
            </label>
          </div>
        </div>
      </Card>

      <Card style={{ padding: '1rem' }}>
        <h2>Node Editor</h2>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Button variant="secondary" onClick={populateSampleNode}>Populate Sample Node</Button>
        </div>
        <div style={{ height: '60vh' }}>
          <NodeEditorView />
        </div>
      </Card>

      <Card style={{ padding: '1rem' }}>
        <h2>Status</h2>
        {!workflowId && <div>No workflow started yet.</div>}
        {workflowId && (
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            <div>
              <strong>ID:</strong> {workflowId}
            </div>
            {statusQuery.isLoading && <div>Polling status…</div>}
            {statusQuery.error && (
              <div style={{ color: 'crimson' }}>
                Error: {statusQuery.error instanceof Error ? statusQuery.error.message : String(statusQuery.error)}
              </div>
            )}
            {statusQuery.data && (
              <div>
                <div>
                  <strong>State:</strong> {statusQuery.data.status}
                </div>
                <div>
                  <strong>Audit Trail</strong>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Task</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Start</TableHead>
                        <TableHead>End</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(statusQuery.data.tasks || []).map((t, idx) => (
                        <TableRow key={`${t.taskName}-${idx}`}>
                          <TableCell>{t.taskName}</TableCell>
                          <TableCell>{t.status}</TableCell>
                          <TableCell>{t.startTime}</TableCell>
                          <TableCell>{t.endTime || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <pre style={{ background: '#111', color: '#ddd', padding: '0.5rem', borderRadius: 8 }}>
                  {JSON.stringify(statusQuery.data.output ?? statusQuery.data, null, 2)}
                </pre>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button variant="secondary" onClick={deployBundle} disabled={!hasDeployableOutput || !hasCompleted}>
                    Deploy Bundle
                  </Button>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button variant="secondary" onClick={() => controls.pause()} disabled={!workflowId}>
                Pause
              </Button>
              <Button variant="secondary" onClick={() => controls.resume()} disabled={!workflowId}>
                Resume
              </Button>
              <Button variant="secondary" onClick={() => controls.retry()} disabled={!workflowId}>
                Retry
              </Button>
              <Button variant="destructive" onClick={() => controls.terminate('user requested')} disabled={!workflowId}>
                Terminate
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card style={{ padding: '1rem' }}>
        <h2>Device Controls</h2>
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <div>
            <label htmlFor="brightnessRange">Brightness</label>
            <input id="brightnessRange" type="range" min={0} max={1} step={0.05} defaultValue={0.8} onChange={(e) => applyBrightness(parseFloat(e.target.value))} />
          </div>
          <div>
            <div>
              <div>Select Pattern</div>
              <Select value={selectedPatternId} onValueChange={(val: string) => setSelectedPatternId(val)}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Choose a pattern" />
                </SelectTrigger>
                <SelectContent>
                  {K1_PATTERNS.map((p) => (
                    <SelectItem value={p.id} key={p.id}>
                      {p.icon} {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div style={{ marginTop: 8 }}>
              <Button variant="secondary" onClick={() => selectPattern(selectedPatternId)} disabled={!deviceConnected}>
                Apply Selection
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
