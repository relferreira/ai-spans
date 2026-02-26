'use client';

import { useMemo, useState } from 'react';
import { useChat } from '@ai-sdk/react';

function partsToText(parts: { type: string; text?: string }[] | undefined): string {
  if (!parts?.length) return '';
  return parts
    .map((part) => {
      if (part.type === 'text') return part.text ?? '';
      return `[${part.type}]`;
    })
    .join('');
}

const DEMO_USER_ID = 'demo_user_1';
const DEMO_SESSION_ID = 'demo_session_1';

export function ChatDemo() {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status, error, stop } = useChat();

  const canSend = input.trim().length > 0 && status !== 'submitted' && status !== 'streaming';
  const statusLabel = useMemo(() => {
    if (status === 'submitted') return 'Sending...';
    if (status === 'streaming') return 'Streaming...';
    return 'Idle';
  }, [status]);

  return (
    <div className="shell">
      <section className="card col">
        <div className="row wrap" style={{ justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ margin: 0 }}>AI SDK v6 + Anthropic + ai-spans</h1>
            <p style={{ margin: '6px 0 0', color: 'var(--muted)' }}>
              Send a chat message. The route uses AI SDK v6 and records telemetry to ClickHouse via <code>ai-spans</code>.
            </p>
          </div>
          <div className="row wrap">
            <a href="/admin/ai-observability">Open observability UI</a>
          </div>
        </div>
        <div className="kv">Status: {statusLabel}</div>
        <div className="kv">User ID: {DEMO_USER_ID}</div>
        <div className="kv">Session ID: {DEMO_SESSION_ID}</div>
        {error ? <div style={{ color: '#b91c1c' }}>Error: {error.message}</div> : null}
      </section>

      <section className="card messageList" aria-label="Conversation">
        {messages.length === 0 ? (
          <div className="kv">No messages yet. Try asking for a short summary or a joke.</div>
        ) : (
          messages.map((message) => (
            <article key={message.id} className={`message ${message.role === 'user' ? 'user' : ''}`}>
              <div className="role">{message.role}</div>
              <pre>{partsToText(message.parts as any)}</pre>
            </article>
          ))
        )}
      </section>

      <section className="card col">
        <label htmlFor="chat-input" style={{ fontWeight: 600 }}>Prompt</label>
        <textarea
          id="chat-input"
          rows={4}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask Anthropic something..."
        />
        <div className="row wrap">
          <button
            type="button"
            disabled={!canSend}
            onClick={async () => {
              const text = input.trim();
              if (!text) return;
              setInput('');
              await sendMessage(
                { text },
                {
                  body: {
                    userId: DEMO_USER_ID,
                    sessionId: DEMO_SESSION_ID,
                  },
                },
              );
            }}
          >
            Send
          </button>
          <button type="button" className="secondary" onClick={() => stop()} disabled={status !== 'streaming'}>
            Stop
          </button>
        </div>
      </section>
    </div>
  );
}
