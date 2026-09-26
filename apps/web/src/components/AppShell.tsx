'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { clearSession, getSession } from '@/lib/api';
import { APP_ICONS } from '@/lib/app-branding';
import { isMobileAppSurface } from '@/lib/mobile-app';
import { useEffect, useMemo, useState } from 'react';

type NavLink = {
  href: string;
  label: string;
  desktopOnly?: boolean;
  /** Only Super Admin sees this item */
  superAdminOnly?: boolean;
  /** Only mobile app / phone — hidden on desktop website */
  mobileAppOnly?: boolean;
};

const links: NavLink[] = [
  { href: '/dashboard', label: 'Home' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/collections', label: 'Collection' },
  { href: '/customers', label: 'People' },
  { href: '/loans', label: 'Records' },
  { href: '/repayments', label: 'Receipts' },
  { href: '/reports', label: 'Summary' },
  { href: '/notifications', label: 'Notes' },
  { href: '/users', label: 'Users', superAdminOnly: true },
  { href: '/audit', label: 'Activity', superAdminOnly: true, desktopOnly: true },
  { href: '/settings', label: 'Settings', superAdminOnly: true },
  { href: '/updates', label: 'Updates', mobileAppOnly: true },
  { href: '/app', label: 'Install' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobileApp, setIsMobileApp] = useState(false);

  const isSuperAdmin = role === 'SUPER_ADMIN';

  const visibleLinks = useMemo(
    () =>
      links.filter((link) => {
        if (link.superAdminOnly && !isSuperAdmin) return false;
        if (link.mobileAppOnly && !isMobileApp) return false;
        return true;
      }),
    [isSuperAdmin, isMobileApp],
  );

  const mobileMenuLinks = useMemo(
    () => visibleLinks.filter((l) => !l.desktopOnly),
    [visibleLinks],
  );

  const mobileBottomLinks = useMemo(() => {
    const base = [
      { href: '/dashboard', label: 'Home' },
      { href: '/collections', label: 'Collect' },
      { href: '/customers', label: 'People' },
    ];
    if (isSuperAdmin) {
      return [...base, { href: '/settings', label: 'Settings' }];
    }
    return [...base, { href: '/gallery', label: 'Gallery' }];
  }, [isSuperAdmin]);

  useEffect(() => {
    setIsMobileApp(isMobileAppSurface());
    const session = getSession();
    if (!session) {
      router.replace('/login');
      return;
    }
    setName(session.user.name);
    setRole(session.user.role || '');
  }, [router, pathname]);

  function logout() {
    clearSession();
    router.replace('/login');
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-4 px-3 pb-24 pt-4 md:flex-row md:gap-6 md:px-8 md:pb-6 md:pt-6">
      <header className="flex items-center justify-between rounded-2xl border border-white/10 bg-ink-900/90 px-3 py-2 md:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image
            src={APP_ICONS.logo}
            alt="NVR.io"
            width={40}
            height={40}
            className="rounded-xl"
            unoptimized
            priority
          />
          <span className="font-display text-xl text-white">NVR.io</span>
        </Link>
        <button
          type="button"
          className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
        >
          Menu
        </button>
      </header>

      {menuOpen ? (
        <nav className="rounded-2xl border border-white/10 bg-ink-900/95 p-3 md:hidden">
          <div className="grid grid-cols-2 gap-1">
            {mobileMenuLinks.map((link) => {
              const active = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={`rounded-lg px-3 py-2.5 text-sm ${
                    active
                      ? 'bg-blue-600/25 text-blue-100'
                      : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
            <p className="truncate text-sm text-slate-300">{name}</p>
            <button
              type="button"
              onClick={logout}
              className="text-xs text-slate-400 hover:text-white"
            >
              Sign out
            </button>
          </div>
        </nav>
      ) : null}

      <aside className="hidden w-56 shrink-0 flex-col rounded-2xl border border-white/10 bg-ink-900/80 p-4 md:flex">
        <div className="mb-8 flex items-center gap-3">
          <Image
            src={APP_ICONS.logo}
            alt="NVR.io"
            width={48}
            height={48}
            className="rounded-xl"
            unoptimized
            priority
          />
          <div>
            <p className="font-display text-2xl text-white">NVR.io</p>
            <p className="text-xs text-slate-400">
              {isSuperAdmin ? 'Super admin' : 'Personal use'}
            </p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {visibleLinks.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? 'bg-blue-600/25 text-blue-100'
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

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink-950/95 px-2 py-2 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-lg justify-around">
          {mobileBottomLinks.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`min-w-[4.5rem] rounded-xl px-2 py-2 text-center text-xs ${
                  active ? 'bg-blue-600/30 text-blue-100' : 'text-slate-400'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
