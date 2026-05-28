import RiskBadge from './RiskBadge';

export default function SummaryCard({ summary, docType, overallRisk, keyDates = [], keyAmounts = [] }) {
  const docLabel = docType || 'Legal Document';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">

      {/* Top bar */}
      <div className="px-4 sm:px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <span className="text-slate-200 font-semibold text-sm sm:text-base">📋 {docLabel}</span>
        {overallRisk && <RiskBadge level={overallRisk} size="lg" />}
      </div>

      {/* Plain English summary */}
      <div className="px-4 sm:px-6 py-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
          Plain English Summary
        </p>
        <p className="text-slate-200 leading-relaxed text-sm sm:text-base">
          {summary || 'Generating summary…'}
        </p>
      </div>

      {/* Key dates & amounts */}
      {(keyDates.length > 0 || keyAmounts.length > 0) && (
        <div className="border-t border-slate-800 px-4 sm:px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">

          {keyDates.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Key Dates</p>
              <ul className="space-y-2">
                {keyDates.map((d, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 text-sm">
                    <span className="text-slate-500 min-w-0 break-words">{d.label}</span>
                    <span className="text-slate-200 font-medium flex-shrink-0 text-right">{d.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {keyAmounts.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Key Amounts</p>
              <ul className="space-y-2">
                {keyAmounts.map((a, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 text-sm">
                    <span className="text-slate-500 min-w-0 break-words">{a.label}</span>
                    <span className="text-amber-400 font-semibold flex-shrink-0 text-right">{a.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>
      )}
    </div>
  );
}