import type { AiSpansResolvedConfig } from '../types';
import type { AiSpansRow } from '../otel/transform';
import type {
  ModelSummary,
  ObservationFilters,
  ObservationListResult,
  OverviewMetrics,
  TimeSeriesPoint,
  TraceDetail,
} from '../query/types';

export interface AiSpansStorageAdapter {
  readonly config: AiSpansResolvedConfig;
  ensureSchema(): Promise<void>;
  insertRows(rows: AiSpansRow[]): Promise<void>;
  listObservations(filters?: ObservationFilters): Promise<ObservationListResult>;
  getTrace(traceId: string): Promise<TraceDetail>;
  getOverviewMetrics(filters?: ObservationFilters): Promise<OverviewMetrics>;
  getTimeSeries(filters?: ObservationFilters): Promise<TimeSeriesPoint[]>;
  listModels(filters?: ObservationFilters): Promise<ModelSummary[]>;
}
