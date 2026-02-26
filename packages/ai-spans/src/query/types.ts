export interface ObservationFilters {
  from?: string;
  to?: string;
  provider?: string;
  model?: string;
  functionId?: string;
  userId?: string;
  sessionId?: string;
  errorOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface ObservationRow {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  spanName: string;
  startTime: string;
  endTime: string;
  durationMs: number;
  statusCode: number;
  statusMessage: string | null;
  provider: string | null;
  model: string | null;
  functionId: string | null;
  userId: string | null;
  sessionId: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  inputCostUsd: number | null;
  outputCostUsd: number | null;
  totalCostUsd: number | null;
  appRoute: string | null;
  contentRecorded: boolean;
}

export interface ObservationListResult {
  rows: ObservationRow[];
  total: number;
}

export interface OverviewMetrics {
  count: number;
  errorCount: number;
  errorRate: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  totalTokens: number;
  totalCostUsd: number;
}

export interface TimeSeriesPoint {
  bucketStart: string;
  count: number;
  errorCount: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
}

export interface ModelSummary {
  provider: string | null;
  model: string | null;
  count: number;
}

export interface TraceSpanRow {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  spanName: string;
  startTime: string;
  endTime: string;
  durationMs: number;
  statusCode: number;
  statusMessage: string | null;
  provider: string | null;
  model: string | null;
  functionId: string | null;
  userId: string | null;
  sessionId: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  inputCostUsd: number | null;
  outputCostUsd: number | null;
  totalCostUsd: number | null;
  inputText: string | null;
  outputText: string | null;
  metadataJson: string;
  attributesJson: string;
  eventsJson: string;
  appRoute: string | null;
}

export interface TraceDetail {
  traceId: string;
  spans: TraceSpanRow[];
}
