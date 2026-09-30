'use client';

import { useEffect, useState } from 'react';
import { apiBlob, getSession } from '@/lib/api';

export function CustomerPhoto({
  customerId,
  version,
  alt,
  className,
}: {
  customerId: string;
  /** Changes whenever a new photo is uploaded so the image reloads. */
  version?: string | null;
  alt: string;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getSession() || !customerId) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    setLoading(true);

    apiBlob(`/customers/${customerId}/photo`)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [customerId, version]);

  if (!src) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-50 text-slate-500 ${className || ''}`}
      >
        {loading ? 'Loading…' : 'No photo'}
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} />;
}
