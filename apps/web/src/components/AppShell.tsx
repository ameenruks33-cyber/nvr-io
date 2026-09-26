'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearSession, getSession } from '@/lib/api';
import { useEffect, useState } from 'react';

const links = [
  { href: '/dashboard', label: 'Home' },
  { href: '/customers', label: 'People' },
  { href: '/loans', label: 'Records' },
  { href: '/repayments', label: 'Receipts' },
  { href: '/reports', label: 'Summary' },
  { href: '/notifications', label: 'Notes' },
  { href: '/users', label: 'Users' },
  { href: '/audit', label: 'Activity' },
  { href: '/settings', label: 'Settings' },
  { href: '/app', label: 'Install app' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [name, setName] = useState('');

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace('/login');
      return;
    }
    setName(session.user.name);
  }, [router]);

  function logout() {
    clearSession();
    router.replace('/login');
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl gap-6 px-4 py-6 md:px-8">
      <aside className="hidden w-56 shrink-0 flex-col rounded-2xl border border-white/10 bg-ink-900/80 p-4 md:flex">
        <div className="mb-8">
          <p className="font-display text-2xl text-white">NVR.io</p>
          <p className="mt-1 text-xs text-slate-400">Personal use</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {links.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? 'bg-accent/20 text-teal-200'
                    : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="truncate text-sm text-slate-300">{name}</p>
          <button
            type="button"
            onClick={logout}
            className="mt-2 text-xs text-slate-400 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
