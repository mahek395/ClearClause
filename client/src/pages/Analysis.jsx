import { useEffect, useState, useRef } from 'react';
import { useParams, useLocation, Link, Navigate, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { useAnalysisStream } from '../hooks/useAnalysisStream';
import api from '../utils/axiosInstance';

import SummaryCard from '../components/analysis/SummaryCard';
import SectionCard from '../components/analysis/SectionCard';
import MissingClauseAlert from '../components/analysis/MissingClauseAlert';
import AIProviderBadge from '../components/analysis/AIProviderBadge';
import ShareButton from '../components/layout/ShareButton';
import KeyTermsTable from '../components/analysis/KeyTermsTable';
import ExportButton from './ExportButton';
import ChatPanel from '../components/analysis/ChatPanel';

function SectionSkeleton() {
  return (
    <div className="bg-slate-900 border border-slate-800 border-l-4 border-l-slate-700 rounded-xl p-5 animate-pulse">
      <div className="flex gap-2 mb-3">
        <div className="h-5 w-20 bg-slate-800 rounded-full" />
        <div className="h-5 w-28 bg-slate-800 rounded-full" />
      </div>
      <div className="h-4 bg-slate-800 rounded w-3/4 mb-2" />
      <div className="h-4 bg-slate-800 rounded w-full mb-2" />
      <div className="h-4 bg-slate-800 rounded w-5/6" />
    </div>
  );
}

function PDFPanel({ pdfUrl, onClose, isLoading }) {
  return (
    <div className="flex flex-col h-full border-r border-slate-800 bg-slate-950">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <span className="text-slate-300 text-sm font-medium">Original Document</span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close PDF panel"
          className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-slate-800"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950 z-10">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Loading PDF…</p>
            </div>
          </div>
        )}
        {pdfUrl && (
          <iframe
            src={pdfUrl}
            className="w-full h-full"
            title="Original document"
            style={{ border: 'none' }}
          />
        )}
        {!pdfUrl && !isLoading && (
          <div className="flex items-center justify-center h-full">
            <p className="text-slate-500 text-sm">PDF not available</p>
          </div>
        )}
      </div>
    </div>
  );
}

function MobilePDFSheet({ pdfUrl, isLoading, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <span className="text-slate-300 text-sm font-medium">Original Document</span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close PDF"
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-800"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Close
        </button>
      </div>
      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950 z-10">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Loading PDF…</p>
            </div>
          </div>
        )}
        {pdfUrl ? (
          <iframe
            src={pdfUrl}
            className="w-full h-full"
            title="Original document"
            style={{ border: 'none' }}
          />
        ) : !isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
            <p className="text-slate-400 text-sm">PDF preview isn't available on this device.</p>
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-amber-400 text-sm underline">
              Open in new tab
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function Analysis() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const { loading, isAuthenticated } = useAuth();

  const [shareToken, setShareToken] = useState(location.state?.shareToken || null);
  const [docFilename, setDocFilename] = useState(location.state?.filename || '');
  const [showPdf, setShowPdf] = useState(false);
  const [showMobilePdf, setShowMobilePdf] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('analysis');
  const pdfBlobRef = useRef(null);

  // ── Chat state lifted up so it survives Analysis <-> Chat tab switches ───────
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'assistant',
      content: "Hi! I've read this document. Ask me anything about it — clauses, risks, key dates, obligations, or anything you're unsure about.",
    },
  ]);

  const {
    sections, summary, docType, overallRisk,
    missingClauses, keyDates, keyAmounts,
    aiProvider, status, error,
  } = useAnalysisStream(
    !loading ? id : null
  );

  useEffect(() => {
    if (!id) return;

    async function fetchDocument() {
      try {
        const res = await api.get(`/documents/${id}`);
        if (res.data?.share_token) setShareToken(res.data.share_token);
        if (res.data?.original_filename) setDocFilename(res.data.original_filename);

        setPdfLoading(true);
        const fileRes = await api.get(`/documents/${id}/file`, { responseType: 'blob' });
        const url = URL.createObjectURL(fileRes.data);
        pdfBlobRef.current = url;
        setPdfUrl(url);
      } catch (err) {
        console.error('Failed to load document:', err);
      } finally {
        setPdfLoading(false);
      }
    }

    fetchDocument();
    return () => { if (pdfBlobRef.current) URL.revokeObjectURL(pdfBlobRef.current); };
  }, [id]);

  useEffect(() => {
    if (status === 'complete') toast.success('Analysis complete!');
    if (status === 'error') toast.error(error || 'Analysis failed. Please try again.');
  }, [status]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        Loading...
      </div>
    );
  }

  const isStreaming = status === 'streaming' || status === 'connecting';
  const isComplete = status === 'complete';

  // ── Waiting state ─────────────────────────────────────────────────────────────
  if (status === 'waiting') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 sm:px-6">
        <div className="text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-amber-400/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          </div>
          <h2 className="text-white text-xl font-bold mb-2">Processing your document</h2>
          <p className="text-slate-400 text-sm mb-6">
            We're extracting text from your PDF in the background.
            This usually takes 15–30 seconds.
          </p>
          <button
            onClick={() => navigate(0)}
            className="inline-flex items-center gap-2 bg-amber-400 text-slate-950 font-semibold px-6 py-3 rounded-xl hover:bg-amber-300 active:bg-amber-500 transition-colors text-sm touch-manipulation"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Check again
          </button>
        </div>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 sm:px-6">
        <div className="text-center max-w-md w-full">
          <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-white text-xl font-bold mb-2">Analysis failed</h2>
          <p className="text-slate-400 text-sm mb-6">{error || 'Something went wrong. Please try again.'}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate(0)}
              className="inline-flex items-center justify-center gap-2 bg-amber-400 text-slate-950 font-semibold px-6 py-3 rounded-xl hover:bg-amber-300 active:bg-amber-500 transition-colors touch-manipulation"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Retry analysis
            </button>
            <Link
              to="/"
              className="inline-flex items-center justify-center bg-slate-800 text-slate-200 font-medium px-6 py-3 rounded-xl hover:bg-slate-700 transition-colors"
            >
              Upload new document
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Analysis content ──────────────────────────────────────────────────────────
  const analysisContent = (
    <div className={showPdf ? 'max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8' : 'max-w-4xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-20'}>

      {!isAuthenticated && (
        <div className="bg-amber-400/10 border border-amber-400/20 rounded-xl px-4 py-3.5 mb-6 text-sm text-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <p>
              You are using ClearClause as a guest. Your analysis <span className="font-semibold text-amber-300">will not be saved</span>.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-amber-400 hover:text-amber-300 font-semibold transition-colors">
              Log in
            </Link>
            <span className="text-slate-700">|</span>
            <Link to="/register" className="text-amber-400 hover:text-amber-300 font-semibold transition-colors">
              Sign up
            </Link>
          </div>
        </div>
      )}

      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-6 sm:mb-8">
        <div>
          <Link
            to="/"
            className="text-slate-500 text-sm hover:text-slate-300 transition-colors mb-2 inline-flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            New analysis
          </Link>
          <h1 className="text-xl sm:text-2xl font-black text-white">Document Analysis</h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowPdf(v => !v)}
            disabled={!pdfUrl}
            className={`hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all
              ${showPdf
                ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            {showPdf ? 'Hide PDF' : 'View PDF'}
            {pdfLoading && !pdfUrl && (
              <span className="w-3 h-3 border border-slate-500 border-t-transparent rounded-full animate-spin" />
            )}
          </button>

          <button
            onClick={() => setShowMobilePdf(true)}
            disabled={!pdfUrl && !pdfLoading}
            className="sm:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all touch-manipulation"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            PDF
            {pdfLoading && !pdfUrl && (
              <span className="w-3 h-3 border border-slate-500 border-t-transparent rounded-full animate-spin" />
            )}
          </button>

          <AIProviderBadge provider={aiProvider} />
          {shareToken && <ShareButton shareToken={shareToken} />}
          {isComplete && <ExportButton documentId={id} filename={docFilename} />}
        </div>
      </div>

      {/* Tab toggle — only shown when analysis is complete */}
      {isComplete && (
        <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 mb-6 w-fit">
          <button
            onClick={() => setActiveTab('analysis')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'analysis'
                ? 'bg-amber-400 text-slate-950'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Analysis
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'chat'
                ? 'bg-amber-400 text-slate-950'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Ask AI
          </button>
        </div>
      )}

      {/* ── Chat tab ── */}
      {activeTab === 'chat' && isComplete ? (
        <ChatPanel
          documentId={id}
          messages={chatMessages}
          setMessages={setChatMessages}
        />
      ) : (
        <>
          {/* Streaming banner */}
          {isStreaming && (
            <div className="flex items-center gap-3 bg-amber-400/10 border border-amber-400/20 rounded-xl px-4 py-3 mb-6">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
              <p className="text-amber-300 text-sm">
                Analyzing your document with AI — results appear as they stream in…
              </p>
            </div>
          )}

          {/* Cards */}
          <div className="mb-6">
            <SummaryCard summary={summary} docType={docType} overallRisk={overallRisk} />
          </div>

          {missingClauses.length > 0 && (
            <div className="mb-6"><MissingClauseAlert clauses={missingClauses} /></div>
          )}

          {(keyDates?.length > 0 || keyAmounts?.length > 0) && (
            <div className="mb-6"><KeyTermsTable keyDates={keyDates} keyAmounts={keyAmounts} /></div>
          )}

          {/* Section breakdown */}
          <div>
            <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-4">
              Section-by-Section Breakdown
              {sections.length > 0 && <span className="ml-2 text-amber-400">({sections.length} sections)</span>}
            </h2>
            <div className="space-y-3">
              {sections.map((section, i) => <SectionCard key={i} section={section} index={i} />)}
              {isStreaming && sections.length < 3 && (
                <>
                  <SectionSkeleton />
                  <SectionSkeleton />
                  {sections.length === 0 && <SectionSkeleton />}
                </>
              )}
            </div>
            {isComplete && sections.length === 0 && (
              <div className="text-center py-12 text-slate-500 text-sm">
                No sections were extracted from this document.
              </div>
            )}
          </div>

          {isComplete && (
            <div className="mt-10 border-t border-slate-800 pt-8">
              <p className="text-slate-500 text-sm text-center">
                This is an AI-generated summary. Always consult a legal professional before signing.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );

  // ── Desktop split panel ───────────────────────────────────────────────────────
  if (showPdf) {
    return (
      <div className="h-screen bg-slate-950 text-white flex flex-col overflow-hidden">
        <div className="flex flex-1 overflow-hidden pt-16">
          <div className="w-[42%] flex-shrink-0 overflow-hidden">
            <PDFPanel pdfUrl={pdfUrl} isLoading={pdfLoading} onClose={() => setShowPdf(false)} />
          </div>
          <div className="flex-1 overflow-y-auto">{analysisContent}</div>
        </div>
      </div>
    );
  }

  // ── Default single-column layout ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {analysisContent}

      {showMobilePdf && (
        <MobilePDFSheet
          pdfUrl={pdfUrl}
          isLoading={pdfLoading}
          onClose={() => setShowMobilePdf(false)}
        />
      )}
    </div>
  );
}