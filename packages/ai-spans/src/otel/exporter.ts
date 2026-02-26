import type { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';
import { ExportResultCode } from '@opentelemetry/core';
import { resolveAiSpansConfig } from '../config';
import { ClickHouseAiSpansStorageAdapter } from '../storage/clickhouse-adapter';
import type { AiSpansConfig, AiSpansResolvedConfig } from '../types';
import { isAiSdkSpan } from './filter';
import { transformSpanToRow, type AiSpansRow } from './transform';

function logError(config: AiSpansResolvedConfig, message: string, error: unknown): void {
  const payload = {
    error: error instanceof Error ? error.message : String(error),
  };
  if (config.logger?.error) {
    config.logger.error(message, payload);
    return;
  }
  console.error(`[ai-spans] ${message}`, payload);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class AiSpansClickHouseExporter implements SpanExporter {
  private readonly config: AiSpansResolvedConfig;
  private readonly storage: ClickHouseAiSpansStorageAdapter;
  private ensureSchemaPromise: Promise<void> | null = null;
  private isShutdown = false;
  private lastLoggedErrorAt = 0;

  constructor(config: AiSpansConfig) {
    this.config = resolveAiSpansConfig(config);
    this.storage = new ClickHouseAiSpansStorageAdapter(this.config);
  }

  async export(spans: ReadableSpan[], resultCallback: (result: { code: number; error?: Error }) => void): Promise<void> {
    if (this.isShutdown) {
      resultCallback({ code: ExportResultCode.FAILED, error: new Error('AiSpansClickHouseExporter is shutdown') });
      return;
    }

    const aiSpans = spans.filter((span) => isAiSdkSpan(span.name));
    if (process.env.AI_SPANS_DEBUG === '1') {
      console.log('[ai-spans] export batch', {
        totalSpans: spans.length,
        aiSpans: aiSpans.length,
        names: spans.map((s) => s.name),
      });
    }
    if (aiSpans.length === 0) {
      resultCallback({ code: ExportResultCode.SUCCESS });
      return;
    }

    try {
      if (this.config.manageSchema) {
        await this.ensureSchema();
      }

      const rows = aiSpans.map((span) => transformSpanToRow(span, this.config));
      await this.insertWithRetry(rows);
      if (process.env.AI_SPANS_DEBUG === '1') {
        console.log('[ai-spans] inserted rows', rows.length);
      }
      resultCallback({ code: ExportResultCode.SUCCESS });
    } catch (error) {
      this.logErrorRateLimited('ai-spans export failed', error);
      resultCallback({
        code: ExportResultCode.FAILED,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  async shutdown(): Promise<void> {
    this.isShutdown = true;
  }

  async forceFlush(): Promise<void> {
    return;
  }

  private async ensureSchema(): Promise<void> {
    if (!this.ensureSchemaPromise) {
      this.ensureSchemaPromise = this.storage.ensureSchema().catch((error) => {
        this.ensureSchemaPromise = null;
        throw error;
      });
    }
    await this.ensureSchemaPromise;
  }

  private async insertWithRetry(rows: AiSpansRow[]): Promise<void> {
    const maxAttempts = 3;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.storage.insertRows(rows);
        return;
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts) {
          await sleep(attempt * 100);
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  private logErrorRateLimited(message: string, error: unknown): void {
    const now = Date.now();
    if (now - this.lastLoggedErrorAt < 30_000) {
      return;
    }
    this.lastLoggedErrorAt = now;
    logError(this.config, message, error);
  }
}

export function createAiSpansExporter(config: AiSpansConfig): SpanExporter {
  return new AiSpansClickHouseExporter(config);
}
