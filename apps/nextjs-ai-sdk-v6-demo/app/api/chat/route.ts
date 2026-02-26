import { anthropic } from '@ai-sdk/anthropic';
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from 'ai';
import { aiSpansTelemetry } from 'ai-spans/ai-sdk';
import { z } from 'zod/v4';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function simulateWeather(location: string): { location: string; temperatureC: number; condition: string } {
  const conditions = ['sunny', 'cloudy', 'rainy', 'windy', 'foggy'];
  const hash = Array.from(location).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return {
    location,
    temperatureC: 12 + (hash % 21),
    condition: conditions[hash % conditions.length],
  };
}

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
      await new Promise((resolve) => setTimeout(resolve, 300));
      return simulateWeather(location);
    },
  });

  const result = streamText({
    model: anthropic('claude-3-haiku-20240307'),
    system:
      'You are a helpful assistant. If the user asks about weather, use the weather tool and answer with the returned data.',
    messages: await convertToModelMessages(messages),
    tools: {
      weather: weatherTool,
    },
    stopWhen: stepCountIs(5),
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
