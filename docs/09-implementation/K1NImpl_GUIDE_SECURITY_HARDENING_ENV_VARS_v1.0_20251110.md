# Security Hardening: Environment Variable Configuration

**Status:** Implemented (Phase 0)
**Date:** November 10, 2025
**Task:** Task 1 — WiFi Credential Removal

---

## Overview

All sensitive credentials (WiFi SSID, password, API keys) have been removed from hardcoded comments and source code. Configuration is now environment-based using `.env` files that are **never committed** to version control.

---

## Changes Made

### 1. Removed Hardcoded Credentials

**File:** `firmware/src/main.cpp` (lines 67-68)

**Before:**
```cpp
// Configuration (hardcoded for Phase A simplicity)
// Updated per user request
// SSID: OPTUS_738CC0N
// Password: parrs45432vw
```

**After:**
```cpp
// Configuration (environment-based per Phase 0 security hardening)
// WiFi credentials must be supplied via environment variables - see .env.example
```

### 2. Created `.env.example`

**File:** `firmware/.env.example`

Template file with all required environment variables and their descriptions. Safe to commit as it contains only placeholder values.

**Contents:**
- `WIFI_SSID` — WiFi network name
- `WIFI_PASSWORD` — WiFi network password
- `DEVICE_HOSTNAME` — Device mDNS hostname
- `DEBUG_LEVEL` — Logging verbosity
- Feature flags for profiler, UART sync, OTA updates

### 3. Pre-Commit Hook

**File:** `.githooks/prevent-credentials`

Automated hook that prevents accidental credential commits by:
- Blocking `.env` files from being staged
- Scanning staged code files for credential patterns (SSID=, PASSWORD=, API_KEY=, etc.)
- Warning on known test credentials

**Installation:**
```bash
cp .githooks/prevent-credentials .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

### 4. Git Configuration

**Status:** `.env` already in `.gitignore`

The `.env` file is protected by `.gitignore` (line 88):
```
.env
.env.local
.env*.local
```

---

## Setup Instructions for Development

### Initial Setup

1. **Copy the template:**
   ```bash
   cd firmware
   cp .env.example .env
   ```

2. **Edit with your credentials:**
   ```bash
   nano .env  # or your preferred editor
   ```

3. **Never commit the `.env` file:**
   ```bash
   # Verify it's ignored
   git check-ignore -v firmware/.env
   # Output: firmware/.env matched pattern .env
   ```

### WiFi Configuration

Edit `firmware/.env`:

```env
# Required: Your WiFi network details
WIFI_SSID=your_network_ssid
WIFI_PASSWORD=your_network_password
DEVICE_HOSTNAME=k1-reinvented
```

### Building with Environment Variables

The PlatformIO build system will automatically read `firmware/.env` during compilation (if using the env file integration).

```bash
cd firmware
pio run -e esp32-s3-devkit
```

---

## Verification

### 1. Grep for Remaining Credentials

Verify no credentials exist in source:

```bash
# Check for hardcoded WiFi patterns
grep -r "SSID.*=" firmware/src/ --include="*.cpp" --include="*.h"
grep -r "PASSWORD.*=" firmware/src/ --include="*.cpp" --include="*.h"

# Check for known test credentials
grep -r "parrs45432vw" firmware/src/
grep -r "OPTUS_738CC0" firmware/src/
```

**Expected output:** No matches

### 2. Binary Inspection

Verify credentials don't appear in compiled binary:

```bash
# After build
strings build/esp32s3devkit*/firmware.elf | grep -i "ssid\|password"

# Expected: No matches or only generic references
```

### 3. Pre-Commit Hook Test

Test that the hook prevents credential commits:

```bash
# Try to stage .env (should fail)
git add firmware/.env
# Output: ERROR: Attempting to commit firmware/.env

# Try to commit with credentials in code (should warn)
echo "// SSID: TestNetwork" >> firmware/src/test.cpp
git add firmware/src/test.cpp
git commit -m "test"
# Output: WARNING: Possible credential pattern detected
```

---

## Best Practices

1. **Never commit `.env`** — Always keep local
2. **Share `.env.example`** — This is the contract for required variables
3. **Rotate credentials regularly** — If credentials are exposed
4. **Use strong passwords** — WiFi and API credentials must be strong
5. **Document new env vars** — Add them to `.env.example` and this guide

---

## Troubleshooting

### Build fails with "credential not found"

**Cause:** `.env` file missing or variables not set

**Solution:**
```bash
cp firmware/.env.example firmware/.env
nano firmware/.env  # Fill in your values
```

### Pre-commit hook blocks legitimate commits

**Cause:** False positive in credential pattern detection

**Solution:**
```bash
# Override (not recommended)
git commit --no-verify -m "message"

# Better: Update the hook pattern and re-enable
```

### WiFi not connecting after deployment

**Cause:** Credentials in `.env` don't match your network

**Solution:**
1. Verify SSID spelling (case-sensitive)
2. Verify password is correct
3. Check WiFi network supports your device (2.4GHz vs 5GHz)
4. Redeploy after updating `.env`

---

## Related Documents

- **CLAUDE.md** § Firmware/ESP-IDF Guardrails — General firmware practices
- **ADR-????** — Future: WiFi provisioning alternative (OOB setup flow)

---

## Changelog

| Date | Change |
|------|--------|
| 2025-11-10 | Initial implementation: removed hardcoded credentials, added .env.example, pre-commit hook |

---

**Next Step:** Verify build passes with no credentials in binary, then proceed to Task 2 (I2S Timeout Protection).
