# Conductor Workflow Definitions for K1.node1

**Title:** Workflow Definitions and Task Catalog
**Owner:** ULTRA Choreographer
**Date:** 2025-11-08
**Status:** draft
**Scope:** Complete workflow definitions in JSON format with task specifications
**Related:**
- Analysis: `/docs/05-analysis/K1NAnalysis_ANALYSIS_CONDUCTOR_INTEGRATION_TECHNICAL_v1.0_20251108.md`
- SDK Integration: `/docs/06-reference/K1NRef_REFERENCE_CONDUCTOR_SDK_INTEGRATION_v1.0_20251108.md`

**Tags:** workflow-definitions, task-catalog, json-spec

---

## Overview

This document provides complete, production-ready workflow definitions for Conductor, tailored to K1.node1's firmware build, deployment, and pattern testing pipelines. All workflows are defined using Conductor's JSON DSL and can be imported directly via the Conductor API or UI.

---

## Workflow 1: Firmware CI/CD Pipeline

### Workflow Definition

```json
{
  "name": "firmware-ci-cd-pipeline",
  "description": "Complete CI/CD pipeline for ESP32 firmware: build, validate, deploy, and verify",
  "version": 1,
  "schemaVersion": 2,
  "ownerEmail": "dev@k1.reinvented",
  "timeoutSeconds": 900,
  "inputParameters": [
    "repo",
    "branch",
    "commit_sha",
    "environment"
  ],
  "outputParameters": {
    "build_success": "${validate_build.output.success}",
    "firmware_path": "${store_artifact.output.artifact_url}",
    "deployment_status": "${device_health_check.output.status}"
  },
  "tasks": [
    {
      "name": "validate_commit",
      "taskReferenceName": "validate_commit",
      "type": "SIMPLE",
      "inputParameters": {
        "repo": "${workflow.input.repo}",
        "commit_sha": "${workflow.input.commit_sha}"
      }
    },
    {
      "name": "clean_build_env",
      "taskReferenceName": "clean_build_env",
      "type": "SIMPLE",
      "inputParameters": {
        "build_dir": "/tmp/k1-build-${workflow.input.commit_sha}"
      }
    },
    {
      "name": "platformio_compile",
      "taskReferenceName": "platformio_compile",
      "type": "SIMPLE",
      "inputParameters": {
        "repo": "${workflow.input.repo}",
        "branch": "${workflow.input.branch}",
        "commit_sha": "${workflow.input.commit_sha}",
        "environment": "${workflow.input.environment}",
        "build_dir": "/tmp/k1-build-${workflow.input.commit_sha}"
      },
      "retryCount": 1,
      "retryLogic": "FIXED",
      "retryDelaySeconds": 30,
      "timeoutSeconds": 300
    },
    {
      "name": "extract_build_metrics",
      "taskReferenceName": "extract_build_metrics",
      "type": "SIMPLE",
      "inputParameters": {
        "firmware_path": "${platformio_compile.output.firmware_bin_path}",
        "build_output": "${platformio_compile.output.build_log}"
      }
    },
    {
      "name": "validate_build",
      "taskReferenceName": "validate_build",
      "type": "SIMPLE",
      "inputParameters": {
        "flash_usage_percent": "${extract_build_metrics.output.flash_usage_percent}",
        "ram_usage_percent": "${extract_build_metrics.output.ram_usage_percent}",
        "warning_count": "${extract_build_metrics.output.warning_count}",
        "max_flash_percent": 70,
        "max_ram_percent": 80,
        "max_warnings": 0
      }
    },
    {
      "name": "decision_deploy_or_fail",
      "taskReferenceName": "decision_deploy_or_fail",
      "type": "DECISION",
      "inputParameters": {
        "success": "${validate_build.output.success}"
      },
      "caseValueParam": "success",
      "decisionCases": {
        "true": [
          {
            "name": "store_artifact",
            "taskReferenceName": "store_artifact",
            "type": "SIMPLE",
            "inputParameters": {
              "firmware_path": "${platformio_compile.output.firmware_bin_path}",
              "version": "${workflow.input.commit_sha}",
              "metadata": {
                "branch": "${workflow.input.branch}",
                "build_time": "${extract_build_metrics.output.build_timestamp}",
                "flash_usage": "${extract_build_metrics.output.flash_usage_percent}"
              }
            }
          },
          {
            "name": "deploy_firmware_ota",
            "taskReferenceName": "deploy_firmware_ota",
            "type": "SIMPLE",
            "inputParameters": {
              "device_ip": "192.168.1.104",
              "firmware_path": "${store_artifact.output.artifact_url}"
            },
            "retryCount": 3,
            "retryLogic": "EXPONENTIAL_BACKOFF",
            "retryDelaySeconds": 60,
            "timeoutSeconds": 180
          },
          {
            "name": "device_health_check",
            "taskReferenceName": "device_health_check",
            "type": "SIMPLE",
            "inputParameters": {
              "device_ip": "192.168.1.104",
              "expected_commit_sha": "${workflow.input.commit_sha}"
            },
            "retryCount": 2,
            "retryLogic": "FIXED",
            "retryDelaySeconds": 10,
            "timeoutSeconds": 30
          }
        ]
      },
      "defaultCase": [
        {
          "name": "send_build_failure_notification",
          "taskReferenceName": "send_build_failure_notification",
          "type": "SIMPLE",
          "inputParameters": {
            "message": "Firmware build failed validation checks",
            "details": "${validate_build.output.failure_reasons}"
          }
        }
      ]
    }
  ],
  "failureWorkflow": "firmware-build-failure-handler",
  "restartable": true
}
```

### Task Definitions

#### 1. validate_commit

```json
{
  "name": "validate_commit",
  "description": "Validate commit metadata and ensure it's safe to build",
  "retryCount": 0,
  "timeoutSeconds": 30,
  "inputKeys": ["repo", "commit_sha"],
  "outputKeys": ["valid", "reason"]
}
```

#### 2. clean_build_env

```json
{
  "name": "clean_build_env",
  "description": "Clean PlatformIO build artifacts to ensure fresh build",
  "retryCount": 1,
  "timeoutSeconds": 60,
  "inputKeys": ["build_dir"],
  "outputKeys": ["cleaned"]
}
```

#### 3. platformio_compile

```json
{
  "name": "platformio_compile",
  "description": "Compile ESP32 firmware using PlatformIO CLI",
  "retryCount": 1,
  "timeoutSeconds": 300,
  "inputKeys": ["repo", "branch", "commit_sha", "environment", "build_dir"],
  "outputKeys": [
    "firmware_bin_path",
    "build_log",
    "success",
    "error_message"
  ],
  "ownerEmail": "build-system@k1.reinvented"
}
```

#### 4. extract_build_metrics

```json
{
  "name": "extract_build_metrics",
  "description": "Parse PlatformIO build output to extract flash/RAM usage and warnings",
  "retryCount": 0,
  "timeoutSeconds": 30,
  "inputKeys": ["firmware_path", "build_output"],
  "outputKeys": [
    "flash_usage_bytes",
    "flash_usage_percent",
    "ram_usage_bytes",
    "ram_usage_percent",
    "warning_count",
    "build_timestamp"
  ]
}
```

#### 5. validate_build

```json
{
  "name": "validate_build",
  "description": "Validate build meets quality gates (flash/RAM usage, zero warnings)",
  "retryCount": 0,
  "timeoutSeconds": 10,
  "inputKeys": [
    "flash_usage_percent",
    "ram_usage_percent",
    "warning_count",
    "max_flash_percent",
    "max_ram_percent",
    "max_warnings"
  ],
  "outputKeys": ["success", "failure_reasons"]
}
```

#### 6. store_artifact

```json
{
  "name": "store_artifact",
  "description": "Store firmware binary and metadata in artifact repository",
  "retryCount": 2,
  "timeoutSeconds": 60,
  "inputKeys": ["firmware_path", "version", "metadata"],
  "outputKeys": ["artifact_url", "artifact_id"]
}
```

#### 7. deploy_firmware_ota

```json
{
  "name": "deploy_firmware_ota",
  "description": "Deploy firmware to ESP32 device via OTA (espota protocol)",
  "retryCount": 3,
  "retryLogic": "EXPONENTIAL_BACKOFF",
  "retryDelaySeconds": 60,
  "timeoutSeconds": 180,
  "inputKeys": ["device_ip", "firmware_path"],
  "outputKeys": ["deployment_status", "deployment_log"],
  "ownerEmail": "deployment@k1.reinvented"
}
```

#### 8. device_health_check

```json
{
  "name": "device_health_check",
  "description": "Verify device is running and reports expected build signature",
  "retryCount": 2,
  "timeoutSeconds": 30,
  "inputKeys": ["device_ip", "expected_commit_sha"],
  "outputKeys": [
    "status",
    "build_signature",
    "free_heap",
    "uptime_seconds"
  ]
}
```

---

## Workflow 2: Pattern Generation & Testing Pipeline

### Workflow Definition

```json
{
  "name": "pattern-generation-testing",
  "description": "Generate, compile, deploy, and validate LED pattern on device",
  "version": 1,
  "schemaVersion": 2,
  "timeoutSeconds": 600,
  "inputParameters": [
    "pattern_name",
    "pattern_params",
    "baseline_version"
  ],
  "outputParameters": {
    "validation_passed": "${compare_performance.output.passed}",
    "report_url": "${generate_report.output.report_url}"
  },
  "tasks": [
    {
      "name": "generate_pattern_code",
      "taskReferenceName": "generate_pattern_code",
      "type": "SIMPLE",
      "inputParameters": {
        "pattern_name": "${workflow.input.pattern_name}",
        "pattern_params": "${workflow.input.pattern_params}"
      }
    },
    {
      "name": "compile_pattern_firmware",
      "taskReferenceName": "compile_pattern_firmware",
      "type": "SUB_WORKFLOW",
      "inputParameters": {
        "subWorkflowName": "firmware-ci-cd-pipeline",
        "subWorkflowVersion": 1,
        "workflowInput": {
          "repo": "K1.node1",
          "branch": "pattern-test",
          "commit_sha": "${generate_pattern_code.output.commit_sha}",
          "environment": "esp32-s3-devkitc-1"
        }
      }
    },
    {
      "name": "run_pattern_validation",
      "taskReferenceName": "run_pattern_validation",
      "type": "SIMPLE",
      "inputParameters": {
        "device_ip": "192.168.1.104",
        "pattern_name": "${workflow.input.pattern_name}",
        "duration_seconds": 30
      }
    },
    {
      "name": "capture_performance_metrics",
      "taskReferenceName": "capture_performance_metrics",
      "type": "SIMPLE",
      "inputParameters": {
        "device_ip": "192.168.1.104",
        "pattern_name": "${workflow.input.pattern_name}"
      }
    },
    {
      "name": "compare_performance",
      "taskReferenceName": "compare_performance",
      "type": "SIMPLE",
      "inputParameters": {
        "current_metrics": "${capture_performance_metrics.output.metrics}",
        "baseline_version": "${workflow.input.baseline_version}",
        "thresholds": {
          "min_fps": 30,
          "max_render_time_ms": 20,
          "max_audio_latency_ms": 50
        }
      }
    },
    {
      "name": "generate_report",
      "taskReferenceName": "generate_report",
      "type": "SIMPLE",
      "inputParameters": {
        "pattern_name": "${workflow.input.pattern_name}",
        "metrics": "${capture_performance_metrics.output.metrics}",
        "comparison": "${compare_performance.output}",
        "validation_passed": "${compare_performance.output.passed}"
      }
    }
  ]
}
```

### Task Definitions

#### 9. generate_pattern_code

```json
{
  "name": "generate_pattern_code",
  "description": "Generate LED pattern source code from specification",
  "retryCount": 0,
  "timeoutSeconds": 60,
  "inputKeys": ["pattern_name", "pattern_params"],
  "outputKeys": ["source_code", "commit_sha"]
}
```

#### 10. run_pattern_validation

```json
{
  "name": "run_pattern_validation",
  "description": "Activate pattern on device and monitor LED output",
  "retryCount": 1,
  "timeoutSeconds": 60,
  "inputKeys": ["device_ip", "pattern_name", "duration_seconds"],
  "outputKeys": ["validation_log", "visual_check_passed"]
}
```

#### 11. capture_performance_metrics

```json
{
  "name": "capture_performance_metrics",
  "description": "Capture FPS, render time, and audio latency from device",
  "retryCount": 2,
  "timeoutSeconds": 45,
  "inputKeys": ["device_ip", "pattern_name"],
  "outputKeys": {
    "metrics": {
      "fps": "number",
      "avg_render_time_ms": "number",
      "max_render_time_ms": "number",
      "audio_latency_ms": "number",
      "free_heap_bytes": "number"
    }
  }
}
```

#### 12. compare_performance

```json
{
  "name": "compare_performance",
  "description": "Compare current pattern performance against baseline",
  "retryCount": 0,
  "timeoutSeconds": 30,
  "inputKeys": ["current_metrics", "baseline_version", "thresholds"],
  "outputKeys": [
    "passed",
    "fps_delta",
    "render_time_delta",
    "regression_detected"
  ]
}
```

#### 13. generate_report

```json
{
  "name": "generate_report",
  "description": "Generate JSON/CSV validation report with metrics and pass/fail status",
  "retryCount": 0,
  "timeoutSeconds": 30,
  "inputKeys": ["pattern_name", "metrics", "comparison", "validation_passed"],
  "outputKeys": ["report_url", "report_data"]
}
```

---

## Workflow 3: Multi-Stage Deployment Workflow

### Workflow Definition

```json
{
  "name": "multi-stage-deployment",
  "description": "Coordinated firmware + webapp deployment with rollback",
  "version": 1,
  "schemaVersion": 2,
  "timeoutSeconds": 1200,
  "inputParameters": [
    "release_version",
    "firmware_commit_sha",
    "webapp_commit_sha"
  ],
  "outputParameters": {
    "deployment_status": "${final_status.output.status}"
  },
  "tasks": [
    {
      "name": "parallel_builds",
      "taskReferenceName": "parallel_builds",
      "type": "FORK_JOIN",
      "forkTasks": [
        [
          {
            "name": "build_firmware",
            "taskReferenceName": "build_firmware",
            "type": "SUB_WORKFLOW",
            "inputParameters": {
              "subWorkflowName": "firmware-ci-cd-pipeline",
              "subWorkflowVersion": 1,
              "workflowInput": {
                "repo": "K1.node1",
                "branch": "main",
                "commit_sha": "${workflow.input.firmware_commit_sha}",
                "environment": "esp32-s3-devkitc-1"
              }
            }
          }
        ],
        [
          {
            "name": "build_webapp",
            "taskReferenceName": "build_webapp",
            "type": "SIMPLE",
            "inputParameters": {
              "repo": "K1.node1",
              "branch": "main",
              "commit_sha": "${workflow.input.webapp_commit_sha}"
            }
          }
        ]
      ]
    },
    {
      "name": "join_builds",
      "taskReferenceName": "join_builds",
      "type": "JOIN",
      "joinOn": ["build_firmware", "build_webapp"]
    },
    {
      "name": "deploy_webapp_staging",
      "taskReferenceName": "deploy_webapp_staging",
      "type": "SIMPLE",
      "inputParameters": {
        "webapp_artifact": "${build_webapp.output.artifact_url}",
        "environment": "staging"
      }
    },
    {
      "name": "deploy_firmware_test_device",
      "taskReferenceName": "deploy_firmware_test_device",
      "type": "SIMPLE",
      "inputParameters": {
        "device_ip": "192.168.1.104",
        "firmware_artifact": "${build_firmware.output.firmware_path}"
      }
    },
    {
      "name": "run_integration_tests",
      "taskReferenceName": "run_integration_tests",
      "type": "SIMPLE",
      "inputParameters": {
        "webapp_url": "${deploy_webapp_staging.output.url}",
        "device_ip": "192.168.1.104"
      }
    },
    {
      "name": "manual_approval_gate",
      "taskReferenceName": "manual_approval_gate",
      "type": "WAIT",
      "inputParameters": {
        "waitTime": "3600"
      }
    },
    {
      "name": "deploy_production",
      "taskReferenceName": "deploy_production",
      "type": "DECISION",
      "inputParameters": {
        "approved": "${manual_approval_gate.output.approved}"
      },
      "caseValueParam": "approved",
      "decisionCases": {
        "true": [
          {
            "name": "deploy_webapp_prod",
            "taskReferenceName": "deploy_webapp_prod",
            "type": "SIMPLE",
            "inputParameters": {
              "webapp_artifact": "${build_webapp.output.artifact_url}",
              "environment": "production"
            }
          },
          {
            "name": "deploy_firmware_prod_device",
            "taskReferenceName": "deploy_firmware_prod_device",
            "type": "SIMPLE",
            "inputParameters": {
              "device_ip": "192.168.1.104",
              "firmware_artifact": "${build_firmware.output.firmware_path}"
            }
          }
        ]
      },
      "defaultCase": [
        {
          "name": "deployment_cancelled",
          "taskReferenceName": "deployment_cancelled",
          "type": "SIMPLE",
          "inputParameters": {
            "reason": "Manual approval rejected"
          }
        }
      ]
    },
    {
      "name": "final_status",
      "taskReferenceName": "final_status",
      "type": "SIMPLE",
      "inputParameters": {
        "deployment_complete": "true"
      }
    }
  ],
  "failureWorkflow": "deployment-rollback-handler"
}
```

---

## Workflow 4: Audio Processing Pipeline

### Workflow Definition

```json
{
  "name": "audio-processing-pipeline",
  "description": "Process audio file to extract features for pattern tuning",
  "version": 1,
  "schemaVersion": 2,
  "timeoutSeconds": 300,
  "inputParameters": [
    "audio_file_url",
    "sample_rate",
    "output_format"
  ],
  "outputParameters": {
    "features_url": "${export_features.output.url}"
  },
  "tasks": [
    {
      "name": "download_audio_file",
      "taskReferenceName": "download_audio_file",
      "type": "SIMPLE",
      "inputParameters": {
        "url": "${workflow.input.audio_file_url}"
      }
    },
    {
      "name": "validate_audio_format",
      "taskReferenceName": "validate_audio_format",
      "type": "SIMPLE",
      "inputParameters": {
        "file_path": "${download_audio_file.output.local_path}",
        "expected_sample_rate": "${workflow.input.sample_rate}"
      }
    },
    {
      "name": "parallel_feature_extraction",
      "taskReferenceName": "parallel_feature_extraction",
      "type": "FORK_JOIN",
      "forkTasks": [
        [
          {
            "name": "extract_tempo",
            "taskReferenceName": "extract_tempo",
            "type": "SIMPLE",
            "inputParameters": {
              "audio_file": "${download_audio_file.output.local_path}"
            }
          }
        ],
        [
          {
            "name": "extract_frequency_spectrum",
            "taskReferenceName": "extract_frequency_spectrum",
            "type": "SIMPLE",
            "inputParameters": {
              "audio_file": "${download_audio_file.output.local_path}",
              "fft_size": 512
            }
          }
        ],
        [
          {
            "name": "extract_envelope",
            "taskReferenceName": "extract_envelope",
            "type": "SIMPLE",
            "inputParameters": {
              "audio_file": "${download_audio_file.output.local_path}"
            }
          }
        ]
      ]
    },
    {
      "name": "join_features",
      "taskReferenceName": "join_features",
      "type": "JOIN",
      "joinOn": ["extract_tempo", "extract_frequency_spectrum", "extract_envelope"]
    },
    {
      "name": "generate_pattern_parameters",
      "taskReferenceName": "generate_pattern_parameters",
      "type": "SIMPLE",
      "inputParameters": {
        "tempo": "${extract_tempo.output.bpm}",
        "frequency_bins": "${extract_frequency_spectrum.output.bins}",
        "envelope": "${extract_envelope.output.envelope}"
      }
    },
    {
      "name": "export_features",
      "taskReferenceName": "export_features",
      "type": "SIMPLE",
      "inputParameters": {
        "features": "${generate_pattern_parameters.output}",
        "format": "${workflow.input.output_format}"
      }
    }
  ]
}
```

### Task Definitions

#### 14. download_audio_file

```json
{
  "name": "download_audio_file",
  "description": "Download audio file from URL to local filesystem",
  "retryCount": 2,
  "timeoutSeconds": 60,
  "inputKeys": ["url"],
  "outputKeys": ["local_path", "file_size_bytes"]
}
```

#### 15. validate_audio_format

```json
{
  "name": "validate_audio_format",
  "description": "Validate audio file format, sample rate, and codec",
  "retryCount": 0,
  "timeoutSeconds": 30,
  "inputKeys": ["file_path", "expected_sample_rate"],
  "outputKeys": ["valid", "sample_rate", "channels", "duration_seconds"]
}
```

#### 16. extract_tempo

```json
{
  "name": "extract_tempo",
  "description": "Extract tempo (BPM) using beat detection algorithm",
  "retryCount": 0,
  "timeoutSeconds": 60,
  "inputKeys": ["audio_file"],
  "outputKeys": ["bpm", "confidence"]
}
```

#### 17. extract_frequency_spectrum

```json
{
  "name": "extract_frequency_spectrum",
  "description": "Compute FFT and extract frequency bins",
  "retryCount": 0,
  "timeoutSeconds": 90,
  "inputKeys": ["audio_file", "fft_size"],
  "outputKeys": ["bins", "dominant_frequency_hz"]
}
```

#### 18. extract_envelope

```json
{
  "name": "extract_envelope",
  "description": "Extract audio amplitude envelope for reactive patterns",
  "retryCount": 0,
  "timeoutSeconds": 60,
  "inputKeys": ["audio_file"],
  "outputKeys": ["envelope", "peak_amplitude", "rms_amplitude"]
}
```

#### 19. generate_pattern_parameters

```json
{
  "name": "generate_pattern_parameters",
  "description": "Generate LED pattern tuning parameters from audio features",
  "retryCount": 0,
  "timeoutSeconds": 30,
  "inputKeys": ["tempo", "frequency_bins", "envelope"],
  "outputKeys": [
    "speed_multiplier",
    "color_palette",
    "reactivity_threshold"
  ]
}
```

#### 20. export_features

```json
{
  "name": "export_features",
  "description": "Export audio features to CSV/JSON format",
  "retryCount": 1,
  "timeoutSeconds": 30,
  "inputKeys": ["features", "format"],
  "outputKeys": ["url", "local_path"]
}
```

---

## Failure Workflow: Firmware Build Failure Handler

### Workflow Definition

```json
{
  "name": "firmware-build-failure-handler",
  "description": "Handle firmware build failures with notifications and cleanup",
  "version": 1,
  "schemaVersion": 2,
  "timeoutSeconds": 120,
  "inputParameters": [
    "failed_workflow_id",
    "failure_reason"
  ],
  "tasks": [
    {
      "name": "extract_failure_context",
      "taskReferenceName": "extract_failure_context",
      "type": "SIMPLE",
      "inputParameters": {
        "workflow_id": "${workflow.input.failed_workflow_id}"
      }
    },
    {
      "name": "cleanup_build_artifacts",
      "taskReferenceName": "cleanup_build_artifacts",
      "type": "SIMPLE",
      "inputParameters": {
        "build_dir": "${extract_failure_context.output.build_dir}"
      }
    },
    {
      "name": "send_failure_notification",
      "taskReferenceName": "send_failure_notification",
      "type": "SIMPLE",
      "inputParameters": {
        "channel": "slack",
        "message": "Firmware build failed: ${workflow.input.failure_reason}",
        "workflow_id": "${workflow.input.failed_workflow_id}"
      }
    },
    {
      "name": "log_failure_metrics",
      "taskReferenceName": "log_failure_metrics",
      "type": "SIMPLE",
      "inputParameters": {
        "failure_type": "build",
        "reason": "${workflow.input.failure_reason}"
      }
    }
  ]
}
```

---

## Deployment Rollback Workflow

### Workflow Definition

```json
{
  "name": "deployment-rollback-handler",
  "description": "Rollback firmware deployment to last known good version",
  "version": 1,
  "schemaVersion": 2,
  "timeoutSeconds": 180,
  "inputParameters": [
    "failed_workflow_id",
    "device_ip"
  ],
  "tasks": [
    {
      "name": "fetch_last_good_version",
      "taskReferenceName": "fetch_last_good_version",
      "type": "SIMPLE",
      "inputParameters": {
        "device_ip": "${workflow.input.device_ip}"
      }
    },
    {
      "name": "rollback_firmware",
      "taskReferenceName": "rollback_firmware",
      "type": "SIMPLE",
      "inputParameters": {
        "device_ip": "${workflow.input.device_ip}",
        "firmware_artifact": "${fetch_last_good_version.output.artifact_url}"
      },
      "retryCount": 2,
      "retryLogic": "FIXED",
      "retryDelaySeconds": 30
    },
    {
      "name": "verify_rollback",
      "taskReferenceName": "verify_rollback",
      "type": "SIMPLE",
      "inputParameters": {
        "device_ip": "${workflow.input.device_ip}",
        "expected_version": "${fetch_last_good_version.output.version}"
      }
    },
    {
      "name": "send_rollback_notification",
      "taskReferenceName": "send_rollback_notification",
      "type": "SIMPLE",
      "inputParameters": {
        "channel": "slack",
        "message": "Firmware rolled back to ${fetch_last_good_version.output.version}",
        "workflow_id": "${workflow.input.failed_workflow_id}"
      }
    }
  ]
}
```

---

## Using These Definitions

### 1. Import Workflows via API

```bash
# Import workflow definition
curl -X POST http://localhost:8080/api/metadata/workflow \
  -H "Content-Type: application/json" \
  -d @firmware-ci-cd-pipeline.json
```

### 2. Import via Conductor UI

1. Navigate to `http://localhost:8127`
2. Go to "Definitions" → "Workflow"
3. Click "Define Workflow"
4. Paste JSON definition
5. Click "Save"

### 3. Start Workflow Execution

```bash
# Start firmware CI/CD workflow
curl -X POST http://localhost:8080/api/workflow/firmware-ci-cd-pipeline \
  -H "Content-Type: application/json" \
  -d '{
    "repo": "K1.node1",
    "branch": "main",
    "commit_sha": "737e3d8",
    "environment": "esp32-s3-devkitc-1"
  }'
```

---

## Next Steps

1. Implement task workers (see `/docs/06-reference/K1NRef_REFERENCE_CONDUCTOR_SDK_INTEGRATION_v1.0_20251108.md`)
2. Test workflows in Conductor UI
3. Set up GitHub webhooks to trigger workflows
4. Configure monitoring and alerting

---

**Document Status:** Draft - Ready for implementation
**Last Updated:** 2025-11-08
