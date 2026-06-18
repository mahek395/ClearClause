import { useState } from 'react';
import { Download, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../utils/axiosInstance';

export default function ExportButton({ documentId, filename }) {
  const [status,   setStatus]   = useState('idle'); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState('');

  const handleExport = async () => {
    if (status === 'loading') return;

    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await api.get(`/documents/${documentId}/export`, {
        responseType: 'blob',
      });

      const url = URL.createObjectURL(res.data);
      const safeName = (filename || 'Summary')
        .replace(/\.pdf$/i, '')
        .replace(/[^a-zA-Z0-9_\-\s]/g, '')
        .trim()
        .replace(/\s+/g, '_');

      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `ClearClause_${safeName}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);

      setStatus('success');
      setTimeout(() => setStatus('idle'), 2500);

    } catch (err) {
      console.error('[ExportButton]', err);
      const msg = err.response?.data?.error || err.message || 'Something went wrong';
      setErrorMsg(msg);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 4000);
    }
  };

  const states = {
    idle: {
      label: 'Export PDF',
      icon:  <Download size={15} />,
      cls:   'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white',
    },
    loading: {
      label: 'Generating…',
      icon:  <Loader2 size={15} className="animate-spin" />,
      cls:   'bg-blue-600 text-white opacity-70 cursor-not-allowed',
    },
    success: {
      label: 'Downloaded!',
      icon:  <CheckCircle size={15} />,
      cls:   'bg-green-600 text-white cursor-default',
    },
    error: {
      label: 'Export failed',
      icon:  <AlertCircle size={15} />,
      cls:   'bg-red-100 text-red-700 border border-red-300 cursor-default',
    },
  };

  const s = states[status];

  return (
    <div className="inline-flex flex-col items-start gap-1.5">
      <button
        onClick={handleExport}
        disabled={status === 'loading' || status === 'success'}
        aria-label="Export document analysis as PDF"
        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
          transition-colors duration-150 shadow-sm select-none touch-manipulation ${s.cls}`}
      >
        {s.icon}
        {s.label}
      </button>
      {status === 'error' && errorMsg && (
        <p className="text-xs text-red-500 max-w-[200px] sm:max-w-xs">{errorMsg}</p>
      )}
    </div>
  );
}