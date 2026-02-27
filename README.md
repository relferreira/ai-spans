# ai-spans

Embedded AI SDK observability for Next.js apps.

`ai-spans` runs inside your app (not SaaS): it captures AI SDK telemetry spans (`ai.*`), stores them in ClickHouse, and provides an embedded observability UI.

## Quick Start (Existing Next.js + AI SDK App)

### 1) Install

```bash
npm install ai-spans
```

### 2) Set database URL

```bash
AI_SPANS_DATABASE_URL=http://default:clickhouse_password@localhost:8123/ai_spans
```

If your password has special characters, URL-encode it.

### 3) Enable ai-spans in `instrumentation.ts`

```ts
import { registerAiObservability } from 'ai-spans/next';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await registerAiObservability();
  }
}
```

### 4) Add telemetry to AI SDK calls

```ts
import { streamText } from 'ai';
import { aiSpansTelemetry } from 'ai-spans/ai-sdk';

const result = streamText({
  model,
  messages,
  ...aiSpansTelemetry({
    functionId: 'chat.stream',
    userId: 'user_123', // optional
    sessionId: 'session_123', // optional
  }),
});
```

### 5) Mount the built-in UI in your app

```tsx
import { AiObservabilityPage } from 'ai-spans/ui';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function Page({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  return (
    <AiObservabilityPage
      basePath="/admin/ai-observability"
      searchParams={searchParams}
      authCheck={async () => {
        // Add your auth guard here.
      }}
    />
  );
}
```

## Existing OpenTelemetry Setup

If you already manage your own OTel `NodeSDK`, compose with ai-spans instead of replacing your setup:

```ts
import { createAiSpansSpanProcessor } from 'ai-spans/otel';
import { createAiSpansConfigFromEnv } from 'ai-spans/next';

const processor = createAiSpansSpanProcessor(createAiSpansConfigFromEnv());
```

## Optional Environment Variables

- `AI_SPANS_SERVICE_NAME`
- `AI_SPANS_ENV`
- `AI_SPANS_CONTENT_MODE` (`full` default)
- `AI_SPANS_SCHEMA_MANAGE` (`true` default)
- `AI_SPANS_RETENTION_DAYS`
- `AI_SPANS_PROCESSOR_MODE` (`auto` default)
- `AI_SPANS_BATCH_SIZE`
- `AI_SPANS_FLUSH_INTERVAL_MS`
- `AI_SPANS_QUERY_TIMEOUT_MS`
- `AI_SPANS_SCHEMA_TABLE`
- `AI_SPANS_DEBUG`

## Scope (v1)

- Backend: ClickHouse only
- Runtime: Node.js (Next.js)
- Telemetry scope: AI SDK spans (`ai.*`)
- Deployment model: embedded in your app

## Development (This Repo)

- Library package: `packages/ai-spans`
- Demo app: `apps/nextjs-ai-sdk-v6-demo`
- Local ClickHouse: `docker-compose.clickhouse.yml`
- Smoke e2e: `npm run test:e2e`

Run all checks:

```bash
npm run build
npm run test
npm run typecheck
npm run test:e2e
```
