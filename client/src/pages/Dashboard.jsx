import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../utils/axiosInstance';

export default function Dashboard() {
  const { loading, isAuthenticated } = useAuth();

  const [documents,        setDocuments]        = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [error,            setError]            = useState('');
  const [copied,           setCopied]           = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    async function fetchDocuments() {
      try {
        setDocumentsLoading(true);
        const res = await api.get('/documents/user/all');
        setDocuments(res.data || []);
      } catch (err) {
        console.error(err);
        setError('Failed to load documents.');
      } finally {
        setDocumentsLoading(false);
      }
    }

    fetchDocuments();
  }, [isAuthenticated]);

  const handleShare = async (shareToken) => {
    try {
      const shareUrl = `${window.location.origin}/share/${shareToken}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
      alert('Failed to copy share link.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        Loading dashboard...
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" />;

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* Toast — positioned safely inside safe area on mobile */}
      {copied && (
        <div className="fixed top-4 sm:top-6 right-4 sm:right-6 z-50 bg-green-500 text-white px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl shadow-xl text-sm font-medium">
          Share link copied!
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-16">

        {/* Page header */}
        <div className="mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-3 sm:mb-4">Your Dashboard</h1>
          <p className="text-slate-400 text-base sm:text-lg max-w-3xl">
            Manage all your AI-generated legal analyses, revisit uploaded documents, and share reports.
          </p>
        </div>

        {error && (
          <div className="mb-6 sm:mb-8 bg-red-500/10 border border-red-500/20 text-red-400 px-4 sm:px-5 py-3 sm:py-4 rounded-2xl text-sm">
            {error}
          </div>
        )}

        {/* Loading skeletons */}
        {documentsLoading ? (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 animate-pulse">
                <div className="h-5 w-40 bg-slate-800 rounded mb-4" />
                <div className="h-4 w-full bg-slate-800 rounded mb-2" />
                <div className="h-4 w-3/4 bg-slate-800 rounded mb-6" />
                <div className="flex justify-between">
                  <div className="h-8 w-20 bg-slate-800 rounded-full" />
                  <div className="h-8 w-24 bg-slate-800 rounded-xl" />
                </div>
              </div>
            ))}
          </div>

        ) : documents.length === 0 ? (
          /* Empty state */
          <div className="bg-slate-900 border border-slate-800 rounded-3xl px-6 py-12 sm:p-16 text-center">
            <div className="w-16 sm:w-24 h-16 sm:h-24 rounded-2xl sm:rounded-3xl bg-slate-800 flex items-center justify-center mx-auto mb-6 sm:mb-8 text-4xl sm:text-5xl">
              📄
            </div>
            <h3 className="text-2xl sm:text-3xl font-black mb-3 sm:mb-4">No documents yet</h3>
            <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto mb-8 sm:mb-10">
              Upload your first legal document and let LexSimple explain it in plain English with AI-powered risk analysis.
            </p>
            <Link
              to="/"
              className="bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 font-bold px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl transition-colors inline-flex items-center gap-2 touch-manipulation"
            >
              Upload Your First Document
            </Link>
          </div>

        ) : (
          /* Document grid */
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {documents.map(doc => (
              <div
                key={doc.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-5 sm:p-6 hover:border-slate-700 transition-all"
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-3 mb-4 sm:mb-5">
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-xl font-bold mb-1 sm:mb-2 line-clamp-2 break-words">
                      {doc.filename}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500">{doc.doc_type || 'Unknown document'}</p>
                  </div>
                  <StatusBadge status={doc.status} />
                </div>

                {/* Meta rows */}
                <div className="space-y-1.5 sm:space-y-2 mb-5 sm:mb-6 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Pages</span>
                    <span className="text-slate-300">{doc.page_count || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">OCR Used</span>
                    <span className="text-slate-300">{doc.is_scanned ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Uploaded</span>
                    <span className="text-slate-300">{new Date(doc.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Action buttons — equal height, good tap targets */}
                <div className="flex gap-2 sm:gap-3">
                  <Link
                    to={`/analyze/${doc.id}`}
                    className="flex-1 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 font-bold py-3 rounded-xl text-center text-sm transition-colors touch-manipulation"
                  >
                    View Analysis
                  </Link>
                  <button
                    onClick={() => handleShare(doc.share_token)}
                    aria-label="Copy share link"
                    className="px-4 py-3 rounded-xl border border-slate-700 hover:border-slate-500 active:bg-slate-800 transition-colors text-sm text-slate-300 touch-manipulation"
                  >
                    Share
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    completed:  'bg-green-500/10 text-green-400 border-green-500/20',
    processing: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    failed:     'bg-red-500/10 text-red-400 border-red-500/20',
    pending:    'bg-slate-500/10 text-slate-400 border-slate-500/20',
  };
  return (
    <div className={`px-2.5 sm:px-3 py-1 rounded-full border text-xs font-semibold flex-shrink-0 ${styles[status] || styles.pending}`}>
      {status || 'pending'}
    </div>
  );
}