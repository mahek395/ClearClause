export default function AIProviderBadge({ provider }) {
  if (!provider || provider === 'gemini') return null;

  return (
    <div className="inline-flex items-center gap-2 text-xs text-slate-400 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 max-w-full">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
      {/* Text wraps on small screens rather than overflowing */}
      <span className="leading-snug">
        Powered by Groq{' '}
        <span className="text-slate-500">(Gemini rate-limited — auto-switched)</span>
      </span>
    </div>
  );
}