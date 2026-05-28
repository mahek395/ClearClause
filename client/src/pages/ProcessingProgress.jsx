// src/components/UploadProgress.jsx
// Polls BullMQ job status after upload, auto-redirects to /analyze/:id when ready.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/axiosInstance';

export default function UploadProgress({ jobId, documentId }) {
  const navigate = useNavigate();
  const [progress,   setProgress]   = useState(0);
  const [state,      setState]      = useState('waiting');
  const [failReason, setFailReason] = useState('');

  useEffect(() => {
    if (!jobId) return;

    let intervalId;

    async function poll() {
      try {
        const { data } = await api.get(`/jobs/${jobId}`);
        setState(data.state);
        setProgress(data.progress || 0);

        if (data.state === 'completed') {
          clearInterval(intervalId);

          // Pick up shareToken saved by Home.jsx before redirecting
          const shareToken = sessionStorage.getItem(`shareToken-${documentId}`);
          sessionStorage.removeItem(`shareToken-${documentId}`);

          setTimeout(() => {
            navigate(`/analyze/${documentId}`, {
              state: { shareToken: shareToken || null },
            });
          }, 600);
        }

        if (data.state === 'failed') {
          clearInterval(intervalId);
          setFailReason(data.failReason || 'Unknown error');
        }
      } catch (err) {
        console.error('[UploadProgress] Poll error:', err);
      }
    }

    poll();
    intervalId = setInterval(poll, 2000);
    return () => clearInterval(intervalId);
  }, [jobId, documentId, navigate]);

  const isFailed   = state === 'failed';
  const isComplete = state === 'completed';

  const label =
    isFailed   ? 'Processing failed'    :
    isComplete ? 'Ready! Redirecting…'  :
    state === 'active' ? 'Extracting text…' : 'Queued…';

  const hint =
    progress < 10 ? 'Starting OCR engine…'              :
    progress < 80 ? 'Extracting text from document…'    :
                    'Finalising…';

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {!isFailed && !isComplete && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          )}
          <span className={`text-sm font-medium ${
            isFailed   ? 'text-red-400'   :
            isComplete ? 'text-green-400' : 'text-slate-300'
          }`}>
            {label}
          </span>
        </div>
        <span className="text-slate-500 text-sm">{progress}%</span>
      </div>

      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isFailed   ? 'bg-red-500'   :
            isComplete ? 'bg-green-500' : 'bg-amber-400'
          }`}
          style={{ width: `${Math.max(progress, 4)}%` }}
        />
      </div>

      {!isFailed && !isComplete && (
        <p className="text-slate-500 text-xs mt-3">{hint}</p>
      )}
      {isFailed && (
        <p className="text-red-400 text-xs mt-3">{failReason}</p>
      )}
    </div>
  );
}