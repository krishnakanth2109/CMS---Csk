import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');

  const { login } = useAuth();
  const navigate  = useNavigate();

  // ─────────────────────────────────────────────────────────────────────────
  // getFriendlyError
  //
  // Firebase REST API error codes come in via err.code (set in AuthContext).
  // Backend errors come in via err.message (plain string from JSON response).
  //
  // Both paths are handled here.
  // ─────────────────────────────────────────────────────────────────────────
  const getFriendlyError = (err) => {
    const code = (err.code || err.message || '').toUpperCase();

    if (
      code.includes('INVALID_LOGIN_CREDENTIALS') ||
      code.includes('INVALID_PASSWORD')          ||
      code.includes('EMAIL_NOT_FOUND')           ||
      code.includes('INVALID_EMAIL')             ||
      code.includes('WRONG_PASSWORD')
    ) return 'Invalid email or password.';

    if (
      code.includes('TOO_MANY_ATTEMPTS_TRY_LATER') ||
      code.includes('TOO_MANY_REQUESTS')
    ) return 'Too many failed attempts. Please try again later.';

    if (code.includes('USER_DISABLED'))
      return 'This account has been disabled. Contact support.';

    if (
      code.includes('NETWORK_REQUEST_FAILED') ||
      code.includes('FAILED TO FETCH')        ||
      code.includes('NETWORKERROR')
    ) return 'Network error. Please check your connection and try again.';

    // Backend-specific messages — show them directly (they're user-safe strings)
    // e.g. "User not registered. Contact admin." / "Account deactivated."
    return err.message || 'Something went wrong. Please try again.';
  };

  // ─────────────────────────────────────────────────────────────────────────
  // handleSubmit
  //
  // Login.jsx fully owns the loading state. AuthContext.login() is a pure
  // async function that throws on failure and resolves on success.
  //
  // Flow:
  //   setLoading(true)
  //   → await login()         (may throw)
  //   → on success: navigate
  //   → on error:  setError() → shown in UI
  //   → finally:   setLoading(false) — safe because no AuthProvider re-render
  // ─────────────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');    // clear any previous error
    setLoading(true);

    try {
      const user = await login(email, password);

      // Navigate based on role — admin & manager go to dashboard
      if (user?.role === 'admin' || user?.role === 'manager') {
        navigate('/admin');
      } else {
        navigate('/recruiter');
      }

    } catch (err) {
      // FIX: setError is called BEFORE setLoading(false) in finally.
      // React batches both into ONE render, so the error banner
      // appears at the same time the spinner disappears. No flash.
      setError(getFriendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-white">

      {/* ── Left Side: Branding ───────────────────────────────────────────── */}
      <div className="hidden lg:flex w-1/2 bg-zinc-900 relative overflow-hidden items-center justify-center p-12 text-white">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')",
          }}
        />
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600/30 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-purple-600/20 blur-3xl" />

        <div className="relative z-10 max-w-lg space-y-8">
          <div className="w-20 h-20 bg-white/10 backdrop-blur-md flex items-center justify-center shadow-2xl border border-white/10">
            <img
              src="https://image2url.com/images/1764921567560-55d1b6d6-49f3-4473-82e3-1cdd2f7c19c2.jpg"
              alt="Brand Logo"
              className="w-12 h-12 object-contain"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>

          <h1 className="text-5xl font-extrabold tracking-tight leading-tight">
            Streamline Your <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
              Hiring Process
            </span>
          </h1>

          <p className="text-lg text-zinc-300 leading-relaxed">
            The all-in-one dashboard for modern recruiters. Manage candidates, track interviews,
            and analyze performance in one place.
          </p>

          <div className="space-y-4 pt-4">
            {['Smart Candidate Tracking', 'Real-time Analytics', 'Seamless Scheduling'].map((item) => (
              <div key={item} className="flex items-center gap-3 text-zinc-300">
                <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0" />
                <span className="font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right Side: Form ──────────────────────────────────────────────── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md space-y-8">

          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900">Welcome back</h2>
            <p className="text-zinc-500">Please enter your details to sign in.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* ── Error Banner ── */}
            {error && (
              <div
                role="alert"
                className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded"
              >
                {error}
              </div>
            )}

            {/* ── Email ── */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-zinc-700">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                required
                disabled={loading}
                className="w-full h-12 px-4 border border-zinc-200 bg-zinc-50 text-zinc-900 placeholder-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all disabled:opacity-50"
              />
            </div>

            {/* ── Password ── */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-zinc-700">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  required
                  disabled={loading}
                  className="w-full h-12 px-4 pr-11 border border-zinc-200 bg-zinc-50 text-zinc-900 placeholder-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* ── Forgot password ── */}
            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-sm font-medium text-blue-600 hover:text-blue-500 hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            {/* ── Submit ── */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-base font-medium shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 group disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* ── Footer ── */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-zinc-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-zinc-400">Protected by RecruiterHub Security</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}