import type { AiSpansConfig, AiSpansContentMode, AiSpansProcessorMode, AiSpansResolvedConfig } from './types';

const DEFAULT_TABLE = 'ai_sdk_spans_v1';

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value === '') return fallback;
  if (['1', 'true', 'yes', 'on'].includes(value.toLowerCase())) return true;
  if (['0', 'false', 'no', 'off'].includes(value.toLowerCase())) return false;
  throw new Error(`Invalid boolean value: ${value}`);
}

function parseIntSafe(value: string | undefined): number | undefined {
  if (value == null || value === '') return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid integer value: ${value}`);
  }
  return parsed;
}

function parseContentMode(value: string | undefined): AiSpansContentMode | undefined {
  if (!value) return undefined;
  if (value === 'full' || value === 'metadata-only' || value === 'none') return value;
  throw new Error(`Invalid AI_SPANS_CONTENT_MODE: ${value}`);
}

function parseProcessorMode(value: string | undefined): AiSpansProcessorMode | undefined {
  if (!value) return undefined;
  if (value === 'auto' || value === 'serverless' || value === 'batch') return value;
  throw new Error(`Invalid AI_SPANS_PROCESSOR_MODE: ${value}`);
}

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function parseStorageBackend(value: string | undefined): 'clickhouse' {
  if (!value || value === 'clickhouse') return 'clickhouse';
  throw new Error(`Unsupported AI_SPANS_STORAGE_BACKEND: ${value}. Only 'clickhouse' is supported in v1.`);
}

function parseClickHouseDsn(dsn: string): AiSpansConfig['clickhouse'] {
  let parsed: URL;
  try {
    parsed = new URL(dsn);
  } catch {
    throw new Error('Invalid AI_SPANS_DATABASE_URL: must be a valid URL');
  }

  if (!parsed.protocol || !parsed.host) {
    throw new Error('Invalid AI_SPANS_DATABASE_URL: missing protocol or host');
  }

  const pathParts = parsed.pathname.split('/').filter(Boolean);
  if (pathParts.length !== 1) {
    throw new Error('Invalid AI_SPANS_DATABASE_URL: path must contain exactly one database name segment');
  }

  const user = decodeURIComponent(parsed.username || '');
  const password = decodeURIComponent(parsed.password || '');
  const database = decodeURIComponent(pathParts[0] || '');

  if (!user) {
    throw new Error('Invalid AI_SPANS_DATABASE_URL: missing username');
  }
  if (!password) {
    throw new Error('Invalid AI_SPANS_DATABASE_URL: missing password');
  }
  if (!database) {
    throw new Error('Invalid AI_SPANS_DATABASE_URL: missing database');
  }

  return {
    url: `${parsed.protocol}//${parsed.host}`,
    database,
    user,
    password,
  };
}

export function createAiSpansConfigFromEnv(env: NodeJS.ProcessEnv = process.env): AiSpansResolvedConfig {
  parseStorageBackend(env.AI_SPANS_STORAGE_BACKEND);
  const clickhouse = parseClickHouseDsn(required(env, 'AI_SPANS_DATABASE_URL'));

  const config: AiSpansConfig = {
    clickhouse: {
      ...clickhouse,
      queryTimeoutMs: parseIntSafe(env.AI_SPANS_QUERY_TIMEOUT_MS),
    },
    serviceName: env.AI_SPANS_SERVICE_NAME || env.npm_package_name || 'next-app',
    environment: env.AI_SPANS_ENV || env.VERCEL_ENV || env.NODE_ENV || 'development',
    contentMode: parseContentMode(env.AI_SPANS_CONTENT_MODE) ?? 'full',
    manageSchema: parseBool(env.AI_SPANS_SCHEMA_MANAGE, true),
    retentionDays: parseIntSafe(env.AI_SPANS_RETENTION_DAYS),
    processorMode: parseProcessorMode(env.AI_SPANS_PROCESSOR_MODE) ?? 'auto',
    batchSize: parseIntSafe(env.AI_SPANS_BATCH_SIZE),
    flushIntervalMs: parseIntSafe(env.AI_SPANS_FLUSH_INTERVAL_MS),
    schemaTable: env.AI_SPANS_SCHEMA_TABLE || DEFAULT_TABLE,
  };

  return resolveAiSpansConfig(config);
}

export function resolveAiSpansConfig(config: AiSpansConfig): AiSpansResolvedConfig {
  if (!config.clickhouse?.url || !config.clickhouse?.database || !config.clickhouse?.user || !config.clickhouse?.password) {
    throw new Error('AiSpansConfig.clickhouse requires url, database, user, and password');
  }

  return {
    ...config,
    clickhouse: {
      ...config.clickhouse,
      queryTimeoutMs: config.clickhouse.queryTimeoutMs ?? 10_000,
      headers: config.clickhouse.headers ?? {},
    },
    serviceName: config.serviceName || 'next-app',
    environment: config.environment || process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
    contentMode: config.contentMode ?? 'full',
    manageSchema: config.manageSchema ?? true,
    processorMode: config.processorMode ?? 'auto',
    schemaTable: config.schemaTable || DEFAULT_TABLE,
  };
}

export const AI_SPANS_DEFAULT_TABLE = DEFAULT_TABLE;
