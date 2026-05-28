export default function UploadProgress({ progress, filename }) {
  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 sm:w-10 h-9 sm:h-10 bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          {/* Filename truncates gracefully on narrow screens */}
          <p className="text-slate-200 font-medium text-sm truncate max-w-[200px] sm:max-w-none">
            {filename}
          </p>
          <p className="text-slate-500 text-xs">
            {progress < 100 ? `Uploading… ${progress}%` : 'Processing with AI…'}
          </p>
        </div>
        {/* Percentage badge on the right */}
        <span className="text-amber-400 text-xs font-semibold tabular-nums flex-shrink-0">
          {progress}%
        </span>
      </div>

      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full bg-amber-400 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {progress >= 100 && (
        <p className="text-slate-500 text-xs mt-3 text-center animate-pulse">
          Analyzing document with AI — this takes about 10–20 seconds…
        </p>
      )}
    </div>
  );
}