import type { Attributes, HrTime } from '@opentelemetry/api';
import type { ReadableSpan, TimedEvent } from '@opentelemetry/sdk-trace-base';
import type { AiSpansResolvedConfig } from '../types';
import { AI_SPANS_SCHEMA_VERSION } from '../clickhouse/schema';
import { estimateCostMicrousd } from '../cost/pricing';

export interface AiSpansRow {
  trace_id: string;
  span_id: string;
  parent_span_id: string | null;
  span_name: string;
  span_kind: number;
  start_time: string;
  end_time: string;
  duration_ms: number;
  status_code: number;
  status_message: string | null;
  service_name: string;
  deployment_env: string;
  runtime: string;
  vercel_region: string | null;
  app_route: string | null;
  ai_operation: string;
  function_id: string | null;
  user_id: string | null;
  session_id: string | null;
  provider: string | null;
  model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  input_cost_microusd: number | null;
  output_cost_microusd: number | null;
  total_cost_microusd: number | null;
  input_text: string | null;
  output_text: string | null;
  content_recorded: boolean;
  metadata_json: string;
  attributes_json: string;
  events_json: string;
  resource_attributes_json: string;
  inserted_at: string;
  schema_version: number;
}

const PROVIDER_KEYS = ['gen_ai.system', 'gen_ai.provider.name', 'ai.provider', 'vercel.ai.provider'];
const MODEL_KEYS = ['gen_ai.request.model', 'gen_ai.response.model', 'ai.model', 'vercel.ai.model'];
const FUNCTION_ID_KEYS = ['ai.telemetry.functionId', 'vercel.ai.functionId', 'ai.function_id', 'function_id', 'functionId'];
const USER_ID_KEYS = [
  'ai.telemetry.metadata.ai_spans.user_id',
  'vercel.ai.metadata.ai_spans.user_id',
  'metadata.ai_spans.user_id',
  'ai_spans.user_id',
  'enduser.id',
  'user.id',
];
const SESSION_ID_KEYS = [
  'ai.telemetry.metadata.ai_spans.session_id',
  'vercel.ai.metadata.ai_spans.session_id',
  'metadata.ai_spans.session_id',
  'ai_spans.session_id',
  'session.id',
  'conversation.id',
];
const PROMPT_TOKEN_KEYS = ['gen_ai.usage.input_tokens', 'ai.usage.promptTokens', 'prompt_tokens', 'usage.prompt_tokens'];
const COMPLETION_TOKEN_KEYS = ['gen_ai.usage.output_tokens', 'ai.usage.completionTokens', 'completion_tokens', 'usage.completion_tokens'];
const TOTAL_TOKEN_KEYS = ['gen_ai.usage.total_tokens', 'ai.usage.totalTokens', 'total_tokens', 'usage.total_tokens'];
const INPUT_KEYS = ['ai.input', 'ai.prompt', 'ai.prompt.text', 'gen_ai.input.messages', 'input', 'prompt'];
const OUTPUT_KEYS = ['ai.output', 'ai.response', 'ai.output.text', 'gen_ai.output', 'output', 'completion', 'response'];
const ROUTE_KEYS = ['http.route', 'next.route', 'nextjs.route'];
const REGION_KEYS = ['vercel.region', 'cloud.region'];

function hrTimeToMs(time: HrTime): number {
  return time[0] * 1000 + time[1] / 1_000_000;
}

function hrTimeToIso(time: HrTime): string {
  return new Date(hrTimeToMs(time)).toISOString();
}

function toClickHouseDateTime64String(date: Date): string {
  const pad = (n: number, width = 2): string => String(n).padStart(width, '0');
  return [
    date.getUTCFullYear(),
    '-',
    pad(date.getUTCMonth() + 1),
    '-',
    pad(date.getUTCDate()),
    ' ',
    pad(date.getUTCHours()),
    ':',
    pad(date.getUTCMinutes()),
    ':',
    pad(date.getUTCSeconds()),
    '.',
    pad(date.getUTCMilliseconds(), 3),
  ].join('');
}

function toPrimitive(value: unknown): string | number | boolean | null {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return JSON.stringify(value);
  return JSON.stringify(value);
}

function jsonStringifySafe(value: unknown): string {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return 'null';
  }
}

function pickFirstString(attributes: Attributes, keys: string[]): string | null {
  for (const key of keys) {
    const value = attributes[key];
    if (typeof value === 'string' && value.length > 0) return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  }
  return null;
}

function pickFirstNumber(attributes: Attributes, keys: string[]): number | null {
  for (const key of keys) {
    const value = attributes[key];
    if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.trunc(value));
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return Math.max(0, Math.trunc(parsed));
    }
  }
  return null;
}

function extractMetadata(attributes: Attributes): Record<string, string | number | boolean | null> {
  const metadata: Record<string, string | number | boolean | null> = {};
  for (const [key, rawValue] of Object.entries(attributes)) {
    if (
      key.startsWith('ai.telemetry.metadata.') ||
      key.startsWith('vercel.ai.metadata.') ||
      key.startsWith('metadata.') ||
      key.startsWith('ai_spans.')
    ) {
      metadata[key] = toPrimitive(rawValue);
    }
  }
  return metadata;
}

function sanitizeContent(
  value: string | null,
  kind: 'input' | 'output',
  config: AiSpansResolvedConfig,
): string | null {
  if (value == null) return null;
  if (config.contentMode === 'none') return null;
  if (config.contentMode === 'metadata-only') return null;
  if (kind === 'input' && config.redactInput) return config.redactInput(value);
  if (kind === 'output' && config.redactOutput) return config.redactOutput(value);
  return value;
}

function normalizeAttributes(attributes: Attributes): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attributes)) {
    normalized[key] = toPrimitive(value);
  }
  return normalized;
}

function normalizeEvents(events: TimedEvent[]): Array<Record<string, unknown>> {
  return events.map((event) => ({
    name: event.name,
    time: hrTimeToIso(event.time),
    attributes: normalizeAttributes(event.attributes ?? {}),
  }));
}

function getAiOperation(spanName: string): string {
  if (!spanName.startsWith('ai.')) return 'unknown';
  const rest = spanName.slice(3);
  const segment = rest.split(/[.:]/)[0];
  return segment || 'unknown';
}

export function transformSpanToRow(span: ReadableSpan, config: AiSpansResolvedConfig): AiSpansRow {
  const attributes = span.attributes ?? {};
  const resourceAttributes = span.resource.attributes ?? {};

  const startMs = hrTimeToMs(span.startTime);
  const endMs = hrTimeToMs(span.endTime);
  const durationMs = Math.max(0, endMs - startMs);

  const inputTextRaw = pickFirstString(attributes, INPUT_KEYS);
  const outputTextRaw = pickFirstString(attributes, OUTPUT_KEYS);
  const inputText = sanitizeContent(inputTextRaw, 'input', config);
  const outputText = sanitizeContent(outputTextRaw, 'output', config);
  const contentRecorded = Boolean(inputText || outputText);

  const provider = pickFirstString(attributes, PROVIDER_KEYS);
  const model = pickFirstString(attributes, MODEL_KEYS);
  const functionId = pickFirstString(attributes, FUNCTION_ID_KEYS);
  const userId = pickFirstString(attributes, USER_ID_KEYS);
  const sessionId = pickFirstString(attributes, SESSION_ID_KEYS);
  const promptTokens = pickFirstNumber(attributes, PROMPT_TOKEN_KEYS);
  const completionTokens = pickFirstNumber(attributes, COMPLETION_TOKEN_KEYS);
  const totalTokens = pickFirstNumber(attributes, TOTAL_TOKEN_KEYS);
  const estimatedCost = estimateCostMicrousd({
    provider,
    model,
    promptTokens,
    completionTokens,
  });

  const serviceName = String(resourceAttributes['service.name'] ?? config.serviceName);
  const deploymentEnv = String(resourceAttributes['deployment.environment.name'] ?? config.environment);
  const runtime = String(resourceAttributes['process.runtime.name'] ?? 'nodejs').toLowerCase();
  const vercelRegion = pickFirstString(attributes, REGION_KEYS) || process.env.VERCEL_REGION || null;
  const appRoute = pickFirstString(attributes, ROUTE_KEYS);

  return {
    trace_id: span.spanContext().traceId,
    span_id: span.spanContext().spanId,
    parent_span_id: span.parentSpanContext?.spanId ?? null,
    span_name: span.name,
    span_kind: Number(span.kind),
    start_time: toClickHouseDateTime64String(new Date(startMs)),
    end_time: toClickHouseDateTime64String(new Date(endMs)),
    duration_ms: durationMs,
    status_code: Number(span.status.code ?? 0),
    status_message: span.status.message || null,
    service_name: serviceName,
    deployment_env: deploymentEnv,
    runtime,
    vercel_region: vercelRegion,
    app_route: appRoute,
    ai_operation: getAiOperation(span.name),
    function_id: functionId,
    user_id: userId,
    session_id: sessionId,
    provider,
    model,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokens,
    input_cost_microusd: estimatedCost?.inputCostMicrousd ?? null,
    output_cost_microusd: estimatedCost?.outputCostMicrousd ?? null,
    total_cost_microusd: estimatedCost?.totalCostMicrousd ?? null,
    input_text: inputText,
    output_text: outputText,
    content_recorded: contentRecorded,
    metadata_json: jsonStringifySafe(extractMetadata(attributes)),
    attributes_json: jsonStringifySafe(normalizeAttributes(attributes)),
    events_json: jsonStringifySafe(normalizeEvents(span.events)),
    resource_attributes_json: jsonStringifySafe(normalizeAttributes(resourceAttributes)),
    inserted_at: toClickHouseDateTime64String(new Date()),
    schema_version: AI_SPANS_SCHEMA_VERSION,
  };
}
