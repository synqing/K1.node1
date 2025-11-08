/**
 * End-to-end runner: triggers the pattern compilation workflow and waits for completion.
 *
 * Usage:
 *   npx tsx src/scripts/run-e2e.ts [patternName] [optimizationLevel]
 */
import { orkesConductorClient } from '@io-orkes/conductor-javascript';
import 'dotenv/config';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function runE2E(patternName = 'rainbow_pulse', optimizationLevel: 'O0'|'O1'|'O2'|'O3' = 'O2') {
  const client = await orkesConductorClient({
    serverUrl: process.env.ORKES_SERVER_URL,
    keyId: process.env.ORKES_KEY_ID,
    keySecret: process.env.ORKES_KEY_SECRET,
  });

  const patternCode = `pattern ${patternName} { color: red; timing: pulse(0.5s); }`;

  const workflowId = await client.workflowResource.startWorkflow({
    name: 'k1_pattern_compilation',
    version: 1,
    input: {
      patternName,
      patternCode,
      optimizationLevel,
    },
  });

  // Poll for completion
  const start = Date.now();
  while (true) {
    const status = await client.workflowResource.getExecutionStatus(workflowId, true);
    if (status.status === 'COMPLETED' || status.status === 'FAILED' || status.status === 'TERMINATED') {
      console.log(JSON.stringify({ workflowId, status: status.status, output: status.output || null }, null, 2));
      return status.status === 'COMPLETED' ? 0 : 1;
    }
    if (Date.now() - start > 10 * 60 * 1000) {
      console.log(JSON.stringify({ workflowId, status: 'TIMEOUT' }, null, 2));
      return 2;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , argName, argOpt] = process.argv;
  runE2E(argName, (argOpt as any) || 'O2').then((code) => process.exit(code));
}

export default runE2E;

