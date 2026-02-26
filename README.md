# ai-spans

Embedded AI SDK observability for Next.js apps.

`ai-spans` is a library (not a SaaS) that lives inside your app, captures AI SDK telemetry (`ai.*` spans), stores it in ClickHouse, and gives you an embedded observability UI you can mount behind your own auth.

## Why this exists

- No external observability service required
- Works inside your existing Next.js app deployment
- Built for AI SDK telemetry and traces, not generic app logging
- ClickHouse-first for fast analytics queries and low-cost storage

## What you get

- OpenTelemetry exporter + span processor for AI SDK spans
- `instrumentation.ts` helper for Next.js (`registerAiObservability`)
- AI SDK telemetry helper (`aiSpansTelemetry`)
- Query client for custom dashboards/server code
- Embedded UI pages/components (`AiObservabilityPage`, `AiTracePage`)
- Local demo app (Next.js App Router + AI SDK v6 + Anthropic)
- Automated smoke e2e test (`npm run test:e2e`)

## Monorepo layout

- `packages/ai-spans`: the library package
- `apps/nextjs-ai-sdk-v6-demo`: working demo app using AI SDK v6 + Anthropic
- `scripts/e2e/smoke.ts`: Docker + demo + ClickHouse smoke e2e
- `docker-compose.clickhouse.yml`: local ClickHouse for development/testing

## Quick demo (local)

### 1. Start ClickHouse (Docker)

```bash
export CLICKHOUSE_PASSWORD='your-clickhouse-password'
docker compose -f docker-compose.clickhouse.yml up -d
```

If `CLICKHOUSE_PASSWORD` is not set, Docker Compose uses the fallback password `clickhouse_password`.

### 2. Configure the demo app

Copy the example env file:

```bash
cp apps/nextjs-ai-sdk-v6-demo/.env.local.example apps/nextjs-ai-sdk-v6-demo/.env.local
```

Set the required values in `apps/nextjs-ai-sdk-v6-demo/.env.local`:

- `ANTHROPIC_API_KEY`
- `AI_SPANS_DATABASE_URL`

Example:

```bash
AI_SPANS_DATABASE_URL=http://default:clickhouse_password@localhost:8123/ai_spans
```

### 3. Run the demo

```bash
npm install
npm run dev:demo
```

Open:

- `http://localhost:3000/` (chat demo)
- `http://localhost:3000/admin/ai-observability` (embedded observability UI)

## Automated smoke e2e

This repo includes an end-to-end smoke test that:

- starts ClickHouse with Docker
- starts the demo app
- sends a real Anthropic request
- verifies ClickHouse rows were written
- verifies the observability UI renders

Run it from the repo root:

```bash
npm run test:e2e
```

Requirements:

- Docker running
- `apps/nextjs-ai-sdk-v6-demo/.env.local` present
- valid `ANTHROPIC_API_KEY`

## Using the library in your app

See the package README for the integration details:

- `packages/ai-spans/README.md`

Minimal setup in a consumer app:

1. Install `ai-spans`
2. Set `AI_SPANS_DATABASE_URL`
3. Call `registerAiObservability()` from `instrumentation.ts`
4. Add `...aiSpansTelemetry({ functionId: '...' })` to AI SDK calls
5. Mount `AiObservabilityPage` behind your auth

## Current scope (v1)

- Backend support: ClickHouse only
- Runtime support: Node runtime (Next.js)
- Telemetry scope: AI SDK spans (`ai.*`)
- Deployment model: embedded in the app (not a hosted product)

## Development commands

Run from the repo root:

```bash
npm run build
npm run test
npm run typecheck
npm run test:e2e
npm run dev:demo
```

## Security notes

- `.env.local` files are ignored and should never be committed
- The demo uses a local `.env.local`; keep provider keys local only
- Root `.gitignore` includes common local/dev artifacts (`.turbo`, `.clickhouse-local`, `*.tsbuildinfo`)

## Status

Early-stage project, not released yet. Breaking changes are still expected while the API and developer experience are refined.
