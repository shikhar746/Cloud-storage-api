import React, { useState } from 'react';
import { Cloud, Lock, Mail, User, ArrowRight, ShieldCheck, Database, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface AuthPageProps {
  onOpenSettings?: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onOpenSettings }) => {
  const { login, register, loginDemo, apiMode, baseUrl } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (mode === 'register') {
      if (name.trim().length < 2) {
        setErrorMessage('Name must be at least 2 characters long');
        return;
      }
      if (name.length > 50) {
        setErrorMessage('Name must be at most 50 characters long');
        return;
      }
    }

    if (!email || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoLogin = async () => {
    setSubmitting(true);
    try {
      await loginDemo();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to sign in to demo');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      id="auth-page-container"
      className="h-[100dvh] min-h-[100dvh] w-full bg-[#0a0a0a] flex flex-col justify-center items-center px-4 py-2 sm:py-4 md:py-6 overflow-x-hidden overflow-y-auto"
    >
      <div className="w-full max-w-sm sm:max-w-md my-auto flex flex-col items-center">
        {/* Header / Brand */}
        <div className="text-center mb-2 sm:mb-4">
          <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 mb-1.5 sm:mb-2.5 border border-indigo-400/20">
            <Cloud className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-tight">
            Cloud Storage API Client
          </h1>
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-400 leading-tight">
            Secure, high-availability object storage & directory explorer
          </p>
        </div>

        {/* Card */}
        <div className="w-full bg-[#111111] p-4 sm:p-6 shadow-2xl border border-[#1f1f1f] rounded-2xl">
          {/* Mode Switcher */}
          <div className="flex rounded-xl bg-[#161616] p-1 mb-3 sm:mb-4 border border-[#222222]">
            <button
              id="auth-tab-login"
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMessage(null);
              }}
              className={`w-1/2 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-[#222222] text-white shadow-xs'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              id="auth-tab-register"
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMessage(null);
              }}
              className={`w-1/2 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                mode === 'register'
                  ? 'bg-[#222222] text-white shadow-xs'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>

          {errorMessage && (
            <div
              id="auth-error-alert"
              className="mb-2.5 rounded-lg bg-red-950/30 p-2 sm:p-2.5 text-xs text-red-400 flex items-start gap-2 border border-red-800/40"
            >
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-2 sm:space-y-3">
            {mode === 'register' && (
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-500" />
                  </div>
                  <input
                    id="auth-input-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Alex Rivera"
                    className="block w-full rounded-xl border border-[#262626] bg-[#161616] pl-9 pr-3 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-100 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1">
                Email Address
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-500" />
                </div>
                <input
                  id="auth-input-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="block w-full rounded-xl border border-[#262626] bg-[#161616] pl-9 pr-3 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-100 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1">
                Password
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-500" />
                </div>
                <input
                  id="auth-input-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="block w-full rounded-xl border border-[#262626] bg-[#161616] pl-9 pr-3 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-100 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <button
              id="auth-submit-btn"
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2 sm:py-2.5 px-4 text-xs sm:text-sm font-semibold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#111111] transition-colors disabled:opacity-50 mt-1 sm:mt-2 cursor-pointer"
            >
              {submitting ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="relative my-2.5 sm:my-3.5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#1f1f1f]" />
            </div>
            <div className="relative flex justify-center text-[10px] sm:text-xs uppercase">
              <span className="bg-[#111111] px-2 text-gray-500 font-medium">or evaluate instantly</span>
            </div>
          </div>

          <button
            id="auth-demo-btn"
            type="button"
            onClick={handleDemoLogin}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-[#262626] bg-[#161616] py-1.5 sm:py-2 px-4 text-xs sm:text-sm font-medium text-gray-200 hover:bg-[#1c1c1c] hover:text-white transition-colors cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Continue with Demo Workspace</span>
          </button>

          {/* Backend target status banner */}
          <div className="mt-2.5 pt-2 sm:mt-3.5 sm:pt-2.5 border-t border-[#1f1f1f] flex items-center justify-between text-[11px] sm:text-xs text-gray-500">
            <div className="flex items-center gap-1.5 truncate mr-2">
              <Database className="w-3.5 h-3.5 text-gray-500 shrink-0" />
              <span className="shrink-0">Target:</span>
              <span className="font-semibold text-gray-300 truncate">
                {apiMode === 'live' ? baseUrl : 'Sandbox Mode (Local)'}
              </span>
            </div>
            {onOpenSettings && (
              <button
                id="auth-settings-btn"
                type="button"
                onClick={onOpenSettings}
                className="text-indigo-400 hover:text-indigo-300 hover:underline font-medium shrink-0 cursor-pointer"
              >
                Change
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
