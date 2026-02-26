import React, { type ReactNode } from 'react';
import { createAiSpansQueryClient, type AiSpansQueryClient } from '../query/client';
import type { ObservationFilters } from '../query/types';
import type { AiSpansConfig, AiSpansContentMode } from '../types';
import { formatDate, formatUsd, parseObservationSearchParams, toDateTimeLocalValue } from './utils';

export interface AiObservabilityPageProps {
  authCheck?: () => Promise<void> | void;
  defaultFilters?: Partial<ObservationFilters>;
  basePath?: string;
  contentMode?: AiSpansContentMode;
  queryClient?: AiSpansQueryClient;
  config?: AiSpansConfig;
  searchParams?: Record<string, string | string[] | undefined>;
}

export interface AiTracePageProps {
  traceId: string;
  authCheck?: () => Promise<void> | void;
  basePath?: string;
  contentMode?: AiSpansContentMode;
  queryClient?: AiSpansQueryClient;
  config?: AiSpansConfig;
}

export interface AiObservabilityProviderProps {
  children: ReactNode;
  config?: AiSpansConfig;
  queryClient?: AiSpansQueryClient;
}

const noopStyles: React.CSSProperties = { margin: 0, padding: 0 };

function formatMs(value: number): string {
  if (!Number.isFinite(value)) return '-';
  return `${value.toFixed(value < 10 ? 2 : 0)} ms`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function normalizeBasePath(basePath?: string): string {
  return (basePath || '').replace(/\/$/, '');
}

function renderJsonBlock(label: string, value: string | null | undefined): ReactNode {
  if (!value) return null;
  return (
    <section>
      <h3 style={{ marginTop: 16 }}>{label}</h3>
      <pre style={preStyle}>{value}</pre>
    </section>
  );
}

const pageStyle: React.CSSProperties = {
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  lineHeight: 1.4,
  color: '#111827',
  padding: 24,
};

const panelStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: 16,
  background: '#ffffff',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 12,
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
};

const thtdStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  borderBottom: '1px solid #e5e7eb',
  verticalAlign: 'top',
};

const preStyle: React.CSSProperties = {
  ...panelStyle,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  fontSize: 12,
  overflowX: 'auto',
};

function getClient(props: { queryClient?: AiSpansQueryClient; config?: AiSpansConfig }): AiSpansQueryClient {
  return props.queryClient ?? createAiSpansQueryClient(props.config);
}

export async function AiObservabilityPage(props: AiObservabilityPageProps): Promise<React.JSX.Element> {
  await props.authCheck?.();

  const filters = {
    ...props.defaultFilters,
    ...parseObservationSearchParams(props.searchParams),
  };
  const client = getClient(props);
  const basePath = normalizeBasePath(props.basePath) || '';

  try {
    const [metrics, series, observations, models] = await Promise.all([
      client.getOverviewMetrics(filters),
      client.getTimeSeries(filters),
      client.listObservations(filters),
      client.listModels(filters),
    ]);

    return (
      <main style={{ ...pageStyle, background: '#f9fafb' }}>
        <div style={{ display: 'grid', gap: 16 }}>
          <header style={panelStyle}>
            <h1 style={{ margin: 0 }}>AI Observability</h1>
            <p style={{ margin: '8px 0 0', color: '#4b5563' }}>
              AI SDK spans stored in ClickHouse. Mount this page behind your app auth.
            </p>
          </header>

          <section style={{ ...panelStyle, display: 'grid', gap: 12 }}>
            <h2 style={{ margin: 0 }}>Filters</h2>
            <form method="get" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
              <label>
                <div>From</div>
                <input type="datetime-local" name="from" defaultValue={toDateTimeLocalValue(filters.from)} style={{ width: '100%' }} />
              </label>
              <label>
                <div>To</div>
                <input type="datetime-local" name="to" defaultValue={toDateTimeLocalValue(filters.to)} style={{ width: '100%' }} />
              </label>
              <label>
                <div>Provider</div>
                <input name="provider" defaultValue={filters.provider ?? ''} style={{ width: '100%' }} />
              </label>
              <label>
                <div>Model</div>
                <input name="model" defaultValue={filters.model ?? ''} style={{ width: '100%' }} />
              </label>
              <label>
                <div>Function ID</div>
                <input name="functionId" defaultValue={filters.functionId ?? ''} style={{ width: '100%' }} />
              </label>
              <label>
                <div>User ID</div>
                <input name="userId" defaultValue={filters.userId ?? ''} style={{ width: '100%' }} />
              </label>
              <label>
                <div>Session ID</div>
                <input name="sessionId" defaultValue={filters.sessionId ?? ''} style={{ width: '100%' }} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
                <input type="checkbox" name="errorOnly" value="1" defaultChecked={Boolean(filters.errorOnly)} />
                Errors only
              </label>
              <div style={{ display: 'flex', alignItems: 'end' }}>
                <button type="submit">Apply</button>
              </div>
            </form>
          </section>

          <section style={gridStyle}>
            <MetricCard label="Requests" value={metrics.count.toLocaleString()} />
            <MetricCard label="Errors" value={metrics.errorCount.toLocaleString()} />
            <MetricCard label="Error Rate" value={formatPercent(metrics.errorRate)} />
            <MetricCard label="Avg Latency" value={formatMs(metrics.avgLatencyMs)} />
            <MetricCard label="P50 Latency" value={formatMs(metrics.p50LatencyMs)} />
            <MetricCard label="P95 Latency" value={formatMs(metrics.p95LatencyMs)} />
            <MetricCard label="Total Tokens" value={metrics.totalTokens.toLocaleString()} />
            <MetricCard label="Total Cost (USD)" value={formatUsd(metrics.totalCostUsd)} />
          </section>

          <section style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>Time Series</h2>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thtdStyle}>Bucket</th>
                  <th style={thtdStyle}>Count</th>
                  <th style={thtdStyle}>Errors</th>
                  <th style={thtdStyle}>Avg Latency</th>
                  <th style={thtdStyle}>P95 Latency</th>
                </tr>
              </thead>
              <tbody>
                {series.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={thtdStyle}>No data</td>
                  </tr>
                ) : (
                  series.map((point) => (
                    <tr key={point.bucketStart}>
                      <td style={thtdStyle}>{formatDate(point.bucketStart)}</td>
                      <td style={thtdStyle}>{point.count}</td>
                      <td style={thtdStyle}>{point.errorCount}</td>
                      <td style={thtdStyle}>{formatMs(point.avgLatencyMs)}</td>
                      <td style={thtdStyle}>{formatMs(point.p95LatencyMs)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <section style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>Models</h2>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thtdStyle}>Provider</th>
                  <th style={thtdStyle}>Model</th>
                  <th style={thtdStyle}>Count</th>
                </tr>
              </thead>
              <tbody>
                {models.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={thtdStyle}>No data</td>
                  </tr>
                ) : (
                  models.map((model) => (
                    <tr key={`${model.provider ?? 'unknown'}:${model.model ?? 'unknown'}`}>
                      <td style={thtdStyle}>{model.provider ?? '-'}</td>
                      <td style={thtdStyle}>{model.model ?? '-'}</td>
                      <td style={thtdStyle}>{model.count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <section style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>Recent Observations ({observations.total})</h2>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thtdStyle}>Start</th>
                  <th style={thtdStyle}>Span</th>
                  <th style={thtdStyle}>Function</th>
                  <th style={thtdStyle}>User</th>
                  <th style={thtdStyle}>Session</th>
                  <th style={thtdStyle}>Provider/Model</th>
                  <th style={thtdStyle}>Latency</th>
                  <th style={thtdStyle}>Tokens</th>
                  <th style={thtdStyle}>Cost (USD)</th>
                  <th style={thtdStyle}>Status</th>
                  <th style={thtdStyle}>Trace</th>
                </tr>
              </thead>
              <tbody>
                {observations.rows.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={thtdStyle}>No observations found.</td>
                  </tr>
                ) : (
                  observations.rows.map((row) => (
                    <tr key={`${row.traceId}:${row.spanId}`}>
                      <td style={thtdStyle}>{formatDate(row.startTime)}</td>
                      <td style={thtdStyle}>{row.spanName}</td>
                      <td style={thtdStyle}>{row.functionId ?? '-'}</td>
                      <td style={thtdStyle}>{row.userId ?? '-'}</td>
                      <td style={thtdStyle}>{row.sessionId ?? '-'}</td>
                      <td style={thtdStyle}>{[row.provider, row.model].filter(Boolean).join(' / ') || '-'}</td>
                      <td style={thtdStyle}>{formatMs(row.durationMs)}</td>
                      <td style={thtdStyle}>{row.totalTokens ?? '-'}</td>
                      <td style={thtdStyle}>{formatUsd(row.totalCostUsd)}</td>
                      <td style={thtdStyle}>{row.statusCode > 0 ? `ERR ${row.statusCode}` : 'OK'}</td>
                      <td style={thtdStyle}>
                        <a href={`${basePath}/trace/${encodeURIComponent(row.traceId)}`}>View trace</a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        </div>
      </main>
    );
  } catch (error) {
    return (
      <main style={pageStyle}>
        <section style={panelStyle}>
          <h1 style={{ marginTop: 0 }}>AI Observability</h1>
          <p>Failed to load observability data from ClickHouse.</p>
          <pre style={preStyle}>{error instanceof Error ? error.stack || error.message : String(error)}</pre>
        </section>
      </main>
    );
  }
}

export async function AiTracePage(props: AiTracePageProps): Promise<React.JSX.Element> {
  await props.authCheck?.();
  const client = getClient(props);
  const trace = await client.getTrace(props.traceId);
  const basePath = normalizeBasePath(props.basePath);

  return (
    <main style={{ ...pageStyle, background: '#f9fafb' }}>
      <div style={{ display: 'grid', gap: 16 }}>
        <header style={panelStyle}>
          <h1 style={{ margin: 0 }}>Trace {trace.traceId}</h1>
          {basePath ? (
            <p style={{ margin: '8px 0 0' }}>
              <a href={basePath}>Back to overview</a>
            </p>
          ) : null}
        </header>

        <section style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Spans</h2>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thtdStyle}>Start</th>
                <th style={thtdStyle}>Span</th>
                <th style={thtdStyle}>Function</th>
                <th style={thtdStyle}>User</th>
                <th style={thtdStyle}>Session</th>
                <th style={thtdStyle}>Model</th>
                <th style={thtdStyle}>Latency</th>
                <th style={thtdStyle}>Status</th>
                <th style={thtdStyle}>Tokens</th>
                <th style={thtdStyle}>Cost (USD)</th>
              </tr>
            </thead>
            <tbody>
              {trace.spans.map((span) => (
                <tr key={span.spanId}>
                  <td style={thtdStyle}>{formatDate(span.startTime)}</td>
                  <td style={thtdStyle}>{span.spanName}</td>
                  <td style={thtdStyle}>{span.functionId ?? '-'}</td>
                  <td style={thtdStyle}>{span.userId ?? '-'}</td>
                  <td style={thtdStyle}>{span.sessionId ?? '-'}</td>
                  <td style={thtdStyle}>{[span.provider, span.model].filter(Boolean).join(' / ') || '-'}</td>
                  <td style={thtdStyle}>{formatMs(span.durationMs)}</td>
                  <td style={thtdStyle}>{span.statusCode > 0 ? `ERR ${span.statusCode}` : 'OK'}</td>
                  <td style={thtdStyle}>{span.totalTokens ?? '-'}</td>
                  <td style={thtdStyle}>{formatUsd(span.totalCostUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {trace.spans.map((span) => (
          <section key={`${span.spanId}:details`} style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>{span.spanName}</h2>
            <p style={{ marginTop: 0, color: '#4b5563' }}>
              {formatDate(span.startTime)} | {formatMs(span.durationMs)} | {span.statusCode > 0 ? `ERR ${span.statusCode}` : 'OK'}
            </p>
            <p style={{ marginTop: 0, color: '#4b5563' }}>
              Tokens: {span.totalTokens ?? '-'} | Cost: {formatUsd(span.totalCostUsd)}
            </p>
            {props.contentMode !== 'none' ? (
              <>
                {renderJsonBlock('Input', span.inputText)}
                {renderJsonBlock('Output', span.outputText)}
              </>
            ) : null}
            {renderJsonBlock('Metadata JSON', span.metadataJson)}
            {renderJsonBlock('Attributes JSON', span.attributesJson)}
            {renderJsonBlock('Events JSON', span.eventsJson)}
          </section>
        ))}
      </div>
    </main>
  );
}

export function AiObservabilityProvider(props: AiObservabilityProviderProps): React.JSX.Element {
  return <>{props.children}</>;
}

function MetricCard({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <section style={panelStyle}>
      <div style={{ color: '#6b7280', fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600 }}>{value}</div>
    </section>
  );
}

export default AiObservabilityPage;
