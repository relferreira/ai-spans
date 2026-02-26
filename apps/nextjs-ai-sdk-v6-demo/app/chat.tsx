'use client';

import { useState } from 'react';
import { useChat } from '@ai-sdk/react';

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function renderMessagePart(part: any, index: number) {
  if (part?.type === 'text') {
    return <pre key={index}>{part.text ?? ''}</pre>;
  }

  return (
    <pre key={index}>
      [{String(part?.type ?? 'unknown')}]
      {'\n'}
      {formatJson(part)}
    </pre>
  );
}

const DEMO_USER_ID = 'demo_user_1';
const DEMO_SESSION_ID = 'demo_session_1';

export function ChatDemo() {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status, error, stop } = useChat();

  const canSend = input.trim().length > 0 && status !== 'submitted' && status !== 'streaming';

  return (
    <div className="shell">
      <section className="card col">
        <div className="row wrap" style={{ justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ margin: 0 }}>AI SDK v6 + Anthropic + ai-spans</h1>
            <p style={{ margin: '6px 0 0', color: 'var(--muted)' }}>
              Ask for weather to trigger a tool call. Telemetry is recorded to ClickHouse via <code>ai-spans</code>.
            </p>
          </div>
          <div className="row wrap">
            <a href="/admin/ai-observability">Open observability UI</a>
          </div>
        </div>
        <div className="kv">Status: {status}</div>
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
              <div className="col">{(message.parts as any[] | undefined)?.map((part, index) => renderMessagePart(part, index))}</div>
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
