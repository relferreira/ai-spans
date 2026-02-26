# ai-spans monorepo

## Packages

- `packages/ai-spans`: Embedded AI SDK observability library for Next.js + ClickHouse

## Apps

- `apps/nextjs-ai-sdk-v6-demo`: Minimal Next.js App Router demo using AI SDK v6 + Anthropic + `ai-spans`
  - copy `/Users/relferreira/Github/ai-spans/apps/nextjs-ai-sdk-v6-demo/.env.local.example` to `.env.local`
  - only `ANTHROPIC_API_KEY` and `AI_SPANS_DATABASE_URL` are required

## Local ClickHouse (Docker)

Set a password (recommended) before starting:

```bash
export CLICKHOUSE_PASSWORD='your-clickhouse-password'
```

If unset, Docker Compose uses the fallback password `clickhouse_password`.

```bash
docker compose -f docker-compose.clickhouse.yml up -d
```

## Workspace commands

```bash
npm install
npm run build
npm run test
npm run test:e2e
npm run typecheck
npm run dev:demo
```
