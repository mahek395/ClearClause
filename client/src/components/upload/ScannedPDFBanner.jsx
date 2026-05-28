export default function ScannedPDFBanner() {
  return (
    <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-3.5">
      <span className="text-lg flex-shrink-0 mt-0.5">📄</span>
      <div>
        <p className="text-blue-300 font-medium text-sm">Scanned document detected</p>
        <p className="text-blue-400/70 text-xs mt-0.5">
          OCR (Optical Character Recognition) was used to extract text from this scanned PDF.
          Analysis accuracy may vary slightly depending on scan quality.
        </p>
      </div>
    </div>
  );
}