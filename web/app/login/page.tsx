'use client';
// Dang nhap (spec web 2.1). Sai mat khau va tai khoan bi khoa cung mot cau.
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { btnCls, errorText, inputCls } from '@/components/ui';
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
  const [error, setError] = useState<string | null>(null);
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
      setError(err instanceof ApiError && err.status === 401 ? 'Sai tên đăng nhập hoặc mật khẩu' : errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto mt-24 max-w-sm rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
      <h1 className="mb-4 text-xl font-semibold">SwiftletCare — Đăng nhập</h1>
      {notice ? <p className="mb-3 text-sm text-amber-700">{notice}</p> : null}
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">Tên đăng nhập
          <input className={inputCls} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
        </label>
        <label className="flex flex-col gap-1 text-sm">Mật khẩu
          <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        <button className={btnCls} disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
      </form>
    </main>
  );
}
