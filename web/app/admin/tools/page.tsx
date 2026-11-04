'use client';
// Duoi ranh gioi cat: trang an cho demo, khong co lien ket tren menu. CHI an o client; bao ve that o backend
// (ADMIN + DEMO_TOOLS=true). Chi lam sau khi PR hop dong co POST /api/admin/anomalies/detect da merge (spec web 2.2).
import { useEffect, useState, type FormEvent } from 'react';
import { Banner, btnCls, Card, Empty, inputCls } from '@/components/ui';
import { api } from '@/lib/api';
import { AuthGate, useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/errors';
import { formatVn, msToVnInput, vnInputToIso } from '@/lib/time';
import type { Alert } from '@/lib/types';

function Tools() {
  const { session } = useAuth();
  const [nowLocal, setNowLocal] = useState('');
  const [result, setResult] = useState<Alert[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [off, setOff] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => setNowLocal(msToVnInput(Date.now())), []);

  if (session.user.role !== 'ADMIN') return <main className="p-8"><Empty>Không tìm thấy trang</Empty></main>;

  async function run(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOff(false);
    setResult(null);
    setBusy(true);
    try {
      const r = await api<{ newAlerts: Alert[] }>('/api/admin/anomalies/detect', 'POST', { nowUtc: vnInputToIso(nowLocal) });
      setResult(r.newAlerts);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setOff(true);
      else setError(err);
    }
    setBusy(false);
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Card title="Công cụ demo — phát hiện bất thường">
        <form onSubmit={run} className="flex flex-wrap items-end gap-2 text-sm">
          <label className="flex flex-col">Thời điểm chạy (giờ VN)
            <input type="datetime-local" className={inputCls} value={nowLocal} required onChange={(e) => setNowLocal(e.target.value)} />
          </label>
          <button className={btnCls} disabled={busy}>Chạy phát hiện bất thường</button>
        </form>
        {off ? <p className="mt-3 text-sm text-amber-700">Công cụ demo đang tắt</p> : null}
        <Banner error={error} />
        {result ? (
          result.length === 0 ? <Empty>Không có cảnh báo mới.</Empty> : (
            <ul className="mt-3 text-sm">{result.map((a) => <li key={a.alertId}>#{a.alertId} {a.message} · {formatVn(a.createdAt)}</li>)}</ul>
          )
        ) : null}
      </Card>
    </main>
  );
}

export default function AdminToolsPage() {
  return <AuthGate><Tools /></AuthGate>;
}
