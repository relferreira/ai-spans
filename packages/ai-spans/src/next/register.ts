import { NodeSDK } from '@opentelemetry/sdk-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { createAiSpansSpanProcessor } from '../otel/processor';
import { createAiSpansConfigFromEnv, resolveAiSpansConfig } from '../config';
import type { AiSpansConfig } from '../types';

const GLOBAL_KEY = Symbol.for('ai-spans.node-sdk');

type GlobalState = {
  sdk: NodeSDK;
  started: boolean;
};

function getGlobalState(): GlobalState | undefined {
  return (globalThis as Record<PropertyKey, unknown>)[GLOBAL_KEY] as GlobalState | undefined;
}

function setGlobalState(state: GlobalState): void {
  (globalThis as Record<PropertyKey, unknown>)[GLOBAL_KEY] = state;
}

export async function registerAiObservability(config?: AiSpansConfig): Promise<void> {
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== 'nodejs') {
    if (process.env.AI_SPANS_DEBUG === '1') {
      console.log('[ai-spans] register skipped for runtime', process.env.NEXT_RUNTIME);
    }
    return;
  }

  const existing = getGlobalState();
  if (existing?.started) {
    if (process.env.AI_SPANS_DEBUG === '1') {
      console.log('[ai-spans] register skipped (already started)');
    }
    return;
  }

  const resolved = config ? resolveAiSpansConfig(config) : createAiSpansConfigFromEnv();

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      'service.name': resolved.serviceName,
      'deployment.environment.name': resolved.environment,
      'service.namespace': 'ai-spans',
    }),
    spanProcessors: [createAiSpansSpanProcessor(resolved)],
  });

  await Promise.resolve(sdk.start());
  if (process.env.AI_SPANS_DEBUG === '1') {
    console.log('[ai-spans] NodeSDK started', {
      serviceName: resolved.serviceName,
      environment: resolved.environment,
      processorMode: resolved.processorMode,
    });
  }
  setGlobalState({ sdk, started: true });
}

export async function shutdownAiObservability(): Promise<void> {
  const existing = getGlobalState();
  if (!existing) return;
  await Promise.resolve(existing.sdk.shutdown());
  (globalThis as Record<PropertyKey, unknown>)[GLOBAL_KEY] = undefined;
}
