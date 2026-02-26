# ai-spans

Embedded AI SDK observability for Next.js apps using ClickHouse.

## What it provides

- OpenTelemetry exporter + span processor that stores `ai.*` spans in ClickHouse
- Next.js `instrumentation.ts` helper (`registerAiObservability`)
- AI SDK telemetry helper (`aiSpansTelemetry`)
- Server-side query client for dashboards and custom pages
- Embedded UI components (`AiObservabilityPage`, `AiTracePage`)

## Quick start

```bash
npm install ai-spans
```

Set the required env var:

```bash
AI_SPANS_DATABASE_URL=http://default:clickhouse_password@localhost:8123/ai_spans
```

If your password contains special characters, URL-encode it in the URL.
All other `AI_SPANS_*` env vars are optional.

Create `instrumentation.ts` in your Next.js app:

```ts
import { registerAiObservability } from 'ai-spans/next';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await registerAiObservability();
  }
}
```

Use AI SDK telemetry on calls:

```ts
import { generateText } from 'ai';
import { aiSpansTelemetry } from 'ai-spans/ai-sdk';

await generateText({
  model,
  prompt: 'Hello',
  ...aiSpansTelemetry({ functionId: 'chat.generate' }),
});
```

Mount the UI page in your app:

```tsx
import { AiObservabilityPage } from 'ai-spans/ui';

export default async function Page({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  return (
    <AiObservabilityPage
      basePath="/admin/ai-observability"
      searchParams={searchParams}
      authCheck={async () => {
        // your auth guard
      }}
    />
  );
}
```

## Existing OpenTelemetry setup

If you already own your `NodeSDK` setup, compose the processor:

```ts
import { createAiSpansSpanProcessor } from 'ai-spans/otel';
import { createAiSpansConfigFromEnv } from 'ai-spans/next';

const processor = createAiSpansSpanProcessor(createAiSpansConfigFromEnv());
```

## Optional env vars

- `AI_SPANS_STORAGE_BACKEND` (defaults to `clickhouse`; v1 only supports ClickHouse)
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
- `AI_SPANS_DEBUG` (debug logging only)
