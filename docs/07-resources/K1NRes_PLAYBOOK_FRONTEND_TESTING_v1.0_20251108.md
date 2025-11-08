# Frontend Testing Playbook (Resources)

Relocated from CLAUDE.md on 2025-11-05. Focuses on unit, integration, and E2E practices for web UI in this repo.

## Test Pyramid

- Unit (fast, isolated): components, hooks, pure utils.
- Integration (medium): component trees with providers, routing, data fetching.
- E2E (slow): user journeys across pages, critical workflows.

Bias toward many unit/integration tests + a few deterministic E2E journeys.

## Tools

- Unit/Integration: Vitest or Jest + React Testing Library.
- E2E: Playwright (headless, trace, retries).
- Coverage: c8/istanbul via Vitest/Jest.

Repo-specific:
- Jest + RTL is configured in `webapp/jest.config.ts` with jsdom and CSS module mapping.
- Test setup lives in `webapp/src/test/setup.ts` (adds `@testing-library/jest-dom` and polyfills `requestIdleCallback`).

## Patterns

- Components: render with minimal providers; assert on visible behavior, not implementation.
- Hooks: test with a tiny wrapper component; model timeouts with fake timers.
- Async: prefer `findBy*` queries; use `await` and `userEvent` for input flows.
- Data: prefer MSW to stub network; keep fixtures under `__fixtures__/`.
- Accessibility: assert roles/names; run `@axe-core/playwright` in E2E for critical paths.

## Example Snippets

Unit (React Testing Library):
```
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Button from './Button'

it('submits when enabled', async () => {
  render(<Button onClick={() => submit()} disabled={false}>Send</Button>)
  await userEvent.click(screen.getByRole('button', { name: /send/i }))
  // assert side effects
})
```

Playwright E2E:
```
import { test, expect } from '@playwright/test'

test('user can send a message', async ({ page }) => {
  await page.goto('/chat')
  await page.getByPlaceholder('Type a message').fill('Hello')
  await page.getByRole('button', { name: /send/i }).click()
  await expect(page.getByText('Hello')).toBeVisible()
})
```

Repo Jest config (excerpt):
```
// webapp/jest.config.ts
export default {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: { jsx: 'react-jsx' } }] }
}
```

Setup polyfill (idle callback):
```
// webapp/src/test/setup.ts
import '@testing-library/jest-dom'
if (!globalThis.requestIdleCallback) {
  globalThis.requestIdleCallback = (cb) => setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 0 }), 16)
  globalThis.cancelIdleCallback = (id) => clearTimeout(id as any)
}
```

Fake timers with hooks (from repo):
```
// webapp/src/hooks/__tests__/useCoalescedParams.test.tsx
jest.useFakeTimers()
const { result } = renderHook(() => useCoalescedParams({ onSend, delay: 80, leadingEdge: true, maxWait: 500 }))
act(() => { result.current.scheduleSend('brightness', 42); jest.advanceTimersByTime(0) })
expect(onSend).toHaveBeenCalledTimes(1)
```

Mock fetch gating (from repo):
```
// webapp/src/lib/__tests__/api.gating.test.ts
globalThis.fetch = jest.fn((input, init) => { /* return Response-like */ }) as any
jest.advanceTimersByTime(40) // gate GET until POST resolves
```

Vitest example (from repo):
```
// webapp/src/lib/__tests__/ledRenderer.test.ts
import { describe, it, expect } from 'vitest'
it('respects maxFPS', async () => { /* measure fps and assert */ })
```

## Coverage Targets

- Lines/branches ≥ 80–90% overall; critical modules ≥ 95%.
- Do not chase 100% when it creates brittle tests; prefer meaningful coverage.

## CI Guidance

- Run unit/integration on every push; E2E on main and release branches.
- Record Playwright traces on failure: `--trace on-first-retry`.
- Shard long suites; cap test timeouts; keep retries low (≤ 2) to avoid hiding flakes.

## Flaky Test Triage

- Tag with `@flaky` and isolate in CI if needed.
- Prefer deterministic waits (await UI state) over timeouts.
- Use network stubbing to avoid external variability.

## Visual Regressions (Optional)

- Use Playwright screenshot comparisons for critical components only.
- Control fonts/timezones; mask dynamic regions to reduce false positives.

## MSW Setup (Integration)

```
// test/setup.ts
import { setupServer } from 'msw/node'
import { rest } from 'msw'

export const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

export const mockGet = (path: string, json: any, status = 200) =>
  server.use(rest.get(path, (_req, res, ctx) => res(ctx.status(status), ctx.json(json))))
```

Use in test:
```
import { mockGet } from '../test/setup'
mockGet('/api/me', { name: 'Ada' })
```

## RTL Anti‑Patterns

- Don’t assert internal state; assert visible output and ARIA roles.
- Don’t use `container.querySelector` unless unavoidable; prefer role-based queries.
- Don’t rely on timers when you can await UI state; prefer `findBy*`.

## Playwright Config Tips

```
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  retries: 1,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  reporter: [['html', { open: 'never' }], ['list']]
})
```
