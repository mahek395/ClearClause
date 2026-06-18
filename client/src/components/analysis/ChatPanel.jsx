import { useState, useRef, useEffect } from 'react';
import { tokenStore } from '../../utils/tokenStore';
import ReactMarkdown from 'react-markdown';

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-slate-300"
      title="Copy response"
    >
      {copied ? (
        <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────
function Message({ role, content, isLatest }) {
  const isUser = role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} group`}>
      {/* Avatar */}
      <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5
        ${isUser ? 'bg-amber-400 text-slate-950' : 'bg-slate-700 text-amber-400'}`}>
        {isUser ? 'U' : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        )}
      </div>

      {/* Bubble */}
      <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'} max-w-[82%]`}>
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed
          ${isUser
            ? 'bg-amber-400 text-slate-950 rounded-tr-sm font-medium'
            : 'bg-slate-800/80 text-slate-200 rounded-tl-sm border border-slate-700/50'
          }`}>
          {isUser ? (
            <p>{content}</p>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none
              prose-p:my-1.5 prose-p:leading-relaxed
              prose-strong:text-white prose-strong:font-semibold
              prose-ul:my-2 prose-ul:space-y-1 prose-ul:pl-4
              prose-ol:my-2 prose-ol:space-y-1 prose-ol:pl-4
              prose-li:leading-relaxed
              prose-h3:text-white prose-h3:font-bold prose-h3:mt-3 prose-h3:mb-1.5 prose-h3:text-sm
              prose-h4:text-slate-200 prose-h4:font-semibold prose-h4:mt-2 prose-h4:mb-1
              prose-blockquote:border-l-2 prose-blockquote:border-amber-400 prose-blockquote:pl-3 prose-blockquote:text-slate-400
              prose-code:bg-slate-900 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-amber-300 prose-code:text-xs
              prose-hr:border-slate-700">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Copy button — only for AI messages */}
        {!isUser && content && (
          <div className="flex items-center gap-1 px-1">
            <CopyButton text={content} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Thinking indicator (shown while waiting for first token) ──────────────────
function ThinkingIndicator() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center bg-slate-700 text-amber-400 mt-0.5">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      <div className="bg-slate-800/80 border border-slate-700/50 px-4 py-3 rounded-2xl rounded-tl-sm">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-slate-500 text-xs">
            {seconds < 3 ? 'Reading document…' : seconds < 8 ? 'Analyzing…' : `Thinking… (${seconds}s)`}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Suggestion chips ──────────────────────────────────────────────────────────
const SUGGESTIONS = [
  'What are my main obligations?',
  'Are there any high-risk clauses?',
  'What are the key dates?',
  'Can I terminate this early?',
  'Who are the parties involved?',
  'What happens if I breach this?',
];

// ── Main ChatPanel ────────────────────────────────────────────────────────────
// `messages` and `setMessages` are now lifted to the parent (Analysis.jsx)
// so chat history survives Analysis <-> Chat tab switches.
export default function ChatPanel({ documentId, messages, setMessages }) {
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false); // waiting for first token
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const messagesRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || isStreaming) return;

    const history = messages.filter((m, i) => i !== 0);
    const userMsg = { role: 'user', content: text };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);
    setIsStreaming(true);

    try {
      const res = await fetch(`http://localhost:5001/api/chat/${documentId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenStore.get() || ''}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          message: text,
          history: history.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Chat request failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantMessageAdded = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith('event:')) continue;
          if (!line.startsWith('data:')) continue;

          const data = JSON.parse(line.slice(5).trim());

          if (data.text) {
            // First chunk received — stop thinking indicator, add message
            if (!assistantMessageAdded) {
              setIsThinking(false);
              setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
              assistantMessageAdded = true;
            }

            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                role: 'assistant',
                content: updated[updated.length - 1].content + data.text,
              };
              return updated;
            });
          }

          if (data.message) {
            throw new Error(data.message);
          }
        }
      }

      // If no message was added (empty response)
      if (!assistantMessageAdded) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: "I couldn't find relevant information in this document to answer that question.",
        }]);
      }

    } catch (err) {
      setIsThinking(false);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
      }]);
    } finally {
      setIsThinking(false);
      setIsStreaming(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const showSuggestions = messages.length === 1 && !isStreaming;

  return (
    <div className="flex flex-col max-w-4xl mx-auto px-4 sm:px-6 pt-4 pb-6"
      style={{ height: 'calc(100vh - 220px)', minHeight: '400px' }}>

      {/* Suggestion chips */}
      {showSuggestions && (
        <div className="mb-5">
          <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-2">Suggested questions</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map(q => (
              <button
                key={q}
                onClick={() => { setInput(q); inputRef.current?.focus(); }}
                className="text-xs px-3 py-1.5 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-all border border-slate-700 hover:border-slate-600"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages area */}
      <div
        ref={messagesRef}
        className="flex-1 overflow-y-auto space-y-5 pr-2 mb-4"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#334155 transparent' }}
      >
        {messages.map((m, i) => (
          <Message
            key={i}
            role={m.role}
            content={m.content}
            isLatest={i === messages.length - 1}
          />
        ))}

        {/* Thinking indicator — shown before first token arrives */}
        {isThinking && <ThinkingIndicator />}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0">
        <div className={`flex gap-2 items-end rounded-2xl bg-slate-900 px-4 py-3 transition-all border
          ${isStreaming
            ? 'border-amber-400/30 bg-slate-900/80'
            : 'border-slate-700 focus-within:border-amber-400/50'
          }`}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? 'AI is responding…' : 'Ask anything about this document…'}
            rows={1}
            disabled={isStreaming}
            className="flex-1 bg-transparent text-white text-sm placeholder-slate-500 resize-none outline-none leading-relaxed disabled:opacity-40"
            style={{ maxHeight: '120px' }}
            onInput={e => {
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isStreaming}
            className="flex-shrink-0 w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {isStreaming ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            )}
          </button>
        </div>

        <p className="text-slate-600 text-xs text-center mt-2">
          Answers are based on this document only · Not legal advice
        </p>
      </div>
    </div>
  );
}