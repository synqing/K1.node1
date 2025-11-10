# Deployment Considerations

## Environment Configuration
- Orkes Service:
  - `PORT=8800`
  - `ALLOWED_ORIGINS=http://localhost:3003,http://localhost:3004,http://localhost:5173`
  - `ORKES_SERVER_URL=https://developer.orkescloud.com/api`
  - `ORKES_KEY_ID`, `ORKES_KEY_SECRET` (optional for auth-enabled Orkes)
  - `FIRMWARE_PROJECT_DIR=../firmware` (default)
  - `PIO_ENV=esp32-s3-devkitc-1`, `PIO_BIN=pio`
- Webapp:
  - `VITE_ORKES_SERVICE_BASE_URL=/api/workflows` (Vite proxies `/api` to `http://localhost:8800`)
  - `VITE_ANALYSIS_API_BASE_URL` if using analysis endpoints

## Build & Pipeline Changes
- Add service build/start to dev and CI:
  - `orkes-service`: build, run tests, start workers.
  - Register workflows via `src/scripts/register.ts` upon deploy.
- Webapp:
  - Ensure `.env` includes Orkes base URL; add QA/staging/prod variants.

## Monitoring & Logging
- Orkes Service logs:
  - Request logs (method, path, timestamp)
  - Worker task logs with input summaries
- Health endpoints:
  - `/health`, `/api/status` consumed by uptime checks
- Frontend telemetry:
  - Log workflow transitions for user sessions; track failures and retry counts.
