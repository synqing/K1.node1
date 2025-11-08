# Performance Monitoring for UI Components

Budgets:
- Target under 16ms per frame for interactive components.
- Avoid synchronous heavy work in render; use memoization and virtualization.

Measurements:
- Use React Profiler and browser performance tools.
- Integrate runtime telemetry from `getPerformanceMetrics` in `StatusBar`.

Checks:
- Measure before/after changes to components.
- Record findings in `design/04-quality/` with dates and versions.

Regression Handling:
- Capture regressions with steps to reproduce and resolution notes.

