import { createAiSpansStorageAdapter } from '../storage/factory';
import type { AiSpansStorageAdapter } from '../storage/types';
import type { AiSpansConfig, AiSpansResolvedConfig } from '../types';
import type {
  ModelSummary,
  ObservationFilters,
  ObservationListResult,
  OverviewMetrics,
  TimeSeriesPoint,
  TraceDetail,
} from './types';

export class AiSpansQueryClient {
  readonly config: AiSpansResolvedConfig;
  private readonly storage: AiSpansStorageAdapter;

  constructor(config?: AiSpansConfig) {
    this.storage = createAiSpansStorageAdapter(config);
    this.config = this.storage.config;
  }

  async listObservations(filters: ObservationFilters = {}): Promise<ObservationListResult> {
    return this.storage.listObservations(filters);
  }

  async getTrace(traceId: string): Promise<TraceDetail> {
    return this.storage.getTrace(traceId);
  }

  async getOverviewMetrics(filters: ObservationFilters = {}): Promise<OverviewMetrics> {
    return this.storage.getOverviewMetrics(filters);
  }

  async getTimeSeries(filters: ObservationFilters = {}): Promise<TimeSeriesPoint[]> {
    return this.storage.getTimeSeries(filters);
  }

  async listModels(filters: ObservationFilters = {}): Promise<ModelSummary[]> {
    return this.storage.listModels(filters);
  }
}

export function createAiSpansQueryClient(config?: AiSpansConfig): AiSpansQueryClient {
  return new AiSpansQueryClient(config);
}
