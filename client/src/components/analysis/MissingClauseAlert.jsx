export default function MissingClauseAlert({ clauses = [] }) {
  if (!clauses || clauses.length === 0) return null;

  return (
    <div className="bg-orange-500/5 border border-orange-500/25 rounded-xl px-4 sm:px-5 py-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg" aria-hidden="true">🔍</span>
        <h3 className="text-orange-300 font-semibold text-sm">Missing Clauses Detected</h3>
      </div>
      <p className="text-slate-400 text-xs mb-3">
        The following standard clauses are absent from this document — you may want to ask about them before signing.
      </p>
      <ul className="space-y-2">
        {clauses.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
            <span className="text-orange-400 flex-shrink-0 mt-0.5" aria-hidden="true">•</span>
            <div className="break-words">
              <strong className="text-orange-300 block">{item.clause}</strong>
              {item.why_it_matters && (
                <span className="text-slate-400 text-xs">{item.why_it_matters}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}