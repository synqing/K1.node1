---
title: API Versioning Guide
status: draft
---

Overview

- Current firmware exposes unversioned routes under `/api/*`.
- Aliases are provided for compatibility (`/api/device-info`, `/api/device-performance`, `/api/metrics`).

Guidance

- Prefer unversioned routes for on-device UI and tight coupling.
- Introduce `/api/v1/*` aliases only when external integrators require stability across firmware revisions.
- If versioning is added:
  - Maintain `/api/*` as the canonical source of truth.
  - Provide `/api/v1/*` aliases mapped to the same handlers.
  - Deprecate aliases with clear timelines and headers when removing.