import { describe, expect, it } from 'vitest';
import { estimateCostMicrousd } from './pricing';

describe('estimateCostMicrousd', () => {
  it('estimates cost for supported Anthropic models', () => {
    const cost = estimateCostMicrousd({
      provider: 'anthropic.messages',
      model: 'claude-3-haiku-20240307',
      promptTokens: 24,
      completionTokens: 14,
    });

    expect(cost).toEqual({
      inputCostMicrousd: 6,
      outputCostMicrousd: 18,
      totalCostMicrousd: 24,
    });
  });

  it('returns null for unknown models', () => {
    const cost = estimateCostMicrousd({
      provider: 'some-provider',
      model: 'unknown-model',
      promptTokens: 10,
      completionTokens: 10,
    });

    expect(cost).toBeNull();
  });
});
