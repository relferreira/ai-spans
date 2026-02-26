import type { AiSpansResolvedConfig } from '../types';
import { qualifiedTable } from './sql';

export class ClickHouseHttpClient {
  private readonly baseUrl: string;
  private readonly database: string;
  private readonly headers: HeadersInit;
  private readonly timeoutMs: number;

  constructor(config: AiSpansResolvedConfig) {
    this.baseUrl = config.clickhouse.url.replace(/\/$/, '');
    this.database = config.clickhouse.database;
    this.timeoutMs = config.clickhouse.queryTimeoutMs ?? 10_000;
    const auth = Buffer.from(`${config.clickhouse.user}:${config.clickhouse.password}`).toString('base64');
    this.headers = {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'text/plain; charset=utf-8',
      ...config.clickhouse.headers,
    };
  }

  async command(sql: string): Promise<void> {
    await this.request(sql);
  }

  async commandNoDatabase(sql: string): Promise<void> {
    await this.request(sql, { useDatabase: false });
  }

  async queryJsonEachRow<T>(sql: string): Promise<T[]> {
    const responseText = await this.request(`${sql}\nFORMAT JSONEachRow`);
    if (!responseText.trim()) return [];
    return responseText
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T);
  }

  async insertJsonEachRow(table: string, rows: unknown[]): Promise<void> {
    if (rows.length === 0) return;
    const payload = rows.map((row) => JSON.stringify(row)).join('\n');
    await this.request(`INSERT INTO ${qualifiedTable(this.database, table)} FORMAT JSONEachRow\n${payload}\n`);
  }

  async ping(): Promise<boolean> {
    try {
      const responseText = await this.request('SELECT 1', { useDatabase: false });
      return responseText.trim().startsWith('1');
    } catch {
      return false;
    }
  }

  private async request(body: string, options?: { useDatabase?: boolean }): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const url = new URL(`${this.baseUrl}/`);
      if (options?.useDatabase !== false) {
        url.searchParams.set('database', this.database);
      }
      url.searchParams.set('wait_end_of_query', '1');

      const response = await fetch(url, {
        method: 'POST',
        headers: this.headers,
        body,
        signal: controller.signal,
        cache: 'no-store',
      });

      const responseText = await response.text();
      if (!response.ok) {
        throw new Error(`ClickHouse request failed (${response.status}): ${responseText}`);
      }
      return responseText;
    } finally {
      clearTimeout(timeout);
    }
  }
}
