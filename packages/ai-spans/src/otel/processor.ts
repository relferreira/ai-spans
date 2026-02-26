import type { SpanProcessor } from '@opentelemetry/sdk-trace-base';
import { BatchSpanProcessor, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { resolveAiSpansConfig } from '../config';
import type { AiSpansConfig, AiSpansResolvedConfig } from '../types';
import { AiSpansClickHouseExporter } from './exporter';

function isServerlessEnvironment(): boolean {
  return Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.LAMBDA_TASK_ROOT ||
      process.env.FUNCTION_TARGET,
  );
}

function resolveProcessorMode(config: AiSpansResolvedConfig): 'serverless' | 'batch' {
  if (config.processorMode === 'serverless' || config.processorMode === 'batch') {
    return config.processorMode;
  }
  return isServerlessEnvironment() ? 'serverless' : 'batch';
}

export function createAiSpansSpanProcessor(config: AiSpansConfig): SpanProcessor {
  const resolved = resolveAiSpansConfig(config);
  const exporter = new AiSpansClickHouseExporter(resolved);
  const mode = resolveProcessorMode(resolved);

  if (mode === 'serverless') {
    if (resolved.batchSize && resolved.batchSize <= 1) {
      return new SimpleSpanProcessor(exporter);
    }

    return new BatchSpanProcessor(exporter, {
      maxQueueSize: 256,
      maxExportBatchSize: Math.max(1, Math.min(64, resolved.batchSize ?? 20)),
      scheduledDelayMillis: resolved.flushIntervalMs ?? 1_000,
      exportTimeoutMillis: Math.min(10_000, resolved.clickhouse.queryTimeoutMs ?? 5_000),
    });
  }

  return new BatchSpanProcessor(exporter, {
    maxQueueSize: 2_048,
    maxExportBatchSize: Math.max(1, Math.min(512, resolved.batchSize ?? 200)),
    scheduledDelayMillis: resolved.flushIntervalMs ?? 5_000,
    exportTimeoutMillis: resolved.clickhouse.queryTimeoutMs ?? 10_000,
  });
}
