import type { AiSpansResolvedConfig } from '../types';
import { AI_SPANS_DEFAULT_TABLE } from '../config';
import type { ClickHouseHttpClient } from './client';
import { qualifiedTable, quoteIdentifier } from './sql';

export const AI_SPANS_SCHEMA_VERSION = 2;

export async function ensureAiSpansSchema(client: ClickHouseHttpClient, config: AiSpansResolvedConfig): Promise<void> {
  const database = quoteIdentifier(config.clickhouse.database);
  const table = qualifiedTable(config.clickhouse.database, config.schemaTable || AI_SPANS_DEFAULT_TABLE);

  await client.commandNoDatabase(`CREATE DATABASE IF NOT EXISTS ${database}`);

  const ttlClause = config.retentionDays
    ? `\nTTL start_time + INTERVAL ${Math.floor(config.retentionDays)} DAY`
    : '';

  await client.command(`
CREATE TABLE IF NOT EXISTS ${table} (
  trace_id String,
  span_id String,
  parent_span_id Nullable(String),
  span_name LowCardinality(String),
  span_kind UInt8,
  start_time DateTime64(3, 'UTC'),
  end_time DateTime64(3, 'UTC'),
  duration_ms Float64,
  status_code UInt8,
  status_message Nullable(String),
  service_name LowCardinality(String),
  deployment_env LowCardinality(String),
  runtime LowCardinality(String),
  vercel_region Nullable(String),
  app_route Nullable(String),
  ai_operation LowCardinality(String),
  function_id Nullable(String),
  user_id Nullable(String),
  session_id Nullable(String),
  provider LowCardinality(Nullable(String)),
  model LowCardinality(Nullable(String)),
  prompt_tokens Nullable(UInt32),
  completion_tokens Nullable(UInt32),
  total_tokens Nullable(UInt32),
  input_text Nullable(String),
  output_text Nullable(String),
  content_recorded Bool,
  metadata_json String,
  attributes_json String,
  events_json String,
  resource_attributes_json String,
  inserted_at DateTime64(3, 'UTC'),
  schema_version UInt16
)
ENGINE = MergeTree
PARTITION BY toDate(start_time)
ORDER BY (toDate(start_time), ifNull(function_id, ''), span_name, trace_id, start_time)
${ttlClause}
SETTINGS index_granularity = 8192
`.trim());

  await client.command(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS user_id Nullable(String) AFTER function_id`).catch(() => {
    // Best-effort schema upgrade for existing tables.
  });
  await client.command(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS session_id Nullable(String) AFTER user_id`).catch(() => {
    // Best-effort schema upgrade for existing tables.
  });

  if (config.retentionDays) {
    await client.command(
      `ALTER TABLE ${table} MODIFY TTL start_time + INTERVAL ${Math.floor(config.retentionDays)} DAY`,
    ).catch(() => {
      // Ignore if table engine/version rejects MODIFY TTL; create-time TTL already covers new installs.
    });
  }
}
