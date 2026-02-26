import type { ObservationFilters } from './types';
import { escapeDateTimeLiteral, escapeNullableStringLiteral } from '../clickhouse/sql';

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function normalizeInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.trunc(value);
}

export function normalizeFilters(filters: ObservationFilters = {}): Required<Pick<ObservationFilters, 'limit' | 'offset'>> & ObservationFilters {
  const rawLimit = normalizeInteger(filters.limit, 50);
  const rawOffset = normalizeInteger(filters.offset, 0);

  return {
    ...filters,
    limit: clamp(rawLimit, 1, 500),
    offset: Math.max(0, rawOffset),
  };
}

export function buildWhereClause(filters: ObservationFilters): string {
  const clauses: string[] = ["span_name LIKE 'ai.%'"];

  if (filters.from) clauses.push(`start_time >= ${escapeDateTimeLiteral(filters.from)}`);
  if (filters.to) clauses.push(`start_time <= ${escapeDateTimeLiteral(filters.to)}`);
  if (filters.provider) clauses.push(`provider = ${escapeNullableStringLiteral(filters.provider)}`);
  if (filters.model) clauses.push(`model = ${escapeNullableStringLiteral(filters.model)}`);
  if (filters.functionId) clauses.push(`function_id = ${escapeNullableStringLiteral(filters.functionId)}`);
  if (filters.userId) clauses.push(`user_id = ${escapeNullableStringLiteral(filters.userId)}`);
  if (filters.sessionId) clauses.push(`session_id = ${escapeNullableStringLiteral(filters.sessionId)}`);
  if (filters.errorOnly) clauses.push('status_code > 0');

  return clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
}

export function deriveTimeBucketMinutes(filters: ObservationFilters): number {
  const from = filters.from ? Date.parse(filters.from) : Date.now() - 24 * 60 * 60 * 1000;
  const to = filters.to ? Date.parse(filters.to) : Date.now();
  const minutes = Math.max(1, Math.round((to - from) / (60_000 * 60)));
  if (minutes <= 1) return 1;
  if (minutes <= 6) return 5;
  if (minutes <= 24) return 15;
  if (minutes <= 24 * 3) return 30;
  return 60;
}
