export interface EstimatedCostMicrousd {
  inputCostMicrousd: number;
  outputCostMicrousd: number;
  totalCostMicrousd: number;
}

interface ModelPricingMicrousdPer1M {
  inputPer1M: number;
  outputPer1M: number;
}

interface PricingRule {
  providerMatch?: RegExp;
  modelMatch: RegExp;
  pricing: ModelPricingMicrousdPer1M;
}

// Update as provider pricing changes. Prices are micro-USD per 1M tokens.
// This is intentionally small and focused on common Anthropic model families first.
const PRICING_RULES: PricingRule[] = [
  {
    providerMatch: /^anthropic/i,
    modelMatch: /^claude-3-haiku(?:-|$)/i,
    pricing: { inputPer1M: 250_000, outputPer1M: 1_250_000 },
  },
  {
    providerMatch: /^anthropic/i,
    modelMatch: /^claude-3(?:\.|-)?5-haiku(?:-|$)/i,
    pricing: { inputPer1M: 800_000, outputPer1M: 4_000_000 },
  },
  {
    providerMatch: /^anthropic/i,
    modelMatch: /^claude-(?:3(?:\.|-)?5|3(?:\.|-)?7)-sonnet(?:-|$)/i,
    pricing: { inputPer1M: 3_000_000, outputPer1M: 15_000_000 },
  },
  {
    providerMatch: /^anthropic/i,
    modelMatch: /^claude-(?:sonnet-)?4(?:[.-]\d+)?(?:-|$)/i,
    pricing: { inputPer1M: 3_000_000, outputPer1M: 15_000_000 },
  },
  {
    providerMatch: /^anthropic/i,
    modelMatch: /^claude-(?:haiku-)?4(?:[.-]\d+)?(?:-|$)/i,
    pricing: { inputPer1M: 1_000_000, outputPer1M: 5_000_000 },
  },
];

function roundDiv(numerator: number, denominator: number): number {
  return Math.floor((numerator + denominator / 2) / denominator);
}

function findPricing(provider: string | null, model: string | null): ModelPricingMicrousdPer1M | null {
  if (!model) return null;
  for (const rule of PRICING_RULES) {
    if (rule.providerMatch && (!provider || !rule.providerMatch.test(provider))) continue;
    if (rule.modelMatch.test(model)) return rule.pricing;
  }
  return null;
}

export function estimateCostMicrousd(args: {
  provider: string | null;
  model: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
}): EstimatedCostMicrousd | null {
  const pricing = findPricing(args.provider, args.model);
  if (!pricing) return null;

  const promptTokens = Math.max(0, Math.trunc(args.promptTokens ?? 0));
  const completionTokens = Math.max(0, Math.trunc(args.completionTokens ?? 0));

  // If usage is completely missing, we cannot produce a meaningful estimate.
  if (args.promptTokens == null && args.completionTokens == null) return null;

  const inputCostMicrousd = roundDiv(promptTokens * pricing.inputPer1M, 1_000_000);
  const outputCostMicrousd = roundDiv(completionTokens * pricing.outputPer1M, 1_000_000);
  const totalCostMicrousd = inputCostMicrousd + outputCostMicrousd;

  return {
    inputCostMicrousd,
    outputCostMicrousd,
    totalCostMicrousd,
  };
}
