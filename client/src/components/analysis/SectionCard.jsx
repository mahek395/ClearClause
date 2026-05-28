// src/components/analysis/SectionCard.jsx
import { useState } from 'react';
import RiskBadge from './RiskBadge';

// Map who_benefits values to display labels
const benefitsLabels = {
  Borrower:     { label: 'Benefits Borrower',      className: 'text-green-400 bg-green-500/10 border-green-500/20' },
  Lender:       { label: 'Benefits Lender',        className: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  Both:         { label: 'Benefits Both',          className: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  Employer:     { label: 'Benefits Employer',      className: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  Employee:     { label: 'Benefits Employee',      className: 'text-green-400 bg-green-500/10 border-green-500/20' },
  Lessor:       { label: 'Benefits Lessor',        className: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  Lessee:       { label: 'Benefits Lessee',        className: 'text-green-400 bg-green-500/10 border-green-500/20' },
  Neutral:      { label: 'Neutral',                className: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
};

export default function SectionCard({ section, index }) {
  const [expanded, setExpanded] = useState(false);
  
  if (!section) return null;

  // Get the benefits label based on who_benefits value
  const benefits = benefitsLabels[section.who_benefits] || benefitsLabels.Neutral;

  // Color the left border based on risk level
  const borderColor =
    section.risk_level === 'high'   ? 'border-l-red-500' :
    section.risk_level === 'medium' ? 'border-l-amber-500' :
    'border-l-green-500';

  // Check if there's any content to show in expanded view
  const hasExpandedContent = 
    (section.risk_reason && ['high', 'medium'].includes(section.risk_level)) || 
    section.original_text;

  return (
    <div
      className={`bg-slate-900 border border-slate-800 border-l-4 ${borderColor} rounded-xl overflow-hidden
        transition-all duration-200 hover:border-slate-700`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Header — full row is clickable */}
      <button
        type="button"
        className="w-full flex items-start justify-between gap-3 p-4 sm:p-5 cursor-pointer hover:bg-slate-800/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <div className="flex-1 min-w-0 text-left">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <RiskBadge level={section.risk_level} />
            <span className={`text-xs px-2 py-0.5 rounded-full border ${benefits.className}`}>
              {benefits.label}
            </span>
          </div>
          {/* ✅ Render section.heading */}
          <h3 className="text-slate-100 font-semibold text-sm sm:text-base leading-snug">
            {section.heading || `Section ${index + 1}`}
          </h3>
        </div>

        {/* Expand/collapse chevron - only show if there's content to expand */}
        {hasExpandedContent && (
          <span aria-hidden="true" className="text-slate-500 flex-shrink-0 mt-1">
            <svg
              className={`w-5 h-5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        )}
      </button>

      {/* Plain English summary — always visible */}
      <div className="px-4 sm:px-5 pb-4">
        {/* ✅ Render section.plain_english */}
        <p className="text-slate-300 text-sm leading-relaxed">{section.plain_english}</p>
      </div>

      {/* Expanded content — shown when user clicks */}
      {expanded && hasExpandedContent && (
        <div className="border-t border-slate-800 px-4 sm:px-5 py-4 bg-slate-800/20 space-y-4 animate-in fade-in duration-200">

          {/* Risk reason — only shown for high/medium risk sections */}
          {section.risk_reason && ['high', 'medium'].includes(section.risk_level) && (
            <div className="flex gap-3 bg-red-500/5 border border-red-500/15 rounded-lg p-3 sm:p-3.5">
              <span className="text-red-400 flex-shrink-0 text-base mt-0.5" aria-hidden="true">⚠️</span>
              <div className="flex-1">
                <p className="text-red-300 text-xs font-semibold uppercase tracking-wide mb-1">
                  Why this is risky
                </p>
                <p className="text-slate-300 text-sm">{section.risk_reason}</p>
              </div>
            </div>
          )}

          {/* Original clause text if available */}
          {section.original_text && (
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-2">
                Original clause text
              </p>
              <blockquote className="border-l-2 border-slate-700 pl-3 py-2 text-slate-400 text-xs leading-relaxed break-words italic">
                "{section.original_text}"
              </blockquote>
            </div>
          )}

        </div>
      )}
    </div>
  );
}