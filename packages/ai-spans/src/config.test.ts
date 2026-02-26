import { describe, expect, it } from 'vitest';
import { createAiSpansConfigFromEnv } from './config';

describe('createAiSpansConfigFromEnv', () => {
  it('throws on missing required env vars', () => {
    expect(() => createAiSpansConfigFromEnv({} as NodeJS.ProcessEnv)).toThrow(/AI_SPANS_DATABASE_URL/);
  });

  it('parses dsn, defaults and optional values', () => {
    const config = createAiSpansConfigFromEnv({
      AI_SPANS_DATABASE_URL: 'http://default:password@localhost:8123/ai_spans',
      AI_SPANS_PROCESSOR_MODE: 'serverless',
      AI_SPANS_CONTENT_MODE: 'metadata-only',
      AI_SPANS_BATCH_SIZE: '10',
      AI_SPANS_FLUSH_INTERVAL_MS: '500',
    } as NodeJS.ProcessEnv);

    expect(config.clickhouse.url).toBe('http://localhost:8123');
    expect(config.clickhouse.database).toBe('ai_spans');
    expect(config.clickhouse.user).toBe('default');
    expect(config.clickhouse.password).toBe('password');
    expect(config.contentMode).toBe('metadata-only');
    expect(config.processorMode).toBe('serverless');
    expect(config.batchSize).toBe(10);
    expect(config.flushIntervalMs).toBe(500);
  });

  it('decodes url-encoded credentials in dsn', () => {
    const config = createAiSpansConfigFromEnv({
      AI_SPANS_DATABASE_URL: 'http://default:p%40ss%3Aword@localhost:8123/ai_spans',
    } as NodeJS.ProcessEnv);

    expect(config.clickhouse.password).toBe('p@ss:word');
  });

  it('defaults storage backend to clickhouse and rejects unsupported values', () => {
    expect(() =>
      createAiSpansConfigFromEnv({
        AI_SPANS_STORAGE_BACKEND: 'postgres',
        AI_SPANS_DATABASE_URL: 'http://default:password@localhost:8123/ai_spans',
      } as NodeJS.ProcessEnv),
    ).toThrow(/AI_SPANS_STORAGE_BACKEND/);
  });
});
