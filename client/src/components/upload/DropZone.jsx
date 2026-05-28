import { useState, useRef, useCallback } from 'react';

export default function DropZone({ onFileSelect, isLoading }) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const validateFile = (file) => {
    if (!file) return 'No file selected.';
    if (file.type !== 'application/pdf') return 'Only PDF files are supported.';
    if (file.size > 20 * 1024 * 1024) return 'File must be under 20MB.';
    return null;
  };

  const handleFile = (file) => {
    const err = validateFile(file);
    if (err) { setError(err); return; }
    setError('');
    onFileSelect(file);
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }, []);

  const onDragOver  = (e) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onInputChange = (e) => handleFile(e.target.files[0]);

  return (
    <div className="w-full">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !isLoading && fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload PDF — click or drag and drop"
        onKeyDown={(e) => e.key === 'Enter' && !isLoading && fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-2xl
          px-6 py-8 sm:p-12
          text-center cursor-pointer
          transition-all duration-200 group
          ${isDragging
            ? 'border-amber-400 bg-amber-400/5 scale-[1.01]'
            : 'border-slate-700 hover:border-slate-500 bg-slate-900/50 hover:bg-slate-900'
          }
          ${isLoading ? 'pointer-events-none opacity-60' : ''}
        `}
      >
        {/* Upload icon */}
        <div className={`
          mx-auto w-14 sm:w-16 h-14 sm:h-16 rounded-2xl flex items-center justify-center mb-4 sm:mb-5 transition-colors
          ${isDragging ? 'bg-amber-400/20' : 'bg-slate-800 group-hover:bg-slate-700'}
        `}>
          {isLoading ? (
            <svg className="w-6 sm:w-7 h-6 sm:h-7 text-amber-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          ) : (
            <svg
              className={`w-6 sm:w-7 h-6 sm:h-7 ${isDragging ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-300'}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          )}
        </div>

        {/* Text */}
        {isLoading ? (
          <p className="text-slate-300 font-medium text-sm sm:text-base">
            Uploading & analyzing your document…
          </p>
        ) : (
          <>
            <p className="text-slate-200 font-semibold text-base sm:text-lg mb-1">
              {isDragging ? 'Drop it here' : 'Drop your PDF here'}
            </p>
            {/* Hide the sub-text on very small screens to keep the zone tidy */}
            <p className="text-slate-500 text-sm mb-4 hidden xs:block">or click to browse files</p>

            {/* Choose PDF button — large tap target */}
            <span className="inline-block px-5 py-2.5 bg-amber-400 text-slate-950 text-sm font-semibold rounded-lg touch-manipulation">
              Choose PDF
            </span>

            <p className="text-slate-600 text-xs mt-4">
              Supports text PDFs and scanned documents · Max 20MB
            </p>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={onInputChange}
        />
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2.5">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}
    </div>
  );
}