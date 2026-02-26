import { describe, expect, it } from 'vitest';
import { isAiSdkSpan } from './filter';

describe('isAiSdkSpan', () => {
  it('matches ai.* spans', () => {
    expect(isAiSdkSpan('ai.generateText')).toBe(true);
    expect(isAiSdkSpan('ai.streamText.chunk')).toBe(true);
  });

  it('rejects non-ai spans', () => {
    expect(isAiSdkSpan('http.request')).toBe(false);
    expect(isAiSdkSpan('')).toBe(false);
  });
});
