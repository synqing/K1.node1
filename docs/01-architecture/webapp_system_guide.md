# Webapp System Guide

**Version:** 1.0
**Date:** 2025-12-05
**Status:** Active
**Owner:** System Architecture
**Scope:** K1.node1 Webapp - React Control Interface

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Technology Stack](#technology-stack)
4. [Component Hierarchy](#component-hierarchy)
5. [View System](#view-system)
6. [API Integration](#api-integration)
7. [State Management](#state-management)
8. [Performance Optimization](#performance-optimization)
9. [Build & Deployment](#build--deployment)
10. [Testing Strategy](#testing-strategy)
11. [References](#references)

---

## Executive Summary

The **K1.node1 Webapp** is a React-based single-page application that provides a real-time control interface for the K1 firmware. It communicates with the ESP32-S3 device over HTTP REST APIs to control LED patterns, adjust parameters, monitor performance, and configure audio reactivity.

### Key Features

- **Real-time parameter control** - Live slider adjustments with debouncing
- **Multi-view interface** - Control Panel, Profiling, Terminal, Node Editor, API Browser
- **Device auto-discovery** - Automatic connection to default device IP
- **Performance monitoring** - Live FPS charts and timing breakdowns
- **Pattern & palette management** - Browse and select from firmware patterns
- **Idle prefetching** - Predictive lazy-loading for instant view transitions
- **Dark-themed UI** - Custom PRISM design system with Tailwind CSS

### Technology Highlights

```
React 18.3 + TypeScript
├─ Vite 6.4 (Build tool, HMR)
├─ TanStack Query v5 (API state management)
├─ Radix UI (Accessible primitives)
├─ Tailwind CSS (Utility-first styling)
├─ Framer Motion (Animations)
├─ Recharts (Performance charts)
└─ Vitest + Jest (Testing)
```

---

## System Architecture

### High-Level Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                        K1 Webapp (Browser)                         │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                      App.tsx (Root)                          │ │
│  ├──────────────────────────────────────────────────────────────┤ │
│  │                                                              │ │
│  │  ┌────────────┐  ┌─────────────┐  ┌──────────────────────┐ │ │
│  │  │  TopNav    │  │  Sidebar    │  │  Main Content Area   │ │ │
│  │  │            │  │             │  │                      │ │ │
│  │  │ - View     │  │ - Device    │  │ ┌──────────────────┐ │ │ │
│  │  │   Tabs     │  │   Manager   │  │ │ Suspense +       │ │ │ │
│  │  │ - Connect  │  │ - Quick     │  │ │ Lazy Views       │ │ │ │
│  │  │   Status   │  │   Settings  │  │ │                  │ │ │ │
│  │  └────────────┘  └─────────────┘  │ │ Current View:    │ │ │ │
│  │                                    │ │ ──────────────   │ │ │ │
│  │                                    │ │ - Control Panel  │ │ │ │
│  │                                    │ │ - Profiling      │ │ │ │
│  │                                    │ │ - Terminal       │ │ │ │
│  │                                    │ │ - Node Editor    │ │ │ │
│  │                                    │ │ - API Browser    │ │ │ │
│  │                                    │ └──────────────────┘ │ │ │
│  │                                    └──────────────────────┘ │ │
│  │                                                              │ │
│  │  Connection State:                                           │ │
│  │  ├─ connected: boolean                                       │ │
│  │  ├─ deviceIp: string                                         │ │
│  │  ├─ serialPort: string                                       │ │
│  │  └─ lastSyncTime: number                                     │ │
│  │                                                              │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
                           ▼ HTTP REST API ▼
┌────────────────────────────────────────────────────────────────────┐
│                    ESP32-S3 Firmware (Device)                      │
├────────────────────────────────────────────────────────────────────┤
│  GET  /api/patterns   → List available patterns                   │
│  POST /api/select     → Change active pattern                     │
│  GET  /api/params     → Current parameter values                  │
│  POST /api/params     → Update parameters                         │
│  GET  /api/palettes   → Available color palettes                  │
│  GET  /api/device/info → Device metadata (IP, version, uptime)    │
│  GET  /api/device/performance → FPS, CPU, memory metrics          │
└────────────────────────────────────────────────────────────────────┘
```

### Data Flow Architecture

```
USER INTERACTION              COMPONENT LAYER           API LAYER            FIRMWARE
───────────────              ────────────────          ─────────            ────────

Slider Drag        ──┬──►   ParamSlider
                     │       ├─ Debounce (100ms)
                     │       └─ onChange callback
                     │
                     ▼
Local State Update   ─────►  RealTimeParameterControls
(Optimistic UI)              ├─ useState (local)
                             └─ TanStack Mutation       ──►  POST /api/params  ──►  Update
                                                                                    audio_back
                                                                                    .payload
                             ┌─ onSuccess: invalidate
                             └─ onError: revert        ◄───  Response 200 OK  ◄───

GET on mount/refocus ─────►  TanStack Query            ──►  GET /api/params   ──►  Read
                             ├─ useQuery                                            audio_front
                             ├─ Auto-refetch                                        .payload
                             └─ Cache (staleTime: 1s)  ◄───  {brightness:0.5}  ◄───
```

### Request-Response Coordination

**Problem:** Concurrent GET and POST to `/api/params` can cause race conditions.

**Solution:** Sequential gating with promise chaining.

```typescript
// lib/api.ts
let postInFlight = false;
let postDonePromise: Promise<void> | null = null;

export async function getParams(ip: string) {
  // Wait for any in-flight POST to complete
  if (postInFlight && postDonePromise) {
    await postDonePromise;
  }
  return fetch(`${ip}/api/params`);
}

export async function postParams(ip: string, params: Partial<FirmwareParams>) {
  postInFlight = true;
  postDonePromise = new Promise((resolve) => {
    // ... POST logic ...
    resolve();  // Signal completion
  });
  // ...
}
```

**Guarantees:**
- GET requests wait for POST completion
- No torn reads of parameters mid-update
- Maintains eventual consistency

---

## Technology Stack

### Core Framework

| Package | Version | Purpose |
|---------|---------|---------|
| **React** | 18.3.1 | UI library with Concurrent Mode |
| **TypeScript** | 5.6.3 | Type safety and developer experience |
| **Vite** | 6.4.1 | Build tool with instant HMR |
| **Node.js** | >=20 <21 | Runtime requirement (engines lock) |

### State Management

| Package | Version | Purpose |
|---------|---------|---------|
| **@tanstack/react-query** | 5.56.2 | Server state management, caching |
| **useState/useEffect** | Built-in | Local component state |
| **localStorage** | Browser API | Persistent preferences |

**TanStack Query Configuration:**
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000,        // 1 second before refetch
      refetchOnWindowFocus: true,
      retry: 2,
    },
    mutations: {
      retry: 1,
    },
  },
});
```

### UI Components

| Package | Version | Purpose |
|---------|---------|---------|
| **@radix-ui/react-*** | Various | Accessible primitives (Dialog, Slider, Tabs, etc.) |
| **lucide-react** | 0.487.0 | Icon library (consistent design) |
| **framer-motion** | 12.23.24 | Animation library |
| **sonner** | 2.0.3 | Toast notifications |
| **Tailwind CSS** | 3.x | Utility-first styling |

**Radix UI Benefits:**
- ✅ WCAG 2.1 AAA accessibility
- ✅ Keyboard navigation
- ✅ Screen reader support
- ✅ Unstyled (custom styling with Tailwind)
- ✅ Composable primitives

### Data Visualization

| Package | Version | Purpose |
|---------|---------|---------|
| **recharts** | 2.15.2 | Charts for performance metrics |
| **@tanstack/react-virtual** | 3.13.12 | Virtual scrolling (large lists) |

### Testing

| Package | Version | Purpose |
|---------|---------|---------|
| **Vitest** | 4.0.5 | Fast unit test runner (Vite-native) |
| **Jest** | 30.2.0 | Integration tests |
| **@testing-library/react** | 16.3.0 | Component testing utilities |
| **@testing-library/user-event** | 14.6.1 | User interaction simulation |
| **jsdom** | 24.0.0 | Browser environment simulation |

### Build Tools

| Package | Version | Purpose |
|---------|---------|---------|
| **@vitejs/plugin-react-swc** | 3.10.2 | Fast React refresh with SWC |
| **rollup-plugin-visualizer** | 6.0.5 | Bundle size analysis |
| **TypeScript** | 5.6.3 | Type checking |

---

## Component Hierarchy

### Structural Overview

```
App.tsx (Root)
├─ TopNav
│  ├─ View Tabs (Control, Profiling, Terminal, Node, API)
│  ├─ Connection Indicator
│  └─ Quick Connect Button
│
├─ Sidebar
│  ├─ DeviceManager
│  │  ├─ IP Input
│  │  ├─ Connect/Disconnect Button
│  │  └─ Connection Status
│  ├─ Quick Settings
│  │  └─ Idle Prefetch Toggle
│  └─ Collapse Button
│
└─ Main Content (Suspense + Lazy)
   │
   ├─ ControlPanelView (Default)
   │  ├─ PatternSelector
   │  │  └─ Grid of pattern cards
   │  ├─ RealTimeParameterControls
   │  │  ├─ Brightness Slider
   │  │  ├─ Speed Slider
   │  │  ├─ Color Slider
   │  │  ├─ Saturation Slider
   │  │  ├─ Warmth Slider
   │  │  ├─ Softness Slider
   │  │  └─ Dithering Toggle
   │  ├─ ColorManagement
   │  │  └─ Palette Selector
   │  └─ GlobalSettings
   │     └─ Master brightness, frame rate, etc.
   │
   ├─ ProfilingView (Lazy)
   │  ├─ ProfilingFilters
   │  │  └─ Time range, metric selection
   │  ├─ LiveStatistics
   │  │  ├─ FPS Counter
   │  │  ├─ Frame Time
   │  │  └─ CPU/Memory Usage
   │  └─ ProfilingCharts
   │     ├─ FPS Timeline (Recharts LineChart)
   │     ├─ Stage Breakdown (Recharts AreaChart)
   │     └─ Histogram (Render/Quantize/TX times)
   │
   ├─ TerminalView (Lazy)
   │  ├─ Command Input
   │  ├─ Command History
   │  └─ Serial Output Log
   │
   ├─ NodeEditorView (Lazy)
   │  ├─ Canvas (React Flow-based)
   │  ├─ Node Palette
   │  ├─ Parameter Editor
   │  └─ Toolbar (Import/Export, Shortcuts)
   │
   └─ ApiIndexView (Lazy)
      ├─ Endpoint List
      ├─ Request/Response Viewer
      └─ API Documentation
```

### Component Responsibilities

#### App.tsx (Root Controller)
**File:** [webapp/src/App.tsx](../../webapp/src/App.tsx)

**State:**
```typescript
const [currentView, setCurrentView] = useState<'control' | 'profiling' | 'terminal' | 'node' | 'api'>('control');
const [connectionState, setConnectionState] = useState<ConnectionState>({
  connected: false,
  deviceIp: '',
  serialPort: '',
});
const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
const [idlePrefetch, setIdlePrefetch] = useState(true);
```

**Responsibilities:**
- View routing (single-page, client-side)
- Connection state management
- Auto-connect on mount
- Idle prefetching orchestration
- Toast notification system

**Auto-Connect Logic:**
```typescript
useEffect(() => {
  const auto = shouldAutoConnect();  // localStorage pref
  const defaultIp = getDefaultDeviceIp();  // Config or localStorage
  if (!connectionState.connected && auto && defaultIp) {
    void handleConnect(defaultIp, '');
  }
}, []);
```

#### TopNav
**File:** [webapp/src/components/TopNav.tsx](../../webapp/src/components/TopNav.tsx)

**Props:**
```typescript
interface TopNavProps {
  currentView: string;
  onViewChange: (view: string) => void;
  connected: boolean;
  deviceIp: string;
  defaultIp: string;
  onConnect: (ip: string) => void;
  onDisconnect: () => void;
}
```

**Features:**
- Tabbed navigation (Control, Profiling, Terminal, Node, API)
- Connection status indicator (green/red badge)
- Quick connect dropdown
- Responsive layout

#### Sidebar
**File:** [webapp/src/components/Sidebar.tsx](../../webapp/src/components/Sidebar.tsx)

**Collapsible State:**
- Expanded: 280px width, full labels
- Collapsed: 64px width, icons only

**Features:**
- DeviceManager component (IP input, connect button)
- Quick settings (idle prefetch toggle)
- Collapse/expand button

#### ControlPanelView
**File:** [webapp/src/components/views/ControlPanelView.tsx](../../webapp/src/components/views/ControlPanelView.tsx)

**Structure:**
```tsx
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  <div className="lg:col-span-2">
    <PatternSelector />
    <RealTimeParameterControls />
  </div>
  <div>
    <ColorManagement />
    <GlobalSettings />
  </div>
</div>
```

**Key Components:**

##### PatternSelector
- Fetches patterns via TanStack Query: `useQuery({ queryKey: ['patterns', deviceIp] })`
- Grid layout of pattern cards
- Click to select → POST `/api/select { index }`
- Highlights active pattern

##### RealTimeParameterControls
**File:** [webapp/src/components/control/RealTimeParameterControls.tsx](../../webapp/src/components/control/RealTimeParameterControls.tsx)

**Debounced Sliders:**
```typescript
const [localBrightness, setLocalBrightness] = useState(0.5);

// Optimistic update (instant UI response)
const handleBrightnessChange = (value: number) => {
  setLocalBrightness(value);
  debouncedMutate({ brightness: value });  // 100ms debounce
};

// TanStack Query mutation
const mutation = useMutation({
  mutationFn: (params: Partial<FirmwareParams>) => postParams(deviceIp, params),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['params'] });
  },
  onError: () => {
    // Revert optimistic update
    setLocalBrightness(serverBrightness);
  },
});
```

**Parameters:**
- `brightness`: 0.0 - 1.0 (Master brightness)
- `speed`: 0.0 - 2.0 (Animation speed multiplier)
- `color`: 0.0 - 1.0 (Hue shift)
- `saturation`: 0.0 - 1.0 (Color saturation)
- `warmth`: 0.0 - 1.0 (Incandescent blend)
- `softness`: 0.0 - 1.0 (Motion blur)
- `dithering`: 0.0 - 1.0 (Temporal dithering, ≥0.5 enables)

#### ProfilingView
**File:** [webapp/src/components/views/ProfilingView.tsx](../../webapp/src/components/views/ProfilingView.tsx)

**Data Sources:**
```typescript
// Live statistics (refreshes every 1s)
const { data: perfData } = useQuery({
  queryKey: ['device', 'performance', deviceIp],
  queryFn: () => fetch(`${deviceIp}/api/device/performance`).then(r => r.json()),
  refetchInterval: 1000,
});
```

**Charts:**
1. **FPS Timeline** (Recharts LineChart)
   - X-axis: Time (last 60 seconds)
   - Y-axis: FPS (0-250)
   - Shows render FPS and audio FPS

2. **Stage Breakdown** (Recharts AreaChart)
   - Stacked areas: Render, Quantize, Wait, Transmit times
   - Shows performance bottlenecks

3. **Frame Time Histogram** (Recharts BarChart)
   - Distribution of frame times
   - Identifies jitter and outliers

**Filters:**
- Time range (Last 10s, 30s, 1m, 5m, All)
- Metric selection (FPS, CPU, Memory, Frame Time)
- Auto-refresh toggle

#### TerminalView
**File:** [webapp/src/components/views/TerminalView.tsx](../../webapp/src/components/views/TerminalView.tsx)

**Features:**
- Command input with autocomplete
- Command history (up/down arrows)
- Serial output log (WebSocket or polling)
- Copy to clipboard
- Clear history

**Commands:**
- `/help` - Show available commands
- `/status` - Device status
- `/patterns` - List patterns
- `/params` - Show parameters
- `/reset` - Restart device

#### NodeEditorView
**File:** [webapp/src/components/views/NodeEditorView.tsx](../../webapp/src/components/views/NodeEditorView.tsx)

**Node-Based Programming:**
- Visual graph editor for pattern composition
- Drag-and-drop nodes (Input, Effect, Math, Color, Output)
- Connect ports to create data flow
- Real-time preview
- Export/Import JSON graph

**Node Categories:**
- **Input:** Audio spectrum, VU level, time, random
- **Effect:** Blur, fade, mirror, scroll
- **Math:** Add, multiply, sine, clamp
- **Color:** HSV to RGB, palette lookup, blend
- **Output:** LED strip, preview

#### ApiIndexView
**File:** [webapp/src/components/views/ApiIndexView.tsx](../../webapp/src/components/views/ApiIndexView.tsx)

**API Browser:**
- Lists all available endpoints
- Interactive request builder
- Response viewer (JSON formatted)
- Documentation links
- Copy curl command

---

## View System

### Lazy Loading & Code Splitting

**Strategy:** Lazy-load views to reduce initial bundle size.

```typescript
// App.tsx
const ProfilingView = lazy(() => import('./components/views/ProfilingView').then(m => ({ default: m.ProfilingView })));
const TerminalView = lazy(() => import('./components/views/TerminalView').then(m => ({ default: m.TerminalView })));
const NodeEditorView = lazy(() => import('./components/views/NodeEditorView').then(m => ({ default: m.NodeEditorView })));
const ApiIndexView = lazy(() => import('./components/views/ApiIndexView').then(m => ({ default: m.ApiIndexView })));
```

**Suspense Fallback:**
```tsx
<Suspense fallback={
  <div className="flex-1 p-6">
    <div className="animate-pulse space-y-4">
      <div className="h-6 w-1/3 bg-elevated/50 rounded" />
      <div className="h-64 w-full bg-elevated/50 rounded" />
    </div>
  </div>
}>
  {currentView === 'profiling' && <ProfilingView />}
  {/* ... */}
</Suspense>
```

**Bundle Sizes (After Splitting):**
- Main chunk: ~150 KB (React, TanStack Query, Radix primitives)
- ControlPanelView: ~30 KB
- ProfilingView: ~120 KB (includes Recharts)
- TerminalView: ~15 KB
- NodeEditorView: ~80 KB
- ApiIndexView: ~10 KB

### Idle Prefetching

**Problem:** Lazy-loaded views have a delay on first render (network fetch).

**Solution:** Predictively prefetch likely-next views during idle time.

```typescript
useEffect(() => {
  if (!idlePrefetch) return;

  const requestIdle = window.requestIdleCallback || ((cb) => setTimeout(cb, 600));
  const cancelIdle = window.cancelIdleCallback || clearTimeout;

  const id = requestIdle(() => {
    // When on Control Panel, prefetch Profiling (charts) and Terminal
    if (currentView === 'control') {
      void import('./components/views/ProfilingView');
      void import('./components/profiling/ProfilingCharts');
      void import('recharts');  // Heavy vendor lib
      void import('./components/views/TerminalView');
    }

    // When on Profiling, prefetch Node Editor
    if (currentView === 'profiling') {
      void import('./components/views/NodeEditorView');
    }
  });

  return () => cancelIdle(id);
}, [currentView, idlePrefetch]);
```

**Benefits:**
- Instant view transitions (already cached)
- No UI blocking (runs during idle)
- User can disable via sidebar toggle

**Metrics:**
- Without prefetch: 200-500ms load time
- With prefetch: <10ms (cache hit)

---

## API Integration

### REST API Client

**File:** [webapp/src/lib/api.ts](../../webapp/src/lib/api.ts)

#### Base URL Construction

```typescript
function base(ip: string) {
  const trimmed = (ip || '').trim();
  if (!trimmed) throw new Error('Device IP not set');

  // Respect protocol if included
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed.replace(/\/+$/, '');
  }

  return `http://${trimmed.replace(/\/+$/, '')}`;
}
```

#### Proxy Fallback (Development)

**Problem:** CORS restrictions when device doesn't send proper headers.

**Solution:** Fallback to dev proxy server.

```typescript
async function getWithProxyFallback<T>(ip: string, path: string): Promise<T> {
  try {
    return await getJson<T>(`${base(ip)}${path}`);
  } catch (err: any) {
    const msg = String(err?.message || err);
    const isNetwork = msg.toLowerCase().includes('failed to fetch');

    // Fallback to local proxy
    if (isNetwork) {
      return await getJson<T>(`/api${path}`);
    }

    throw err;
  }
}
```

**Vite Dev Proxy Configuration:**
```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://192.168.1.100',  // Device IP
        changeOrigin: true,
      },
    },
  },
});
```

### TanStack Query Integration

**Query Hooks:**

```typescript
// backend/react-query-hooks.ts

export function usePatternsQuery(deviceIp: string) {
  return useQuery({
    queryKey: ['patterns', deviceIp],
    queryFn: () => getPatterns(deviceIp),
    enabled: !!deviceIp,
    staleTime: 30000,  // Patterns rarely change
  });
}

export function useParamsQuery(deviceIp: string) {
  return useQuery({
    queryKey: ['params', deviceIp],
    queryFn: () => getParams(deviceIp),
    enabled: !!deviceIp,
    staleTime: 1000,  // Refetch after 1s
    refetchOnWindowFocus: true,
  });
}

export function usePalettesQuery(deviceIp: string) {
  return useQuery({
    queryKey: ['palettes', deviceIp],
    queryFn: () => getPalettes(deviceIp),
    enabled: !!deviceIp,
    staleTime: 30000,
  });
}
```

**Mutation Hooks:**

```typescript
export function useSelectPatternMutation(deviceIp: string, queryClient: QueryClient) {
  return useMutation({
    mutationFn: (index: number) => postSelectPattern(deviceIp, { index }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patterns', deviceIp] });
      toast.success('Pattern changed');
    },
    onError: (err) => {
      toast.error('Failed to change pattern', {
        description: err.message,
      });
    },
  });
}

export function useUpdateParamsMutation(deviceIp: string, queryClient: QueryClient) {
  return useMutation({
    mutationFn: (params: Partial<FirmwareParams>) => postParams(deviceIp, params),
    onMutate: async (newParams) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['params', deviceIp] });

      // Snapshot previous value
      const previous = queryClient.getQueryData(['params', deviceIp]);

      // Optimistically update
      queryClient.setQueryData(['params', deviceIp], (old: any) => ({
        ...old,
        ...newParams,
      }));

      return { previous };
    },
    onError: (err, newParams, context) => {
      // Rollback on error
      queryClient.setQueryData(['params', deviceIp], context?.previous);
      toast.error('Failed to update parameters');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['params', deviceIp] });
    },
  });
}
```

### API Endpoints Reference

| Method | Endpoint | Purpose | Response |
|--------|----------|---------|----------|
| GET | `/api/patterns` | List available patterns | `{ patterns: FirmwarePattern[], current_pattern: number }` |
| POST | `/api/select` | Change active pattern | `{ index: number }` → `{ ok: true }` |
| GET | `/api/params` | Get current parameters | `FirmwareParams` |
| POST | `/api/params` | Update parameters | `Partial<FirmwareParams>` → `FirmwareParams` |
| GET | `/api/palettes` | List color palettes | `{ palettes: FirmwarePalette[] }` |
| GET | `/api/device/info` | Device metadata | `{ ip, version, uptime, ... }` |
| GET | `/api/device/performance` | Performance metrics | `{ fps, cpu, memory, ... }` |

---

## State Management

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      State Management Layers                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Layer 1: LOCAL COMPONENT STATE (useState)                      │
│  ├─ Ephemeral UI state (modal open, input focus, etc.)         │
│  ├─ Optimistic updates (slider positions during drag)          │
│  └─ Transient form data (uncommitted changes)                  │
│                                                                 │
│  Layer 2: SERVER STATE (TanStack Query)                         │
│  ├─ Cached API responses (patterns, params, palettes)          │
│  ├─ Auto-refetching (staleTime, refetchInterval)               │
│  ├─ Optimistic mutations (immediate UI update, rollback on err) │
│  └─ Query invalidation (trigger refetch after mutation)        │
│                                                                 │
│  Layer 3: PERSISTENT STATE (localStorage)                      │
│  ├─ User preferences (deviceIp, autoConnect, idlePrefetch)     │
│  ├─ Sidebar collapsed state                                    │
│  └─ Theme preference (dark mode)                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Local Component State (useState)

**Use Cases:**
- ✅ Controlled inputs (text, sliders)
- ✅ Modal/dialog visibility
- ✅ Tab selection
- ✅ Dropdown expansion
- ✅ Loading spinners

**Example:**
```typescript
const [brightness, setBrightness] = useState(0.5);
const [isModalOpen, setIsModalOpen] = useState(false);
const [activeTab, setActiveTab] = useState('general');
```

### Server State (TanStack Query)

**Use Cases:**
- ✅ API data caching
- ✅ Background refetching
- ✅ Optimistic updates
- ✅ Request deduplication
- ✅ Retry logic

**Cache Configuration:**
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000,           // 1 second before considered stale
      cacheTime: 5 * 60 * 1000,  // 5 minutes in cache
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 2,
    },
  },
});
```

**Query Lifecycle:**
```
1. Component mounts
   └─ useQuery({ queryKey: ['patterns'], queryFn })

2. Check cache
   ├─ Cache HIT (fresh) → Return cached data immediately
   ├─ Cache HIT (stale) → Return cached data + refetch in background
   └─ Cache MISS → Fetch data (loading state)

3. Data fetched
   └─ Update cache + notify subscribers

4. Stale after 1s
   └─ Refetch on next access or window focus

5. Component unmounts
   └─ Data remains in cache (5 min TTL)
```

### Persistent State (localStorage)

**Configuration:**
```typescript
// lib/config.ts

export function getDefaultDeviceIp(): string {
  return localStorage.getItem('device.defaultIp') || '';
}

export function setDefaultDeviceIp(ip: string) {
  localStorage.setItem('device.defaultIp', ip);
}

export function shouldAutoConnect(): boolean {
  const pref = localStorage.getItem('device.autoConnect');
  return pref === null ? true : pref === 'true';
}

export function setAutoConnect(enabled: boolean) {
  localStorage.setItem('device.autoConnect', String(enabled));
}
```

**Error Handling:**
```typescript
try {
  const value = localStorage.getItem('key');
  return value === null ? defaultValue : JSON.parse(value);
} catch {
  return defaultValue;  // Graceful fallback
}
```

---

## Performance Optimization

### Bundle Size Optimization

**Before Optimization:**
- Total bundle: 1.2 MB (uncompressed)
- Initial load time: 3-5 seconds

**After Optimization:**
- Main chunk: 150 KB
- Total (lazy-loaded): 450 KB
- Initial load time: 500-800ms
- Subsequent views: <10ms (cached)

**Techniques:**

#### 1. Code Splitting (Lazy Loading)
```typescript
const ProfilingView = lazy(() => import('./components/views/ProfilingView'));
```

#### 2. Tree Shaking
```typescript
// ❌ Don't import entire library
import _ from 'lodash';

// ✅ Import specific functions
import debounce from 'lodash/debounce';
```

#### 3. Vendor Chunking (Vite)
```typescript
// vite.config.ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-react': ['react', 'react-dom'],
        'vendor-query': ['@tanstack/react-query'],
        'vendor-radix': [/* Radix packages */],
        'vendor-charts': ['recharts'],
      },
    },
  },
},
```

#### 4. Dynamic Imports
```typescript
// Only load Recharts when Profiling view is active
const loadCharts = () => import('recharts');
```

### Runtime Performance

#### React Profiling Results

**Component Render Times (95th percentile):**
- `ParamSlider`: 2-5ms
- `PatternSelector`: 10-15ms
- `ProfilingCharts`: 30-50ms (Recharts rendering)
- `ControlPanelView`: 20-30ms

**Optimization Techniques:**

##### 1. Debounced Mutations
```typescript
const debouncedMutate = useCallback(
  debounce((params) => mutation.mutate(params), 100),
  [mutation]
);
```

##### 2. Virtualized Lists
```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

const virtualizer = useVirtualizer({
  count: patterns.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 80,
});
```

##### 3. Memoization
```typescript
const patternCards = useMemo(() => {
  return patterns.map(pattern => (
    <PatternCard key={pattern.id} {...pattern} />
  ));
}, [patterns]);
```

##### 4. Lazy Component Mounting
```typescript
import { LazyVisible } from './components/common/LazyVisible';

<LazyVisible>
  <ExpensiveChart data={chartData} />
</LazyVisible>
```

### Network Performance

**Request Deduplication:**
- TanStack Query prevents duplicate requests
- Same `queryKey` → single network request
- All components share cached result

**Optimistic Updates:**
- Slider changes update UI immediately (no network delay)
- Mutation sent in background
- Rollback on error

**Idle Prefetching:**
- Heavy views (Profiling/Recharts) prefetched during idle
- Zero impact on main thread
- Instant view transitions

---

## Build & Deployment

### Development

```bash
# Install dependencies (Node 20 required)
npm install

# Start dev server (HMR enabled)
npm run dev
# → http://localhost:5173

# Run tests (watch mode)
npm run test:watch

# Type checking
npx tsc --noEmit
```

**Vite Dev Server Features:**
- Hot Module Replacement (HMR) - instant updates
- Fast startup (<1s cold start)
- Source maps for debugging
- Proxy to device for CORS bypass

### Production Build

```bash
# Build for production
npm run build
# → dist/ folder (minified, optimized)

# Preview production build
npm run preview
# → http://localhost:4173

# Analyze bundle size
npx vite-bundle-visualizer
```

**Build Output:**
```
dist/
├─ index.html (entry point)
├─ assets/
│  ├─ index-[hash].js (main chunk, ~150 KB gzipped)
│  ├─ vendor-react-[hash].js (~40 KB gzipped)
│  ├─ vendor-query-[hash].js (~30 KB gzipped)
│  ├─ vendor-charts-[hash].js (~100 KB gzipped)
│  ├─ ProfilingView-[hash].js (lazy, ~50 KB gzipped)
│  └─ ... (other lazy chunks)
└─ vite.svg (favicon)
```

### Deployment Options

#### Option 1: Static Hosting (Netlify, Vercel)
```bash
# Build
npm run build

# Deploy to Netlify
netlify deploy --prod --dir=dist

# Deploy to Vercel
vercel --prod
```

#### Option 2: ESP32 Serving (SPIFFS)
```bash
# Build with base path
VITE_BASE=/webapp npm run build

# Upload dist/ to ESP32 SPIFFS
pio run --target uploadfs
```

#### Option 3: Docker Container
```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## Testing Strategy

### Unit Tests (Vitest)

**Component Tests:**
```typescript
// __tests__/ParamSlider.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ParamSlider } from '../components/control/ParamSlider';

test('slider updates value on drag', () => {
  const onChange = jest.fn();
  render(<ParamSlider value={0.5} onChange={onChange} min={0} max={1} />);

  const slider = screen.getByRole('slider');
  fireEvent.change(slider, { target: { value: 0.8 } });

  expect(onChange).toHaveBeenCalledWith(0.8);
});
```

**API Client Tests:**
```typescript
// __tests__/api.test.ts
import { getPatterns, postParams } from '../lib/api';

beforeEach(() => {
  fetchMock.resetMocks();
});

test('getPatterns fetches from correct endpoint', async () => {
  fetchMock.mockResponseOnce(JSON.stringify({ patterns: [] }));

  await getPatterns('192.168.1.100');

  expect(fetchMock).toHaveBeenCalledWith('http://192.168.1.100/api/patterns');
});

test('postParams sends correct payload', async () => {
  fetchMock.mockResponseOnce(JSON.stringify({ brightness: 0.8 }));

  await postParams('192.168.1.100', { brightness: 0.8 });

  expect(fetchMock).toHaveBeenCalledWith(
    'http://192.168.1.100/api/params',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ brightness: 0.8 }),
    })
  );
});
```

### Integration Tests (Jest + Testing Library)

**File:** [webapp/src/__tests__/phase54-e2e-integration.test.ts](../../webapp/src/__tests__/phase54-e2e-integration.test.ts)

```typescript
test('full user flow: connect → select pattern → adjust params', async () => {
  render(<App />);

  // 1. Connect to device
  const ipInput = screen.getByPlaceholderText('Device IP');
  fireEvent.change(ipInput, { target: { value: '192.168.1.100' } });
  fireEvent.click(screen.getByText('Connect'));

  await waitFor(() => {
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  // 2. Select pattern
  const patternCard = await screen.findByText('Spectrum Bars');
  fireEvent.click(patternCard);

  await waitFor(() => {
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  // 3. Adjust brightness
  const brightnessSlider = screen.getByLabelText('Brightness');
  fireEvent.change(brightnessSlider, { target: { value: 0.7 } });

  await waitFor(() => {
    expect(mockPostParams).toHaveBeenCalledWith(
      '192.168.1.100',
      expect.objectContaining({ brightness: 0.7 })
    );
  });
});
```

### E2E Tests (Playwright - Future)

```typescript
// e2e/control-panel.spec.ts
import { test, expect } from '@playwright/test';

test('adjust brightness slider', async ({ page }) => {
  await page.goto('http://localhost:5173');

  // Connect to device
  await page.fill('input[placeholder="Device IP"]', '192.168.1.100');
  await page.click('button:has-text("Connect")');

  // Adjust brightness
  const slider = page.locator('input[aria-label="Brightness"]');
  await slider.fill('0.8');

  // Verify request sent
  const response = await page.waitForResponse(/\/api\/params/);
  const body = await response.json();
  expect(body.brightness).toBe(0.8);
});
```

### Test Coverage

**Current Coverage:**
```
Statements   : 45%
Branches     : 38%
Functions    : 40%
Lines        : 45%
```

**Target Coverage:**
```
Statements   : 80%
Branches     : 75%
Functions    : 80%
Lines        : 80%
```

**Run Coverage Report:**
```bash
npm run test:coverage
# → coverage/lcov-report/index.html
```

---

## References

### Source Files

| File | Description | Lines |
|------|-------------|-------|
| [`webapp/package.json`](../../webapp/package.json) | Dependencies, scripts | 85 |
| [`webapp/src/App.tsx`](../../webapp/src/App.tsx) | Root component, view routing | 200 |
| [`webapp/src/lib/api.ts`](../../webapp/src/lib/api.ts) | REST API client | 300 |
| [`webapp/src/lib/types.ts`](../../webapp/src/lib/types.ts) | TypeScript type definitions | 150 |
| [`webapp/src/backend/react-query-hooks.ts`](../../webapp/src/backend/react-query-hooks.ts) | TanStack Query hooks | 200 |
| [`webapp/src/components/views/ControlPanelView.tsx`](../../webapp/src/components/views/ControlPanelView.tsx) | Main control interface | 250 |
| [`webapp/src/components/control/RealTimeParameterControls.tsx`](../../webapp/src/components/control/RealTimeParameterControls.tsx) | Parameter sliders | 300 |

### Related Documentation

- **Audio Sync Layer:** [docs/01-architecture/audio_sync_layer_system_guide.md](audio_sync_layer_system_guide.md)
- **Visual Pipeline:** [docs/01-architecture/visual_rendering_pipeline_system_guide.md](visual_rendering_pipeline_system_guide.md)
- **Firmware API:** [firmware/src/webserver.cpp](../../firmware/src/webserver.cpp)

### External References

- [React Documentation](https://react.dev/)
- [TanStack Query Docs](https://tanstack.com/query/latest)
- [Radix UI Primitives](https://www.radix-ui.com/primitives)
- [Vite Documentation](https://vite.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Recharts](https://recharts.org/)

---

## Appendix A: Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                         Browser (Client)                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  React 18.3 + TypeScript + Vite                                 │
│  ├─ SPA (Single Page Application)                               │
│  ├─ Client-side routing (view switching)                        │
│  └─ Hot Module Replacement (dev mode)                           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  UI Layer (Components)                                     │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │  - Radix UI (Accessible primitives)                        │ │
│  │  - Tailwind CSS (Styling)                                  │ │
│  │  - Framer Motion (Animations)                              │ │
│  │  - Recharts (Performance visualization)                    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                          ▼                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  State Management                                          │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │  - TanStack Query (Server state + cache)                   │ │
│  │  - useState (Local component state)                        │ │
│  │  - localStorage (Persistent preferences)                   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                          ▼                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  API Client (lib/api.ts)                                   │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │  - REST fetch abstraction                                  │ │
│  │  - Proxy fallback (dev mode)                               │ │
│  │  - GET/POST coordination                                   │ │
│  │  - Error handling                                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                           ▼ HTTP REST API ▼
┌──────────────────────────────────────────────────────────────────┐
│                      ESP32-S3 Firmware                           │
├──────────────────────────────────────────────────────────────────┤
│  - Async HTTP server (ESPAsyncWebServer)                        │
│  - JSON request/response (ArduinoJson)                          │
│  - Parameter management (double-buffered)                       │
│  - Pattern registry                                             │
│  - Palette storage                                              │
└──────────────────────────────────────────────────────────────────┘
```

---

**End of Document**
