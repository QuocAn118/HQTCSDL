'use client';
// Anh thien dich: fetch kem token -> blob -> object URL; thu hoi khi doi anh hoac unmount (spec web 2.4, hop dong 3.3).
import { useEffect, useState } from 'react';
import { fetchBlob } from '@/lib/api';

export function SnapshotImage({ alertId }: { alertId: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'none' | 'error' | 'ok'>('loading');

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    setState('loading');
    setUrl(null);
    fetchBlob(`/api/alerts/${alertId}/snapshot`)
      .then((blob) => {
        if (cancelled) return;
        if (!blob) {
          setState('none');
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
        setState('ok');
      })
      .catch(() => !cancelled && setState('error'));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [alertId]);

  if (state === 'loading') return <p className="text-sm text-stone-500">Đang tải ảnh…</p>;
  if (state === 'none') return <p className="text-sm text-stone-500">Không có ảnh</p>;
  if (state === 'error' || !url) return <p className="text-sm text-red-700">Không tải được ảnh</p>;
  // eslint-disable-next-line @next/next/no-img-element -- object URL, khong qua toi uu anh cua Next
  return <img src={url} alt={`Ảnh cảnh báo ${alertId}`} className="max-h-80 rounded border" />;
}
