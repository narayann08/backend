import { useEffect, useRef, useState } from 'react';
import { Bot, Send, User, AlertTriangle } from 'lucide-react';

import Card from '../../components/Card';
import { useChatbot } from '../../hooks/useDecisions';
import { formatTime } from '../../utils/format';

/** Starter questions so an operator does not face an empty box. */
const SUGGESTIONS = [
  'Why is generation different from the forecast right now?',
  'What should I do about the current risk alerts?',
  'Summarise this plant’s condition for a shift handover.',
];

function MessageBubble({ message }) {
  const isUser = message.role === 'user';

  return (
    <li className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
      <span
        className={`grid size-7 shrink-0 place-items-center rounded-[2px] ${
          isUser ? 'bg-ink text-white' : 'bg-surface-sunken text-ink-muted'
        }`}
      >
        {isUser ? (
          <User className="size-3.5" aria-hidden="true" />
        ) : (
          <Bot className="size-3.5" aria-hidden="true" />
        )}
      </span>

      <div
        className={`max-w-[80%] rounded-[3px] px-3 py-2 text-sm ${
          isUser
            ? 'bg-ink text-white'
            : message.isError
              ? 'border border-severity-high/35 bg-severity-high-soft text-ink'
              : 'border border-line bg-surface-raised text-ink'
        }`}
      >
        {message.isError && (
          <span className="fc-label mb-1.5 flex items-center gap-1.5 text-severity-high">
            <AlertTriangle className="size-3.5" aria-hidden="true" />
            Assistant unavailable
          </span>
        )}
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.detail && <p className="mt-1 text-xs text-ink-muted">{message.detail}</p>}
        <time
          className={`mt-1.5 block font-mono text-[11px] ${isUser ? 'text-white/60' : 'text-ink-muted'}`}
        >
          {formatTime(message.at)}
        </time>
      </div>
    </li>
  );
}

/**
 * Plant-scoped AI chatbot (plan §6.2).
 *
 * Mounted with `key={plantId}` by DecisionsPage, so switching plants gives a
 * fresh component rather than carrying the previous conversation over.
 *
 * The backend answers only from this plant's stored data and returns 503 when
 * the model is unreachable — so a failure is rendered as a visible error
 * message rather than being retried or replaced with canned text. The backend
 * has no streaming endpoint, so this is plain request/response.
 */
export default function ChatBox({ plantId, plantName, className = '' }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const listRef = useRef(null);
  const chat = useChatbot(plantId);

  // Keep the newest message in view as the conversation grows.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  function send(question) {
    const trimmed = question.trim();
    if (!trimmed || chat.isPending) return;

    const userMessage = { role: 'user', content: trimmed, at: new Date() };
    // Only completed exchanges are sent back as context.
    const history = messages
      .filter((m) => !m.isError)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    chat.mutate(
      { message: trimmed, history },
      {
        onSuccess: (data) =>
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: data.reply, at: new Date(data.answeredAt) },
          ]),
        onError: (error) =>
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: error.message,
              detail: error.detail,
              isError: true,
              at: new Date(),
            },
          ]),
      },
    );
  }

  return (
    <Card
      title="Ask about this plant"
      subtitle={plantName ? `Answers are scoped to ${plantName}` : 'Plant-scoped assistant'}
      icon={Bot}
      className={className}
      bodyClassName="flex min-h-0 flex-col p-0"
    >
      <div
        ref={listRef}
        className="min-h-0 flex-1 overflow-y-auto p-4"
        role="log"
        aria-label="Conversation"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-ink-muted">
              Ask about current output, forecast accuracy, alerts or what to do next. The assistant
              only uses this plant&apos;s stored telemetry, weather and recommendations.
            </p>
            <ul className="space-y-2">
              {SUGGESTIONS.map((suggestion) => (
                <li key={suggestion}>
                  <button
                    type="button"
                    onClick={() => send(suggestion)}
                    className="w-full rounded-[3px] border border-line bg-surface px-3 py-2.5 text-left text-sm text-ink transition-colors hover:border-brand hover:bg-surface-raised"
                  >
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ul className="space-y-3">
            {messages.map((message, index) => (
              <MessageBubble key={index} message={message} />
            ))}
            {chat.isPending && (
              <li className="flex items-center gap-2.5 text-sm text-ink-muted">
                <span className="grid size-7 place-items-center rounded-[2px] bg-surface-sunken">
                  <Bot className="size-3.5" aria-hidden="true" />
                </span>
                <span className="animate-soft-pulse">Thinking…</span>
              </li>
            )}
          </ul>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          send(input);
        }}
        className="flex shrink-0 items-center gap-2 border-t border-line p-3"
      >
        <label htmlFor="chat-input" className="sr-only">
          Ask a question about this plant
        </label>
        <input
          id="chat-input"
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about output, forecasts or alerts…"
          disabled={chat.isPending}
          className="min-w-0 flex-1 rounded-[2px] border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={chat.isPending || !input.trim()}
          className="fc-label inline-flex shrink-0 items-center gap-2 rounded-[2px] bg-ink px-3.5 py-3 text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
        >
          <Send className="size-4" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">Send</span>
        </button>
      </form>
    </Card>
  );
}
