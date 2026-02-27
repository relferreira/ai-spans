import { describe, expect, it, vi } from 'vitest';
import { formatDate, formatUsd, parseObservationSearchParams, toDateTimeLocalValue } from './utils';

describe('parseObservationSearchParams', () => {
  it('omits absent keys so default filters are preserved', () => {
    const parsed = parseObservationSearchParams({ provider: 'anthropic' });

    expect(parsed).toEqual({ provider: 'anthropic' });
    expect(Object.prototype.hasOwnProperty.call(parsed, 'from')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(parsed, 'errorOnly')).toBe(false);
  });

  it('allows explicit false and explicit clears', () => {
    const parsed = parseObservationSearchParams({
      errorOnly: '0',
      provider: '',
      limit: 'abc',
    });

    expect(parsed.errorOnly).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(parsed, 'provider')).toBe(true);
    expect(parsed.provider).toBeUndefined();
    expect(Number.isNaN(parsed.limit)).toBe(true);
  });

  it('parses user and session filter params', () => {
    const parsed = parseObservationSearchParams({
      userId: 'user_42',
      sessionId: 'sess_42',
      observationType: 'tool',
      toolName: 'weather',
    });

    expect(parsed.userId).toBe('user_42');
    expect(parsed.sessionId).toBe('sess_42');
    expect(parsed.observationType).toBe('tool');
    expect(parsed.toolName).toBe('weather');
  });
});

describe('date formatting helpers', () => {
  it('parses ClickHouse UTC timestamps as UTC before formatting', () => {
    const spy = vi.spyOn(Date.prototype, 'toLocaleString').mockReturnValue('formatted');
    try {
      expect(formatDate('2026-02-26 12:34:56.789')).toBe('formatted');
      expect(spy).toHaveBeenCalledTimes(1);
      const parsedDate = spy.mock.contexts[0] as Date;
      expect(parsedDate.toISOString()).toBe('2026-02-26T12:34:56.789Z');
    } finally {
      spy.mockRestore();
    }
  });

  it('converts ClickHouse UTC timestamp to datetime-local value using local timezone', () => {
    const value = toDateTimeLocalValue('2026-02-26 12:34:56.789');
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});

describe('currency formatting', () => {
  it('formats small USD values with enough precision', () => {
    expect(formatUsd(0.0000235)).toBe('$0.000024');
    expect(formatUsd(0.123456)).toBe('$0.1235');
    expect(formatUsd(null)).toBe('-');
  });
});
