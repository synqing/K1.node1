/**
 * Serve the compiled service and run the end-to-end workflow via local REST.
 *
 * Usage:
 *   npm run build && npx tsx src/scripts/serve-and-run.ts
 */
import { spawn } from 'node:child_process';

const SERVICE_URL = process.env.SERVICE_URL || 'http://localhost:4002';

async function wait(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function waitForStatus(timeoutMs = 30000) {
  const start = Date.now();
  while (true) {
    try {
      const res = await fetch(`${SERVICE_URL}/api/status`);
      if (res.ok) return true;
    } catch {}
    if (Date.now() - start > timeoutMs) return false;
    await wait(500);
  }
}

async function run() {
  const child = spawn('node', ['dist/index.js'], { stdio: 'ignore' });
  const killChild = () => { try { child.kill(); } catch {} };
  process.on('SIGINT', killChild);
  process.on('SIGTERM', killChild);

  const ok = await waitForStatus();
  if (!ok) {
    killChild();
    console.error('Service did not become ready');
    process.exit(2);
  }

  // Trigger workflow via local REST
  const body = {
    workflowName: 'k1_pattern_compilation',
    input: {
      patternName: 'rainbow_pulse',
      patternCode: 'pattern rainbow_pulse { color: red; timing: pulse(0.5s); }',
      optimizationLevel: 'O2',
    },
  };

  const execRes = await fetch(`${SERVICE_URL}/api/workflows/execute`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  if (!execRes.ok) {
    killChild();
    console.error('Failed to execute workflow');
    process.exit(3);
  }
  const execJson: any = await execRes.json();
  const workflowId = execJson.workflowId as string;

  // Poll local REST for completion
  const start = Date.now();
  while (true) {
    const s = await fetch(`${SERVICE_URL}/api/workflows/${workflowId}`);
    const data: any = await s.json();
    if (data.status === 'COMPLETED' || data.status === 'FAILED' || data.status === 'TERMINATED') {
      console.log(JSON.stringify(data, null, 2));
      break;
    }
    if (Date.now() - start > 10 * 60 * 1000) {
      console.error('Timeout waiting for workflow');
      break;
    }
    await wait(1000);
  }

  killChild();
}

run().catch((e) => { console.error(e); process.exit(1); });
