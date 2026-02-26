import { describe, expect, it } from 'vitest';
import { normalizeFilters } from './sql';

describe('normalizeFilters', () => {
  it('falls back for non-finite limit/offset values', () => {
    const filters = normalizeFilters({ limit: Number.NaN, offset: Number.NaN });

    expect(filters.limit).toBe(50);
    expect(filters.offset).toBe(0);
  });

  it('clamps and truncates pagination values', () => {
    const filters = normalizeFilters({ limit: 999.9, offset: -10.5 });

    expect(filters.limit).toBe(500);
    expect(filters.offset).toBe(0);
  });
});
