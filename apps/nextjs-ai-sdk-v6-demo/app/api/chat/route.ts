import { anthropic } from '@ai-sdk/anthropic';
import { convertToModelMessages, streamText, type UIMessage } from 'ai';
import { aiSpansTelemetry } from 'ai-spans/ai-sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: Request) {
  const body = (await request.json()) as { messages?: UIMessage[] };
  const messages = Array.isArray(body.messages) ? body.messages : [];

  const result = streamText({
    model: anthropic('claude-3-haiku-20240307'),
    messages: await convertToModelMessages(messages),
    ...aiSpansTelemetry({
      functionId: 'chat.stream',
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
