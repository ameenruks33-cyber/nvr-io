'use client';

import { useEffect, useState } from 'react';
import { apiBlob, getSession } from '@/lib/api';

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

  useEffect(() => {
    if (!getSession() || !storageKey) return;
    let objectUrl: string | null = null;
    let cancelled = false;

    apiBlob(`/documents/by-storage/${storageKey}`)
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
  }, [storageKey]);

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
