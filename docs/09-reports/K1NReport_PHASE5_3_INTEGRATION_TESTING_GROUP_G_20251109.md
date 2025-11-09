# Group G: Integration Testing Framework

**Phase:** 5.3 (Dashboard & Advanced API)
**Group:** G (Integration Testing)
**Timeline:** Days 6-9 (parallel with Groups C-F)
**Status:** FRAMEWORK READY FOR EXECUTION

---

## Executive Summary

Group G provides comprehensive integration testing across all Phase 5.3 deliverables:

- **Dashboard Integration Tests** - React components + Redux + WebSocket
- **API Integration Tests** - All endpoints with auth scopes + error handling
- **E2E Test Scenarios** - Complete user workflows
- **Performance Testing** - Load testing + profiling
- **Security Testing** - Auth + HMAC signature verification

---

## Testing Strategy

### Staggered Testing Approach

```
Days 6-7:   Partial Dashboard Testing (with Group C components)
Days 6-7:   Partial API Testing (with Group D endpoints)
Days 8-9:   Full E2E Testing (all components integrated)
Days 9:     Performance & Load Testing
Days 9:     Security Validation
```

### Progressive Testing (No Blocking)

- Test with **mock data first** (Days 6-7)
- Transition to **real APIs** (Days 8)
- **Parallel with development** of remaining features
- **Non-blocking** - failures don't stop other groups

---

## Task 3.3.7: Dashboard Integration Tests

### Test File Structure

```
webapp/src/components/__tests__/
├── GanttChart.integration.test.tsx
├── AnalyticsDashboard.integration.test.tsx
├── DashboardWithRedux.integration.test.tsx
└── DashboardE2E.test.tsx
```

### Test Scenarios

#### 1. Component Rendering with Redux

```typescript
describe('GanttChart Integration', () => {
  it('renders Gantt chart with Redux scheduling data', async () => {
    const store = configureStore({
      reducer: { scheduling: schedulingReducer },
      preloadedState: { scheduling: { schedules: MOCK_SCHEDULES, ... } },
    });

    render(
      <Provider store={store}>
        <GanttChartWithRedux />
      </Provider>
    );

    expect(screen.getByText(/Schedule Timeline/i)).toBeInTheDocument();
    expect(screen.getByText(/Daily Backup/i)).toBeInTheDocument();
    expect(screen.getByText(/4/i)).toBeInTheDocument(); // Schedule count
  });

  it('updates Gantt chart when Redux state changes', async () => {
    const store = configureStore({
      reducer: { scheduling: schedulingReducer },
    });

    render(
      <Provider store={store}>
        <GanttChartWithRedux />
      </Provider>
    );

    // Initial state should be empty
    expect(screen.queryByText(/Daily Backup/i)).not.toBeInTheDocument();

    // Dispatch update
    store.dispatch(setSchedules(MOCK_SCHEDULES));

    // Wait for update
    await waitFor(() => {
      expect(screen.getByText(/Daily Backup/i)).toBeInTheDocument();
    });
  });

  it('handles zoom controls correctly', async () => {
    const { rerender } = render(
      <Provider store={mockStore}>
        <GanttChartWithRedux />
      </Provider>
    );

    const zoomInBtn = screen.getByTitle(/Zoom in/i);
    fireEvent.click(zoomInBtn);

    // Verify zoom level changed (check by rendered text or prop)
    await waitFor(() => {
      expect(screen.getByText(/1 Hour/i)).toBeInTheDocument();
    });
  });
});
```

#### 2. WebSocket Data Binding

```typescript
describe('Dashboard WebSocket Integration', () => {
  it('updates dashboard when WebSocket sends scheduling:update', async () => {
    const store = configureStore({
      reducer: { scheduling: schedulingReducer },
    });

    const { rerender } = render(
      <Provider store={store}>
        <AnalyticsDashboardWithRedux />
      </Provider>
    );

    // Simulate WebSocket message
    const wsMessage = {
      type: 'scheduling:update',
      timestamp: new Date().toISOString(),
      data: {
        schedules: MOCK_SCHEDULES,
        queueStatus: MOCK_QUEUE_STATUS,
      },
    };

    // Dispatch to Redux (simulating WebSocket service)
    store.dispatch(setSchedules(wsMessage.data.schedules));
    store.dispatch(setQueueStatus(wsMessage.data.queueStatus));

    await waitFor(() => {
      expect(screen.getByText(/4/i)).toBeInTheDocument(); // Schedule count
    });
  });

  it('handles WebSocket disconnection gracefully', async () => {
    const store = configureStore({
      reducer: { connection: connectionReducer },
    });

    render(
      <Provider store={store}>
        <ConnectionIndicator />
      </Provider>
    );

    // Simulate disconnect
    store.dispatch(setWebSocketConnected(false));
    store.dispatch(setConnectionError('WebSocket disconnected'));

    await waitFor(() => {
      expect(screen.getByText(/Disconnected/i)).toBeInTheDocument();
      expect(screen.getByText(/Polling fallback active/i)).toBeInTheDocument();
    });
  });
});
```

#### 3. Real API Integration

```typescript
describe('Dashboard Real API Integration', () => {
  beforeEach(() => {
    // Mock fetch API
    global.fetch = jest.fn();
  });

  it('fetches real metrics from /api/v2/metrics/scheduling', async () => {
    const mockResponse = {
      schedules: MOCK_SCHEDULES,
      queueStatus: MOCK_QUEUE_STATUS,
      resourceUsage: MOCK_RESOURCE_USAGE,
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const store = configureStore({
      reducer: { scheduling: schedulingReducer },
    });

    render(
      <Provider store={store}>
        <GanttChartWithRedux />
      </Provider>
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v2/metrics/scheduling'
      );
    });
  });

  it('falls back to mock data when API fails', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error('Network error')
    );

    const store = configureStore({
      reducer: { scheduling: schedulingReducer },
    });

    render(
      <Provider store={store}>
        <GanttChartWithRedux />
      </Provider>
    );

    // Should still render (with mock data fallback)
    await waitFor(() => {
      expect(screen.getByText(/Schedule Timeline/i)).toBeInTheDocument();
    });
  });
});
```

#### 4. E2E User Workflows

```typescript
describe('Dashboard E2E Workflows', () => {
  it('allows user to view schedule timeline and interventions', async () => {
    render(
      <Provider store={store}>
        <Dashboard />
      </Provider>
    );

    // 1. View Gantt chart
    expect(screen.getByText(/Schedule Timeline/i)).toBeInTheDocument();

    // 2. Check schedule details on hover
    const scheduleBar = screen.getByText(/Daily Backup/i).closest('svg');
    fireEvent.mouseEnter(scheduleBar!);

    await waitFor(() => {
      expect(screen.getByText(/Next:/i)).toBeInTheDocument();
      expect(screen.getByText(/Duration:/i)).toBeInTheDocument();
    });

    // 3. View analytics panels
    expect(screen.getByText(/Retry Success Rate/i)).toBeInTheDocument();
    expect(screen.getByText(/Circuit Breakers/i)).toBeInTheDocument();

    // 4. Check resource utilization
    const cpuGauge = screen.getByText(/CPU Usage/i);
    expect(cpuGauge).toBeInTheDocument();
  });

  it('allows user to pause/resume task from dashboard', async () => {
    const mockPauseTask = jest.fn();

    // TODO: Mock API call to POST /tasks/:taskId/pause

    render(
      <Provider store={store}>
        <TaskInterventionPanel interventions={[]} />
      </Provider>
    );

    // Pause button should be available in component
    const pauseBtn = screen.getByRole('button', { name: /pause/i });
    fireEvent.click(pauseBtn);

    await waitFor(() => {
      expect(mockPauseTask).toHaveBeenCalled();
    });
  });
});
```

---

## Task 3.4.7: API Integration Tests

### Test File Structure

```
ops/api/__tests__/
├── errorRecoveryEndpoints.integration.test.ts
├── webhookEndpoints.integration.test.ts
├── batchEndpoints.integration.test.ts
├── rateLimiting.integration.test.ts
└── apiE2E.test.ts
```

### Test Scenarios

#### 1. Endpoint Functionality

```typescript
describe('Error Recovery Endpoints', () => {
  let app: Express;
  let request: SuperTest<Test>;

  beforeAll(() => {
    app = createApp();
    request = supertest(app);
  });

  describe('GET /api/v2/metrics/retry-stats', () => {
    it('returns retry statistics with correct structure', async () => {
      const response = await request
        .get('/api/v2/metrics/retry-stats')
        .set('Authorization', `Bearer sk-test-dashboard`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalRetries');
      expect(response.body).toHaveProperty('successfulRetries');
      expect(response.body).toHaveProperty('retrySuccessRate');
      expect(response.body.retrySuccessRate).toBeGreaterThanOrEqual(0);
      expect(response.body.retrySuccessRate).toBeLessThanOrEqual(100);
    });

    it('filters by interval parameter', async () => {
      const response = await request
        .get('/api/v2/metrics/retry-stats?interval=24h')
        .set('Authorization', `Bearer sk-test-dashboard`);

      expect(response.status).toBe(200);
      expect(response.body.interval).toBe('24h');
    });

    it('returns 400 for invalid interval', async () => {
      const response = await request
        .get('/api/v2/metrics/retry-stats?interval=invalid')
        .set('Authorization', `Bearer sk-test-dashboard`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_INTERVAL');
    });
  });

  describe('POST /api/v2/queue/dlq/:dlqId/resubmit', () => {
    it('resubmits DLQ entry and returns success', async () => {
      const response = await request
        .post('/api/v2/queue/dlq/dlq-1/resubmit')
        .set('Authorization', `Bearer sk-test-dashboard`)
        .send({ parameters: { retry: true } });

      expect(response.status).toBe(202);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('status', 'pending');
    });

    it('requires ERROR_RECOVERY_WRITE scope', async () => {
      const response = await request
        .post('/api/v2/queue/dlq/dlq-1/resubmit')
        .set('Authorization', `Bearer sk-test-readonly`); // No write scope

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });
  });
});
```

#### 2. Auth Scope Enforcement

```typescript
describe('Authorization Scope Enforcement', () => {
  const testCases = [
    {
      endpoint: 'GET /api/v2/metrics/retry-stats',
      requiredScope: SCOPES.ERROR_RECOVERY_READ,
      invalidToken: 'sk-test-batch-only',
      expectedStatus: 403,
    },
    {
      endpoint: 'POST /api/v2/queue/dlq/:dlqId/resubmit',
      requiredScope: SCOPES.ERROR_RECOVERY_WRITE,
      invalidToken: 'sk-test-readonly',
      expectedStatus: 403,
    },
    {
      endpoint: 'POST /api/v2/tasks/batch',
      requiredScope: SCOPES.BATCH_WRITE,
      invalidToken: 'sk-test-dashboard',
      expectedStatus: 403,
    },
  ];

  testCases.forEach(({ endpoint, requiredScope, invalidToken, expectedStatus }) => {
    it(`enforces ${requiredScope} for ${endpoint}`, async () => {
      const [method, path] = endpoint.split(' ');
      const request = supertest(app)[method.toLowerCase() as 'get' | 'post'](path);

      const response = await request
        .set('Authorization', `Bearer ${invalidToken}`)
        .send({});

      expect(response.status).toBe(expectedStatus);
      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });
  });
});
```

#### 3. Error Handling

```typescript
describe('Error Handling', () => {
  it('returns 404 when resource not found', async () => {
    const response = await request
      .get('/api/v2/tasks/batch/invalid-batch-id')
      .set('Authorization', `Bearer sk-test-dashboard`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 with detailed error for invalid input', async () => {
    const response = await request
      .post('/api/v2/tasks/batch')
      .set('Authorization', `Bearer sk-test-dashboard`)
      .send({ tasks: [] }); // Empty array

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_REQUEST');
    expect(response.body.error).toHaveProperty('details');
  });

  it('handles internal errors gracefully', async () => {
    // Mock an error in the handler
    jest.spyOn(metricsService, 'getScheduleMetrics').mockRejectedValueOnce(
      new Error('Database connection failed')
    );

    const response = await request
      .get('/api/v2/metrics/scheduling')
      .set('Authorization', `Bearer sk-test-dashboard`);

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
    // Should NOT expose internal error message
    expect(response.body.error.message).not.toContain('Database');
  });
});
```

#### 4. Rate Limiting

```typescript
describe('Rate Limiting', () => {
  it('includes rate limit headers in response', async () => {
    const response = await request
      .get('/api/v2/metrics/retry-stats')
      .set('Authorization', `Bearer sk-test-dashboard`);

    expect(response.headers).toHaveProperty('x-ratelimit-limit');
    expect(response.headers).toHaveProperty('x-ratelimit-remaining');
    expect(response.headers).toHaveProperty('x-ratelimit-reset');
  });

  it('returns 429 when rate limit exceeded', async () => {
    const clientId = 'test-client-429';

    // Make requests until limit exceeded
    for (let i = 0; i < 1001; i++) {
      const response = await request
        .get('/api/v2/metrics/retry-stats')
        .set('X-Client-ID', clientId);

      if (i === 1000) {
        expect(response.status).toBe(429);
        expect(response.body.error.code).toBe('RATE_LIMITED');
        expect(response.headers).toHaveProperty('retry-after');
      }
    }
  });

  it('refills tokens over time', async () => {
    // Mock time passing (in production, would use real time)
    // This test demonstrates the expected behavior

    const bucket = getOrCreateBucket('test-client', 1000);
    bucket.tokens = 0;
    bucket.lastRefillAt = Date.now() - 3600000; // 1 hour ago

    refillTokens(bucket, 1000);
    expect(bucket.tokens).toBe(1000);
  });
});
```

---

## Performance Testing

### Load Testing Scenarios

```typescript
describe('Performance & Load Testing', () => {
  it('handles 100 concurrent dashboard loads', async () => {
    const promises = Array(100).fill(null).map(() =>
      request
        .get('/api/v2/metrics/scheduling')
        .set('Authorization', `Bearer sk-test-dashboard`)
    );

    const startTime = Date.now();
    const responses = await Promise.all(promises);
    const duration = Date.now() - startTime;

    // All should succeed
    responses.forEach(r => expect(r.status).toBe(200));

    // Should complete in reasonable time (< 5 seconds)
    expect(duration).toBeLessThan(5000);
  });

  it('handles batch submission of 10,000 tasks', async () => {
    const tasks = Array(10000).fill(null).map((_, i) => ({
      taskId: `task-${i}`,
      parameters: {},
    }));

    const startTime = Date.now();
    const response = await request
      .post('/api/v2/tasks/batch')
      .set('Authorization', `Bearer sk-test-dashboard`)
      .send({ tasks });
    const duration = Date.now() - startTime;

    expect(response.status).toBe(202);
    expect(response.body.taskCount).toBe(10000);
    expect(duration).toBeLessThan(2000); // Should accept batch quickly
  });

  it('dashboard renders with 10,000 schedules', async () => {
    const largeScheduleSet = Array(10000).fill(null).map((_, i) => ({
      ...MOCK_SCHEDULES[i % 4],
      id: `schedule-${i}`,
    }));

    const store = configureStore({
      reducer: { scheduling: schedulingReducer },
      preloadedState: { scheduling: { schedules: largeScheduleSet } },
    });

    const startTime = Date.now();
    render(
      <Provider store={store}>
        <GanttChartWithRedux />
      </Provider>
    );
    const duration = Date.now() - startTime;

    // Should render in < 2 seconds
    expect(duration).toBeLessThan(2000);
    expect(screen.getByText(/Schedule Timeline/i)).toBeInTheDocument();
  });
});
```

---

## Security Testing

### Authentication & Authorization

```typescript
describe('Security: Authentication & Authorization', () => {
  it('rejects requests without authorization header', async () => {
    const response = await request
      .get('/api/v2/metrics/retry-stats');
    // Should return 401

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('rejects invalid API keys', async () => {
    const response = await request
      .get('/api/v2/metrics/retry-stats')
      .set('Authorization', 'Bearer invalid-key-12345');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_TOKEN');
  });

  it('rejects expired JWT tokens', async () => {
    const expiredToken = generateJWT({ exp: Math.floor(Date.now() / 1000) - 3600 });

    const response = await request
      .get('/api/v2/metrics/retry-stats')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(response.status).toBe(401);
  });

  it('enforces HMAC signature verification for webhooks', async () => {
    const payload = JSON.stringify({ event: 'test' });
    const invalidSignature = 'sha256=invalid';

    const response = await request
      .post('/webhooks/callback')
      .set('X-K1Node-Signature', invalidSignature)
      .send(payload);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_SIGNATURE');
  });
});
```

---

## Test Execution Plan

### Phase 1: Days 6-7 (Partial Testing)

```bash
# Run with mock data only
npm test -- --testPathPattern="(Gantt|Analytics).integration"
npm test -- --testPathPattern="errorRecoveryEndpoints.integration"

# Expected: ~80% pass rate (some tests skipped for incomplete features)
```

### Phase 2: Days 8 (Full Testing)

```bash
# Run complete test suite
npm test -- --coverage

# Run E2E tests
npm run test:e2e

# Expected: 95%+ pass rate
```

### Phase 3: Day 9 (Performance & Security)

```bash
# Performance tests
npm test -- --testPathPattern="Performance"

# Security tests
npm test -- --testPathPattern="Security"

# Load testing
npm run test:load

# Expected: All performance targets met
```

---

## Success Criteria

✅ **Dashboard Integration Tests**
- [ ] All components render with Redux store
- [ ] WebSocket data binding works correctly
- [ ] Fallback to polling when WebSocket unavailable
- [ ] Real API integration successful
- [ ] E2E user workflows pass

✅ **API Integration Tests**
- [ ] All endpoints functional
- [ ] Authentication enforced
- [ ] Authorization scopes validated
- [ ] Error handling comprehensive
- [ ] Rate limiting works correctly

✅ **Performance**
- [ ] Dashboard renders 10,000 schedules in < 2s
- [ ] API handles 100 concurrent requests
- [ ] Batch operations accept 10,000 items < 2s

✅ **Security**
- [ ] All auth mechanisms validated
- [ ] HMAC signatures verified
- [ ] No sensitive data exposed in errors
- [ ] Rate limiting prevents abuse

---

## Next Steps

1. **Run integration tests** (Days 6-9, parallel with development)
2. **Fix failing tests** (non-blocking, don't stop other groups)
3. **Performance profiling** (Day 9)
4. **Load testing** (Day 9)
5. **Security audit** (Day 9)
6. **Production readiness** (Day 10)

---

**Status:** ✅ FRAMEWORK READY FOR EXECUTION

All test templates provided. Begin testing immediately as each component completes.
