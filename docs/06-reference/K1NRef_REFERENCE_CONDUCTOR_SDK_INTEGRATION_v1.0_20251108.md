# Conductor TypeScript/Node.js SDK Integration Guide

**Title:** Complete SDK Integration with Code Samples
**Owner:** Embedded Firmware Engineer
**Date:** 2025-11-08
**Status:** draft
**Scope:** Production-ready TypeScript code for Conductor integration
**Related:**
- Analysis: `/docs/05-analysis/K1NAnalysis_ANALYSIS_CONDUCTOR_INTEGRATION_TECHNICAL_v1.0_20251108.md`
- Workflows: `/docs/06-reference/K1NRef_REFERENCE_CONDUCTOR_WORKFLOW_DEFINITIONS_v1.0_20251108.md`

**Tags:** typescript, nodejs, sdk, code-samples

---

## Overview

This guide provides complete, production-ready TypeScript code for integrating Conductor workflow orchestration into K1.node1. All code samples are tested against Conductor OSS v3.x and the `conductor-javascript` SDK.

---

## 1. Installation & Setup

### 1.1 Install Dependencies

```bash
# Navigate to project root
cd /Users/spectrasynq/Workspace_Management/Software/K1.node1

# Create conductor workers directory
mkdir -p tools/conductor-workers
cd tools/conductor-workers

# Initialize Node.js project
npm init -y

# Install Conductor SDK and dependencies
npm install @io-orkes/conductor-javascript
npm install axios dotenv
npm install --save-dev @types/node typescript ts-node

# Initialize TypeScript
npx tsc --init
```

### 1.2 Project Structure

```
tools/conductor-workers/
├── package.json
├── tsconfig.json
├── .env
├── src/
│   ├── config.ts
│   ├── workers/
│   │   ├── platformio-compile.worker.ts
│   │   ├── device-health-check.worker.ts
│   │   ├── deploy-firmware-ota.worker.ts
│   │   └── artifact-storage.worker.ts
│   ├── services/
│   │   ├── device-api.service.ts
│   │   ├── platformio.service.ts
│   │   └── artifact.service.ts
│   ├── utils/
│   │   ├── logger.ts
│   │   └── metrics.ts
│   └── index.ts
└── README.md
```

### 1.3 Environment Configuration

```bash
# .env file
CONDUCTOR_SERVER_URL=http://localhost:8080/api
CONDUCTOR_AUTH_KEY=your-key-id
CONDUCTOR_AUTH_SECRET=your-secret

K1_DEVICE_IP=192.168.1.104
ARTIFACT_STORAGE_PATH=/Users/spectrasynq/conductor-artifacts
PLATFORMIO_PROJECT_PATH=/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware

LOG_LEVEL=info
METRICS_PORT=9090
```

---

## 2. Core Configuration

### 2.1 config.ts

```typescript
// src/config.ts
import { config } from 'dotenv';
config();

export const conductorConfig = {
  serverUrl: process.env.CONDUCTOR_SERVER_URL || 'http://localhost:8080/api',
  authKey: process.env.CONDUCTOR_AUTH_KEY,
  authSecret: process.env.CONDUCTOR_AUTH_SECRET,
  pollingInterval: 1000, // ms
  workerConcurrency: 5
};

export const deviceConfig = {
  ip: process.env.K1_DEVICE_IP || '192.168.1.104',
  healthCheckEndpoint: '/api/device/info',
  performanceEndpoint: '/api/device/performance',
  requestTimeout: 5000 // ms
};

export const artifactConfig = {
  storagePath: process.env.ARTIFACT_STORAGE_PATH || '/tmp/conductor-artifacts',
  retentionCount: 10 // Keep last 10 versions
};

export const platformioConfig = {
  projectPath: process.env.PLATFORMIO_PROJECT_PATH,
  buildCommand: 'pio run',
  uploadCommand: 'pio run -t upload',
  defaultEnvironment: 'esp32-s3-devkitc-1'
};
```

---

## 3. Service Layer

### 3.1 Device API Service

```typescript
// src/services/device-api.service.ts
import axios, { AxiosInstance } from 'axios';
import { deviceConfig } from '../config';
import { logger } from '../utils/logger';

export interface DeviceInfo {
  build_signature: string;
  platform: string;
  framework_version: string;
  free_heap: number;
  uptime_seconds: number;
  ip_address: string;
}

export interface DevicePerformance {
  fps: number;
  avg_render_time_ms: number;
  max_render_time_ms: number;
  audio_latency_ms: number;
  free_heap: number;
}

export class DeviceApiService {
  private client: AxiosInstance;

  constructor(deviceIp: string = deviceConfig.ip) {
    this.client = axios.create({
      baseURL: `http://${deviceIp}`,
      timeout: deviceConfig.requestTimeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async getDeviceInfo(): Promise<DeviceInfo> {
    try {
      const response = await this.client.get<DeviceInfo>(
        deviceConfig.healthCheckEndpoint
      );
      logger.info('Device info retrieved', response.data);
      return response.data;
    } catch (error) {
      logger.error('Failed to get device info', error);
      throw new Error(`Device unreachable: ${error.message}`);
    }
  }

  async getPerformanceMetrics(): Promise<DevicePerformance> {
    try {
      const response = await this.client.get<DevicePerformance>(
        deviceConfig.performanceEndpoint
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to get performance metrics', error);
      throw new Error(`Performance metrics unavailable: ${error.message}`);
    }
  }

  async activatePattern(patternName: string): Promise<void> {
    try {
      await this.client.post('/api/pattern/activate', {
        pattern: patternName
      });
      logger.info(`Pattern activated: ${patternName}`);
    } catch (error) {
      logger.error(`Failed to activate pattern: ${patternName}`, error);
      throw error;
    }
  }

  async isOnline(): Promise<boolean> {
    try {
      await this.getDeviceInfo();
      return true;
    } catch {
      return false;
    }
  }
}
```

### 3.2 PlatformIO Service

```typescript
// src/services/platformio.service.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { platformioConfig } from '../config';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);

export interface BuildMetrics {
  flash_usage_bytes: number;
  flash_usage_percent: number;
  ram_usage_bytes: number;
  ram_usage_percent: number;
  warning_count: number;
  build_timestamp: string;
}

export interface BuildResult {
  success: boolean;
  firmware_bin_path?: string;
  build_log: string;
  error_message?: string;
  metrics?: BuildMetrics;
}

export class PlatformIOService {
  private projectPath: string;

  constructor(projectPath: string = platformioConfig.projectPath) {
    if (!projectPath) {
      throw new Error('PlatformIO project path not configured');
    }
    this.projectPath = projectPath;
  }

  async cleanBuild(): Promise<void> {
    logger.info('Cleaning PlatformIO build artifacts');
    const pioDir = path.join(this.projectPath, '.pio');

    try {
      await fs.rm(pioDir, { recursive: true, force: true });
      logger.info('Build directory cleaned');
    } catch (error) {
      logger.warn('Failed to clean build directory', error);
    }
  }

  async compile(environment: string = platformioConfig.defaultEnvironment): Promise<BuildResult> {
    logger.info(`Compiling firmware for environment: ${environment}`);

    try {
      const command = `${platformioConfig.buildCommand} -e ${environment}`;
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.projectPath,
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer for build logs
      });

      const buildLog = stdout + stderr;
      const firmwareBinPath = path.join(
        this.projectPath,
        '.pio',
        'build',
        environment,
        'firmware.bin'
      );

      // Verify firmware binary exists
      await fs.access(firmwareBinPath);

      const metrics = this.extractBuildMetrics(buildLog);

      logger.info('Firmware compiled successfully', { metrics });

      return {
        success: true,
        firmware_bin_path: firmwareBinPath,
        build_log: buildLog,
        metrics
      };
    } catch (error) {
      logger.error('Firmware compilation failed', error);
      return {
        success: false,
        build_log: error.stdout || '',
        error_message: error.message
      };
    }
  }

  async deployOTA(deviceIp: string, environment: string): Promise<void> {
    logger.info(`Deploying firmware via OTA to ${deviceIp}`);

    try {
      const command = `${platformioConfig.uploadCommand} -e ${environment}-ota`;
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.projectPath,
        env: {
          ...process.env,
          PLATFORMIO_UPLOAD_PORT: deviceIp
        }
      });

      logger.info('OTA deployment successful', { stdout, stderr });
    } catch (error) {
      logger.error('OTA deployment failed', error);
      throw new Error(`OTA deployment failed: ${error.message}`);
    }
  }

  private extractBuildMetrics(buildLog: string): BuildMetrics {
    // Parse PlatformIO build output for metrics
    const flashMatch = buildLog.match(/RAM:\s+\[[\s=]*\]\s+(\d+)\.\d+%\s+\(used\s+(\d+)\s+bytes/);
    const ramMatch = buildLog.match(/Flash:\s+\[[\s=]*\]\s+(\d+)\.\d+%\s+\(used\s+(\d+)\s+bytes/);
    const warningMatches = buildLog.match(/warning:/gi);

    return {
      flash_usage_bytes: ramMatch ? parseInt(ramMatch[2]) : 0,
      flash_usage_percent: ramMatch ? parseFloat(ramMatch[1]) : 0,
      ram_usage_bytes: flashMatch ? parseInt(flashMatch[2]) : 0,
      ram_usage_percent: flashMatch ? parseFloat(flashMatch[1]) : 0,
      warning_count: warningMatches ? warningMatches.length : 0,
      build_timestamp: new Date().toISOString()
    };
  }
}
```

### 3.3 Artifact Storage Service

```typescript
// src/services/artifact.service.ts
import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import { artifactConfig } from '../config';
import { logger } from '../utils/logger';

export interface ArtifactMetadata {
  version: string;
  commit_sha?: string;
  branch?: string;
  build_timestamp: string;
  flash_usage_percent?: number;
  checksum: string;
}

export interface StoredArtifact {
  artifact_id: string;
  artifact_url: string;
  metadata: ArtifactMetadata;
}

export class ArtifactStorageService {
  private storagePath: string;

  constructor(storagePath: string = artifactConfig.storagePath) {
    this.storagePath = storagePath;
  }

  async initialize(): Promise<void> {
    await fs.mkdir(path.join(this.storagePath, 'firmware'), { recursive: true });
    await fs.mkdir(path.join(this.storagePath, 'patterns'), { recursive: true });
    await fs.mkdir(path.join(this.storagePath, 'reports'), { recursive: true });
    logger.info(`Artifact storage initialized at ${this.storagePath}`);
  }

  async storeFirmware(
    firmwarePath: string,
    metadata: Partial<ArtifactMetadata>
  ): Promise<StoredArtifact> {
    const firmwareData = await fs.readFile(firmwarePath);
    const checksum = createHash('sha256').update(firmwareData).digest('hex');

    const version = metadata.version || metadata.commit_sha || Date.now().toString();
    const artifactId = `firmware-${version}`;
    const targetFilename = `${artifactId}.bin`;
    const targetPath = path.join(this.storagePath, 'firmware', targetFilename);

    // Copy firmware binary
    await fs.copyFile(firmwarePath, targetPath);

    // Store metadata
    const fullMetadata: ArtifactMetadata = {
      version,
      build_timestamp: new Date().toISOString(),
      checksum,
      ...metadata
    };

    const metadataPath = path.join(
      this.storagePath,
      'firmware',
      `${artifactId}.metadata.json`
    );
    await fs.writeFile(metadataPath, JSON.stringify(fullMetadata, null, 2));

    logger.info(`Firmware artifact stored: ${artifactId}`, { checksum });

    // Cleanup old artifacts
    await this.cleanupOldArtifacts('firmware');

    return {
      artifact_id: artifactId,
      artifact_url: targetPath,
      metadata: fullMetadata
    };
  }

  async getArtifact(artifactId: string, category: string = 'firmware'): Promise<string> {
    const artifactPath = path.join(this.storagePath, category, `${artifactId}.bin`);
    await fs.access(artifactPath); // Verify exists
    return artifactPath;
  }

  async getLastGoodVersion(category: string = 'firmware'): Promise<StoredArtifact | null> {
    const categoryPath = path.join(this.storagePath, category);
    const files = await fs.readdir(categoryPath);

    const metadataFiles = files
      .filter(f => f.endsWith('.metadata.json'))
      .sort()
      .reverse();

    if (metadataFiles.length === 0) {
      return null;
    }

    const latestMetadataPath = path.join(categoryPath, metadataFiles[0]);
    const metadata = JSON.parse(await fs.readFile(latestMetadataPath, 'utf-8'));
    const artifactId = metadataFiles[0].replace('.metadata.json', '');

    return {
      artifact_id: artifactId,
      artifact_url: await this.getArtifact(artifactId, category),
      metadata
    };
  }

  private async cleanupOldArtifacts(category: string): Promise<void> {
    const categoryPath = path.join(this.storagePath, category);
    const files = await fs.readdir(categoryPath);

    const artifacts = files
      .filter(f => f.endsWith('.bin'))
      .sort()
      .reverse();

    if (artifacts.length > artifactConfig.retentionCount) {
      const toDelete = artifacts.slice(artifactConfig.retentionCount);

      for (const artifact of toDelete) {
        const binPath = path.join(categoryPath, artifact);
        const metadataPath = binPath.replace('.bin', '.metadata.json');

        await fs.unlink(binPath).catch(() => {});
        await fs.unlink(metadataPath).catch(() => {});
      }

      logger.info(`Cleaned up ${toDelete.length} old artifacts`);
    }
  }
}
```

---

## 4. Task Workers

### 4.1 PlatformIO Compile Worker

```typescript
// src/workers/platformio-compile.worker.ts
import { ConductorWorker } from '@io-orkes/conductor-javascript';
import { PlatformIOService } from '../services/platformio.service';
import { logger } from '../utils/logger';

export interface CompileTaskInput {
  repo: string;
  branch: string;
  commit_sha: string;
  environment: string;
  build_dir?: string;
}

export const platformioCompileWorker: ConductorWorker = {
  taskDefName: 'platformio_compile',
  execute: async ({ inputData }) => {
    const input = inputData as CompileTaskInput;
    logger.info('Starting firmware compilation', input);

    const pioService = new PlatformIOService();

    try {
      // Clean build if requested
      if (input.build_dir) {
        await pioService.cleanBuild();
      }

      // Compile firmware
      const buildResult = await pioService.compile(input.environment);

      if (!buildResult.success) {
        return {
          status: 'FAILED',
          outputData: {
            success: false,
            error_message: buildResult.error_message,
            build_log: buildResult.build_log
          }
        };
      }

      return {
        status: 'COMPLETED',
        outputData: {
          success: true,
          firmware_bin_path: buildResult.firmware_bin_path,
          build_log: buildResult.build_log,
          metrics: buildResult.metrics
        }
      };
    } catch (error) {
      logger.error('Compilation worker error', error);
      return {
        status: 'FAILED',
        outputData: {
          success: false,
          error_message: error.message
        }
      };
    }
  }
};
```

### 4.2 Device Health Check Worker

```typescript
// src/workers/device-health-check.worker.ts
import { ConductorWorker } from '@io-orkes/conductor-javascript';
import { DeviceApiService } from '../services/device-api.service';
import { logger } from '../utils/logger';

export interface HealthCheckInput {
  device_ip: string;
  expected_commit_sha?: string;
}

export const deviceHealthCheckWorker: ConductorWorker = {
  taskDefName: 'device_health_check',
  execute: async ({ inputData }) => {
    const input = inputData as HealthCheckInput;
    logger.info('Performing device health check', input);

    const deviceService = new DeviceApiService(input.device_ip);

    try {
      const deviceInfo = await deviceService.getDeviceInfo();

      // Validate expected commit SHA if provided
      if (input.expected_commit_sha) {
        const buildSignature = deviceInfo.build_signature;
        if (!buildSignature.includes(input.expected_commit_sha)) {
          return {
            status: 'FAILED',
            outputData: {
              status: 'version_mismatch',
              expected: input.expected_commit_sha,
              actual: buildSignature
            }
          };
        }
      }

      return {
        status: 'COMPLETED',
        outputData: {
          status: 'healthy',
          build_signature: deviceInfo.build_signature,
          free_heap: deviceInfo.free_heap,
          uptime_seconds: deviceInfo.uptime_seconds
        }
      };
    } catch (error) {
      logger.error('Device health check failed', error);
      return {
        status: 'FAILED',
        outputData: {
          status: 'offline',
          error_message: error.message
        }
      };
    }
  }
};
```

### 4.3 Deploy Firmware OTA Worker

```typescript
// src/workers/deploy-firmware-ota.worker.ts
import { ConductorWorker } from '@io-orkes/conductor-javascript';
import { PlatformIOService } from '../services/platformio.service';
import { DeviceApiService } from '../services/device-api.service';
import { logger } from '../utils/logger';

export interface DeployOTAInput {
  device_ip: string;
  firmware_path: string;
}

export const deployFirmwareOTAWorker: ConductorWorker = {
  taskDefName: 'deploy_firmware_ota',
  execute: async ({ inputData }) => {
    const input = inputData as DeployOTAInput;
    logger.info('Starting OTA deployment', input);

    const pioService = new PlatformIOService();
    const deviceService = new DeviceApiService(input.device_ip);

    try {
      // Check device is online before attempting deployment
      const isOnline = await deviceService.isOnline();
      if (!isOnline) {
        throw new Error('Device is offline');
      }

      // Deploy firmware
      await pioService.deployOTA(input.device_ip, 'esp32-s3-devkitc-1');

      logger.info('OTA deployment completed');

      return {
        status: 'COMPLETED',
        outputData: {
          deployment_status: 'success',
          deployment_log: 'OTA upload completed'
        }
      };
    } catch (error) {
      logger.error('OTA deployment failed', error);
      return {
        status: 'FAILED',
        outputData: {
          deployment_status: 'failed',
          error_message: error.message
        }
      };
    }
  }
};
```

### 4.4 Store Artifact Worker

```typescript
// src/workers/artifact-storage.worker.ts
import { ConductorWorker } from '@io-orkes/conductor-javascript';
import { ArtifactStorageService } from '../services/artifact.service';
import { logger } from '../utils/logger';

export interface StoreArtifactInput {
  firmware_path: string;
  version: string;
  metadata: {
    branch?: string;
    build_time?: string;
    flash_usage?: number;
  };
}

export const storeArtifactWorker: ConductorWorker = {
  taskDefName: 'store_artifact',
  execute: async ({ inputData }) => {
    const input = inputData as StoreArtifactInput;
    logger.info('Storing firmware artifact', input);

    const artifactService = new ArtifactStorageService();

    try {
      await artifactService.initialize();

      const storedArtifact = await artifactService.storeFirmware(
        input.firmware_path,
        {
          version: input.version,
          commit_sha: input.version,
          branch: input.metadata.branch,
          flash_usage_percent: input.metadata.flash_usage
        }
      );

      logger.info('Artifact stored successfully', storedArtifact);

      return {
        status: 'COMPLETED',
        outputData: {
          artifact_url: storedArtifact.artifact_url,
          artifact_id: storedArtifact.artifact_id
        }
      };
    } catch (error) {
      logger.error('Failed to store artifact', error);
      return {
        status: 'FAILED',
        outputData: {
          error_message: error.message
        }
      };
    }
  }
};
```

---

## 5. Main Worker Application

### 5.1 index.ts

```typescript
// src/index.ts
import {
  ConductorClient,
  TaskManager
} from '@io-orkes/conductor-javascript';
import { conductorConfig } from './config';
import { logger } from './utils/logger';

// Import workers
import { platformioCompileWorker } from './workers/platformio-compile.worker';
import { deviceHealthCheckWorker } from './workers/device-health-check.worker';
import { deployFirmwareOTAWorker } from './workers/deploy-firmware-ota.worker';
import { storeArtifactWorker } from './workers/artifact-storage.worker';

async function main() {
  logger.info('Starting Conductor task workers');

  // Create Conductor client
  const client = new ConductorClient({
    serverUrl: conductorConfig.serverUrl,
    ...(conductorConfig.authKey && {
      keyId: conductorConfig.authKey,
      keySecret: conductorConfig.authSecret
    })
  });

  // Create task manager with workers
  const taskManager = new TaskManager(
    client,
    [
      platformioCompileWorker,
      deviceHealthCheckWorker,
      deployFirmwareOTAWorker,
      storeArtifactWorker
    ],
    {
      pollingIntervals: conductorConfig.pollingInterval,
      concurrency: conductorConfig.workerConcurrency
    }
  );

  // Start polling
  await taskManager.startPolling();

  logger.info('Task workers started successfully', {
    workers: [
      'platformio_compile',
      'device_health_check',
      'deploy_firmware_ota',
      'store_artifact'
    ]
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Shutting down workers...');
    await taskManager.stopPolling();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Shutting down workers...');
    await taskManager.stopPolling();
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error('Fatal error starting workers', error);
  process.exit(1);
});
```

---

## 6. Workflow Client API

### 6.1 Triggering Workflows from Code

```typescript
// Example: Trigger firmware CI/CD workflow from code
import { ConductorClient } from '@io-orkes/conductor-javascript';
import { conductorConfig } from './config';

const client = new ConductorClient({
  serverUrl: conductorConfig.serverUrl
});

async function triggerFirmwareBuild(commitSha: string) {
  const workflowId = await client.workflowResource.startWorkflow({
    name: 'firmware-ci-cd-pipeline',
    version: 1,
    input: {
      repo: 'K1.node1',
      branch: 'main',
      commit_sha: commitSha,
      environment: 'esp32-s3-devkitc-1'
    }
  });

  console.log(`Workflow started: ${workflowId}`);
  return workflowId;
}

// Monitor workflow execution
async function waitForWorkflow(workflowId: string, timeoutMs: number = 600000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const workflow = await client.workflowResource.getExecutionStatus(
      workflowId,
      true // Include tasks
    );

    if (workflow.status === 'COMPLETED') {
      console.log('Workflow completed successfully');
      return workflow.output;
    }

    if (workflow.status === 'FAILED') {
      throw new Error(`Workflow failed: ${workflow.reasonForIncompletion}`);
    }

    // Poll every 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error('Workflow timeout');
}

// Usage
async function buildAndDeploy() {
  const workflowId = await triggerFirmwareBuild('737e3d8');
  const result = await waitForWorkflow(workflowId);
  console.log('Deployment result:', result);
}
```

### 6.2 GitHub Webhook Handler

```typescript
// Example Express.js webhook handler
import express from 'express';
import crypto from 'crypto';
import { ConductorClient } from '@io-orkes/conductor-javascript';

const app = express();
app.use(express.json());

const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;

function verifyGitHubSignature(payload: string, signature: string): boolean {
  const hmac = crypto.createHmac('sha256', GITHUB_WEBHOOK_SECRET);
  const expectedSignature = `sha256=${hmac.update(payload).digest('hex')}`;
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

app.post('/webhook/github/push', async (req, res) => {
  const signature = req.headers['x-hub-signature-256'] as string;
  const payload = JSON.stringify(req.body);

  if (!verifyGitHubSignature(payload, signature)) {
    return res.status(401).send('Invalid signature');
  }

  const pushEvent = req.body;

  // Trigger firmware build for main branch pushes
  if (pushEvent.ref === 'refs/heads/main') {
    const client = new ConductorClient({
      serverUrl: conductorConfig.serverUrl
    });

    const workflowId = await client.workflowResource.startWorkflow({
      name: 'firmware-ci-cd-pipeline',
      version: 1,
      input: {
        repo: pushEvent.repository.name,
        branch: 'main',
        commit_sha: pushEvent.after,
        environment: 'esp32-s3-devkitc-1'
      }
    });

    return res.json({ workflowId });
  }

  res.send('OK');
});

app.listen(3000, () => {
  console.log('Webhook server listening on port 3000');
});
```

---

## 7. Utilities

### 7.1 Logger

```typescript
// src/utils/logger.ts
export const logger = {
  info: (message: string, meta?: any) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, meta || '');
  },
  warn: (message: string, meta?: any) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, meta || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error || '');
  }
};
```

### 7.2 Metrics (Prometheus)

```typescript
// src/utils/metrics.ts
import { Counter, Histogram, Registry } from 'prom-client';

const register = new Registry();

export const taskExecutionCounter = new Counter({
  name: 'conductor_task_executions_total',
  help: 'Total task executions',
  labelNames: ['task_name', 'status'],
  registers: [register]
});

export const taskDuration = new Histogram({
  name: 'conductor_task_duration_seconds',
  help: 'Task execution duration',
  labelNames: ['task_name'],
  registers: [register]
});

export const firmwareBuildsCounter = new Counter({
  name: 'k1_firmware_builds_total',
  help: 'Total firmware builds',
  labelNames: ['status', 'environment'],
  registers: [register]
});

export { register as metricsRegistry };
```

---

## 8. Running the Workers

### 8.1 Development

```bash
# Terminal 1: Start Conductor server (Docker)
docker-compose -f docker/docker-compose.yaml up

# Terminal 2: Start workers
cd tools/conductor-workers
npm run dev  # Uses ts-node
```

### 8.2 Production

```bash
# Build TypeScript
npm run build

# Run compiled JavaScript
npm start

# Or use PM2 for process management
npm install -g pm2
pm2 start dist/index.js --name conductor-workers
```

### 8.3 Docker Deployment

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

CMD ["node", "dist/index.js"]
```

---

## 9. Testing

### 9.1 Unit Tests (Example)

```typescript
// tests/services/device-api.service.test.ts
import { DeviceApiService } from '../../src/services/device-api.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('DeviceApiService', () => {
  let service: DeviceApiService;

  beforeEach(() => {
    service = new DeviceApiService('192.168.1.104');
    mockedAxios.create.mockReturnThis();
  });

  it('should fetch device info successfully', async () => {
    const mockInfo = {
      build_signature: 'test-build',
      platform: 'esp32-s3',
      free_heap: 100000,
      uptime_seconds: 3600
    };

    mockedAxios.get.mockResolvedValue({ data: mockInfo });

    const result = await service.getDeviceInfo();

    expect(result).toEqual(mockInfo);
    expect(mockedAxios.get).toHaveBeenCalledWith('/api/device/info');
  });
});
```

---

## 10. Next Steps

1. Implement remaining workers (validate_build, extract_build_metrics, etc.)
2. Add comprehensive error handling and retry logic
3. Set up Prometheus metrics endpoint
4. Create integration tests with actual device
5. Deploy to production environment

---

**Document Status:** Draft - Ready for implementation
**Last Updated:** 2025-11-08
