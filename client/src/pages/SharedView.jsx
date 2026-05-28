import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';

import { getSharedDocument } from '../services/api';

import SummaryCard from '../components/analysis/SummaryCard';
import SectionCard from '../components/analysis/SectionCard';
import MissingClauseAlert from '../components/analysis/MissingClauseAlert';
import KeyTermsTable from '../components/analysis/KeyTermsTable';
import ScannedPDFBanner from '../components/upload/ScannedPDFBanner';

export default function SharedView() {
  const { shareToken } = useParams();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!shareToken) return;

    getSharedDocument(shareToken)
      .then((res) => setData(res.data))
      .catch(() =>
        setError(
          'This report could not be found or the link has expired.'
        )
      )
      .finally(() => setLoading(false));
  }, [shareToken]);

  // ─────────────────────────────────────────────────────────────
  // Loading State
  // ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />

          <p className="text-slate-400 text-sm">
            Loading report…
          </p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Error State
  // ─────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <span className="text-4xl mb-4 block">🔍</span>

          <h2 className="text-white text-xl font-bold mb-2">
            Report not found
          </h2>

          <p className="text-slate-400 text-sm mb-6">
            {error}
          </p>

          <Link
            to="/"
            className="inline-block bg-amber-400 text-slate-950 font-semibold px-6 py-3 rounded-xl hover:bg-amber-300 transition-colors"
          >
            Go to LexSimple
          </Link>
        </div>
      </div>
    );
  }

  const doc = data;
  const analysis = data;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 pb-20">

        {/* Shared Header */}
        <div className="flex items-center gap-2 mb-6 text-slate-500 text-xs break-all">
          <svg
            className="w-4 h-4 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
            />
          </svg>

          <span>
            Shared report · {doc?.filename}
          </span>
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl font-black text-white mb-6">
          Document Analysis Report
        </h1>

        {/* Scanned PDF Banner */}
        {doc?.is_scanned && (
          <div className="mb-6">
            <ScannedPDFBanner />
          </div>
        )}

        {/* Summary */}
        <div className="mb-6">
          <SummaryCard
            summary={analysis?.overall_summary}
            docType={analysis?.doc_type}
            overallRisk={analysis?.overall_risk}
          />
        </div>
        {/* Missing Clauses */}
        {analysis?.missing_clauses?.length > 0 && (
          <div className="mb-6">
            <MissingClauseAlert
              clauses={analysis.missing_clauses}
            />
          </div>
        )}

        {/* Key Terms */}
        {(analysis?.key_dates?.length > 0 ||
          analysis?.key_amounts?.length > 0) && (
          <div className="mb-6">
            <KeyTermsTable
              keyDates={analysis?.key_dates || []}
              keyAmounts={analysis?.key_amounts || []}
            />
          </div>
        )}
        {/* Sections */}
        <div>
          <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-4">
            Section-by-Section Breakdown
            <span className="ml-2 text-amber-400">
              ({analysis?.sections?.length || 0} sections)
            </span>
          </h2>

          <div className="space-y-3">
            {(analysis?.sections || []).map((section, i) => (
              <SectionCard
                key={i}
                section={section}
                index={i}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-10 border-t border-slate-800 pt-8">
          <p className="text-slate-500 text-sm text-center leading-relaxed">
            This is an AI-generated summary.
            Always consult a legal professional before signing.
          </p>
        </div>

      </div>
    </div>
  );
}