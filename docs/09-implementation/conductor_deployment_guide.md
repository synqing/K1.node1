# Conductor Deployment & Operations Guide

**Title:** Production Deployment and Monitoring Runbook
**Owner:** Embedded Firmware Engineer
**Date:** 2025-11-08
**Status:** draft
**Scope:** Complete deployment guide with monitoring, alerting, and troubleshooting
**Related:**
- Analysis: `/docs/05-analysis/conductor_integration_technical_analysis.md`
- Workflows: `/docs/06-reference/conductor_workflow_definitions.md`
- SDK Integration: `/docs/06-reference/conductor_sdk_integration.md`

**Tags:** deployment, monitoring, operations, runbook

---

## Overview

This guide provides step-by-step instructions for deploying Conductor OSS for K1.node1, configuring monitoring, and establishing operational procedures. Follow this guide to go from zero to a production-ready workflow orchestration system.

---

## 1. Prerequisites

### 1.1 System Requirements

**Development (Local Workstation):**
- macOS 10.15+ or Linux
- Docker Desktop 4.0+
- Docker Compose 2.0+
- 8GB RAM minimum
- 20GB free disk space

**Production (Cloud Server):**
- Ubuntu 22.04 LTS or similar
- 4 CPU cores, 8GB RAM
- 50GB SSD storage
- Docker + Docker Compose installed

### 1.2 Software Dependencies

```bash
# On macOS (using Homebrew)
brew install docker docker-compose git

# On Ubuntu/Debian
sudo apt update
sudo apt install -y docker.io docker-compose git

# Add user to docker group (avoid sudo)
sudo usermod -aG docker $USER
```

### 1.3 Network Access

- Conductor Server: Port 8080 (API)
- Conductor UI: Port 8127 (Web UI)
- Elasticsearch: Port 9200 (internal)
- Redis: Port 6379 (internal)
- K1 Device: 192.168.1.104 (local network)
- Prometheus: Port 9090 (metrics)
- Grafana: Port 3000 (dashboards)

---

## 2. Conductor OSS Deployment

### 2.1 Clone Conductor Repository

```bash
# Create workspace directory
mkdir -p ~/conductor-deployment
cd ~/conductor-deployment

# Clone Conductor OSS
git clone https://github.com/conductor-oss/conductor.git
cd conductor
```

### 2.2 Docker Compose Configuration

**Basic Setup (Redis Backend):**

```yaml
# docker/docker-compose-k1.yaml
version: '3.8'

services:
  conductor-server:
    image: conductor:server
    build:
      context: ../
      dockerfile: docker/server/Dockerfile
    environment:
      - CONFIG_PROP=config-redis.properties
    ports:
      - "8080:8080"
      - "8127:8127"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    depends_on:
      - redis
      - elasticsearch
    networks:
      - conductor-network
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    networks:
      - conductor-network
    restart: unless-stopped

  elasticsearch:
    image: elasticsearch:7.17.9
    environment:
      - discovery.type=single-node
      - ES_JAVA_OPTS=-Xms512m -Xmx1024m
      - xpack.security.enabled=false
    ports:
      - "9200:9200"
    volumes:
      - elasticsearch-data:/usr/share/elasticsearch/data
    networks:
      - conductor-network
    restart: unless-stopped

  # Prometheus for metrics
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    networks:
      - conductor-network
    restart: unless-stopped

  # Grafana for dashboards
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - grafana-data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./grafana/datasources:/etc/grafana/provisioning/datasources
    networks:
      - conductor-network
    restart: unless-stopped

volumes:
  redis-data:
  elasticsearch-data:
  prometheus-data:
  grafana-data:

networks:
  conductor-network:
    driver: bridge
```

### 2.3 Start Conductor

```bash
# Build and start all services
docker-compose -f docker/docker-compose-k1.yaml up -d

# View logs
docker-compose -f docker/docker-compose-k1.yaml logs -f conductor-server

# Check service health
docker-compose -f docker/docker-compose-k1.yaml ps
```

**Expected Output:**
```
NAME                     STATUS              PORTS
conductor-server         Up (healthy)        0.0.0.0:8080->8080/tcp
redis                    Up                  0.0.0.0:6379->6379/tcp
elasticsearch            Up                  0.0.0.0:9200->9200/tcp
prometheus               Up                  0.0.0.0:9090->9090/tcp
grafana                  Up                  0.0.0.0:3000->3000/tcp
```

### 2.4 Verify Installation

```bash
# Test Conductor API
curl http://localhost:8080/health

# Expected response:
# {"healthy":true}

# Access Conductor UI
open http://localhost:8127

# Access Prometheus
open http://localhost:9090

# Access Grafana (admin/admin)
open http://localhost:3000
```

---

## 3. Configure Workflow Definitions

### 3.1 Import Workflow via API

```bash
# Import firmware CI/CD workflow
curl -X POST http://localhost:8080/api/metadata/workflow \
  -H "Content-Type: application/json" \
  -d @/Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/06-reference/firmware-ci-cd-workflow.json

# Verify import
curl http://localhost:8080/api/metadata/workflow/firmware-ci-cd-pipeline
```

### 3.2 Register Task Definitions

```bash
# Create task definition JSON
cat > /tmp/platformio-compile-task.json <<'EOF'
{
  "name": "platformio_compile",
  "description": "Compile ESP32 firmware using PlatformIO CLI",
  "retryCount": 1,
  "timeoutSeconds": 300,
  "inputKeys": ["repo", "branch", "commit_sha", "environment", "build_dir"],
  "outputKeys": ["firmware_bin_path", "build_log", "success", "error_message"],
  "ownerEmail": "build-system@k1.reinvented"
}
EOF

# Register task
curl -X POST http://localhost:8080/api/metadata/taskdefs \
  -H "Content-Type: application/json" \
  -d @/tmp/platformio-compile-task.json
```

---

## 4. Deploy Task Workers

### 4.1 Install K1 Conductor Workers

```bash
# Clone K1.node1 repository (if not already)
cd /Users/spectrasynq/Workspace_Management/Software/K1.node1

# Create workers directory
mkdir -p tools/conductor-workers
cd tools/conductor-workers

# Copy SDK integration code from docs
# (Code already provided in /docs/06-reference/conductor_sdk_integration.md)

# Install dependencies
npm install

# Configure environment
cat > .env <<'EOF'
CONDUCTOR_SERVER_URL=http://localhost:8080/api
K1_DEVICE_IP=192.168.1.104
ARTIFACT_STORAGE_PATH=/Users/spectrasynq/conductor-artifacts
PLATFORMIO_PROJECT_PATH=/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware
LOG_LEVEL=info
METRICS_PORT=9090
EOF
```

### 4.2 Start Workers (Development)

```bash
# Build TypeScript
npm run build

# Run workers
npm start

# Or use nodemon for auto-reload during development
npm install -g nodemon
nodemon --watch src --exec "npm start"
```

### 4.3 Start Workers (Production with PM2)

```bash
# Install PM2 globally
npm install -g pm2

# Start workers with PM2
pm2 start dist/index.js --name conductor-workers

# Configure PM2 to start on system boot
pm2 startup
pm2 save

# View logs
pm2 logs conductor-workers

# Monitor workers
pm2 monit
```

---

## 5. Prometheus Configuration

### 5.1 prometheus.yml

```yaml
# docker/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  # Conductor server metrics
  - job_name: 'conductor'
    static_configs:
      - targets: ['conductor-server:8080']
    metrics_path: '/actuator/prometheus'

  # K1 device metrics (if device exposes Prometheus endpoint)
  - job_name: 'k1-device'
    static_configs:
      - targets: ['192.168.1.104:9090']
    scrape_interval: 10s

  # Task workers metrics
  - job_name: 'conductor-workers'
    static_configs:
      - targets: ['host.docker.internal:9091']

alerting:
  alertmanagers:
    - static_configs:
        - targets: []

rule_files:
  - '/etc/prometheus/alerts.yml'
```

### 5.2 Alert Rules

```yaml
# docker/alerts.yml
groups:
  - name: conductor_alerts
    interval: 30s
    rules:
      - alert: HighWorkflowFailureRate
        expr: |
          rate(conductor_workflow_execution_total{status="FAILED"}[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High workflow failure rate detected"
          description: "Workflow failure rate is {{ $value }} per second"

      - alert: WorkflowExecutionTimeout
        expr: |
          conductor_workflow_execution_duration_seconds > 600
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Workflow execution taking too long"
          description: "Workflow {{ $labels.workflow_name }} exceeded 10 minutes"

      - alert: DeviceOffline
        expr: |
          up{job="k1-device"} == 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "K1 device at 192.168.1.104 is offline"
          description: "Device has been unreachable for 5 minutes"

      - alert: LowDeviceHeap
        expr: |
          k1_device_free_heap_bytes < 50000
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "K1 device low on heap memory"
          description: "Free heap is {{ $value }} bytes"
```

---

## 6. Grafana Configuration

### 6.1 Add Prometheus Data Source

```yaml
# docker/grafana/datasources/prometheus.yml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false
```

### 6.2 Import Dashboards

**Workflow Execution Overview Dashboard:**

```json
{
  "dashboard": {
    "title": "Conductor Workflow Execution Overview",
    "panels": [
      {
        "title": "Workflow Success Rate",
        "targets": [
          {
            "expr": "sum(rate(conductor_workflow_execution_total{status=\"COMPLETED\"}[5m])) / sum(rate(conductor_workflow_execution_total[5m]))"
          }
        ],
        "type": "gauge"
      },
      {
        "title": "Workflow Execution Duration",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, conductor_workflow_execution_duration_seconds_bucket)"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Active Workflows",
        "targets": [
          {
            "expr": "conductor_workflow_active_count"
          }
        ],
        "type": "stat"
      }
    ]
  }
}
```

**K1 Device Dashboard:**

```json
{
  "dashboard": {
    "title": "K1 Device Metrics",
    "panels": [
      {
        "title": "Device FPS",
        "targets": [
          {
            "expr": "k1_device_fps"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Free Heap Memory",
        "targets": [
          {
            "expr": "k1_device_free_heap_bytes"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Render Time",
        "targets": [
          {
            "expr": "k1_device_avg_render_time_ms"
          }
        ],
        "type": "graph"
      }
    ]
  }
}
```

---

## 7. GitHub Webhook Setup

### 7.1 Create Webhook Endpoint

```bash
# Deploy webhook handler (Express.js app from SDK integration guide)
cd /Users/spectrasynq/Workspace_Management/Software/K1.node1/tools/conductor-workers

# Create webhook server
mkdir -p webhook-server
cd webhook-server

# Initialize project
npm init -y
npm install express @io-orkes/conductor-javascript

# Copy webhook handler code from SDK integration guide
# (Already provided in conductor_sdk_integration.md section 6.2)

# Start webhook server
npm start
```

### 7.2 Configure GitHub Repository

1. Go to `https://github.com/<username>/K1.node1/settings/hooks`
2. Click "Add webhook"
3. Set Payload URL: `http://<your-server-ip>:3000/webhook/github/push`
4. Content type: `application/json`
5. Secret: (generate secure token)
6. Select events: "Just the push event"
7. Click "Add webhook"

### 7.3 Test Webhook

```bash
# Simulate GitHub push event
curl -X POST http://localhost:3000/webhook/github/push \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=<computed-signature>" \
  -d '{
    "ref": "refs/heads/main",
    "after": "737e3d8",
    "repository": {
      "name": "K1.node1"
    }
  }'
```

---

## 8. Operational Procedures

### 8.1 Daily Health Checks

```bash
# Check Conductor server health
curl http://localhost:8080/health

# Check workflow execution statistics
curl http://localhost:8080/api/admin/stats

# Check worker status (PM2)
pm2 status

# Check disk space for artifacts
df -h /Users/spectrasynq/conductor-artifacts
```

### 8.2 Manual Workflow Execution

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

# Get workflow status
WORKFLOW_ID="<workflow-id-from-response>"
curl http://localhost:8080/api/workflow/${WORKFLOW_ID}

# View workflow execution in UI
open "http://localhost:8127/execution/${WORKFLOW_ID}"
```

### 8.3 Rollback Procedure

```bash
# 1. Identify last known good firmware version
curl http://192.168.1.104/api/device/info

# 2. Trigger rollback workflow
curl -X POST http://localhost:8080/api/workflow/deployment-rollback-handler \
  -H "Content-Type: application/json" \
  -d '{
    "failed_workflow_id": "<failed-workflow-id>",
    "device_ip": "192.168.1.104"
  }'

# 3. Verify rollback success
curl http://192.168.1.104/api/device/info
```

---

## 9. Troubleshooting

### 9.1 Conductor Server Not Starting

**Symptom:** `docker-compose up` fails or Conductor server unhealthy

**Diagnosis:**
```bash
# Check Docker logs
docker-compose -f docker/docker-compose-k1.yaml logs conductor-server

# Check if ports are in use
lsof -i :8080
lsof -i :8127

# Check Elasticsearch health
curl http://localhost:9200/_cluster/health
```

**Solution:**
```bash
# Clear existing data and restart
docker-compose down -v
docker-compose up -d
```

### 9.2 Task Workers Not Polling

**Symptom:** Workers start but don't pick up tasks

**Diagnosis:**
```bash
# Check worker logs
pm2 logs conductor-workers

# Verify tasks are queued
curl http://localhost:8080/api/tasks/queue/all

# Check task definitions registered
curl http://localhost:8080/api/metadata/taskdefs
```

**Solution:**
```bash
# Restart workers
pm2 restart conductor-workers

# Re-register task definitions
curl -X POST http://localhost:8080/api/metadata/taskdefs \
  -H "Content-Type: application/json" \
  -d @task-definitions.json
```

### 9.3 Device Deployment Failures

**Symptom:** OTA deployment task fails repeatedly

**Diagnosis:**
```bash
# Check device is online
ping 192.168.1.104

# Check device API
curl http://192.168.1.104/api/device/info

# Check worker logs for OTA errors
pm2 logs conductor-workers | grep -i "ota"
```

**Solution:**
```bash
# 1. Verify device network connectivity
# 2. Check ArduinoOTA is enabled on device
# 3. Verify upload_port in platformio.ini
# 4. Try manual OTA deployment
cd /Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware
pio run -e esp32-s3-devkitc-1-ota -t upload
```

### 9.4 Workflow Stuck in Running State

**Symptom:** Workflow never completes or fails

**Diagnosis:**
```bash
# Get workflow details
curl http://localhost:8080/api/workflow/${WORKFLOW_ID}?includeTasks=true

# Check task queue
curl http://localhost:8080/api/tasks/queue/all

# Check worker logs
pm2 logs conductor-workers
```

**Solution:**
```bash
# Terminate stuck workflow
curl -X POST http://localhost:8080/api/workflow/${WORKFLOW_ID}/terminate

# Restart from beginning
curl -X POST http://localhost:8080/api/workflow/${WORKFLOW_ID}/restart
```

---

## 10. Backup & Recovery

### 10.1 Backup Workflow Definitions

```bash
# Export all workflow definitions
curl http://localhost:8080/api/metadata/workflow > workflows-backup.json

# Export all task definitions
curl http://localhost:8080/api/metadata/taskdefs > tasks-backup.json
```

### 10.2 Backup Artifacts

```bash
# Create artifact backup
tar -czf conductor-artifacts-$(date +%Y%m%d).tar.gz \
  /Users/spectrasynq/conductor-artifacts

# Copy to remote backup
rsync -avz conductor-artifacts-*.tar.gz user@backup-server:/backups/
```

### 10.3 Disaster Recovery

```bash
# 1. Restore Docker volumes
docker-compose down
docker volume create redis-data
docker volume create elasticsearch-data

# 2. Restore workflow definitions
curl -X POST http://localhost:8080/api/metadata/workflow \
  -H "Content-Type: application/json" \
  -d @workflows-backup.json

# 3. Restore artifacts
tar -xzf conductor-artifacts-latest.tar.gz -C /
```

---

## 11. Performance Tuning

### 11.1 Conductor Server

```yaml
# docker-compose override for production
services:
  conductor-server:
    environment:
      - JAVA_OPTS=-Xms2g -Xmx4g
      - conductor.workflow-execution-lock-timeout=10000
      - conductor.app.taskExecutionPostponeDuration=10
```

### 11.2 Redis Persistence

```yaml
services:
  redis:
    command: redis-server --appendonly yes --appendfsync everysec
    volumes:
      - redis-data:/data
```

### 11.3 Elasticsearch Optimization

```yaml
services:
  elasticsearch:
    environment:
      - ES_JAVA_OPTS=-Xms2g -Xmx2g
      - indices.memory.index_buffer_size=30%
```

---

## 12. Security Hardening

### 12.1 Enable Basic Authentication

```yaml
# docker-compose.yml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./certs:/etc/nginx/certs
    depends_on:
      - conductor-server
```

**nginx.conf:**
```nginx
server {
  listen 443 ssl;
  server_name conductor.k1.local;

  ssl_certificate /etc/nginx/certs/cert.pem;
  ssl_certificate_key /etc/nginx/certs/key.pem;

  auth_basic "Conductor Admin";
  auth_basic_user_file /etc/nginx/.htpasswd;

  location / {
    proxy_pass http://conductor-server:8080;
  }
}
```

### 12.2 Firewall Rules

```bash
# Ubuntu UFW firewall
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 443/tcp  # HTTPS (Conductor UI)
sudo ufw deny 8080/tcp  # Block direct API access
sudo ufw deny 9200/tcp  # Block Elasticsearch
sudo ufw deny 6379/tcp  # Block Redis
sudo ufw enable
```

---

## 13. Migration to Orkes Cloud

### 13.1 Export Workflows

```bash
# Export all workflows from self-hosted
curl http://localhost:8080/api/metadata/workflow > workflows-export.json
```

### 13.2 Import to Orkes Cloud

```bash
# Get Orkes Cloud credentials
ORKES_SERVER_URL="https://play.orkes.io/api"
ORKES_KEY_ID="your-key-id"
ORKES_KEY_SECRET="your-secret"

# Import workflows
curl -X POST ${ORKES_SERVER_URL}/metadata/workflow \
  -H "Content-Type: application/json" \
  -H "X-Authorization: ${ORKES_KEY_ID}:${ORKES_KEY_SECRET}" \
  -d @workflows-export.json
```

### 13.3 Update Worker Configuration

```bash
# Update .env for workers
cat > .env <<EOF
CONDUCTOR_SERVER_URL=https://play.orkes.io/api
CONDUCTOR_AUTH_KEY=${ORKES_KEY_ID}
CONDUCTOR_AUTH_SECRET=${ORKES_KEY_SECRET}
EOF

# Restart workers
pm2 restart conductor-workers
```

---

## 14. Next Steps

- [ ] Complete Phase 1 POC deployment
- [ ] Test firmware CI/CD workflow end-to-end
- [ ] Configure Grafana dashboards with real metrics
- [ ] Set up GitHub webhook for automated builds
- [ ] Document custom task workers
- [ ] Establish on-call runbook for production incidents

---

**Document Status:** Draft - Ready for deployment
**Last Updated:** 2025-11-08
