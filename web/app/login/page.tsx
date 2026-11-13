'use client';
// Dang nhap (spec web 2.1). Sai mat khau va tai khoan bi khoa cung mot cau.
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { IconClock, IconHouse } from '@/components/icons';
import { Banner, btnCls, inputCls } from '@/components/ui';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { loadSession, saveSession, sessionFromLogin } from '@/lib/session';
import type { LoginResponse } from '@/lib/types';

const REASONS: Record<string, string> = {
  expired: 'Phiên đã hết hạn, vui lòng đăng nhập lại.',
  unauthorized: 'Phiên không còn hợp lệ, vui lòng đăng nhập lại.',
};

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loadSession()) {
      router.replace('/houses');
      return;
    }
    const reason = new URLSearchParams(window.location.search).get('reason');
    setNotice(reason ? REASONS[reason] ?? null : null);
  }, [router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<LoginResponse>('/api/auth/login', 'POST', { username, password });
      saveSession(sessionFromLogin(res));
      router.replace('/houses');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="glass w-full max-w-md rounded-2xl p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <IconHouse className="size-10 shrink-0 text-emerald-700" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">SwiftletCare</h1>
            <p className="text-base text-slate-700">Giám sát và điều khiển nhà yến</p>
          </div>
        </div>
        {/* Vung status luon co san de trinh doc man hinh doc thong bao khi no xuat hien. */}
        <div role="status">
          {notice ? (
            <p className="mb-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-base text-amber-900">
              <IconClock className="mt-0.5 size-5 shrink-0 text-amber-800" />
              {notice}
            </p>
          ) : null}
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-base font-medium text-slate-800">Tên đăng nhập
            <input className={inputCls} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
          </label>
          <label className="flex flex-col gap-1.5 text-base font-medium text-slate-800">Mật khẩu
            <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </label>
          <Banner error={error} message={error instanceof ApiError && error.status === 401 ? 'Sai tên đăng nhập hoặc mật khẩu' : undefined} />
          <button className={`${btnCls} mt-1`} disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
        </form>
      </div>
    </main>
  );
}
