import { useState } from 'react';
import DropZone from '../components/upload/DropZone';
import UploadProgress from './ProcessingProgress';
import { uploadDocument } from '../services/api';



export default function Home() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadError,  setUploadError]  = useState('');
  const [phase,        setPhase]        = useState('idle');
  const [httpProgress, setHttpProgress] = useState(0);
  const [jobId,        setJobId]        = useState(null);
  const [documentId,   setDocumentId]   = useState(null);

  const handleFileSelect = (file) => {
    setSelectedFile(file);
    setUploadError('');
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setUploadError('');
    setPhase('idle');
    setHttpProgress(0);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setPhase('uploading');
    setUploadError('');
    setHttpProgress(0);

    try {
      const res = await uploadDocument(selectedFile, (progressEvent) => {
        const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setHttpProgress(pct);
      });

      const { documentId: docId, jobId: jId, shareToken } = res.data;

      sessionStorage.setItem(`shareToken-${docId}`, shareToken);
      setDocumentId(docId);
      setJobId(jId);
      setPhase('processing');
    } catch (err) {
      setUploadError(err?.response?.data?.message || 'Upload failed. Please try again.');
      setPhase('idle');
      setHttpProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Hero */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-10 sm:pt-12 pb-12 sm:pb-16 text-center">

        <div className="inline-flex items-center gap-2 bg-amber-400/10 border border-amber-400/20 rounded-full px-4 py-1.5 mb-6 sm:mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
          <span className="text-amber-400 text-xs font-semibold tracking-wide uppercase">
            AI Legal Document Simplifier
          </span>
        </div>

        {/* Responsive heading: smaller on mobile to prevent overflow */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight mb-4 sm:mb-6 tracking-tight">
          Understand any<br />
          <span className="text-amber-400">legal document</span><br />
          in plain English
        </h1>

        <p className="text-slate-400 text-base sm:text-xl max-w-2xl mx-auto mb-8 sm:mb-12 leading-relaxed px-2">
          Upload a rental agreement, offer letter, NDA, or loan document.
          Get a plain English breakdown — every clause, every risk — in under 60 seconds.
        </p>

        {/* Upload area — full width on mobile, constrained on larger screens */}
        <div id="upload" className="w-full max-w-xl mx-auto">

          {phase === 'uploading' && (
            <UploadProgress progress={httpProgress} filename={selectedFile?.name} />
          )}

          {phase === 'processing' && jobId && (
            <div className="space-y-3">
              <p className="text-slate-400 text-sm">
                File uploaded ✓ — now extracting text from your document…
              </p>
              <UploadProgress jobId={jobId} documentId={documentId} />
            </div>
          )}

          {phase === 'idle' && (
            <>
              {selectedFile ? (
                <>
                  {/* Selected file row */}
                  <div className="flex items-center justify-between gap-3 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <svg className="w-5 h-5 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-slate-200 text-sm font-medium truncate">{selectedFile.name}</span>
                      <span className="text-slate-500 text-xs flex-shrink-0 hidden xs:inline">
                        ({(selectedFile.size / 1024 / 1024).toFixed(1)} MB)
                      </span>
                    </div>
                    <button
                      onClick={handleClearFile}
                      aria-label="Remove file"
                      className="text-slate-500 hover:text-slate-300 flex-shrink-0 transition-colors p-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Analyze button — large tap target on mobile */}
                  <button
                    onClick={handleAnalyze}
                    className="mt-4 w-full bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 font-bold py-4 sm:py-3.5 rounded-xl transition-colors text-base touch-manipulation"
                  >
                    Analyze Document →
                  </button>
                </>
              ) : (
                <DropZone onFileSelect={handleFileSelect} isLoading={false} />
              )}
            </>
          )}

          {uploadError && (
            <div className="mt-4 text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3 text-left">
              {uploadError}
            </div>
          )}
        </div>

        <p className="text-slate-600 text-sm mt-6 px-4">
          Free · No login required · Works on English and Hindi documents
        </p>
      </div>
    </div>
  );
}