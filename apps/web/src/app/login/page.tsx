'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, AuthSession, setSession } from '@/lib/api';
import { APP_NAME } from '@/lib/brand';
import { BrandWordmark } from '@/components/BrandWordmark';
import { OtpCodeInput } from '@/components/OtpCodeInput';
import { SpinningLogo } from '@/components/SpinningLogo';

type OtpChallenge = {
  otpRequired: true;
  challengeId: string;
  phoneHint: string;
};

type LoginResponse = AuthSession | OtpChallenge;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [code, setCode] = useState('');
  const [otpStatus, setOtpStatus] = useState<{
    text: string;
    tone?: 'error' | 'success';
  } | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean(
        (navigator as Navigator & { standalone?: boolean }).standalone,
      );
    setShowInstall(!standalone);
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js');
    }
  }, []);

  async function requestLogin() {
    const data = await api<LoginResponse>('/auth/login', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ email, password }),
    });
    if ('otpRequired' in data) {
      setChallenge(data);
      setCode('');
      setOtpStatus({ text: `Code sent by WhatsApp to ${data.phoneHint}.` });
      return;
    }
    setSession(data);
    router.push('/dashboard');
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await requestLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    if (!challenge || loading) return;
    if (!/^\d{6}$/.test(code)) {
      setOtpStatus({ text: 'Code must contain 6 digits.', tone: 'error' });
      return;
    }
    setLoading(true);
    try {
      const data = await api<AuthSession>('/auth/login/verify', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ challengeId: challenge.challengeId, code }),
      });
      setOtpStatus({ text: 'Code verified.', tone: 'success' });
      setSession(data);
      router.push('/dashboard');
    } catch (err) {
      setCode('');
      setOtpStatus({
        text: err instanceof Error ? err.message : 'Invalid code.',
        tone: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    setLoading(true);
    try {
      await requestLogin();
    } catch (err) {
      setOtpStatus({
        text: err instanceof Error ? err.message : 'Could not resend the code.',
        tone: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  function backToPassword() {
    setChallenge(null);
    setCode('');
    setOtpStatus(null);
    setPassword('');
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex flex-col items-center text-center">
          <SpinningLogo
            size={112}
            className="rounded-3xl p-2 shadow-lg shadow-red-500/25"
            priority
          />
          <div className="mt-4">
            <BrandWordmark size="lg" onDark />
          </div>
          <p className="mt-2 text-sm text-slate-500">Secure staff login</p>
        </div>

        {showInstall ? (
          <Link
            href="/app"
            className="mt-6 flex w-full items-center justify-center rounded-lg border border-blue-400/40 bg-blue-100 px-4 py-3.5 text-center text-sm font-medium text-blue-700 hover:bg-blue-100"
          >
            Install {APP_NAME} on this phone
          </Link>
        ) : null}

        {challenge ? (
          <div className="mt-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Enter WhatsApp code
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                We sent a 6-digit code to your WhatsApp {challenge.phoneHint}. It
                expires in 5 minutes.
              </p>
            </div>
            <OtpCodeInput
              value={code}
              onChange={(next) => {
                setCode(next);
                setOtpStatus(null);
              }}
              onSubmit={verifyCode}
              disabled={loading}
              status={otpStatus}
            />
            <button
              type="button"
              onClick={verifyCode}
              disabled={loading || code.length !== 6}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition hover:bg-blue-500 disabled:opacity-60"
            >
              {loading ? 'Checking…' : 'Verify'}
            </button>
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={backToPassword}
                disabled={loading}
                className="text-slate-500 hover:text-slate-800"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={resendCode}
                disabled={loading}
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                Resend code
              </button>
            </div>
          </div>
        ) : (
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block text-sm">
            <span className="text-slate-600">Email / username</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 outline-none ring-blue-500 focus:ring-2"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              inputMode="email"
              placeholder="you@example.com"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Password</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 outline-none ring-blue-500 focus:ring-2"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Your password"
            />
          </label>
          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition hover:bg-blue-500 disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        )}
      </div>
    </div>
  );
}
