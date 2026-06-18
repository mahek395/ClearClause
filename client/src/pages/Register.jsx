import { useState } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

export default function Register() {
  const navigate = useNavigate();
  const { register, isAuthenticated, loading } = useAuth();

  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [confirm,    setConfirm]    = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
        Loading…
      </div>
    );
  }

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    try {
      setSubmitting(true);
      await register(email, password);
      toast.success('Account created! Welcome to ClearClause.');
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 sm:px-6 py-12">
      <div className="w-full max-w-md">

        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white mb-6 sm:mb-8 transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Home
        </Link>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl">
          <div className="mb-6 sm:mb-8">
            {/* "Create Account" is 14 chars — text-4xl overflows 360px phones */}
            <h1 className="text-3xl sm:text-4xl font-black text-white mb-2 sm:mb-3">Create Account</h1>
            <p className="text-slate-400 text-sm sm:text-base">
              Start understanding your legal documents instantly.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <div>
              <label className="block text-sm text-slate-300 mb-2" htmlFor="reg-email">
                Email Address
              </label>
              <input
                id="reg-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl sm:rounded-2xl px-4 py-3 text-white text-base outline-none focus:border-amber-400 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-2" htmlFor="reg-password">
                Password
              </label>
              <input
                id="reg-password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl sm:rounded-2xl px-4 py-3 text-white text-base outline-none focus:border-amber-400 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-2" htmlFor="reg-confirm">
                Confirm Password
              </label>
              <input
                id="reg-confirm"
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className={`
                  w-full bg-slate-800 border rounded-xl sm:rounded-2xl px-4 py-3 text-white text-base outline-none transition-colors
                  ${confirm && confirm !== password
                    ? 'border-red-500/50 focus:border-red-400'
                    : 'border-slate-700 focus:border-amber-400'
                  }
                `}
              />
              {confirm && confirm !== password && (
                <p className="text-red-400 text-xs mt-1.5 ml-1">Passwords don't match</p>
              )}
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl sm:rounded-2xl px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 font-black py-3.5 rounded-xl sm:rounded-2xl transition-all disabled:opacity-50 touch-manipulation text-base"
            >
              {submitting ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p className="text-slate-500 text-sm mt-6 sm:mt-8 text-center">
            Already have an account?{' '}
            <Link to="/login" className="text-amber-400 hover:text-amber-300 font-semibold">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}