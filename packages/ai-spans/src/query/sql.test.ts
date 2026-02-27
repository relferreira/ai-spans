import { describe, expect, it } from 'vitest';
import { buildWhereClause, normalizeFilters } from './sql';

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

describe('buildWhereClause', () => {
  it('supports user and session filters', () => {
    const where = buildWhereClause({
      userId: 'user_1',
      sessionId: 'session_1',
    });

    expect(where).toContain("user_id = 'user_1'");
    expect(where).toContain("session_id = 'session_1'");
  });

  it('supports observation type and tool name filters', () => {
    const where = buildWhereClause({
      observationType: 'tool',
      toolName: 'weather',
    });

    expect(where).toContain("observation_type = 'tool'");
    expect(where).toContain("tool_name = 'weather'");
  });
});
