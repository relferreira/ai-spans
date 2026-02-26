export function isAiSdkSpan(spanName: string): boolean {
  return typeof spanName === 'string' && spanName.startsWith('ai.');
}
