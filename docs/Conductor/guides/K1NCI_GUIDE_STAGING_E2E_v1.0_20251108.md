# K1.node1 Staging E2E Smoke Test — Device Validation

## Overview

This guide covers the **Staging E2E Smoke** workflow—the final piece that closes the gap between green CI and a live device. It validates your actual device works before you ship.

### What It Does

- **Runs manually or hourly** via GitHub Actions
- **Probes real device endpoints** (/api/health, /api/info, /api/version)
- **Times out safely** with structured logging
- **Exits 0 on success, non-zero on failure**
- **Uploads logs as artifacts** for debugging

---

## Components

### 1. `.github/workflows/staging-e2e.yml`

**Triggers:**
- Manual: GitHub UI → Actions → Staging E2E Smoke → Run workflow
- Scheduled: Hourly (cron: `0 * * * *`) — delete if unwanted

**Environment:** `staging` (special GitHub environment with secrets)

**Secrets:**
- `K1_DEVICE_IP` — Device IP (required)
- `K1_DEVICE_API_TOKEN` — Optional API token (Bearer auth)

**Workflow steps:**
1. Checkout code
2. Setup Node (from .nvmrc)
3. Prepare .env (copy from example)
4. Preflight check (Node ≥20, .env)
5. Resolve device IP (from input or secret)
6. Run k1_smoke.js against device
7. Upload logs as artifact

### 2. `ops/diag/k1_smoke.js`

**Complete device probe script** (no external dependencies, Node 20+ native fetch).

**Usage:**
```bash
node ops/diag/k1_smoke.js --device 192.168.1.50 [--token abc] [--timeout 5000]
```

**Behavior:**
- Probes 3 endpoints: `/api/health`, `/api/info`, `/api/version`
- Expects HTTP 200 for all
- Logs to `ops/diag/.smoke-logs/YYYYMMDD-HHMMSS.txt`
- Outputs structured [SMOKE] lines
- Exits 0 on success, non-zero on failure (exit codes: 2, 10, 11, 99)

**Exit codes:**
| Code | Meaning |
|------|---------|
| 0 | All checks passed |
| 2 | --device required |
| 10 | Fetch error (network/timeout) |
| 11 | Unexpected HTTP status |
| 99 | Unhandled exception |

---

## Setup (One-Time)

### Step 1: Enable GitHub Staging Environment

In your GitHub repo:
1. Go to **Settings** → **Environments**
2. Click **New environment**
3. Name it: `staging`
4. Click **Create environment**

(Optional: Add deployment restrictions if you have a specific branch policy)

### Step 2: Set Secrets

Use GitHub CLI (recommended):

```bash
# Required
gh secret set K1_DEVICE_IP --env staging --body "192.168.1.42"

# Optional (if device requires Bearer token)
gh secret set K1_DEVICE_API_TOKEN --env staging --body "your_jwt_or_token"
```

Or use GitHub UI:
1. Go to repo → **Settings** → **Environments** → **staging**
2. Under "Environment secrets", click **Add secret**
3. Name: `K1_DEVICE_IP`, Value: `192.168.1.42`
4. Repeat for `K1_DEVICE_API_TOKEN` (if needed)

### Step 3: Deploy Workflow

Commit and push `.github/workflows/staging-e2e.yml` to main:

```bash
git add .github/workflows/staging-e2e.yml
git commit -m "Add staging E2E smoke test workflow"
git push origin main
```

---

## Usage

### Manual Smoke Test

1. **GitHub UI:**
   - Go to **Actions** → **Staging E2E Smoke**
   - Click **Run workflow**
   - (Optional) Override device IP in the form
   - Click **Run workflow**

2. **Monitor:**
   - Watch the job execute in real-time
   - Check logs in the job output

3. **Artifacts:**
   - Once complete, download **staging-smoke-logs** (zip)
   - Extract and view the timestamped .txt file

### Scheduled Smoke Tests

The workflow includes:
```yaml
schedule:
  - cron: '0 * * * *'  # Every hour at :00
```

**To disable:** Remove the `schedule:` block from `.github/workflows/staging-e2e.yml`

### Adding Notification Alerts

If a scheduled smoke test fails, you can set up alerts:

1. **GitHub Notifications** (basic):
   - Settings → Notifications
   - Check "Actions" notifications

2. **Slack Integration** (advanced):
   - Add a Slack notification action to the workflow
   - Example:
     ```yaml
     - name: Notify Slack on failure
       if: failure()
       uses: slackapi/slack-github-action@v1
       with:
         webhook-url: ${{ secrets.SLACK_WEBHOOK }}
     ```

---

## Smoke Test Output

### Success Log Example

```
2025-11-07T20:30:45.123Z [SMOKE] START target=http://192.168.1.50 timeoutMs=5000 token=no
2025-11-07T20:30:45.234Z [SMOKE] PROBE health http://192.168.1.50/api/health
2025-11-07T20:30:45.456Z [SMOKE] PASS health status=200 bodySample={"status":"ok","uptime":12345}
2025-11-07T20:30:45.567Z [SMOKE] PROBE info http://192.168.1.50/api/info
2025-11-07T20:30:45.789Z [SMOKE] PASS info status=200 bodySample={"firmware":"v1.2.3","device":"K1-esp32-s3"}
2025-11-07T20:30:45.890Z [SMOKE] PROBE version http://192.168.1.50/api/version
2025-11-07T20:30:46.012Z [SMOKE] PASS version status=200 bodySample={"version":"1.2.3","build":"main"}
2025-11-07T20:30:46.123Z [SMOKE] PASS all checks
```

### Failure Log Example

```
2025-11-07T20:30:45.123Z [SMOKE] START target=http://192.168.1.50 timeoutMs=5000 token=no
2025-11-07T20:30:45.234Z [SMOKE] PROBE health http://192.168.1.50/api/health
2025-11-07T20:30:50.345Z [SMOKE] FAIL health fetch error: AbortError Connection timeout
```

---

## Customization

### Adding More Endpoints

Edit `ops/diag/k1_smoke.js`:

```javascript
const endpoints = [
  { path: '/api/health', expect: 200, label: 'health' },
  { path: '/api/info',   expect: 200, label: 'info' },
  { path: '/api/version', expect: 200, label: 'version' },
  // ADD NEW ENDPOINTS HERE:
  { path: '/api/led/status', expect: 200, label: 'led-status' },
  { path: '/api/metrics', expect: 200, label: 'metrics' },
];
```

No other changes needed. Logs and exit codes will automatically cover new endpoints.

### Changing Timeout

```bash
# In workflow, adjust the --timeout flag:
node ops/diag/k1_smoke.js --device "$IP" --timeout 10000  # 10 seconds
```

Or globally in GitHub Actions:
```yaml
- name: Run k1_smoke (HTTP)
  run: |
    node ops/diag/k1_smoke.js --device "${{ steps.target.outputs.ip }}" \
      --timeout 10000
```

### Device Authentication

If your device requires a Bearer token:

1. Set the secret (one-time):
   ```bash
   gh secret set K1_DEVICE_API_TOKEN --env staging --body "your_token"
   ```

2. Script automatically uses it:
   ```javascript
   const headers = token ? { Authorization: `Bearer ${token}` } : {};
   ```

---

## Acceptance Tests

### Test 1: Local Smoke Test (No Device)

```bash
node ops/diag/k1_smoke.js --device 127.0.0.1 --timeout 1000
```

**Expected:**
- Exit code 10 (fetch error)
- Log shows connection refused
- Message: `[SMOKE] FAIL health fetch error: ...`

### Test 2: Real Device (Manual)

Prerequisite: Device running and on network

```bash
node ops/diag/k1_smoke.js --device 192.168.1.50 --timeout 5000
```

**Expected:**
- Exit code 0 (success)
- Three PASS lines (health, info, version)
- Log file created at `ops/diag/.smoke-logs/YYYYMMDD-HHMMSS.txt`

### Test 3: Device with Token

```bash
K1_DEVICE_API_TOKEN="your_token" node ops/diag/k1_smoke.js --device 192.168.1.50
```

**Expected:**
- Same as Test 2
- Log shows `token=yes`

### Test 4: GitHub Actions Manual Trigger

1. Go to **Actions** → **Staging E2E Smoke**
2. Click **Run workflow**
3. Accept defaults (uses secret K1_DEVICE_IP)
4. Click **Run workflow**

**Expected:**
- Job completes in ~10 seconds
- Upload artifact **staging-smoke-logs**
- Log file is downloadable

### Test 5: Override Device IP at Runtime

1. Go to **Actions** → **Staging E2E Smoke**
2. Click **Run workflow**
3. Enter device IP in the "device_ip" field (e.g., 192.168.1.100)
4. Click **Run workflow**

**Expected:**
- Job uses input IP instead of secret
- Log shows correct target in START line

---

## Troubleshooting

### "No device IP provided"

**Cause:** Neither `--device` arg nor `K1_DEVICE_IP` secret is set.

**Fix:**
```bash
# Local
node ops/diag/k1_smoke.js --device 192.168.1.50

# GitHub Actions: Set secret
gh secret set K1_DEVICE_IP --env staging --body "192.168.1.50"
```

### "fetch error: ... Connection timeout"

**Cause:** Device IP is unreachable or device not running.

**Fix:**
1. Verify device is powered on
2. Ping device: `ping 192.168.1.50`
3. Check network connectivity
4. Increase timeout: `--timeout 10000`

### "Unexpected status=500"

**Cause:** Device endpoint returned error.

**Fix:**
1. Check device logs: `conductor run fw:monitor`
2. Verify endpoints exist: curl device endpoints manually
3. Check firmware version matches expected API

### "Artifact staging-smoke-logs not found"

**Cause:** Workflow didn't run or script crashed before writing logs.

**Fix:**
1. Check workflow run output for errors
2. Run script locally to debug: `node ops/diag/k1_smoke.js --device <IP>`

---

## Integration with Existing Setup

### Conductor Tasks (Unaffected)
```bash
conductor run web:dev           # Still works
conductor run fw:build:release  # Still works
conductor run fw:monitor        # Still works
```

### Pre-Merge Gates (Complementary)
- Pre-merge gates block merges on code quality
- Staging E2E smoke test validates deployed device
- Both can run independently

### Release Workflow (Complementary)
- Release workflow builds and publishes artifacts
- Staging E2E smoke test validates device after deployment
- No conflict

---

## Operational Flow

```
Feature Development
  ↓
Create PR
  ↓ (pre-merge gates run)
Gate — Web & Gate — Firmware pass
  ↓
Merge to main
  ↓ (k1-node1-ci.yml runs)
Full build + test
  ↓
Tag release
  ↓ (release.yml runs)
GitHub Release created
  ↓
Deploy to device
  ↓
Run Staging E2E Smoke (manual or scheduled)
  ↓
Confirm device works → Ready for production
```

---

## Configuration Reference

| Setting | Value | How to Change |
|---------|-------|---------------|
| Device IP | From secret `K1_DEVICE_IP` | `gh secret set K1_DEVICE_IP` |
| API Token | From secret `K1_DEVICE_API_TOKEN` | `gh secret set K1_DEVICE_API_TOKEN` |
| Timeout | 5000 ms | Edit workflow or `--timeout` flag |
| Endpoints | 3 (/api/health, /api/info, /api/version) | Edit `endpoints[]` in k1_smoke.js |
| Schedule | Hourly (0 * * * *) | Edit `schedule.cron` in workflow |

---

## Go/No-Go Checklist

- [ ] Staging environment created in GitHub
- [ ] Secrets configured (K1_DEVICE_IP at minimum)
- [ ] `.github/workflows/staging-e2e.yml` deployed
- [ ] `ops/diag/k1_smoke.js` updated (not stub)
- [ ] Manual test runs successfully on real device
- [ ] Artifacts are created and downloadable
- [ ] (Optional) Scheduled tests are running

---

## Final Notes

- **Zero secrets printed** — Tokens never appear in logs
- **Fast timeouts** — Fails quickly if device unreachable
- **Extensible** — Add endpoints without touching workflow
- **CI/CD closure** — Validates the entire pipeline end-to-end

---

**Status:** Ready for production
**Next:** Deploy workflow, set secrets, run first manual test

