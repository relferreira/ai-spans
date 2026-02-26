import { ClickHouseHttpClient } from '../clickhouse/client';
import { ensureAiSpansSchema } from '../clickhouse/schema';
import { escapeNullableStringLiteral } from '../clickhouse/sql';
import type { AiSpansResolvedConfig } from '../types';
import type { AiSpansRow } from '../otel/transform';
import type {
  ModelSummary,
  ObservationFilters,
  ObservationListResult,
  ObservationRow,
  OverviewMetrics,
  TimeSeriesPoint,
  TraceDetail,
  TraceSpanRow,
} from '../query/types';
import { buildWhereClause, deriveTimeBucketMinutes, normalizeFilters } from '../query/sql';
import type { AiSpansStorageAdapter } from './types';

interface QueryRow {
  [key: string]: unknown;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function asString(value: unknown): string | null {
  if (value == null) return null;
  return String(value);
}

function microusdToUsd(value: unknown): number | null {
  if (value == null) return null;
  return asNumber(value, 0) / 1_000_000;
}

export class ClickHouseAiSpansStorageAdapter implements AiSpansStorageAdapter {
  readonly config: AiSpansResolvedConfig;
  private readonly client: ClickHouseHttpClient;

  constructor(config: AiSpansResolvedConfig) {
    this.config = config;
    this.client = new ClickHouseHttpClient(this.config);
  }

  async ensureSchema(): Promise<void> {
    await ensureAiSpansSchema(this.client, this.config);
  }

  async insertRows(rows: AiSpansRow[]): Promise<void> {
    await this.client.insertJsonEachRow(this.config.schemaTable, rows);
  }

  async listObservations(filters: ObservationFilters = {}): Promise<ObservationListResult> {
    const normalized = normalizeFilters(filters);
    const where = buildWhereClause(normalized);
    const table = this.tableRef();

    const [rows, totalRows] = await Promise.all([
      this.client.queryJsonEachRow<QueryRow>(`
        SELECT
          trace_id AS traceId,
          span_id AS spanId,
          parent_span_id AS parentSpanId,
          span_name AS spanName,
          start_time AS startTime,
          end_time AS endTime,
          duration_ms AS durationMs,
          status_code AS statusCode,
          status_message AS statusMessage,
          provider,
          model,
          function_id AS functionId,
          user_id AS userId,
          session_id AS sessionId,
          prompt_tokens AS promptTokens,
          completion_tokens AS completionTokens,
          total_tokens AS totalTokens,
          input_cost_microusd AS inputCostMicrousd,
          output_cost_microusd AS outputCostMicrousd,
          total_cost_microusd AS totalCostMicrousd,
          app_route AS appRoute,
          content_recorded AS contentRecorded
        FROM ${table}
        ${where}
        ORDER BY start_time DESC
        LIMIT ${normalized.limit}
        OFFSET ${normalized.offset}
      `.trim()),
      this.client.queryJsonEachRow<QueryRow>(`
        SELECT count() AS total
        FROM ${table}
        ${where}
      `.trim()),
    ]);

    return {
      rows: rows.map((row) => ({
        traceId: String(row.traceId),
        spanId: String(row.spanId),
        parentSpanId: asString(row.parentSpanId),
        spanName: String(row.spanName),
        startTime: String(row.startTime),
        endTime: String(row.endTime),
        durationMs: asNumber(row.durationMs),
        statusCode: asNumber(row.statusCode),
        statusMessage: asString(row.statusMessage),
        provider: asString(row.provider),
        model: asString(row.model),
        functionId: asString(row.functionId),
        userId: asString(row.userId),
        sessionId: asString(row.sessionId),
        promptTokens: row.promptTokens == null ? null : asNumber(row.promptTokens),
        completionTokens: row.completionTokens == null ? null : asNumber(row.completionTokens),
        totalTokens: row.totalTokens == null ? null : asNumber(row.totalTokens),
        inputCostUsd: microusdToUsd(row.inputCostMicrousd),
        outputCostUsd: microusdToUsd(row.outputCostMicrousd),
        totalCostUsd: microusdToUsd(row.totalCostMicrousd),
        appRoute: asString(row.appRoute),
        contentRecorded: Boolean(row.contentRecorded),
      } satisfies ObservationRow)),
      total: asNumber(totalRows[0]?.total, 0),
    };
  }

  async getTrace(traceId: string): Promise<TraceDetail> {
    if (!traceId) {
      throw new Error('traceId is required');
    }

    const rows = await this.client.queryJsonEachRow<QueryRow>(`
      SELECT
        trace_id AS traceId,
        span_id AS spanId,
        parent_span_id AS parentSpanId,
        span_name AS spanName,
        start_time AS startTime,
        end_time AS endTime,
        duration_ms AS durationMs,
        status_code AS statusCode,
        status_message AS statusMessage,
        provider,
        model,
        function_id AS functionId,
        user_id AS userId,
        session_id AS sessionId,
        prompt_tokens AS promptTokens,
        completion_tokens AS completionTokens,
        total_tokens AS totalTokens,
        input_cost_microusd AS inputCostMicrousd,
        output_cost_microusd AS outputCostMicrousd,
        total_cost_microusd AS totalCostMicrousd,
        input_text AS inputText,
        output_text AS outputText,
        metadata_json AS metadataJson,
        attributes_json AS attributesJson,
        events_json AS eventsJson,
        app_route AS appRoute
      FROM ${this.tableRef()}
      WHERE trace_id = ${escapeNullableStringLiteral(traceId)}
      ORDER BY start_time ASC, span_id ASC
    `.trim());

    return {
      traceId,
      spans: rows.map((row) => ({
        traceId: String(row.traceId),
        spanId: String(row.spanId),
        parentSpanId: asString(row.parentSpanId),
        spanName: String(row.spanName),
        startTime: String(row.startTime),
        endTime: String(row.endTime),
        durationMs: asNumber(row.durationMs),
        statusCode: asNumber(row.statusCode),
        statusMessage: asString(row.statusMessage),
        provider: asString(row.provider),
        model: asString(row.model),
        functionId: asString(row.functionId),
        userId: asString(row.userId),
        sessionId: asString(row.sessionId),
        promptTokens: row.promptTokens == null ? null : asNumber(row.promptTokens),
        completionTokens: row.completionTokens == null ? null : asNumber(row.completionTokens),
        totalTokens: row.totalTokens == null ? null : asNumber(row.totalTokens),
        inputCostUsd: microusdToUsd(row.inputCostMicrousd),
        outputCostUsd: microusdToUsd(row.outputCostMicrousd),
        totalCostUsd: microusdToUsd(row.totalCostMicrousd),
        inputText: asString(row.inputText),
        outputText: asString(row.outputText),
        metadataJson: String(row.metadataJson ?? '{}'),
        attributesJson: String(row.attributesJson ?? '{}'),
        eventsJson: String(row.eventsJson ?? '[]'),
        appRoute: asString(row.appRoute),
      } satisfies TraceSpanRow)),
    };
  }

  async getOverviewMetrics(filters: ObservationFilters = {}): Promise<OverviewMetrics> {
    const where = buildWhereClause(filters);
    const rows = await this.client.queryJsonEachRow<QueryRow>(`
      SELECT
        count() AS count,
        countIf(status_code > 0) AS errorCount,
        avg(duration_ms) AS avgLatencyMs,
        quantileTDigest(0.5)(duration_ms) AS p50LatencyMs,
        quantileTDigest(0.95)(duration_ms) AS p95LatencyMs,
        sumOrNull(total_tokens) AS totalTokens,
        sumOrNull(total_cost_microusd) AS totalCostMicrousd
      FROM ${this.tableRef()}
      ${where}
    `.trim());

    const row = rows[0] ?? {};
    const count = asNumber(row.count, 0);
    const errorCount = asNumber(row.errorCount, 0);
    return {
      count,
      errorCount,
      errorRate: count === 0 ? 0 : errorCount / count,
      avgLatencyMs: asNumber(row.avgLatencyMs, 0),
      p50LatencyMs: asNumber(row.p50LatencyMs, 0),
      p95LatencyMs: asNumber(row.p95LatencyMs, 0),
      totalTokens: asNumber(row.totalTokens, 0),
      totalCostUsd: asNumber(row.totalCostMicrousd, 0) / 1_000_000,
    };
  }

  async getTimeSeries(filters: ObservationFilters = {}): Promise<TimeSeriesPoint[]> {
    const where = buildWhereClause(filters);
    const bucketMinutes = deriveTimeBucketMinutes(filters);
    const rows = await this.client.queryJsonEachRow<QueryRow>(`
      SELECT
        toStartOfInterval(start_time, INTERVAL ${bucketMinutes} MINUTE) AS bucketStart,
        count() AS count,
        countIf(status_code > 0) AS errorCount,
        avg(duration_ms) AS avgLatencyMs,
        quantileTDigest(0.95)(duration_ms) AS p95LatencyMs
      FROM ${this.tableRef()}
      ${where}
      GROUP BY bucketStart
      ORDER BY bucketStart ASC
    `.trim());

    return rows.map((row) => ({
      bucketStart: String(row.bucketStart),
      count: asNumber(row.count, 0),
      errorCount: asNumber(row.errorCount, 0),
      avgLatencyMs: asNumber(row.avgLatencyMs, 0),
      p95LatencyMs: asNumber(row.p95LatencyMs, 0),
    }));
  }

  async listModels(filters: ObservationFilters = {}): Promise<ModelSummary[]> {
    const where = buildWhereClause(filters);
    const rows = await this.client.queryJsonEachRow<QueryRow>(`
      SELECT provider, model, count() AS count
      FROM ${this.tableRef()}
      ${where}
      GROUP BY provider, model
      ORDER BY count DESC
      LIMIT 100
    `.trim());

    return rows.map((row) => ({
      provider: asString(row.provider),
      model: asString(row.model),
      count: asNumber(row.count, 0),
    }));
  }

  private tableRef(): string {
    return `\`${this.config.clickhouse.database}\`.\`${this.config.schemaTable}\``;
  }
}
