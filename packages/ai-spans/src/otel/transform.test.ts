import { describe, expect, it } from 'vitest';
import { transformSpanToRow } from './transform';
import type { AiSpansResolvedConfig } from '../types';

const baseConfig: AiSpansResolvedConfig = {
  clickhouse: {
    url: 'http://localhost:8123',
    database: 'ai_spans',
    user: 'default',
    password: 'password',
    queryTimeoutMs: 1000,
    headers: {},
  },
  serviceName: 'test-service',
  environment: 'test',
  contentMode: 'full',
  manageSchema: true,
  processorMode: 'serverless',
  schemaTable: 'ai_sdk_spans_v1',
};

describe('transformSpanToRow', () => {
  it('extracts ai fields and stores content in full mode', () => {
    const row = transformSpanToRow(
      {
        name: 'ai.generateText',
        kind: 1,
        startTime: [1_700_000_000, 0],
        endTime: [1_700_000_000, 50_000_000],
        attributes: {
          'gen_ai.system': 'openai',
          'gen_ai.request.model': 'gpt-4o-mini',
          'gen_ai.usage.input_tokens': 12,
          'gen_ai.usage.output_tokens': 34,
          'gen_ai.usage.total_tokens': 46,
          'ai.telemetry.functionId': 'chat.generate',
          'ai.input': 'hello',
          'ai.output': 'world',
          'ai.telemetry.metadata.userId': 'u_1',
        },
        resource: {
          attributes: {
            'service.name': 'demo-app',
            'deployment.environment.name': 'preview',
          },
        },
        events: [],
        status: { code: 0 },
        spanContext: () => ({ traceId: 't1', spanId: 's1', traceFlags: 1 }),
        parentSpanContext: { traceId: 't1', spanId: 'p1', traceFlags: 1 },
      } as any,
      baseConfig,
    );

    expect(row.provider).toBe('openai');
    expect(row.model).toBe('gpt-4o-mini');
    expect(row.function_id).toBe('chat.generate');
    expect(row.prompt_tokens).toBe(12);
    expect(row.output_text).toBe('world');
    expect(row.content_recorded).toBe(true);
    expect(JSON.parse(row.metadata_json)).toMatchObject({ 'ai.telemetry.metadata.userId': 'u_1' });
  });

  it('honors metadata-only mode and redaction hooks', () => {
    const row = transformSpanToRow(
      {
        name: 'ai.generateText',
        kind: 1,
        startTime: [1_700_000_000, 0],
        endTime: [1_700_000_000, 100_000_000],
        attributes: {
          'ai.input': 'secret',
          'ai.output': 'secret-response',
        },
        resource: { attributes: {} },
        events: [],
        status: { code: 0 },
        spanContext: () => ({ traceId: 't2', spanId: 's2', traceFlags: 1 }),
      } as any,
      { ...baseConfig, contentMode: 'metadata-only', redactInput: (v) => `redacted:${v}` },
    );

    expect(row.input_text).toBeNull();
    expect(row.output_text).toBeNull();
    expect(row.content_recorded).toBe(false);
  });
});
