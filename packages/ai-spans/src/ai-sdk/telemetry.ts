export interface AiSpansTelemetryOptions {
  functionId: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, string | number | boolean>;
  recordInputs?: boolean;
  recordOutputs?: boolean;
  tags?: string[];
  requestAttributes?: Record<string, string>;
}

export interface AiSdkExperimentalTelemetryConfig {
  isEnabled: boolean;
  functionId: string;
  metadata?: Record<string, string | number | boolean>;
  recordInputs?: boolean;
  recordOutputs?: boolean;
}

export function aiSpansTelemetry(options: AiSpansTelemetryOptions): {
  experimental_telemetry: AiSdkExperimentalTelemetryConfig;
} {
  if (!options.functionId) {
    throw new Error('aiSpansTelemetry requires a non-empty functionId');
  }

  const metadata: Record<string, string | number | boolean> = {
    ...(options.metadata ?? {}),
  };

  if (options.userId) {
    metadata['ai_spans.user_id'] = options.userId;
  }

  if (options.sessionId) {
    metadata['ai_spans.session_id'] = options.sessionId;
  }

  if (options.tags?.length) {
    metadata['ai_spans.tags'] = options.tags.join(',');
  }

  if (options.requestAttributes) {
    for (const [key, value] of Object.entries(options.requestAttributes)) {
      metadata[`ai_spans.request_attribute.${key}`] = value;
    }
  }

  const experimentalTelemetry: AiSdkExperimentalTelemetryConfig = {
    isEnabled: true,
    functionId: options.functionId,
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
    ...(options.recordInputs != null ? { recordInputs: options.recordInputs } : {}),
    ...(options.recordOutputs != null ? { recordOutputs: options.recordOutputs } : {}),
  };

  return {
    experimental_telemetry: experimentalTelemetry,
  };
}
