export default function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950 py-6 sm:py-8 mt-16 sm:mt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-amber-400 rounded flex items-center justify-center flex-shrink-0">
            <span className="text-slate-950 font-black text-xs">Lx</span>
          </div>
          <span className="text-slate-400 text-sm text-center sm:text-left">
            ClearClause — Understand any legal document in plain English
          </span>
        </div>
        <p className="text-slate-600 text-xs text-center sm:text-right flex-shrink-0">
          Not legal advice. For informational purposes only.
        </p>
      </div>
    </footer>
  );
}