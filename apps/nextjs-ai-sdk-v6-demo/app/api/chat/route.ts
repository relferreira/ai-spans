import { anthropic } from '@ai-sdk/anthropic';
import { convertToModelMessages, streamText, type UIMessage } from 'ai';
import { aiSpansTelemetry } from 'ai-spans/ai-sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: Request) {
  const body = (await request.json()) as {
    messages?: UIMessage[];
    userId?: string;
    sessionId?: string;
  };
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const userId = typeof body.userId === 'string' && body.userId.trim() ? body.userId.trim() : undefined;
  const sessionId = typeof body.sessionId === 'string' && body.sessionId.trim() ? body.sessionId.trim() : undefined;

  const result = streamText({
    model: anthropic('claude-3-haiku-20240307'),
    messages: await convertToModelMessages(messages),
    ...aiSpansTelemetry({
      functionId: 'chat.stream',
      userId,
      sessionId,
      recordInputs: true,
      recordOutputs: true,
      metadata: {
        route: '/api/chat',
        app: 'nextjs-ai-sdk-v6-example',
      },
      tags: ['demo', 'anthropic', 'chat'],
    }),
  });

  return result.toUIMessageStreamResponse();
}
