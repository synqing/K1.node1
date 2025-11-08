# Workflow Integration

Pipelines between Design and Development:

- Intake: Issues filed with component/handoff metadata and links.
- Discovery: Designers research and prototype; engineers provide feasibility notes.
- Spec: Component specs created; tokens planned; accessibility criteria defined.
- Build: Engineers implement; unit and accessibility tests added.
- Validate: Designer reviews; performance and accessibility checks run.
- Release: Merge with metadata and changelog; capability gates updated.

Quality Assurance:
- Follow `design/04-quality/QA_CHECKLIST.md` for visual, interaction, and accessibility checks.
- Record performance metrics in `design/04-quality/PERFORMANCE_MONITORING.md`.

Monitoring:
- Use `StatusBar` and performance polling in the webapp for runtime telemetry.
- Track regressions and fixes in `design/04-quality/`.

