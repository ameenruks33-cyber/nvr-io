'use client';

import { FormEvent, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { api, setSession } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-ink-900/90 p-6 shadow-2xl sm:p-8">
        <div className="flex flex-col items-center text-center">
          <Image
            src="/logo.jpg"
            alt="NVR.io"
            width={112}
            height={112}
            className="rounded-3xl shadow-lg shadow-blue-500/20"
            priority
          />
          <p className="mt-4 font-display text-3xl text-white">NVR.io</p>
          <p className="mt-1 text-sm text-slate-400">Secure staff login</p>
        </div>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <label className="block text-sm">
            <span className="text-slate-300">Email / username</span>
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-3 outline-none ring-blue-500 focus:ring-2"
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
            <span className="text-slate-300">Password</span>
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-3 outline-none ring-blue-500 focus:ring-2"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Your password"
            />
          </label>
          {error ? (
            <p className="text-sm text-red-300" role="alert">
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
