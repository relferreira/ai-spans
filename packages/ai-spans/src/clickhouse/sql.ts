export function quoteIdentifier(identifier: string): string {
  if (!identifier || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Invalid ClickHouse identifier: ${identifier}`);
  }
  return `\`${identifier}\``;
}

export function qualifiedTable(database: string, table: string): string {
  return `${quoteIdentifier(database)}.${quoteIdentifier(table)}`;
}

export function escapeStringLiteral(value: string): string {
  return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}

export function escapeNullableStringLiteral(value: string | null | undefined): string {
  if (value == null) return 'NULL';
  return escapeStringLiteral(value);
}

export function escapeDateTimeLiteral(value: string): string {
  return escapeStringLiteral(value);
}
