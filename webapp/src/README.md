# PRISM.node2 Control Dashboard

A high-fidelity prototype for a dual-platform (web + Tauri-based macOS) interface that controls an audio-reactive LED system.

## Features

### Three Main Views

#### 1. Control Panel
- **Effect Selection**: Choose from 9 audio-reactive effects (Analog, Spectrum, Octave, Metronome, Spectronome, Hype, Bloom, PULSE, SPARKLE)
- **Dynamic Parameters**: Each effect has customizable parameters with real-time sync status
- **Color Management**: 12 preset palettes plus manual HSV controls with live preview
- **Global Settings**: Brightness, Blur, Softness, Gamma correction, and Warmth controls
- **Live Status Bar**: Real-time FPS, CPU, and Memory metrics with color-coded thresholds

#### 2. Profiling Dashboard
- **Performance Charts**:
  - FPS over time with target/minimum reference lines
  - Frame time breakdown by component (Effect, GPU, Driver, Other)
  - CPU usage comparison across all effects
  - Memory usage with safety thresholds
- **Live Statistics Table**: 12 real-time metrics with trend indicators
- **Filtering**: By effect, time range (Last 100/500/1000 frames), phase comparison
- **Export**: CSV export of profiling data

#### 3. Terminal
- **Command Interface**: Execute device commands with color-coded output
- **Command History**: Last 10 commands with click-to-fill
- **Available Commands**: p, k, v, j, r, c, s, help
- **Auto-scroll**: Intelligent scrolling with pause indicator
- **Output Formatting**: Monospace font with syntax highlighting

## Design System

### PRISM.node Design Tokens
Built on the PRISM.node design system with carefully crafted tokens:

**Colors**:
- Dark theme (Canvas #1c2130, Surface #252d3f, Elevated #2f3849)
- Gold accent (#ffb84d) and Info/Cyan accent (#6ee7f3)
- Status colors: Success #22dd88, Warning #f59e0b, Error #ef4444
- Data type colors: Scalar #f59e0b, Field #22d3ee, Color #f472b6, Output #34d399

**Typography**:
- JetBrains Mono for code/numeric display
- Rama Gothic Rounded for body text (fallback: Nunito)
- Bebas Neue Pro for headers and branding (fallback: Impact)

**Spacing & Layout**:
- Consistent spacing with Tailwind's default scale
- Rounded corners with subtle elevation
- Three-column layout in Control Panel
- Responsive grid layouts throughout

**Motion**:
- Smooth transitions on state changes
- Real-time updates at appropriate intervals (100-500ms)
- Color-coded status indicators

## Component Architecture

### Main Components
- `App.tsx` - Main application entry point with view routing
- `TopNav.tsx` - Top navigation bar with view switcher and connection status
- `Sidebar.tsx` - Device connection panel with collapsible functionality

### Control Panel Components
- `EffectSelector.tsx` - Effect grid with selection state
- `EffectParameters.tsx` - Dynamic parameter controls with type-coded colors
- `ColorManagement.tsx` - Palette selector and HSV sliders
- `GlobalSettings.tsx` - System-wide settings controls
- `StatusBar.tsx` - Real-time performance metrics footer

### Profiling Components
- `ProfilingFilters.tsx` - Filter controls and CSV export
- `ProfilingCharts.tsx` - Four performance charts using Recharts
- `LiveStatistics.tsx` - Real-time metrics table with trends

### Terminal Components
- `TerminalView.tsx` - Complete terminal interface with history

### Utilities
- `lib/types.ts` - TypeScript type definitions
- `lib/mockData.ts` - Mock data generators and command execution

## Usage

### Connecting to Device
1. Enter your device IP address in the sidebar (e.g., 192.168.1.100)
2. Select the appropriate serial port (USB0, USB1, UART0)
3. Click "Connect"
4. Connection status shows in both sidebar and top navigation

### Selecting Effects
1. Navigate to the Control Panel view
2. Click on any of the 9 effect cards
3. Adjust parameters in the center column
4. Changes sync automatically with "Syncing..." indicator

### Managing Colors
1. Choose from 12 preset palettes
2. Or manually adjust Hue (0-360°), Saturation (0-100%), and Value (0-100%) sliders
3. Preview colors in real-time with hex value display

### Profiling Performance
1. Switch to the Profiling view
2. Filter by effect or view all effects
3. Adjust time range (100/500/1000 frames)
4. Toggle phase comparison overlay
5. Export data as CSV when needed

### Using the Terminal
1. Switch to Terminal view
2. Type commands in the input field
3. Press Enter or click Execute
4. View command history and click to reuse
5. Type "help" for available commands

## Available Commands

- `p` - Print current effect parameters
- `k` - Kill effect and reset to idle
- `v` - Print firmware version
- `j` - Output JSON status
- `r` - Reboot device
- `c` - Clear error log
- `s` - System diagnostics
- `help` - Show all commands

## Technical Implementation

### Built With
- **React** - Component framework
- **Tailwind CSS v4** - Styling with custom design tokens
- **Recharts** - Data visualization
- **Lucide React** - Icon library
- **Shadcn/ui** - Base component library
- **Sonner** - Toast notifications

### Design Tokens
All design tokens are defined in `/styles/globals.css` using CSS custom properties:
- PRISM.node brand colors (structural and semantic)
- Standard theme variables for shadcn/ui compatibility
- Typography scales and font families
- Custom variant for dark mode

### Accessibility
- Reduced motion: The app respects `prefers-reduced-motion` and disables non‑essential animations/transitions.
  - See: `src/styles/globals.css`
- Screen reader announcements: dynamic events (terminal output, live/pause toggles) are announced via `aria-live` regions.
  - Utility: `src/components/a11y/announcer.ts`
  - Integrations: `src/components/views/TerminalView.tsx`, `src/components/views/ProfilingView.tsx`

### Design Iterations (Optional)
You can preview alternative dark-mode styling from `.superdesign/design_iterations` without changing the Tailwind setup:

- The stylesheet is vendored at `src/styles/experimental/default_ui_darkmode.css`.
- Enable it by adding `VITE_ENABLE_DESIGN_ITER=true` to a local env file (e.g., `webapp/.env.local`).
- When enabled, it overrides CSS variables and adds utility classes like `.card`, `.btn`, `.badge`, etc.

Notes:
- Keep it off in CI and shared builds. It’s intended for local prototyping.
- Expect some overlap with Tailwind utilities; prefer Tailwind for production styles and treat this file as a visual exploration.

### Mock Data
The prototype uses simulated data for demonstration:
- Performance metrics update at realistic intervals (100-500ms)
- Commands return predefined responses
- Charts show generated data patterns
- FPS varies between 55-65 with sine wave pattern
- CPU usage ranges from 150-350μs
- Memory usage drifts between 50-70%

### State Management
- Local React state for view management
- Connection state tracked globally
- Real-time updates via `setInterval`
- Debounced parameter changes (300ms)

### Builder Integration
- Token mapping for preview: `design/03-guides/handoff/builder/custom_code_tokens_with_toggle.html`
- Component wrappers (Builder‑friendly):
  - `src/builder/MetricTileWrapper.tsx`
  - `src/builder/TerminalPanelWrapper.tsx` (forwards optional `initialCommand`, `autoScroll`, `historyLimit`)
  - `src/builder/ProfilingChartsWrapper.tsx`
  - `src/builder/CardWrapper.tsx`, `src/builder/TabsWrapper.tsx`
- Registration hub: `src/builder/register.tsx` (imported in `src/main.tsx`)
- Handoff docs: `design/03-guides/handoff/builder/*` (IA, models, prompt patterns, component index)

## File Structure

```
/
├── App.tsx                          # Main application entry
├── components/
│   ├── TopNav.tsx                   # Top navigation bar
│   ├── Sidebar.tsx                  # Device connection sidebar
│   ├── views/
│   │   ├── ControlPanelView.tsx    # Effect control interface
│   │   ├── ProfilingView.tsx       # Performance dashboard
│   │   └── TerminalView.tsx        # Command terminal
│   ├── control/
│   │   ├── EffectSelector.tsx      # Effect chooser
│   │   ├── EffectParameters.tsx    # Dynamic parameters
│   │   ├── ColorManagement.tsx     # Color picker
│   │   ├── GlobalSettings.tsx      # Global controls
│   │   └── StatusBar.tsx           # Performance footer
│   ├── profiling/
│   │   ├── ProfilingCharts.tsx     # Performance charts
│   │   ├── ProfilingFilters.tsx    # Filter controls
│   │   └── LiveStatistics.tsx      # Metrics table
│   └── ui/                          # Shadcn components
├── lib/
│   ├── types.ts                     # TypeScript definitions
│   └── mockData.ts                  # Mock data generators
├── styles/
│   └── globals.css                  # Design tokens & styles
└── README.md                        # This file
```

## Performance Considerations

### Update Rates
- **Charts**: ~10Hz (100ms intervals)
- **Statistics**: ~2Hz (500ms intervals)
- **Status Bar**: ~5Hz (200ms intervals)
- **Parameter Changes**: Debounced 300ms

### Optimization
- Conditional rendering based on connection state
- Efficient re-renders with proper React keys
- Mock data generation optimized for realistic patterns
- Chart data slicing for performance

## Color System

### PRISM.node Brand Colors
- **Canvas**: #1c2130 - Main background
- **Surface**: #252d3f - Panel backgrounds
- **Elevated**: #2f3849 - Raised elements
- **Gold**: #ffb84d - Primary accent
- **Success**: #22dd88 - Positive states
- **Warning**: #f59e0b - Warning states
- **Error**: #ef4444 - Error states
- **Info**: #6ee7f3 - Information/cyan accent

### Data Type Colors
- **Scalar**: #f59e0b - Numeric values
- **Field**: #22d3ee - Array/field parameters
- **Color**: #f472b6 - Color-related parameters
- **Output**: #34d399 - Output/result values

## Browser Support

- **Chrome/Edge**: Latest 2 versions
- **Firefox**: Latest 2 versions
- **Safari**: Latest 2 versions

## Future Enhancements

### Planned Features
- Real device WebSocket integration
- Persistent user preferences (localStorage)
- Custom color palette creation and saving
- Advanced profiling filters and analysis
- Keyboard macro recording
- Multi-device management
- Effect presets and favorites

### Platform-Specific (Tauri)
- Native file picker for export
- System tray integration
- Native notifications
- Auto-update mechanism
- Serial port discovery

## Development Notes

This is a high-fidelity prototype designed to demonstrate the complete UI/UX of the PRISM.node2 control system. All data is mocked and simulated to provide a realistic experience without requiring actual hardware connection.

The design system is fully implemented with the PRISM.node brand guidelines, featuring:
- Dark-first design optimized for studio environments
- Color-coded parameter types for quick identification
- Real-time performance monitoring
- Professional terminal interface
- Responsive layouts

For production deployment, replace mock data generators in `/lib/mockData.ts` with actual WebSocket or serial communication handlers.

---

Built with ❤️ for audio-reactive LED control
PRISM.node2 Control v2.4.1
