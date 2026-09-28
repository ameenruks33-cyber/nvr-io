'use client';

import { FormEvent, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, setSession } from '@/lib/api';
import { APP_ICONS } from '@/lib/app-branding';
import { APP_NAME } from '@/lib/brand';
import { BrandWordmark } from '@/components/BrandWordmark';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showInstall, setShowInstall] = useState(false);

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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await api<{
        accessToken: string;
        refreshToken: string;
        user: { id: string; name: string; email: string; role: string };
      }>('/auth/login', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ email, password }),
      });
      setSession(data);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex flex-col items-center text-center">
          <Image
            src={APP_ICONS.logo}
            alt={APP_NAME}
            width={112}
            height={112}
            className="rounded-3xl bg-white p-2 shadow-lg shadow-red-500/25"
            unoptimized
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
      </div>
    </div>
  );
}
