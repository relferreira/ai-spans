import { createAiSpansConfigFromEnv, resolveAiSpansConfig } from '../config';
import type { AiSpansConfig } from '../types';
import type { AiSpansStorageAdapter } from './types';
import { ClickHouseAiSpansStorageAdapter } from './clickhouse-adapter';

export function createAiSpansStorageAdapter(config?: AiSpansConfig): AiSpansStorageAdapter {
  const resolved = config ? resolveAiSpansConfig(config) : createAiSpansConfigFromEnv();
  return new ClickHouseAiSpansStorageAdapter(resolved);
}
