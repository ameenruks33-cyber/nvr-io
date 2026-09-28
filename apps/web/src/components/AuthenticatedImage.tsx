'use client';

import { useEffect, useState } from 'react';
import { getSession } from '@/lib/api';

export function AuthenticatedImage({
  storageKey,
  alt,
  className,
}: {
  storageKey: string;
  alt: string;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  useEffect(() => {
    const session = getSession();
    if (!session || !storageKey) return;
    let objectUrl: string | null = null;
    let cancelled = false;

    fetch(`${apiBase}/documents/by-storage/${storageKey}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load image');
        return r.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [apiBase, storageKey]);

  if (!src) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-50 text-slate-500 ${className || ''}`}
      >
        No photo
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} />;
}
