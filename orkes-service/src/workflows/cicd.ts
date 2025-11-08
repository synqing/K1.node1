/**
 * CI/CD Workflow Definition
 *
 * Orchestrates: Build → Test → Deploy workflows for firmware and webapp
 */

import type { WorkflowDef } from '@io-orkes/conductor-javascript';

/**
 * CI/CD Build and Deploy Workflow
 *
 * Steps:
 * 1. Clone repository
 * 2. Run firmware build (if target includes firmware)
 * 3. Run webapp build (if target includes webapp)
 * 4. Run test suites
 * 5. Security scan
 * 6. Deploy to target environment
 * 7. Health check
 * 8. Rollback on failure
 */
export const cicdWorkflow: WorkflowDef = {
  name: 'k1_cicd_pipeline',
  description: 'Build, test, and deploy K1.node1 firmware and webapp',
  version: 1,
  tasks: [
    // Step 1: Clone repository
    {
      name: 'clone_repository',
      taskReferenceName: 'clone_repository_ref',
      type: 'SIMPLE',
      inputParameters: {
        repository: '${workflow.input.repository}',
        branch: '${workflow.input.branch}',
        commit: '${workflow.input.commit}',
      },
    },

    // Step 2-3: Parallel build (firmware + webapp)
    {
      name: 'parallel_build',
      taskReferenceName: 'parallel_build_ref',
      type: 'FORK_JOIN',
      forkTasks: [
        // Firmware build branch
        [
          {
            name: 'build_firmware',
            taskReferenceName: 'build_firmware_ref',
            type: 'SIMPLE',
            inputParameters: {
              sourceDir: '${clone_repository_ref.output.workspaceDir}/firmware',
              environment: '${workflow.input.environment}',
            },
          },
          {
            name: 'test_firmware',
            taskReferenceName: 'test_firmware_ref',
            type: 'SIMPLE',
            inputParameters: {
              binaryPath: '${build_firmware_ref.output.binaryPath}',
            },
          },
        ],
        // Webapp build branch
        [
          {
            name: 'build_webapp',
            taskReferenceName: 'build_webapp_ref',
            type: 'SIMPLE',
            inputParameters: {
              sourceDir: '${clone_repository_ref.output.workspaceDir}/webapp',
              environment: '${workflow.input.environment}',
            },
          },
          {
            name: 'test_webapp',
            taskReferenceName: 'test_webapp_ref',
            type: 'SIMPLE',
            inputParameters: {
              bundlePath: '${build_webapp_ref.output.bundlePath}',
            },
          },
        ],
      ],
    },

    // Join parallel builds
    {
      name: 'join_builds',
      taskReferenceName: 'join_builds_ref',
      type: 'JOIN',
    },

    // Step 4: Security scan
    {
      name: 'security_scan',
      taskReferenceName: 'security_scan_ref',
      type: 'SIMPLE',
      inputParameters: {
        firmwareBinary: '${build_firmware_ref.output.binaryPath}',
        webappBundle: '${build_webapp_ref.output.bundlePath}',
      },
    },

    // Step 5: Decision - Deploy if all checks pass
    {
      name: 'check_quality_gates',
      taskReferenceName: 'check_quality_gates_ref',
      type: 'SWITCH',
      inputParameters: {
        firmwareTestsPassed: '${test_firmware_ref.output.success}',
        webappTestsPassed: '${test_webapp_ref.output.success}',
        securityPassed: '${security_scan_ref.output.passed}',
      },
      evaluatorType: 'javascript',
      expression:
        '$.firmwareTestsPassed && $.webappTestsPassed && $.securityPassed ? "PASS" : "FAIL"',
      decisionCases: {
        PASS: [
          // Step 6: Deploy
          {
            name: 'deploy',
            taskReferenceName: 'deploy_ref',
            type: 'SIMPLE',
            inputParameters: {
              firmwareBinary: '${build_firmware_ref.output.binaryPath}',
              webappBundle: '${build_webapp_ref.output.bundlePath}',
              targetEnvironment: '${workflow.input.targetEnvironment}',
              rolloutStrategy: '${workflow.input.rolloutStrategy}',
              deviceIds: '${workflow.input.deviceIds}',
            },
          },

          // Step 7: Health check after deployment
          {
            name: 'health_check',
            taskReferenceName: 'health_check_ref',
            type: 'SIMPLE',
            inputParameters: {
              deployedDevices: '${deploy_ref.output.deployedDevices}',
              environment: '${workflow.input.targetEnvironment}',
            },
          },

          // Step 8: Decision - Rollback if health check fails
          {
            name: 'check_health',
            taskReferenceName: 'check_health_ref',
            type: 'SWITCH',
            inputParameters: {
              healthPassed: '${health_check_ref.output.success}',
            },
            decisionCases: {
              false: [
                {
                  name: 'rollback',
                  taskReferenceName: 'rollback_ref',
                  type: 'SIMPLE',
                  inputParameters: {
                    environment: '${workflow.input.targetEnvironment}',
                    deviceIds: '${deploy_ref.output.deployedDevices}',
                  },
                },
              ],
            },
          },
        ],
        FAIL: [
          {
            name: 'notify_failure',
            taskReferenceName: 'notify_failure_ref',
            type: 'SIMPLE',
            inputParameters: {
              firmwareErrors: '${test_firmware_ref.output.errors}',
              webappErrors: '${test_webapp_ref.output.errors}',
              securityIssues: '${security_scan_ref.output.issues}',
            },
          },
        ],
      },
    },
  ],
  outputParameters: {
    success: '${deploy_ref.output.success}',
    firmwareBinary: '${build_firmware_ref.output.binaryPath}',
    webappBundle: '${build_webapp_ref.output.bundlePath}',
    deployedDevices: '${deploy_ref.output.deployedDevices}',
    healthCheckPassed: '${health_check_ref.output.success}',
    rolledBack: '${rollback_ref.output.success}',
  },
  schemaVersion: 2,
  restartable: true,
  timeoutPolicy: 'ALERT_ONLY',
  timeoutSeconds: 3600, // 60 minutes
};

/**
 * Register CI/CD workflow with Orkes
 */
export async function registerCICDWorkflow(client: any): Promise<void> {
  try {
    await client.metadataResource.create(cicdWorkflow, true);
    console.log('[Workflow] Registered: k1_cicd_pipeline');
  } catch (error) {
    console.error('[Workflow] Failed to register CI/CD workflow:', error);
    throw error;
  }
}
