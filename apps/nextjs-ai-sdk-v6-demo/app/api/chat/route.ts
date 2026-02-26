import { anthropic } from '@ai-sdk/anthropic';
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from 'ai';
import { aiSpansTelemetry } from 'ai-spans/ai-sdk';
import { z } from 'zod/v4';

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
  const weatherTool = tool({
    description: 'Get the current weather for a location.',
    inputSchema: z.object({
      location: z.string().describe('City or place to get weather for'),
    }),
    execute: async ({ location }) => {
      return { location, temperatureC: 22, condition: 'sunny' };
    },
  });

  const result = streamText({
    model: anthropic('claude-3-haiku-20240307'),
    messages: await convertToModelMessages(messages),
    tools: {
      weather: weatherTool,
    },
    stopWhen: stepCountIs(5),
    ...aiSpansTelemetry({
      functionId: 'chat.stream',
      userId,
      sessionId,
    }),
  });

  return result.toUIMessageStreamResponse();
}
