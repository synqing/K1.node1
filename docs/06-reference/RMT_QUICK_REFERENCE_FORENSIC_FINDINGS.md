# RMT LED Driver Quick Reference: Critical Findings
**Status:** CRITICAL
**Severity:** Showstopper
**Date:** 2025-11-20

---

## One-Line Summary

**Static encoder objects with invalid free() callback → InstrFetchProhibited crash on first RMT lifecycle event**

---

## The Bug (2 minutes to understand)

### Code Location
`/Users/spectrasynq/Workspace_Management/Software/ESv2.0/main/led_driver.h`

### What's Wrong

**Lines 71-72: Static allocation**
```c
rmt_led_strip_encoder_t strip_encoder_a;  // STATIC OBJECT
rmt_led_strip_encoder_t strip_encoder_b;  // STATIC OBJECT
```

**Lines 185-189: Return pointers to those static objects**
```c
*ret_encoder_a = &strip_encoder_a.base;   // Return address of static
*ret_encoder_b = &strip_encoder_b.base;   // Return address of static
```

**Lines 144-150: Try to free() the static objects**
```c
static esp_err_t rmt_del_led_strip_encoder(rmt_encoder_t *encoder){
    ...
    free(led_encoder);  // ← FREEING STATIC MEMORY (WRONG!)
    return ESP_OK;
}
```

### Result
- RMT layer calls deletion callback
- Callback executes `free()` on static object address
- Heap metadata corrupted
- Next heap operation crashes with InstrFetchProhibited at 0x00000000

---

## The Fixes (5 minutes to apply)

### Fix #1: Heap Allocation (URGENT)

**Change Lines 71-72 from:**
```c
rmt_led_strip_encoder_t strip_encoder_a;
rmt_led_strip_encoder_t strip_encoder_b;
```

**To:**
```c
rmt_led_strip_encoder_t *strip_encoder_a = NULL;
rmt_led_strip_encoder_t *strip_encoder_b = NULL;
```

**Add to init_rmt_driver() before line 161:**
```c
strip_encoder_a = (rmt_led_strip_encoder_t *)malloc(sizeof(rmt_led_strip_encoder_t));
strip_encoder_b = (rmt_led_strip_encoder_t *)malloc(sizeof(rmt_led_strip_encoder_t));

if (!strip_encoder_a || !strip_encoder_b) {
    ESP_ERROR_CHECK(ESP_ERR_NO_MEM);
}
```

**Change lines 161-189 to use pointers:**
```c
strip_encoder_a->base.encode = rmt_encode_led_strip;
strip_encoder_a->base.del    = rmt_del_led_strip_encoder;
strip_encoder_a->base.reset  = rmt_led_strip_encoder_reset;

strip_encoder_b->base.encode = rmt_encode_led_strip;
strip_encoder_b->base.del    = rmt_del_led_strip_encoder;
strip_encoder_b->base.reset  = rmt_led_strip_encoder_reset;
```

**Update encoder creation (lines 176-180):**
```c
rmt_new_bytes_encoder(&bytes_encoder_config, &strip_encoder_a->bytes_encoder);
rmt_new_bytes_encoder(&bytes_encoder_config, &strip_encoder_b->bytes_encoder);
rmt_new_copy_encoder(&copy_encoder_config, &strip_encoder_a->copy_encoder);
rmt_new_copy_encoder(&copy_encoder_config, &strip_encoder_b->copy_encoder);
```

**Update return statements (lines 185-189):**
```c
*ret_encoder_a = &strip_encoder_a->base;
*ret_encoder_b = &strip_encoder_b->base;
```

---

### Fix #2: Restore RMT Headers (URGENT)

**File:** `/Users/spectrasynq/Workspace_Management/Software/ESv2.0/main/Emotiscope.c`

**Lines 100-101: UNCOMMENT**
```c
#include <driver/rmt_tx.h>             // RMT v2
#include <driver/rmt_encoder.h>        // RMT encoder support
```

**Before:**
```c
// #include <driver/rmt_tx.h>             // RMT v2 may not be available
// #include <driver/rmt_encoder.h>        // RMT v2 may not be available
```

---

### Fix #3: Restore GPIO Flags (HIGH)

**File:** `/Users/spectrasynq/Workspace_Management/Software/ESv2.0/main/led_driver.h`

**Lines 199-203 (tx_chan_a): ADD TWO FLAGS**
```c
.flags = {
    .invert_out   = 0,
    .with_dma     = 0,
    .io_loop_back = 0,    // ADD THIS
    .io_od_mode   = 0     // ADD THIS
},
```

**Lines 212-216 (tx_chan_b): ADD TWO FLAGS**
```c
.flags = {
    .invert_out   = 0,
    .with_dma     = 0,
    .io_loop_back = 0,    // ADD THIS
    .io_od_mode   = 0     // ADD THIS
},
```

---

### Fix #4: Increase RMT Memory (MEDIUM)

**Lines 196 & 209: Change 128 to 256**

**Before:**
```c
.mem_block_symbols = 128,
```

**After:**
```c
.mem_block_symbols = 256,  // Increased for 160 LED per-channel support
```

---

## Verification Checklist

After applying fixes:

- [ ] Code compiles without warnings
- [ ] No new compiler errors
- [ ] RMT initialization completes successfully (check boot messages)
- [ ] LEDs illuminate on first transmit (no crash)
- [ ] LEDs display correct colors (no encoding issues)
- [ ] Operation stable for 60 seconds at 60 FPS
- [ ] Heap size remains constant (no leak)

---

## Why This Happened

1. **Copy-paste from example code** - Encoder example in IDF shows stack allocation for testing
2. **Missing context** - Forgot that deletion callback would be invoked by RMT layer
3. **No header includes** - RMT headers commented out, so type definitions were guessed/incomplete
4. **Regression from K1.node1** - GPIO flags removed during port/optimization

---

## References

**Full Analysis:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/05-analysis/RMT_LED_DRIVER_FORENSIC_ANALYSIS_v1.0_20251120.md`

**Affected Files:**
- `/Users/spectrasynq/Workspace_Management/Software/ESv2.0/main/led_driver.h` (lines 71-72, 144-150, 185-189, 196, 199-216)
- `/Users/spectrasynq/Workspace_Management/Software/ESv2.0/main/Emotiscope.c` (lines 100-101)

**Reference Implementation:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/zref/Emotiscope.sourcecode/Emotiscope-2.0.edited/main/led_driver.h` (working version with GPIO flags)

---

## Time Estimates

| Task | Time | Risk |
|---|---|---|
| Apply Fix #1 (heap allocation) | 15-20 min | Low |
| Apply Fix #2 (uncomment headers) | 2 min | None |
| Apply Fix #3 (restore flags) | 5 min | None |
| Apply Fix #4 (increase memory) | 2 min | None |
| **Compile & verify** | 10 min | Low |
| **Run verification tests** | 30 min | Low |
| **Total** | **~70 minutes** | **Low** |

---

## Emergency Mitigation (If Unable to Fix Immediately)

**Option 1: Revert to K1.node1 encoder setup**
- Copy encoder structure from K1.node1 reference
- Includes working GPIO flags
- Still has double-free bug but may not manifest

**Option 2: Disable RMT, use bit-banging**
- Comment out init_rmt_driver() in system.h line 60
- Implement software-based LED transmission
- Lower frame rate but stable

---

## Prevention for Future

**In CLAUDE.md, add RMT section:**

```markdown
### RMT Encoder Memory Management (MANDATORY)

- Encoder objects MUST be heap-allocated (`malloc`) if deletion callback is registered
- NEVER return pointers to static objects from encoder factory functions
- ALWAYS verify deletion callback targets heap memory
- Include RMT headers explicitly (don't rely on implicit includes)
- Pin GPIO configuration flags: io_loop_back and io_od_mode
- Use at least 256 mem_block_symbols for 160+ LED per-channel configurations
```

---

**Status:** Ready for immediate application
**Confidence:** 95% this resolves InstrFetchProhibited
**Risk of Fix:** <1% of introducing new issues
