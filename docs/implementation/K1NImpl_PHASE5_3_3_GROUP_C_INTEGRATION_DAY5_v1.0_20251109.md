# Group C Integration: Day 5 - Mock Data to Real APIs

**Phase:** 5.3.3 (Dashboard Development)
**Task:** Group C Integration
**Date:** Day 5 (2025-11-10)
**Status:** READY FOR EXECUTION
**Purpose:** Replace mock data with real Redux hooks and API calls

---

## Overview

On Day 4, all three tasks were completed with mock data:

✅ **Task 3.3.3** - Data Collection Service (590+ lines)
✅ **Task 3.3.4** - Gantt Chart Component (850+ lines, mock data)
✅ **Task 3.3.5** - Analytics Dashboard (1,400+ lines, 7 panels, mock data)

**Day 5 Integration Goal:** Swap mock data for real Redux hooks with **zero breaking changes** to components.

---

## Integration Strategy: No Rework Required

### Design Principle

The mock data generators were specifically designed to match the exact structure of real API responses:

```typescript
// Mock data generator (used Day 4)
const mockMetrics = generateMockScheduleMetrics();
// Returns: ScheduleMetricsData { schedules, queueStatus, resourceUsage, ... }

// Real data hook (use Day 5)
const { schedules, queueStatus, resourceUsage } = useSchedulingMetrics();
// Returns: IDENTICAL structure from Redux store
```

**Result:** Components accept both mock data and real Redux hooks without modification.

---

## Task-by-Task Integration

### Task 3.3.4: Gantt Chart Component

**Current Implementation (Day 4 - Mock Data):**
```typescript
// webapp/src/components/GanttChart.tsx (line ~30-50)
export const GanttChart: React.FC<GanttChartProps> = ({
  schedules,
  queueStatus,
  resourceOverlay = false,
  timeWindow,
  onScheduleClick,
  className = '',
}) => {
  // ... component logic ...
  // Schedules prop comes from parent with mock data
  const visibleSchedules = useMemo(() => {
    // Filter schedules in view
    return schedules.filter(/* ... */);
  }, [schedules, ...]);
```

**Day 5 Wrapper Component (Real Data):**
```typescript
// NEW FILE: webapp/src/components/GanttChartWithRedux.tsx

import React from 'react';
import { GanttChart } from './GanttChart';
import { useSchedulingMetrics } from '../hooks/useDashboard';

export const GanttChartWithRedux: React.FC = () => {
  // Fetch real data from Redux store via custom hook
  const { schedules, queueStatus, loading, error } = useSchedulingMetrics();

  if (loading) return <div className="p-6 text-center">Loading schedule data...</div>;
  if (error) return <div className="p-6 text-center text-red-600">Error: {error}</div>;

  // Pass real data to Gantt Chart component
  return (
    <GanttChart
      schedules={schedules}
      queueStatus={queueStatus}
      resourceOverlay={false}
      onScheduleClick={(schedule) => {
        console.log('Selected schedule:', schedule);
      }}
    />
  );
};
```

**Why No Rework Needed:**
- GanttChart component accepts `schedules` prop (same interface)
- useSchedulingMetrics hook returns `schedules` with identical structure
- Component logic unchanged - just data source switched

### Task 3.3.5: Analytics Dashboard

**Current Implementation (Day 4 - Mock Data):**
```typescript
// webapp/src/components/AnalyticsDashboard.tsx (line ~200+)
interface AnalyticsDashboardProps {
  retryMetrics: RetryMetrics;
  circuitBreakers: CircuitBreakerState[];
  dlqStats: { total, pending, deadLettered, successRate };
  interventions: [...];
  queueStatus: QueueStatus;
  schedules: Schedule[];
  resourceUsage: ResourceMetrics;
  resourceLimits?: {...};
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  retryMetrics,
  circuitBreakers,
  // ... rest of props
}) => {
  // Renders 7 panels with passed-in data
  return (
    <div className="grid ...">
      <RetryAnalyticsPanel retryMetrics={retryMetrics} />
      <CircuitBreakerPanel circuitBreakers={circuitBreakers} />
      {/* ... 5 more panels ... */}
    </div>
  );
};
```

**Day 5 Wrapper Component (Real Data):**
```typescript
// NEW FILE: webapp/src/components/AnalyticsDashboardWithRedux.tsx

import React from 'react';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import {
  useErrorRecoveryMetrics,
  useSchedulingMetrics,
} from '../hooks/useDashboard';

export const AnalyticsDashboardWithRedux: React.FC = () => {
  // Fetch real data from Redux store
  const {
    retryStats: retryMetrics,
    circuitBreakers,
    dlqEntries,
    interventionHistory,
    loading: errorLoading,
  } = useErrorRecoveryMetrics();

  const {
    schedules,
    queueStatus,
    resourceUsage,
    resourceLimits,
    loading: schedulingLoading,
  } = useSchedulingMetrics();

  const loading = errorLoading || schedulingLoading;

  if (loading) return <div className="p-6 text-center">Loading metrics...</div>;

  // Transform intervention history to intervention format expected by component
  const interventions = interventionHistory.map(intervention => ({
    taskId: intervention.taskId,
    type: intervention.type,
    timestamp: intervention.timestamp,
    reason: intervention.reason,
  }));

  // Calculate DLQ stats from dlqEntries
  const dlqStats = {
    total: dlqEntries.length,
    pending: dlqEntries.filter(e => e.status === 'pending').length,
    deadLettered: dlqEntries.filter(e => e.status === 'dead-lettered').length,
    successRate: 64.7, // TODO: calculate from historical data
  };

  return (
    <AnalyticsDashboard
      retryMetrics={retryMetrics}
      circuitBreakers={circuitBreakers}
      dlqStats={dlqStats}
      interventions={interventions}
      queueStatus={queueStatus}
      schedules={schedules}
      resourceUsage={resourceUsage}
      resourceLimits={resourceLimits}
    />
  );
};
```

**Why No Rework Needed:**
- AnalyticsDashboard accepts 8 data props (all matched by Redux hooks)
- Redux hooks return identical structures
- Wrapper transforms data format if needed (minor mapping)
- All 7 panel components unchanged

---

## Integration Checklist (Day 5, Full Day)

### Morning Session (08:00-12:00): Connect Components to Redux

**Gantt Chart Integration**
- [ ] Create `GanttChartWithRedux.tsx` wrapper
- [ ] Import and test `useSchedulingMetrics()` hook
- [ ] Verify schedules load correctly
- [ ] Check Gantt timeline renders properly
- [ ] Test zoom controls with real data
- [ ] Test pan controls with real data
- [ ] Verify no console errors

**Step-by-step code:**
```bash
# 1. Create wrapper component
cat > webapp/src/components/GanttChartWithRedux.tsx << 'EOF'
[insert code from above]
EOF

# 2. Test import and hook
grep -n "useSchedulingMetrics" webapp/src/hooks/useDashboard.ts

# 3. Verify Redux store setup
grep -n "setSchedules" webapp/src/store/slices/schedulingSlice.ts
```

### Midday Session (12:00-15:00): Connect Analytics Panels

**Analytics Dashboard Integration**
- [ ] Create `AnalyticsDashboardWithRedux.tsx` wrapper
- [ ] Import and test `useErrorRecoveryMetrics()` hook
- [ ] Import and test `useSchedulingMetrics()` hook
- [ ] Map Redux data to component props
- [ ] Verify all 7 panels render with real data
- [ ] Test panel interactions (e.g., click circuit breaker)
- [ ] Check for missing data and handle gracefully
- [ ] Verify no console errors

**Step-by-step code:**
```bash
# 1. Create wrapper component
cat > webapp/src/components/AnalyticsDashboardWithRedux.tsx << 'EOF'
[insert code from above]
EOF

# 2. Verify hooks exist
grep -n "useErrorRecoveryMetrics\|useSchedulingMetrics" webapp/src/hooks/useDashboard.ts

# 3. Check Redux dispatch setup
grep -n "setRetryStats\|updateCircuitBreakers" webapp/src/store/slices/errorRecoverySlice.ts
```

### Afternoon Session (15:00-18:00): Comprehensive Testing & Optimization

**Verification Tests**
- [ ] Render GanttChart with real schedules
  ```bash
  npm test -- GanttChart.test.tsx --coverage
  ```

- [ ] Render AnalyticsDashboard with real metrics
  ```bash
  npm test -- AnalyticsDashboard.test.tsx --coverage
  ```

- [ ] Test Redux integration
  ```bash
  npm test -- useDashboard.test.tsx --coverage
  ```

- [ ] Visual regression tests (screenshots)
  ```bash
  npm run test:e2e -- dashboard.spec.ts
  ```

**Performance Optimization**
- [ ] Profile component render times
- [ ] Optimize re-renders with React.memo if needed
- [ ] Verify Redux selectors are memoized
- [ ] Check for unnecessary API calls
- [ ] Measure initial load time (target: <2s)

**Browser Testing**
- [ ] Chrome: test zoom, pan, interactions
- [ ] Firefox: test rendering and animations
- [ ] Safari: test CSS and responsive design
- [ ] Mobile: test touch interactions (if supported)

**Console Cleanup**
- [ ] Remove all console.log statements
- [ ] Remove development warnings
- [ ] Verify no CORS/network errors
- [ ] Verify no Redux errors

**Documentation**
- [ ] Update component usage guide
- [ ] Document prop interfaces
- [ ] Add inline code comments for complex logic
- [ ] Update README with new components

---

## Integration Code Examples

### Example 1: Update Dashboard Main Page

**Current (Day 4):**
```typescript
// webapp/src/pages/Dashboard.tsx
import { GanttChart } from '../components/GanttChart';
import { AnalyticsDashboard } from '../components/AnalyticsDashboard';
import { MOCK_SCHEDULES, generateMockScheduleMetrics, generateMockErrorRecoveryMetrics } from '../services/metrics';

export const Dashboard = () => {
  const scheduleMetrics = generateMockScheduleMetrics();
  const errorMetrics = generateMockErrorRecoveryMetrics();

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <GanttChart schedules={scheduleMetrics.schedules} />
      <AnalyticsDashboard
        retryMetrics={errorMetrics.retryMetrics}
        circuitBreakers={errorMetrics.circuitBreakers}
        dlqStats={errorMetrics.dlqStats}
        // ... other props
      />
    </div>
  );
};
```

**Updated (Day 5):**
```typescript
// webapp/src/pages/Dashboard.tsx
import { GanttChartWithRedux } from '../components/GanttChartWithRedux';
import { AnalyticsDashboardWithRedux } from '../components/AnalyticsDashboardWithRedux';

export const Dashboard = () => {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <GanttChartWithRedux />
      <AnalyticsDashboardWithRedux />
    </div>
  );
};
```

**Benefit:** One-line change per component, zero logic modification.

### Example 2: Mock Mode for Storybook

**Keep mock data for development:**
```typescript
// webapp/src/components/GanttChart.stories.tsx
import { Meta, StoryObj } from '@storybook/react';
import { GanttChart } from './GanttChart';
import { generateMockScheduleMetrics } from '../services/metrics';

const meta: Meta<typeof GanttChart> = {
  component: GanttChart,
  title: 'Components/GanttChart',
};

const scheduleMetrics = generateMockScheduleMetrics();

export const WithMockData: StoryObj = {
  args: {
    schedules: scheduleMetrics.schedules,
    queueStatus: scheduleMetrics.queueStatus,
  },
};

export default meta;
```

**Benefit:** Storybook stories work without Redux, useful for component library/design system.

---

## Potential Integration Issues & Solutions

### Issue 1: Redux Store Not Initialized

**Problem:** Hooks return undefined/empty arrays
**Solution:**
```typescript
// In Redux middleware, dispatch initialization action
store.dispatch(initializeMetrics());

// Or in component:
const { schedules, loading } = useSchedulingMetrics();
if (loading || !schedules) return <LoadingSpinner />;
```

### Issue 2: Hook Returns Different Data Structure

**Problem:** Redux data structure differs from mock data
**Solution:**
```typescript
// Create adapter function in hooks/useDashboard.ts
const adaptReduxToMockFormat = (reduxData) => {
  return {
    ...reduxData,
    // Map any renamed fields
    scheduleList: reduxData.schedules,
  };
};
```

### Issue 3: Performance Degradation with Real Data

**Problem:** Component renders slowly with thousands of real schedules
**Solution:**
```typescript
// Implement virtualization
import { FixedSizeList } from 'react-window';

// Or implement pagination in hook
const useSchedulingMetrics = (page = 1, pageSize = 50) => {
  // Fetch paginated data
  return { schedules: data.slice(0, pageSize), ... };
};
```

### Issue 4: Missing Data in Real API Response

**Problem:** Some fields are undefined
**Solution:**
```typescript
// Add default values in wrapper component
const dlqStats = {
  total: dlqEntries?.length || 0,
  pending: dlqEntries?.filter(e => e.status === 'pending')?.length || 0,
  deadLettered: dlqEntries?.filter(e => e.status === 'dead-lettered')?.length || 0,
  successRate: 64.7, // TODO: calculate from historical data or use Redux value
};
```

---

## Validation Tests

### Unit Test Template

```typescript
// webapp/src/components/__tests__/GanttChartWithRedux.test.tsx
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { GanttChartWithRedux } from '../GanttChartWithRedux';
import schedulingReducer from '../../store/slices/schedulingSlice';

describe('GanttChartWithRedux', () => {
  it('renders Gantt chart with real Redux data', () => {
    const store = configureStore({
      reducer: {
        scheduling: schedulingReducer,
      },
      preloadedState: {
        scheduling: {
          schedules: MOCK_SCHEDULES,
          queueStatus: MOCK_QUEUE_STATUS,
          // ... other initial state
        },
      },
    });

    render(
      <Provider store={store}>
        <GanttChartWithRedux />
      </Provider>
    );

    expect(screen.getByText(/Schedule Timeline/i)).toBeInTheDocument();
    expect(screen.getByText(/Daily Backup/i)).toBeInTheDocument();
  });
});
```

---

## Deployment Readiness

### Pre-Deployment Checklist

**Code Quality:**
- [ ] All linting passes: `npm run lint`
- [ ] All tests pass: `npm test`
- [ ] No TypeScript errors: `npm run type-check`
- [ ] Build succeeds: `npm run build`

**Performance:**
- [ ] Initial load time < 3 seconds
- [ ] Interaction response < 100ms
- [ ] No memory leaks detected
- [ ] Bundle size within limits

**Testing:**
- [ ] Unit test coverage > 80%
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] Manual QA complete

**Documentation:**
- [ ] README updated
- [ ] Component documentation complete
- [ ] API documentation updated
- [ ] Integration guide created (this file)

---

## Next Steps (After Day 5)

Once Group C integration is complete:

1. **Groups D & E Parallel Execution** (Days 5-7)
   - Task 3.4.3: Error Recovery Endpoints
   - Task 3.3.6: WebSocket Real-Time Integration
   - These are independent of Group C completion

2. **Group G: Integration Testing** (Days 6-9)
   - Dashboard component testing with real APIs
   - End-to-end user workflows
   - Performance validation

3. **Deployment** (Day 10+)
   - Staging environment testing
   - Production deployment
   - Monitoring and alerts

---

## Success Criteria

✅ **Day 5 Integration Complete** when:

1. **All Components Running** - GanttChart and AnalyticsDashboard render with real Redux data
2. **No Breaking Changes** - Component props unchanged, only data source switched
3. **Mock Data Preserved** - Mock generators still available for Storybook/testing
4. **Zero Errors** - No console errors, all Redux actions dispatch correctly
5. **Performance Acceptable** - Initial load < 3s, interactions responsive
6. **Tests Passing** - Unit, integration, and E2E tests all pass
7. **Documentation Complete** - Integration guide and component docs updated

**Outcome:** Complete, production-ready dashboard with real-time metrics, ready to unblock Groups D-G (API endpoints, WebSocket integration, advanced features).

---

## Time Tracking

```
Day 5 Integration Schedule:

08:00-10:00  (2h): Gantt Chart integration
10:00-12:00  (2h): Analytics Dashboard integration
12:00-14:00  (2h): Testing & validation
14:00-16:00  (2h): Performance optimization
16:00-17:00  (1h): Documentation & cleanup

Total: 9 hours available (1 hour buffer)
Expected: 8 hours of focused work
Actual: [To be filled during Day 5 execution]
```

---

**Status:** ✅ READY FOR DAY 5 EXECUTION

All components built with mock data on Day 4. Day 5 is purely about connecting to real Redux data with zero code changes to components themselves.

