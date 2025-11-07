# RMT Encoder State Isolation: Visual Reference

**Purpose:** Visual representation of how state is isolated between primary and secondary LED output channels

## Memory Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        GLOBAL DATA SEGMENT                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Primary Channel State (strip_encoder)        Secondary Channel State   │
│  ──────────────────────────────────────────  (strip_encoder_2)          │
│                                              ─────────────────────────  │
│  rmt_led_strip_encoder_t {                   rmt_led_strip_encoder_t { │
│    base: {                                     base: {                 │
│      encode: ─────────┐                         encode: ─────────┐     │
│      del: ────┐       │                         del: ────┐       │     │
│      reset: ──┼─┐     │                         reset: ──┼─┐     │     │
│    },         │ │     │                       },         │ │     │     │
│                │ │     │                                  │ │     │     │
│    bytes_encoder: ◇ ──┼─→ [ESP-IDF bytes_encoder #1]     │ │     │     │
│    copy_encoder: ◇ ──┼─→ [ESP-IDF copy_encoder #1]       │ │     │     │
│                 │ │   │                                   │ │     │     │
│    state: 0   ◄─┘ │   │    bytes_encoder: ◇ ────────────┼─┼─→ [ESP-IDF bytes_encoder #2]
│    reset_code: {  │   │    copy_encoder: ◇ ─────────────┼─┼─→ [ESP-IDF copy_encoder #2]
│      1000, 0, │   │   │                   │ │   │        │ │
│      1000, 0  │   │   │    state: 0   ◄──┘ │   │        │ │
│    }          │   │   │    reset_code: {   │   │        │ │
│  }            │   │   │      1000, 0,      │   │        │ │
│               │   │   │      1000, 0       │   │        │ │
│               │   └───┼─────→ SHARED FUNCTION ◄────────┘ │
│               │       │      rmt_encode_led_strip        │
│               └───────┼──────────────────────────────────┘
│                       │
│  Global Handles       │
│  ──────────────────   │
│  led_encoder = ──┘    │
│  led_encoder_2 = ───┐ │
│                      │ │
└──────────────────────┼─┼──────────────────────────────────────────────┘
                       │ │
                       ▼ ▼
                  RMT Peripheral
                       │
        ┌──────────────┼──────────────┐
        │              │              │
    GPIO 5         GPIO 4        RMT Core
  (Primary)     (Secondary)
```

## Callback Invocation and Context Reconstruction

### When Primary Channel (GPIO 5) Transmits

```
Sequence: Primary Channel Transmission
═════════════════════════════════════════════════════════════════════

User code calls:
  transmit_leds() [led_driver.h:272]
  └─ rmt_transmit(tx_chan, led_encoder, raw_led_data, NUM_LEDS*3, ...)
                    │          │
                    │          └─ Handle = &strip_encoder.base
                    │
                    └─ RMT peripheral (GPIO 5 channel)
                       │
                       ↓
                    [RMT starts transmission]
                    [Fills buffer with encoded symbols]
                    [Needs to encode next chunk]
                       │
                       ↓
                    Call encoder callback:
                    rmt_encode_led_strip(&strip_encoder.base, channel, ...)
                       │
                       ├─ Input: &strip_encoder.base (0xX address)
                       │
                       ↓
                    __containerof() macro reconstruction:
                    ((rmt_led_strip_encoder_t *)
                      ((char *)0xX - offsetof(base)))
                       │
                       ├─ Subtract offset of "base" member within struct
                       ├─ = (rmt_led_strip_encoder_t *)0x(X - offset)
                       │
                       ↓
                    Returns: &strip_encoder (0xY address)
                       │
                       ├─ led_encoder = &strip_encoder (cast confirmed)
                       │
                       ↓
                    Execute state machine on CORRECT instance:
                    switch (led_encoder->state)
                       │
                       ├─ Uses: led_encoder->bytes_encoder
                       ├─ Uses: led_encoder->copy_encoder
                       ├─ Uses: led_encoder->reset_code
                       └─ Modifies: led_encoder->state
                          (ALL operations on strip_encoder, NOT strip_encoder_2)
```

### When Secondary Channel (GPIO 4) Transmits

```
Sequence: Secondary Channel Transmission
═════════════════════════════════════════════════════════════════════

User code calls:
  transmit_leds() [led_driver.h:274]
  └─ rmt_transmit(tx_chan_2, led_encoder_2, raw_led_data, NUM_LEDS*3, ...)
                      │           │
                      │           └─ Handle = &strip_encoder_2.base
                      │
                      └─ RMT peripheral (GPIO 4 channel)
                         │
                         ↓
                      [RMT starts transmission]
                      [Fills buffer with encoded symbols]
                      [Needs to encode next chunk]
                         │
                         ↓
                      Call encoder callback:
                      rmt_encode_led_strip(&strip_encoder_2.base, channel, ...)
                         │
                         ├─ Input: &strip_encoder_2.base (0xZ address)
                         │
                         ↓
                      __containerof() macro reconstruction:
                      ((rmt_led_strip_encoder_t *)
                        ((char *)0xZ - offsetof(base)))
                         │
                         ├─ Subtract offset of "base" member within struct
                         ├─ = (rmt_led_strip_encoder_t *)0x(Z - offset)
                         │
                         ↓
                      Returns: &strip_encoder_2 (0xW address)
                         │
                         ├─ led_encoder = &strip_encoder_2 (cast confirmed)
                         │
                         ↓
                      Execute state machine on CORRECT instance:
                      switch (led_encoder->state)
                         │
                         ├─ Uses: led_encoder->bytes_encoder
                         ├─ Uses: led_encoder->copy_encoder
                         ├─ Uses: led_encoder->reset_code
                         └─ Modifies: led_encoder->state
                            (ALL operations on strip_encoder_2, NOT strip_encoder)
```

## State Isolation Proof

### Key Property: __containerof() Injectivity

```
For struct rmt_led_strip_encoder_t {
    rmt_encoder_t base;
    rmt_encoder_t *bytes_encoder;
    ...
}

Given two distinct instances:
    Instance A: strip_encoder at address 0x3FFF1000
    Instance B: strip_encoder_2 at address 0x3FFF1100

Their base members are at:
    A.base at 0x3FFF1000 (same as instance address, base is first member)
    B.base at 0x3FFF1100 (same as instance address, base is first member)

__containerof(&A.base, ...) = 0x3FFF1000 - 0 = 0x3FFF1000 ✓ Returns A
__containerof(&B.base, ...) = 0x3FFF1100 - 0 = 0x3FFF1100 ✓ Returns B

PROOF: The mapping is one-to-one. No cross-contamination possible.
```

## State Machine Execution Timeline

### Concurrent Transmission Scenario

```
Time    GPIO 5 (Primary)              GPIO 4 (Secondary)         Shared
────────────────────────────────────────────────────────────────────────
T0      User: transmit_leds()        (idle)                      (idle)
        ├─ RMT TX to GPIO 5
        └─ RMT TX to GPIO 4

T1      [RMT encodes on Ch1]         [RMT encodes on Ch2]       rmt_encode_led_strip
        Calls:                       Calls:                      (Same Function)
        rmt_encode_led_strip         rmt_encode_led_strip
        (&strip_encoder.base)        (&strip_encoder_2.base)
            ↓                            ↓
        Reconstructs:                Reconstructs:
        &strip_encoder               &strip_encoder_2
            ↓                            ↓
        Reads: state=0               Reads: state=0             [Each reads own state]
        Reads: bytes_encoder=#1      Reads: bytes_encoder=#2    [Each uses own sub-encoder]

T2      Encodes RGB data             Encodes RGB data           [Independent encoding]
        Calls:                       Calls:
        strip_encoder.bytes_encoder  strip_encoder_2.bytes_encoder
        Modifies:                    Modifies:
        strip_encoder.state=1        strip_encoder_2.state=1    [Each modifies own state]

T3      [RMT continues on Ch1]       [RMT continues on Ch2]     [No interaction]
        Calls:                       Calls:
        rmt_encode_led_strip         rmt_encode_led_strip
        (&strip_encoder.base)        (&strip_encoder_2.base)
            ↓                            ↓
        Reconstructs:                Reconstructs:
        &strip_encoder               &strip_encoder_2
            ↓                            ↓
        Reads: state=1               Reads: state=1             [Each reads own state]
        Calls: copy_encoder          Calls: copy_encoder        [Each uses own sub-encoder]

T4      Encodes reset code           Encodes reset code         [Independent encoding]
        Modifies:                    Modifies:
        strip_encoder.state=0        strip_encoder_2.state=0    [Each resets own state]

T5      [Transmission complete]      [Transmission complete]    [Both finished independently]
```

## Memory Address Example

```
Assuming __IRAM_ATTR at 0x3FFFF000 and encoder structs follow:

Global Declarations (led_driver.cpp:25-34)
────────────────────────────────────────────────────────────────

Address    Content                              Variable Name
──────────────────────────────────────────────────────────────
0x3FFF1000 {                                    strip_encoder
0x3FFF1000   encode: 0x40087234                   .base.encode
0x3FFF1004   del: 0x40087240                      .base.del
0x3FFF1008   reset: 0x40087250                    .base.reset
0x3FFF100C   bytes_encoder: 0x3FFFC000            .bytes_encoder ◄─┐
0x3FFF1010   copy_encoder: 0x3FFFCE00            .copy_encoder  ◄─┐
0x3FFF1014   state: 0                            .state         ◄─┤
0x3FFF1018   reset_code: { 1000, 0, 1000, 0 }   .reset_code    ◄─┤
0x3FFF1020 }                                                     │
           ═══════════════════════════════════════════════════════╪════
           (28 bytes per instance)                              │
           ═════════════════════════════════════════════════════╪═════
0x3FFF1020 {                                    strip_encoder_2 │
0x3FFF1020   encode: 0x40087234                   .base.encode  │
0x3FFF1024   del: 0x40087240                      .base.del     │
0x3FFF1028   reset: 0x40087250                    .base.reset   │
0x3FFF102C   bytes_encoder: 0x3FFFCF00           .bytes_encoder ◄────┐
0x3FFF1030   copy_encoder: 0x3FFFCD00           .copy_encoder  ◄────┐
0x3FFF1034   state: 0                            .state        ◄────┤
0x3FFF1038   reset_code: { 1000, 0, 1000, 0 }  .reset_code    ◄────┤
0x3FFF1040 }                                                     │
                                                                 │
When RMT calls rmt_encode_led_strip(&strip_encoder.base = 0x3FFF1000):
    Macro: __containerof(0x3FFF1000, rmt_led_strip_encoder_t, base)
    = (rmt_led_strip_encoder_t *)((char *)0x3FFF1000 - offset_of_base)
    = (rmt_led_strip_encoder_t *)((char *)0x3FFF1000 - 0)
    = 0x3FFF1000 ✓ Returns strip_encoder
    │
    └─→ Uses bytes_encoder from offset 0x3FFF100C (instance #1)

When RMT calls rmt_encode_led_strip(&strip_encoder_2.base = 0x3FFF1020):
    Macro: __containerof(0x3FFF1020, rmt_led_strip_encoder_t, base)
    = (rmt_led_strip_encoder_t *)((char *)0x3FFF1020 - offset_of_base)
    = (rmt_led_strip_encoder_t *)((char *)0x3FFF1020 - 0)
    = 0x3FFF1020 ✓ Returns strip_encoder_2
    │
    └─→ Uses bytes_encoder from offset 0x3FFF102C (instance #2)
```

## Critical Path Verification

```
Initialization Path → Transmission Path → Callback Path
═════════════════════════════════════════════════════════

PRIMARY CHANNEL (GPIO 5)
──────────────────────────────────────────────────────────
1. init_rmt_driver() [line 124]
   └─→ rmt_new_tx_channel(..., &tx_chan) [line 139]
   └─→ rmt_new_led_strip_encoder(..., &led_encoder) [line 146]
       └─→ Populates: strip_encoder.base.encode = rmt_encode_led_strip
       └─→ Populates: strip_encoder.bytes_encoder = <sub-encoder>
       └─→ Populates: strip_encoder.state = 0
       └─→ Returns: &strip_encoder.base → led_encoder

2. transmit_leds() [line 225]
   └─→ rmt_transmit(tx_chan, led_encoder, ...) [line 272]
       └─→ led_encoder = &strip_encoder.base
       └─→ RMT invokes: rmt_encode_led_strip(&strip_encoder.base, ...)

3. rmt_encode_led_strip callback [line 122]
   └─→ __containerof(&strip_encoder.base, ...)
   └─→ Returns: &strip_encoder ✓ CORRECT INSTANCE
   └─→ Accesses: strip_encoder.state, strip_encoder.bytes_encoder


SECONDARY CHANNEL (GPIO 4)
──────────────────────────────────────────────────────────
1. init_rmt_driver() [line 124]
   └─→ rmt_new_tx_channel(..., &tx_chan_2) [line 163]
   └─→ rmt_new_led_strip_encoder_2(..., &led_encoder_2) [line 167]
       └─→ Populates: strip_encoder_2.base.encode = rmt_encode_led_strip
       └─→ Populates: strip_encoder_2.bytes_encoder = <sub-encoder>
       └─→ Populates: strip_encoder_2.state = 0
       └─→ Returns: &strip_encoder_2.base → led_encoder_2

2. transmit_leds() [line 225]
   └─→ rmt_transmit(tx_chan_2, led_encoder_2, ...) [line 274]
       └─→ led_encoder_2 = &strip_encoder_2.base
       └─→ RMT invokes: rmt_encode_led_strip(&strip_encoder_2.base, ...)

3. rmt_encode_led_strip callback [line 122]
   └─→ __containerof(&strip_encoder_2.base, ...)
   └─→ Returns: &strip_encoder_2 ✓ CORRECT INSTANCE
   └─→ Accesses: strip_encoder_2.state, strip_encoder_2.bytes_encoder


ISOLATION GUARANTEE
───────────────────────────────────────────────────────────
✓ Each channel has its own global struct
✓ Each channel has its own encoder handle
✓ __containerof() ensures correct instance reconstruction
✓ Concurrent transmission on both channels cannot cross-contaminate state
```

## Summary

**Question:** Can the two encoders interfere with each other?

**Answer:** **NO.** The `__containerof()` macro pattern guarantees that:

1. **Different input** (`&strip_encoder.base` vs `&strip_encoder_2.base`)
2. **Maps deterministically** to different struct instances
3. **Each instance has its own state** (state variable, sub-encoders)
4. **RMT peripheral ensures isolation** by calling the callback with different handles

**Conclusion:** The state isolation is **architecturally sound and fully implemented**. This is a correct use of embedded OOP patterns in C.

