import { useState } from 'react';
import toast from 'react-hot-toast';

export default function ShareButton({ shareToken }) {
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}/share/${shareToken}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // fallback for older browsers
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }

    toast.success('Share link copied!');
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // On mobile, try the native share sheet first (works on iOS Safari, Android Chrome)
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'LexSimple Report', url: shareUrl });
        return;
      } catch (err) {
        // User cancelled the share sheet — fall through to clipboard copy
        if (err.name === 'AbortError') return;
      }
    }
    handleCopy();
  };

  return (
    <button
      onClick={handleShare}
      aria-label={copied ? 'Link copied' : 'Share report'}
      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium
        transition-all touch-manipulation
        ${copied
          ? 'border-green-500/40 text-green-400'
          : 'border-slate-700 text-slate-300 hover:border-amber-400 hover:text-amber-400'
        }`}
    >
      {copied ? (
        <>
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Copied!</span>
        </>
      ) : (
        <>
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
            />
          </svg>
          {/* Shorter label saves space when buttons are wrapping on mobile */}
          <span>Share</span>
        </>
      )}
    </button>
  );
}