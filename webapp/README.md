# Audio‑Reactive LED Control Dashboard — Implementation Plan (No Glass)

Dark‑first Control Panel implementation using PRISM.node tokens without glassmorphism. Aligns with z7.md features and z5.css tokens while avoiding blur/backdrop filters.

## Summary
- Build the Control Panel view at `/control` with effect selection, parameters, color management, global settings, void trail selector, audio reactivity pill, reset all, and a live status bar.
- Do not use glass effects (no backdrop‑filter, no translucent overlays). Surfaces are solid and performant.
- Use the exact tokenized theme values defined in z7.UNIFIED.md (embedded CSS block) and z5.css; no raw hex in components.

## Scope
- In‑scope: Control Panel components and flows; shared tokens; responsive behavior (desktop/tablet/mobile); keyboard shortcuts; debounced interactions; status bar.
- Out‑of‑scope: Graph Editor, Terminal, advanced Profiling (can be stubbed for navigation only).

## Architecture
- Framework: `React + Vite`
- Styling: `Tailwind CSS` with CSS custom properties mapped to component classes (no hardcoded colors).
- Components: Shadcn/ui + custom controls.
- Icons: Lucide React.
- State: Local component state + lightweight store (Zustand) for parameters and connection status.
- API: Device control via existing hooks (mock initially, real later).

## Component Inventory
- `TopNav`: App title, route tabs (Control, Profiling, Terminal [disabled], Settings).
- `Sidebar`: Device IP, serial port select, Connect button, connection status.
- `EffectSelector`: 9 effect cards (family categories), active highlight.
- `EffectParameters`: Sliders/selects/toggles with 300ms debounce and “Syncing…” micro‑state.
- `ColorManagement`: 12 preset palettes, HSV sliders, preview swatch, click‑to‑copy hex.
- `GlobalSettings`: Brightness, Blur, Softness, Gamma curve preview, Warmth (temperature bar).
- `ModeSelectors`: Void Trail selector (Off/Short/Medium/Long) with micro‑preview; Audio Reactivity pill (On/Off/Clipping) with tooltip.
- `ResetAll`: Destructive button with confirm dialog.
- `StatusBar`: FPS, Frame Time μs, CPU μs, Memory %, optional Audio device status; color‑coded thresholds.

## Styling Rules (No Glass)
- Panels: Solid surface `--color-card`; elevated panels use `--color-prism-bg-elevated` but with full opacity.
- Borders: Use `--color-border` at 1px; no inner borders.
- Shadows: Subtle shadow tokens; avoid heavy blur.
- Focus: Visible outline using `--color-ring`.
- Motion: 120/180/300ms timings; respect reduced motion.

### Tailwind Mapping Examples
- Panel: `bg-[var(--color-card)] border border-[var(--color-border)] shadow-[var(--shadow-sm)]`
- Elevated: `bg-[var(--color-prism-bg-elevated)]/100 shadow-[var(--shadow-md)]`
- Slider: `accent-[var(--color-accent)]` with `focus:ring-[var(--color-ring)]`

## Layout & Responsiveness
- Desktop: Three‑column Control view.
- Tablet: Collapsible sidebar; stacked parameters.
- Mobile: Single column; touch targets ≥`44px`; long‑press for fine slider adjustment.

## Data & State
- Parameter changes are debounced (`300ms`) before sending.
- Connection state cascades; disconnected disables controls.
- Optional mock layer feeds status metrics during development.

## Tasks & Milestones
- M1 Structure & Tokens (Day 1–2)
  - Scaffold `/control` route and layout.
  - Wire theme tokens from z7.UNIFIED.md/z5.css; set `.dark` root.
  - Build `Sidebar` + `TopNav` scaffolds.
- M2 Effects & Parameters (Day 3–4)
  - Implement `EffectSelector` and `EffectParameters` with debounce + “Syncing…” states.
  - Add keyboard shortcuts (`1–9`) for effect switching.
- M3 Colors & Modes (Day 5)
  - Implement `ColorManagement` (palettes + HSV + preview + copy hex).
  - Add `ModeSelectors` (Void Trail + Audio Reactivity pill).
- M4 Global & Reset (Day 6)
  - Implement `GlobalSettings` sliders and Gamma curve preview.
  - Add `ResetAll` with confirm.
- M5 Status & Responsive (Day 7)
  - Implement `StatusBar` with update rates; color thresholds.
  - Finish tablet/mobile responsive behaviors.
- M6 Polish & QA (Day 8)
  - Accessibility (WCAG AA, focus rings, reduced motion).
  - Keyboard navigation pass; tooltips for parameters.

## Acceptance Criteria
- Theme: Uses only tokenized styles; dark‑first; no glass/blur/backdrop filters.
- Components: EffectSelector, Parameters (debounced sliders), ColorManagement, GlobalSettings, ModeSelectors, ResetAll, StatusBar implemented.
- Interactions: Debounced (`300ms`), tooltips, keyboard shortcuts (`1–9`), visible focus rings.
- Responsive: Desktop, Tablet, Mobile layouts implemented.
- Accessibility: WCAG AA contrast; non‑color indicators for state; focus outline visible.

## Risks & Mitigations
- Visual clarity without glass: Use strong hierarchy (typography, spacing, borders) and PRISM colors.
- Performance under heavy updates: Debounce/throttle and minimize re‑renders; prefer CSS transforms.

## Deliverables
- Implemented `/control` route and components.
- Design tokens applied consistently (no raw hex).
- QA checklist completed; demo data for status.

## UI Control Guide (QA)

Use this checklist to verify that the dashboard controls work end‑to‑end against a live device.

Prerequisites
- Device is on Wi‑Fi and reachable (IP or mDNS).
- Use the diagnostics tool for sanity: `npm run k1:diagnose -- --ip=<DEVICE_IP>`.

1) Connection & Sync
- Open the dashboard and connect using the device IP.
- Expected: Sidebar shows Connected badge and device IP; main sliders reflect values from `GET /api/params` (not zeros).
- Heartbeat: if device disconnects, you see a toast “Device disconnected” and controls disable; on reconnect, a success toast appears and values re‑sync.

2) Palette Presets
- Switch to a palette‑aware pattern (e.g., Departure, Lava, Twilight, Void Trail).
- Click different preset palettes.
- Expected: Visible color changes; `palette_id` updates in firmware; diagnostics palette.valid passes.
- Clamp: Sending out‑of‑range palette_id results in clamp to valid range; diagnostics shows “clamped”.

3) Manual HSV Controls
- On patterns that use HSV (some audio‑reactive ones), adjust Hue/Saturation/Brightness.
- Expected: Color cast changes; diagnostics hsv.set passes with near‑identical round‑trip values.
- Note: Palette‑first patterns may not respond to HSV; this is by design. For those, use palette presets or future “hue offset” customization.

4) Global Settings
- Brightness: Move slider from ~30% to ~80%.
- Expected: Brightness visibly changes; diagnostics brightness.set passes.
- Softness/Blur & Warmth: On supported firmware, sliders apply low‑frequency modulation or tone shifts.
- Dithering: Toggles temporal smoothing if firmware exposes the `dithering` field.

5) Void Trail Modes
- Switch to the `Void Trail` pattern.
- Set modes (Off/Short/Medium/Long).
- Expected: `custom_param_1` round‑trips in `GET /api/params`; visual tail/decay behavior changes per mode.

6) Audio Reactivity
- Toggle Off → Expected: LEDs stop reacting; firmware `active:false` and diagnostics audio.off pass.
- Toggle On → Expected: LEDs resume reacting; firmware `active:true` and diagnostics audio.on pass.
- Rate limit: Avoid rapid toggles; server enforces windows and may return 429s if spammed.

7) Rate Limits & Debounce
- UI debounces requests (~350–375ms) to respect firmware POST windows.
- Expect occasional 429 in extreme slider scrubbing; UI coalesces updates and shows a warning on excessive rate‑limit hits.

8) Disconnect Handling
- Power‑cycle or disconnect device.
- Expected: Within ~12s, UI shows error toast, disables controls, and attempts reconnection. On successful reconnect, UI re‑syncs values and shows success toast.

9) Diagnostics Cross‑Check
- Run `npm run k1:diagnose -- --ip=<DEVICE_IP>` after testing.
- Expected: All control steps pass (“confirmed”), palette clamp shows “clamped”.

Troubleshooting
- If a control appears inert, check `GET /api/params`: the UI disables controls not present in firmware to avoid no‑ops.
- If network flaps, wait for UI to show reconnect success before resuming testing.
- If a pattern doesn’t respond to HSV, use palette presets or try another pattern.

## References
- z7.md, z7.UNIFIED.md (features & flows)
- z5.css (tokens), PRISM.node colors
- `webapp/src` structure for integration

## Developer Tooling
- See `docs/devtools-setup.md` for Quokka, Console Ninja, and Wallaby usage with this app.
