import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export default function Navbar() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { isAuthenticated, user, logout, loading } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  const handleAnalyzeClick = () => {
    closeMenu();
    if (location.pathname === '/') {
      document.getElementById('upload')?.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate('/');
      setTimeout(() => {
        document.getElementById('upload')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  const handleLogout = () => {
    closeMenu();
    logout();
    navigate('/');
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/90 backdrop-blur border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">

          {/* Logo */}
          <Link
            to="/"
            onClick={() => { closeMenu(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className="flex items-center gap-2.5 flex-shrink-0"
          >
            <div className="w-8 h-8 bg-amber-400 rounded-lg flex items-center justify-center">
              <span className="text-slate-950 font-black text-sm">CC</span>
            </div>
            <span className="text-white font-bold text-lg tracking-tight">
              Clear<span className="text-amber-400">Clause</span>
            </span>
          </Link>

          {/* ── Desktop nav (sm and up) ── */}
          <div className="hidden sm:flex items-center gap-3">
            <button
              onClick={handleAnalyzeClick}
              className="text-sm font-medium bg-amber-400 text-slate-950 px-4 py-2 rounded-lg hover:bg-amber-300 transition-colors"
            >
              Analyze a Document
            </button>

            {!loading && (
              isAuthenticated ? (
                <>
                  <Link
                    to="/dashboard"
                    className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
                      location.pathname === '/dashboard'
                        ? 'text-amber-400 bg-amber-400/10'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    Dashboard
                  </Link>
                  <div className="flex items-center gap-2 pl-3 border-l border-slate-700">
                    <span className="text-slate-400 text-sm hidden md:block truncate max-w-[140px]">
                      {user?.email}
                    </span>
                    <button
                      onClick={handleLogout}
                      className="text-sm text-slate-400 hover:text-red-400 px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      Logout
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-sm font-medium text-slate-300 hover:text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="text-sm font-medium border border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    Sign up
                  </Link>
                </>
              )
            )}
          </div>

          {/* ── Mobile right side: CTA + hamburger ── */}
          <div className="flex sm:hidden items-center gap-2">
            <button
              onClick={handleAnalyzeClick}
              aria-label="Analyze a document"
              className="bg-amber-400 text-slate-950 font-semibold text-sm px-3 py-2 rounded-lg hover:bg-amber-300 active:bg-amber-500 transition-colors touch-manipulation"
            >
              <span className="hidden xs:inline">Analyze</span>
              <svg className="w-4 h-4 xs:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </button>

            {/* Hamburger */}
            <button
              onClick={() => setMenuOpen(v => !v)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 active:bg-slate-700 transition-colors touch-manipulation"
            >
              {menuOpen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>

        </div>
      </nav>

      {/* ── Mobile dropdown menu ── */}
      {menuOpen && (
        <>
          <div
            className="sm:hidden fixed inset-0 z-40 bg-slate-950/60"
            onClick={closeMenu}
            aria-hidden="true"
          />

          <div className="sm:hidden fixed top-16 left-0 right-0 z-40 bg-slate-900 border-b border-slate-800 shadow-xl">
            <div className="px-4 py-3 space-y-1">

              {!loading && (
                isAuthenticated ? (
                  <>
                    {user?.email && (
                      <div className="px-3 py-2 text-sm text-slate-500 truncate border-b border-slate-800 mb-2 pb-3">
                        {user.email}
                      </div>
                    )}

                    <Link
                      to="/dashboard"
                      onClick={closeMenu}
                      className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                        location.pathname === '/dashboard'
                          ? 'text-amber-400 bg-amber-400/10'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      </svg>
                      Dashboard
                    </Link>

                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors touch-manipulation"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/login"
                      onClick={closeMenu}
                      className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                      Login
                    </Link>
                    <Link
                      to="/register"
                      onClick={closeMenu}
                      className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                      Create account
                    </Link>
                  </>
                )
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}