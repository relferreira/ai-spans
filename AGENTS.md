# AGENTS.md

## Project Overview

This repository is a monorepo for `ai-spans`, an embedded AI SDK observability library for Next.js apps.

- Library package: `packages/ai-spans`
- Demo app (Next.js App Router + AI SDK v6 + Anthropic): `apps/nextjs-ai-sdk-v6-demo`
- Local infra: `docker-compose.clickhouse.yml`

The current backend support is **ClickHouse only**.

## Monorepo Commands (run from repo root)

- `npm install`
- `npm run build`
- `npm run test`
- `npm run test:e2e`
- `npm run typecheck`
- `npm run dev:demo`

Use root commands by default so Turbo runs dependency-aware pipelines.

## ClickHouse (Local Development)

Preferred local setup uses Docker:

- Start: `docker compose -f docker-compose.clickhouse.yml up -d`
- Stop: `docker compose -f docker-compose.clickhouse.yml down`
- Reset data: `docker compose -f docker-compose.clickhouse.yml down -v`

Expected ports:

- HTTP: `8123`
- Native client: `9000`

Default local credentials used by the demo:

- User: `default`
- Password: set via `CLICKHOUSE_PASSWORD` env var for Docker Compose
- Fallback password (if env var is not set): `clickhouse_password`
- Database: `ai_spans`

## Secrets / Environment Files

- Never commit `.env.local`.
- Demo env file lives at `apps/nextjs-ai-sdk-v6-demo/.env.local`.
- Anthropic keys and database credentials must remain local only.

## Architecture Rules (Important)

### Backend support

- Keep **ClickHouse as the only supported backend** for now.
- Do not add partial support for other databases unless explicitly requested.

### Storage abstraction

- Use the internal storage adapter layer under `packages/ai-spans/src/storage`.
- New database access code should go into the adapter implementation, not directly into:
  - `packages/ai-spans/src/otel/*`
  - `packages/ai-spans/src/query/*`
  - `packages/ai-spans/src/ui/*`

### ORM policy

- Do **not** introduce an ORM as the core abstraction.
- Prefer adapter-specific raw SQL for analytics/observability queries.
- If an ORM is ever added for a future backend, keep it isolated inside that backend adapter.

### Public API stability

Avoid breaking subpath exports unless intentionally making a breaking change:

- `ai-spans/next`
- `ai-spans/otel`
- `ai-spans/ai-sdk`
- `ai-spans/query`
- `ai-spans/ui`

Keep consumer-facing APIs stable where possible.

## Next.js / AI SDK Integration Rules

- Demo app uses App Router and AI SDK v6.
- Keep observability registration in `instrumentation.ts` using `registerAiObservability()`.
- AI SDK calls should include `...aiSpansTelemetry({ functionId: ... })` to produce AI spans.
- Demo routes that query ClickHouse should run in Node runtime (`runtime = 'nodejs'`).

## Testing Expectations

When changing ingestion, query, schema, storage adapter, or UI behavior:

1. Run root checks:
   - `npm run typecheck`
   - `npm run test`
   - `npm run build`
2. Run the automated smoke e2e:
   - `npm run test:e2e`
3. If `npm run test:e2e` fails and you need to debug interactively:
   - Start ClickHouse via Compose
   - Run `npm run dev:demo`
   - Send at least one chat request in the demo
   - Verify rows in `ai_spans.ai_sdk_spans_v1`
   - Open `/admin/ai-observability`

## Debugging Notes

The demo may use these local-only debug env vars:

- `AI_SPANS_DEBUG=1`
- `AI_SPANS_PROCESSOR_MODE=serverless`

These are useful for exporter debugging but can make logs noisy.

## Repo Hygiene

- `.clickhouse-local/` is local runtime state and should not be committed.
- `.turbo/` is cache output and should not be committed.
- Prefer changing code in `packages/ai-spans` and validating through the demo app, not ad hoc scripts.
