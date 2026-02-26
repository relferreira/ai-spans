import { describe, expect, it } from 'vitest';
import { aiSpansTelemetry } from './telemetry';

describe('aiSpansTelemetry', () => {
  it('adds user and session ids to telemetry metadata', () => {
    const result = aiSpansTelemetry({
      functionId: 'chat.stream',
      userId: 'user_123',
      sessionId: 'session_abc',
      metadata: { route: '/api/chat' },
    });

    expect(result.experimental_telemetry.functionId).toBe('chat.stream');
    expect(result.experimental_telemetry.metadata).toMatchObject({
      route: '/api/chat',
      'ai_spans.user_id': 'user_123',
      'ai_spans.session_id': 'session_abc',
    });
  });
});
