import type { ObservationFilters } from '../query/types';

function getSearchParam(searchParams: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const value = searchParams[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

function hasSearchParam(searchParams: Record<string, string | string[] | undefined>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(searchParams, key);
}

function parseIntParam(value: string | undefined): number | undefined {
  if (value == null || value === '') return undefined;
  return Number.parseInt(value, 10);
}

export function parseObservationSearchParams(
  searchParams?: Record<string, string | string[] | undefined>,
): Partial<ObservationFilters> {
  if (!searchParams) return {};

  const parsed: Partial<ObservationFilters> = {};

  if (hasSearchParam(searchParams, 'from')) parsed.from = getSearchParam(searchParams, 'from');
  if (hasSearchParam(searchParams, 'to')) parsed.to = getSearchParam(searchParams, 'to');
  if (hasSearchParam(searchParams, 'provider')) parsed.provider = getSearchParam(searchParams, 'provider') || undefined;
  if (hasSearchParam(searchParams, 'model')) parsed.model = getSearchParam(searchParams, 'model') || undefined;
  if (hasSearchParam(searchParams, 'functionId')) parsed.functionId = getSearchParam(searchParams, 'functionId') || undefined;
  if (hasSearchParam(searchParams, 'userId')) parsed.userId = getSearchParam(searchParams, 'userId') || undefined;
  if (hasSearchParam(searchParams, 'sessionId')) parsed.sessionId = getSearchParam(searchParams, 'sessionId') || undefined;

  if (hasSearchParam(searchParams, 'errorOnly')) {
    const value = getSearchParam(searchParams, 'errorOnly');
    parsed.errorOnly = value === '1' || value === 'true';
  }

  if (hasSearchParam(searchParams, 'limit')) parsed.limit = parseIntParam(getSearchParam(searchParams, 'limit'));
  if (hasSearchParam(searchParams, 'offset')) parsed.offset = parseIntParam(getSearchParam(searchParams, 'offset'));

  return parsed;
}

function parseDateForDisplay(value: string): Date {
  // ClickHouse DateTime64('UTC') strings are commonly returned without timezone markers.
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)) {
    return new Date(value.replace(' ', 'T') + 'Z');
  }
  return new Date(value);
}

export function formatDate(value: string): string {
  const date = parseDateForDisplay(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function formatUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '-';
  const decimals = value >= 0.01 ? 4 : 6;
  const factor = 10 ** decimals;
  const rounded = Math.round((value + Number.EPSILON) * factor) / factor;
  if (rounded === 0) return '$0.000000';
  return `$${rounded.toFixed(decimals)}`;
}

export function toDateTimeLocalValue(value?: string): string {
  if (!value) return '';
  const date = parseDateForDisplay(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
