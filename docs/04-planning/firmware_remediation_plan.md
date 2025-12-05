# K1.node1 Firmware - Technical Remediation Plan

**Document Type:** Agent Handover Prompt
**Created:** 2025-12-04
**Purpose:** Complete technical specification for codebase cleanup and stabilization
**Estimated Total Effort:** 2-4 hours across 5 phases

---

## EXECUTIVE CONTEXT

K1.node1 is an ESP32-S3 audio-reactive LED controller firmware. The core functionality **works** - LEDs respond to audio via I2S microphone input, Goertzel DFT, and FastLED output. However, the codebase has accumulated significant technical debt from AI-assisted development cycles that introduced features, broke things, and left dead code behind.

### Key Metrics Revealing the Problem

| Metric | Value | Interpretation |
|--------|-------|----------------|
| Total commits | 315 | |
| Revert commits | 20 (6.3%) | Industry norm <2% |
| Fix commits | 59 (18.7%) | 1 in 5 commits is a "fix" |
| Checkpoint commits | 69 (21.9%) | Automated Claude Code state dumps |
| Dead code | ~1,200 lines | 5.6% of codebase |
| Documentation files | 549 (10MB) | For 21K lines of code |
| Branch state | Diverged | `main` and `cleanup/git-housekeeping` conflict |

### What Works (DO NOT TOUCH)

- `firmware/src/led_driver.cpp` - FastLED output to GPIO 4 & 5
- `firmware/src/audio/microphone.cpp` - I2S input from SPH0645
- `firmware/src/audio/goertzel.cpp` - 64-bin Goertzel DFT
- `firmware/src/audio/tempo.cpp` - Tempo detection (Phase 1 entropy only)
- `firmware/src/patterns/` - All 21 pattern implementations
- `firmware/src/webserver.cpp` - REST API + WebSocket streaming
- `firmware/src/wifi_monitor.cpp` - WiFi state machine (minus hardcoded creds)
- `firmware/src/audio/audio_config.h` - 12800 Hz / 64 samples (Emotiscope parity)

### What Must Be Removed

- CochlearAGC system (instantiated but disabled)
- Phase 3 tempo validation (commented out, never worked)
- Validation stubs and dead infrastructure
- Hardcoded WiFi credentials
- 540+ obsolete documentation files

---

## PHASE 1: DEAD CODE REMOVAL

**Objective:** Remove ~1,200 lines of dead code that is either disabled, commented out, or serves no purpose.
**Risk Level:** LOW - All targets are confirmed dead/disabled
**Estimated Time:** 30-45 minutes
**Verification:** `pio run` succeeds, binary size decreases

### 1.1 Delete CochlearAGC System

**Files to DELETE entirely:**

```
firmware/src/audio/cochlear_agc.h    # 487 lines, 18KB
```

**Evidence it's dead:**
- `main.cpp:847` - `g_cochlear_agc->enable(false);` immediately after creation
- Commit `46be436b` message: "BREAKTHROUGH: LEDS ALIVE!" after removing AGC
- AGC was crushing LED output to black

**Files to MODIFY:**

1. **`firmware/src/main.cpp`** - Remove all AGC references:

   ```cpp
   // DELETE line 47:
   #include "audio/cochlear_agc.h"  // Cochlear AGC v2.1 - Multi-band adaptive gain control

   // DELETE lines 508-515 (AGC debug output in audio task):
   extern CochlearAGC* g_cochlear_agc;
   if (g_cochlear_agc) {
       LOG_DEBUG(TAG_AUDIO, "AGC: gain=%.3f energy=%.6f smooth=%.6f band0=%.3f band2=%.3f",
                g_cochlear_agc->get_global_gain(),
                // ... etc
   }

   // DELETE lines 841-852 (AGC initialization):
   extern CochlearAGC* g_cochlear_agc;
   g_cochlear_agc = new CochlearAGC();
   if (g_cochlear_agc && g_cochlear_agc->initialize(NUM_FREQS, 100.0f)) {
       LOG_INFO(TAG_CORE1, "CochlearAGC v2.1 initialized (disabled by default)");
       g_cochlear_agc->enable(false);
   } else {
       LOG_WARN(TAG_CORE1, "CochlearAGC initialization failed - continuing without AGC");
       delete g_cochlear_agc;
       g_cochlear_agc = nullptr;
   }

   // DELETE lines 1025-1029 (AGC toggle handler):
   extern CochlearAGC* g_cochlear_agc;
   if (g_cochlear_agc) {
       bool agc_enabled = !g_cochlear_agc->is_enabled();
       LOG_INFO(TAG_CORE1, "Toggling AGC: %s", agc_enabled ? "ENABLED" : "DISABLED");
       g_cochlear_agc->enable(agc_enabled);
   }
   ```

2. **`firmware/src/audio/goertzel.cpp`** - Remove AGC include:

   ```cpp
   // DELETE line 17:
   #include "cochlear_agc.h"
   ```

   Search for any `g_cochlear_agc` references and remove.

### 1.2 Delete Phase 3 Validation System

**Files to DELETE entirely:**

```
firmware/src/audio/validation/                    # Entire directory (36KB)
├── README.md                                     # 12,789 bytes
├── tempo_validation.cpp                          # 16,308 bytes
└── tempo_validation.h                            # 7,847 bytes

firmware/src/audio/tempo_validation_stubs.cpp     # 596 bytes
```

**Evidence it's dead:**
- `tempo.cpp:160-166` - `init_tempo_validation_system()` commented out
- `tempo.cpp:444-458` - All Phase 2-4 validation commented out with "PHASE 3 DEFERRED"
- 6+ add/remove cycles in git history (commits `c689404b` through `733344f3`)
- Only `calculate_tempo_entropy()` is actually called (keep this function)

**Files to MODIFY:**

1. **`firmware/src/audio/tempo.cpp`**:

   ```cpp
   // DELETE line 9:
   #include "validation/tempo_validation.h"

   // DELETE lines 160-166 (commented init function):
   // PHASE 3 DISABLED: Commented out to save ~4KB RAM
   /*
   void init_tempo_validation_system() {
       init_tempo_validation();
       Serial.println("[Tempo] Phase 3 validation system initialized");
   }
   */

   // DELETE lines 444-458 (commented Phase 3 code block):
   // ========================================================================
   // PHASE 3 DEFERRED: All other Phase 3 validation commented out
   // Re-enable in subsequent phases
   /*
   // PHASE 2: Temporal stability tracking
   uint16_t dominant_bin = find_dominant_tempo_bin(tempi_smooth, NUM_TEMPI);
   ... etc
   */
   ```

   **KEEP** the `calculate_tempo_entropy()` call at line 435 - this is the only Phase 1 feature that works:
   ```cpp
   float entropy_confidence = calculate_tempo_entropy(tempi_smooth, NUM_TEMPI, tempi_power_sum);
   ```

2. **`firmware/src/audio/goertzel.h`**:

   ```cpp
   // DELETE line 28:
   #include "validation/tempo_validation.h"
   ```

   **NOTE:** The `TempoLockState` enum and `TempoConfidenceMetrics` struct are referenced by `AudioDataPayload` (lines 115-116). You need to either:
   - A) Move these type definitions to `goertzel.h` directly, OR
   - B) Create a minimal `tempo_types.h` with just the types

   **Recommended approach (A):** Add to `goertzel.h` before the `AudioDataPayload` struct:

   ```cpp
   // Tempo lock state (minimal definition for AudioDataPayload)
   enum TempoLockState {
       TEMPO_UNLOCKED = 0,
       TEMPO_LOCKING = 1,
       TEMPO_LOCKED = 2,
       TEMPO_DEGRADING = 3
   };

   // Tempo confidence metrics (minimal definition for AudioDataPayload)
   struct TempoConfidenceMetrics {
       float peak_ratio;
       float entropy_confidence;
       float temporal_stability;
       float combined;
   };
   ```

3. **`firmware/src/main.cpp`**:

   ```cpp
   // DELETE line (search for it):
   #include "audio/validation/tempo_validation.h"
   ```

4. **`firmware/src/webserver.cpp`**:

   ```cpp
   // DELETE line 68 (approximately):
   #include "audio/validation/tempo_validation.h"  // PHASE 3: Tempo validation metrics
   ```

   Search for `tempo_lock_tracker`, `tempo_confidence_metrics`, `get_tempo_lock_state_string()` references. These are used in the `/api/audio/tempo` endpoint. Either:
   - Remove these fields from the API response, OR
   - Provide stub values (recommended for API compatibility)

5. **`firmware/platformio.ini`**:

   ```ini
   # DELETE line 48 from build_src_filter:
   -<**/audio/tempo_validation_stubs.cpp>
   ```

   This exclusion is no longer needed since we're deleting the file.

### 1.3 Implement calculate_tempo_entropy Inline

The `calculate_tempo_entropy()` function is currently defined in the validation module but IS used. Move it to `tempo.cpp`:

```cpp
// Add to tempo.cpp after the includes, before any functions:

// ============================================================================
// ENTROPY-BASED CONFIDENCE (Phase 1 - the only validation that works)
// ============================================================================
// Returns 0.0 (uniform/ambiguous) to 1.0 (clear single peak)
static float calculate_tempo_entropy(const float* magnitudes, uint16_t num_bins, float total_power) {
    if (total_power < 0.0001f) return 0.0f;

    float entropy = 0.0f;
    float inv_power = 1.0f / total_power;

    for (uint16_t i = 0; i < num_bins; i++) {
        float p = magnitudes[i] * inv_power;
        if (p > 0.0001f) {
            entropy -= p * log2f(p);
        }
    }

    // Normalize to 0-1 range (max entropy = log2(num_bins))
    float max_entropy = log2f((float)num_bins);
    float normalized = entropy / max_entropy;

    // Invert: high entropy = low confidence
    return 1.0f - normalized;
}
```

### 1.4 Verification Steps

After all deletions:

```bash
cd /Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware

# Clean build
rm -rf .pio/build

# Compile
pio run

# Expected: SUCCESS with smaller binary
# Check RAM/Flash usage decreased
```

**Expected Results:**
- Build succeeds
- RAM usage decreases by ~4-8KB
- Flash usage decreases by ~20-30KB
- No new warnings

---

## PHASE 2: GIT HISTORY CLEANUP

**Objective:** Resolve branch divergence and establish clean main branch
**Risk Level:** MEDIUM - Requires force push or branch rename
**Estimated Time:** 15-30 minutes
**Prerequisite:** Phase 1 complete and verified

### 2.1 Current Branch State

```
main                      # Has diverged history
cleanup/git-housekeeping  # Has FastLED migration + semantic search commits
HEAD (detached)           # Current working state after Phase 1
```

**Conflict files when merging (11 total):**
- Multiple firmware source files
- Documentation files
- Configuration files

### 2.2 Recommended Approach: Fresh Start

Given the divergence complexity, create a new clean branch:

```bash
# Ensure Phase 1 changes are complete and tested
cd /Users/spectrasynq/Workspace_Management/Software/K1.node1

# Create new branch from current working state
git checkout -b main-v2

# Stage and commit Phase 1 cleanup
git add -A
git commit -m "refactor: remove dead code (AGC, Phase 3 validation, stubs)

REMOVED:
- firmware/src/audio/cochlear_agc.h (487 lines, disabled at boot)
- firmware/src/audio/validation/ directory (36KB, never worked)
- firmware/src/audio/tempo_validation_stubs.cpp (linkage stubs)
- All AGC references from main.cpp, goertzel.cpp
- All Phase 3 validation references from tempo.cpp, webserver.cpp

KEPT:
- calculate_tempo_entropy() moved inline to tempo.cpp (only working validation)
- TempoLockState/TempoConfidenceMetrics types for API compatibility

Build verified: pio run succeeds with reduced binary size

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### 2.3 Branch Resolution Options

**Option A: Replace main (if sole developer)**

```bash
# After committing Phase 1 cleanup to main-v2
git branch -m main main-old
git branch -m main-v2 main
git push origin main --force
git push origin :main-old  # Delete old main from remote
```

**Option B: Merge with conflict resolution (if team)**

```bash
git checkout main
git merge main-v2 --no-commit
# Resolve conflicts manually, preferring main-v2 for firmware/
git commit -m "merge: incorporate cleanup branch with dead code removal"
```

**Option C: Keep parallel (safest)**

```bash
# Keep main-v2 as the active development branch
# Document in README that main-v2 is the canonical branch
git push origin main-v2
```

### 2.4 Cleanup Stale Branches

After resolving main, delete stale branches:

```bash
# Local branches to consider deleting:
git branch -d cleanup/git-housekeeping
git branch -d chore-update-build-config-*  # Multiple variants
git branch -d rescue/workspace-*
git branch -d test/merge-firmware

# Remote tracking branches:
git fetch --prune
```

---

## PHASE 3: CREDENTIAL REMEDIATION

**Objective:** Remove hardcoded WiFi credentials from source code
**Risk Level:** LOW-MEDIUM - Requires testing WiFi provisioning flow
**Estimated Time:** 20-30 minutes
**Prerequisite:** Phase 1 complete

### 3.1 Current Hardcoded Credentials

**File:** `firmware/src/wifi_monitor.cpp`

```cpp
// Line 419-420 (first boot defaults):
strncpy(stored_ssid, "VX220-013F", sizeof(stored_ssid) - 1);
strncpy(stored_pass, "3232AA90E0F24", sizeof(stored_pass) - 1);

// Line 434-435 (fallback network):
strncpy(fallback_ssid, "OPTUS_738CC0N", sizeof(fallback_ssid) - 1);
strncpy(fallback_pass, "parrs45432vw", sizeof(fallback_pass) - 1);
```

### 3.2 Remediation Options

**Option A: Captive Portal Only (Recommended)**

Remove all hardcoded credentials. On first boot, start captive portal immediately:

```cpp
// Replace lines 417-422 with:
} else {
    // FIRST BOOT: No defaults - require user provisioning
    stored_ssid[0] = '\0';
    stored_pass[0] = '\0';
    connection_logf("INFO", "FIRST BOOT: No credentials - starting captive portal");
}

// Replace lines 432-437 with:
} else {
    // No fallback network - captive portal will activate after primary failures
    fallback_ssid[0] = '\0';
    fallback_pass[0] = '\0';
    connection_logf("INFO", "SECONDARY: No fallback configured");
}
```

**Option B: Gitignored Credentials File**

Create `firmware/src/wifi_credentials.h` (gitignored):

```cpp
#ifndef WIFI_CREDENTIALS_H
#define WIFI_CREDENTIALS_H

// DO NOT COMMIT THIS FILE
#define WIFI_DEFAULT_SSID ""
#define WIFI_DEFAULT_PASS ""
#define WIFI_FALLBACK_SSID ""
#define WIFI_FALLBACK_PASS ""

#endif
```

Add to `.gitignore`:
```
firmware/src/wifi_credentials.h
```

Modify `wifi_monitor.cpp` to include and use these defines.

**Option C: Build-time Environment Variables**

Use PlatformIO build flags:

```ini
# platformio.ini
build_flags =
    ${common.build_flags}
    -DWIFI_SSID=\"${sysenv.WIFI_SSID}\"
    -DWIFI_PASS=\"${sysenv.WIFI_PASS}\"
```

### 3.3 Verification

After credential removal:

1. Flash firmware to device
2. Verify device starts captive portal (AP mode) on first boot
3. Connect to AP, configure WiFi via web interface
4. Verify credentials persist in NVS after reboot
5. Verify fallback behavior when primary network unavailable

---

## PHASE 4: DOCUMENTATION PURGE

**Objective:** Reduce 549 documentation files (10MB) to essential subset
**Risk Level:** LOW - Documentation only, no code impact
**Estimated Time:** 30-45 minutes
**Can be done independently of other phases**

### 4.1 Documentation Inventory

```
docs/
├── 01-architecture/    # 15 files - KEEP key files
├── 02-adr/             # 29 files - KEEP all (Architecture Decision Records)
├── 03-guides/          # 9 files - KEEP all
├── 04-planning/        # 65 files - DELETE most (obsolete plans)
├── 05-analysis/        # 111 files - ARCHIVE (forensic history)
├── 06-reference/       # 46 files - KEEP key files
├── 07-resources/       # 27 files - REVIEW
├── 08-governance/      # 8 files - KEEP
├── 09-implementation/  # 57 files - DELETE most (completed/abandoned)
├── 09-reports/         # 57 files - ARCHIVE
└── Various loose files
```

### 4.2 Keep List (Essential Documentation)

```
docs/
├── README.md                                    # If exists
├── K1N_INDEX_v1.0_20251108.md                  # Master index
├── 01-architecture/
│   └── K1NArch_DOCUMENTATION_COMPREHENSIVE_TECHNICAL_v1.0_20251109.md
├── 02-adr/                                      # Keep ALL ADRs
│   └── *.md
├── 03-guides/                                   # Keep ALL guides
│   └── *.md
├── 06-reference/
│   ├── API documentation files
│   └── Hardware pinout files
└── 08-governance/                               # Keep ALL
    └── *.md
```

### 4.3 Archive List (Move to `docs/_archive/`)

```
docs/05-analysis/          # All 111 files - historical forensics
docs/09-reports/           # All 57 files - session reports
```

### 4.4 Delete List

```
docs/04-planning/          # 65 files - obsolete phase plans
docs/09-implementation/    # 57 files - completed/abandoned impl docs
docs/tab5/                 # If exists - appears to be duplicate
docs/archive/              # Old archive
docs/Lightshow.Pattern/    # Pattern design docs (keep if active)
```

### 4.5 Execution

```bash
cd /Users/spectrasynq/Workspace_Management/Software/K1.node1

# Create archive directory
mkdir -p docs/_archive

# Move analysis and reports to archive
mv docs/05-analysis docs/_archive/
mv docs/09-reports docs/_archive/

# Delete obsolete planning and implementation docs
rm -rf docs/04-planning
rm -rf docs/09-implementation

# Verify essential docs remain
ls docs/02-adr/
ls docs/03-guides/

# Commit
git add -A
git commit -m "docs: archive forensic history, delete obsolete plans

ARCHIVED to docs/_archive/:
- 05-analysis/ (111 files) - forensic investigation history
- 09-reports/ (57 files) - session reports

DELETED:
- 04-planning/ (65 files) - obsolete phase plans
- 09-implementation/ (57 files) - completed/abandoned implementations

KEPT:
- 02-adr/ - Architecture Decision Records
- 03-guides/ - User and developer guides
- 06-reference/ - API and hardware reference
- 08-governance/ - Project governance

Reduces docs from 10MB/549 files to ~2MB/150 files"
```

---

## PHASE 5: DEVELOPMENT PROCESS HARDENING

**Objective:** Prevent future accumulation of dead code and broken features
**Risk Level:** LOW - Process documentation only
**Estimated Time:** 15-20 minutes
**Can be done independently**

### 5.1 Update CLAUDE.md

Add to `/Users/spectrasynq/Workspace_Management/Software/K1.node1/CLAUDE.md`:

```markdown
## Development Rules

### Merge Requirements

NO code merges to main without:

1. **Build Success**: `pio run` completes with zero errors
2. **Flash Success**: Upload to physical ESP32-S3 succeeds
3. **Visual Verification**: LEDs respond to audio input
4. **No Regressions**: Existing patterns still work

### Prohibited Practices

- **NO "FULL SEND" deployments** - All changes require hardware testing
- **NO checkpoint commits** - Use meaningful commit messages
- **NO dead code accumulation** - Delete failed features, don't disable them
- **NO hardcoded credentials** - Use NVS or environment variables

### Feature Development Protocol

1. **Branch**: Create feature branch from main
2. **Implement**: Make changes
3. **Build**: Verify `pio run` succeeds
4. **Flash**: Upload to hardware
5. **Test**: Verify on physical device with audio input
6. **Document**: Update relevant docs only if API changes
7. **PR**: Create pull request with test evidence
8. **Merge**: Only after hardware verification

### Audio Pipeline Rules

The audio pipeline is calibrated to Emotiscope baseline. DO NOT CHANGE without explicit approval:

- Sample rate: 12800 Hz (NOT 16000)
- Chunk size: 64 samples (NOT 128)
- Goertzel normalization: ÷(N/2) (NOT ÷N)
- NUM_FREQS: 64 bins
- NUM_TEMPI: 192 bins
- BOTTOM_NOTE: 12

Any "enhancement" to audio processing requires:
1. A/B comparison with Emotiscope reference
2. Hardware testing with real audio
3. Documented parity verification
```

### 5.2 Add Pre-commit Hook (Optional)

Create `.githooks/pre-commit`:

```bash
#!/bin/bash

# Verify build succeeds before commit
echo "Running pre-commit build check..."

cd firmware
if ! pio run --silent; then
    echo "ERROR: Build failed. Fix errors before committing."
    exit 1
fi

echo "Build check passed."
exit 0
```

Enable with:
```bash
git config core.hooksPath .githooks
```

### 5.3 Create Issue Template

Create `.github/ISSUE_TEMPLATE/bug_report.md`:

```markdown
---
name: Bug Report
about: Report a firmware issue
---

## Environment
- Firmware version/commit:
- Hardware: ESP32-S3-DevKitC-1
- LED strip: WS2812B x160

## Bug Description
[What's broken]

## Steps to Reproduce
1.
2.
3.

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happens]

## Hardware Test Evidence
- [ ] Tested on physical hardware
- [ ] Serial monitor output attached
- [ ] Video/photo if visual issue
```

---

## VERIFICATION CHECKLIST

After completing all phases, verify:

### Build & Runtime
- [ ] `pio run` succeeds
- [ ] RAM usage < 65%
- [ ] Flash usage < 70%
- [ ] Device boots without crash
- [ ] Serial output shows normal startup sequence

### Audio Pipeline
- [ ] I2S microphone captures audio (check `[PT1-I2S]` trace)
- [ ] Goertzel DFT produces spectrum (check `/api/audio/snapshot`)
- [ ] Tempo detection runs (check `/api/audio/tempo`)
- [ ] VU meter responds to sound

### LED Output
- [ ] LEDs illuminate on boot
- [ ] Patterns respond to audio
- [ ] Pattern switching works via API
- [ ] Brightness control works

### WiFi
- [ ] Captive portal starts on first boot (or with cleared NVS)
- [ ] WiFi connects with provisioned credentials
- [ ] mDNS resolves (`k1-reinvented.local`)
- [ ] Web interface accessible

### API
- [ ] `/api/status` returns valid JSON
- [ ] `/api/patterns` lists all patterns
- [ ] `/api/audio/snapshot` returns spectrum data
- [ ] WebSocket streaming works

---

## ROLLBACK PROCEDURE

If any phase causes issues:

```bash
# Phase 1 rollback (dead code removal)
git checkout HEAD~1 -- firmware/src/

# Full rollback to pre-cleanup state
git checkout main  # or whatever branch was stable

# Rebuild
cd firmware && pio run
```

---

## AGENT NOTES

### Files You Will Modify

```
firmware/src/main.cpp                    # Remove AGC code
firmware/src/audio/goertzel.cpp          # Remove AGC include
firmware/src/audio/goertzel.h            # Remove validation include, add types
firmware/src/audio/tempo.cpp             # Remove validation, add entropy function
firmware/src/webserver.cpp               # Remove validation include
firmware/platformio.ini                  # Remove stub exclusion
firmware/src/wifi_monitor.cpp            # Remove hardcoded credentials
CLAUDE.md                                # Add development rules
```

### Files You Will Delete

```
firmware/src/audio/cochlear_agc.h
firmware/src/audio/validation/README.md
firmware/src/audio/validation/tempo_validation.cpp
firmware/src/audio/validation/tempo_validation.h
firmware/src/audio/tempo_validation_stubs.cpp
docs/04-planning/*
docs/09-implementation/*
```

### Files You Will Move

```
docs/05-analysis/* -> docs/_archive/05-analysis/
docs/09-reports/* -> docs/_archive/09-reports/
```

### Critical Warnings

1. **DO NOT** modify `audio_config.h` - sample rate and chunk size are calibrated
2. **DO NOT** modify Goertzel math in `goertzel.cpp` - this was broken 5 times and restored
3. **DO NOT** add new "validation" or "enhancement" layers without hardware testing
4. **DO** verify build after each file deletion before proceeding
5. **DO** test on physical hardware after Phase 1 completion

### Success Criteria

- Binary size reduced by ~20-30KB
- No new compiler warnings
- All 21 patterns still render correctly
- Audio reactivity works on physical hardware
- Git history shows clean, meaningful commits

---

## APPENDIX: KEY FILE LOCATIONS

```
/Users/spectrasynq/Workspace_Management/Software/K1.node1/
├── firmware/
│   ├── platformio.ini              # Build configuration
│   ├── src/
│   │   ├── main.cpp                # Entry point, task creation
│   │   ├── led_driver.cpp          # FastLED output
│   │   ├── webserver.cpp           # REST API + WebSocket
│   │   ├── wifi_monitor.cpp        # WiFi state machine
│   │   ├── parameters.cpp          # Runtime parameters
│   │   ├── pattern_registry.cpp    # Pattern definitions
│   │   └── audio/
│   │       ├── audio_config.h      # Sample rate, chunk size
│   │       ├── microphone.cpp      # I2S input
│   │       ├── goertzel.cpp        # DFT implementation
│   │       ├── goertzel.h          # Audio types and declarations
│   │       ├── tempo.cpp           # Tempo detection
│   │       ├── cochlear_agc.h      # TO DELETE
│   │       ├── tempo_validation_stubs.cpp  # TO DELETE
│   │       └── validation/         # TO DELETE (entire directory)
│   └── test/                       # Hardware tests
├── docs/                           # TO CLEAN
├── CLAUDE.md                       # Agent instructions
└── UNFUCK_PLAN.md                  # This document
```

---

**END OF HANDOVER DOCUMENT**
