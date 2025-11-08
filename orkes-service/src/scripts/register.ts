/**
 * Register Workflows with Orkes Cloud
 *
 * Usage:
 *   npx tsx src/scripts/register.ts [pattern|cicd|all]
 */

import { getOrkesClient } from '../config/orkes.js';
import { registerPatternCompilationWorkflow } from '../workflows/pattern-compilation.js';
import { registerCICDWorkflow } from '../workflows/cicd.js';

async function main() {
  const target = (process.argv[2] || 'pattern').toLowerCase();

  console.log('[Register] Connecting to Orkes...');
  const client = await getOrkesClient();

  try {
    if (target === 'pattern' || target === 'all') {
      console.log('[Register] Registering: k1_pattern_compilation');
      await registerPatternCompilationWorkflow(client);
    }

    if (target === 'cicd' || target === 'all') {
      console.log('[Register] Registering: k1_cicd_pipeline');
      await registerCICDWorkflow(client);
    }

    console.log('[Register] Done');
    process.exit(0);
  } catch (err) {
    console.error('[Register] Failed:', err);
    process.exit(1);
  }
}

main();

