export type AiSpansContentMode = 'full' | 'metadata-only' | 'none';
export type AiSpansProcessorMode = 'auto' | 'serverless' | 'batch';

export interface AiSpansLogger {
  debug?: (message: string, context?: Record<string, unknown>) => void;
  info?: (message: string, context?: Record<string, unknown>) => void;
  warn?: (message: string, context?: Record<string, unknown>) => void;
  error?: (message: string, context?: Record<string, unknown>) => void;
}

export interface AiSpansClickHouseConfig {
  url: string;
  database: string;
  user: string;
  password: string;
  queryTimeoutMs?: number;
  headers?: Record<string, string>;
}

export interface AiSpansConfig {
  clickhouse: AiSpansClickHouseConfig;
  serviceName?: string;
  environment?: string;
  contentMode?: AiSpansContentMode;
  manageSchema?: boolean;
  retentionDays?: number;
  processorMode?: AiSpansProcessorMode;
  batchSize?: number;
  flushIntervalMs?: number;
  schemaTable?: string;
  logger?: AiSpansLogger;
  redactInput?: (value: string) => string;
  redactOutput?: (value: string) => string;
}

export interface AiSpansResolvedConfig extends Omit<AiSpansConfig, 'serviceName' | 'environment' | 'contentMode' | 'manageSchema' | 'processorMode'> {
  serviceName: string;
  environment: string;
  contentMode: AiSpansContentMode;
  manageSchema: boolean;
  processorMode: AiSpansProcessorMode;
  schemaTable: string;
}
