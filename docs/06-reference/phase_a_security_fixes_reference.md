# Phase A Security Fixes Reference

Purpose: Provide exact, copy-paste-ready fixes, test cases, and PR templates for the five blocking security issues identified for Phase A. This doc aligns with the Engineering Playbook (measure-before-cut) and avoids performance regressions by preferring lock-free or atomic patterns where appropriate.

Scope: tempo.cpp:259 (buffer overflow), goertzel.cpp:200 (race), tempo.h (globals), AudioDataSnapshot (initialization), spectral access (bounds).

---

## 1) Buffer Overflow – tempo.cpp:259

Symptom: Indexing history buffers without bounds → potential overflow/corruption.

Example (check_silence)
// BEFORE
```cpp
float magnitude = novelty_history[history_index];  // Unbounded!
```

// AFTER (portable clamp)
```cpp
uint16_t safe_index = history_index % NOVELTY_HISTORY_LENGTH;
float magnitude = novelty_history[safe_index];
```

// AFTER (fast path when length is power-of-two, e.g., 64, 128)
```cpp
static_assert((NOVELTY_HISTORY_LENGTH & (NOVELTY_HISTORY_LENGTH-1)) == 0, "history length must be power-of-two for bitmask");
uint16_t safe_index = history_index & (NOVELTY_HISTORY_LENGTH - 1);
float magnitude = novelty_history[safe_index];
```

Boundary Test Cases
- history_index in {0, NOVELTY_HISTORY_LENGTH-1}
- history_index == NOVELTY_HISTORY_LENGTH (wraps to 0)
- history_index == NOVELTY_HISTORY_LENGTH + 7 (wraps to 7)
- history_index == UINT16_MAX (wraps correctly)
- Fuzz: 100k random indices → no OOB detected

PR Notes
- Include micro-benchmark if switching to bitmasking; prove no regression.
- Attach unit tests validating wrap/clamp behavior.

---

## 2) Race Condition – goertzel.cpp:200

Symptom: Shared analysis buffer written and read concurrently without coordination → torn reads/data races.

Fix Strategy: Use seqlock pattern (lock-free readers, single-writer) to preserve performance and correctness.

// BEFORE (illustrative)
```cpp
// Writer (audio task)
memcpy(shared_bins, local_bins, NUM_BINS * sizeof(float));

// Reader (render task)
for (int k=0; k<NUM_BINS; ++k) sum += shared_bins[k];
```

// AFTER – Writer with seqlock
```cpp
// Globals
static std::atomic<uint32_t> bins_seq{0};
static float shared_bins[NUM_BINS];

// Writer (single writer)
void update_bins(const float* local_bins) {
  bins_seq.fetch_add(1, std::memory_order_acq_rel);     // begin (odd)
  memcpy(shared_bins, local_bins, NUM_BINS * sizeof(float));
  bins_seq.fetch_add(1, std::memory_order_acq_rel);     // end (even)
}
```

// AFTER – Reader (retry on change)
```cpp
bool read_bins_snapshot(float* out) {
  uint32_t s1 = bins_seq.load(std::memory_order_acquire);
  if (s1 & 1u) return false; // writer in progress
  memcpy(out, shared_bins, NUM_BINS * sizeof(float));
  uint32_t s2 = bins_seq.load(std::memory_order_acquire);
  return (s1 == s2) && ((s2 & 1u) == 0);
}
```

Reader Usage
```cpp
float local[NUM_BINS];
for (int attempt=0; attempt<3; ++attempt)
  if (read_bins_snapshot(local)) break; // else retry next frame or yield
```

Tests
- Concurrency stress (producer @ frame rate, consumer tight loop) → checksum constant across read.
- TSAN/helgrind clean; zero torn-reads detected across 10M iterations.

Notes
- Prefer seqlock over mutex to avoid hot-path contention; aligns with existing seqlock usage elsewhere.

---

## 3) Unprotected Globals – tempo.h

Symptom: Extern globals mutated across tasks → data races.

// BEFORE
```cpp
extern float tempi_smooth[NUM_TEMPO];
extern volatile int current_tempo_idx;
```

// AFTER – Encapsulate & guard
```cpp
struct TempoState {
  std::atomic<int> current_idx{0};
  float tempi_smooth[NUM_TEMPO];
};

namespace tempo_state {
  // TU-local instance; provide accessors
  static TempoState g TS_ATTR;

  inline void set_index(int idx) { g.current_idx.store(idx, std::memory_order_release); }
  inline int get_index() { return g.current_idx.load(std::memory_order_acquire); }

  // Writes must occur under writer discipline (same task or guarded by seqlock)
  inline float get_smooth(int i) { return (i>=0 && i<NUM_TEMPO) ? g.tempi_smooth[i] : 0.f; }
}
```

Tests
- Multi-threaded access to index shows no torn values.
- Out-of-range access returns safe defaults.

---

## 4) Memory Initialization – AudioDataSnapshot

Symptom: Struct fields read before initialization → UB.

// BEFORE
```cpp
struct AudioDataSnapshot {
  float beat_phase; // uninitialized in some paths
  float energy;
  // ...
};
```

// AFTER – Default member initializers
```cpp
struct AudioDataSnapshot {
  float beat_phase = 0.f;
  float energy     = 0.f;
  // ... initialize all fields
};
```

// AFTER – Factory zero-initialization (if POD-only)
```cpp
inline AudioDataSnapshot make_snapshot_zeroed() {
  AudioDataSnapshot s{}; // zero-initialize
  return s;
}
```

Tests
- Construct-then-read yields zeros for all fields.
- Coverage includes every constructor path.

---

## 5) Bounds Checking – Spectral Access

Symptom: Access to spectral bins without verifying `k` range.

// BEFORE
```cpp
float v = spectral_bins[k];
```

// AFTER – Safe accessor
```cpp
inline float get_spectral_bin(const float* bins, int k) {
  if (k < 0 || k >= NUM_BINS) return 0.f;
  return bins[k];
}
// usage
float v = get_spectral_bin(spectral_bins, k);
```

Tests
- k in {-1, 0, NUM_BINS-1, NUM_BINS, NUM_BINS+7} → no OOB.
- Fuzz k over large range with sanitizer on.

---

## PR Template (Paste into each Fix PR)
```
Title: Phase A – [Fix] <component>: <short description>

Summary
- Root cause:
- Fix approach:

Before/After (minimal diffs)
// BEFORE
<code snippet>
// AFTER
<code snippet>

Metrics & Telemetry
- CPU/frame before → after:
- /api/rmt maxgap_us before → after:
- /api/health signature fields present: [arduino, idf_ver, git_sha, build_time]

Tests
- Unit: <cases>
- Integration/Stress: <description>
- Hardware-in-loop (if applicable): <evidence>

Risk & Rollback
- Risk:
- Rollback plan: revert PR; canary held at previous image.

Links
- Synthesis report section:
- Playbook section:
```

---

## Commands (Sanity)
```
pio run -e esp32-s3-devkitc-1 -t clean && pio run
pio run -t upload && pio device monitor -b 115200
curl -s http://DEVICE/api/health | jq
curl -s http://DEVICE/api/rmt | jq
curl -s http://DEVICE/api/device/performance | jq
```

