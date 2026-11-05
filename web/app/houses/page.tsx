'use client';
// Danh sach nha; chi co mot nha thi vao thang dashboard; tao nha (spec web 2.2).
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Banner, btnCls, btnGhostCls, Card, Empty, fieldError, inputCls, Loading } from '@/components/ui';
import { api } from '@/lib/api';
import { NAME_PATTERN } from '@/lib/form';
import { useAuth } from '@/lib/auth';
import { singleActiveHouse } from '@/lib/houses';
import type { House } from '@/lib/types';

export default function HousesPage() {
  const router = useRouter();
  const { session, logout } = useAuth();
  const [houses, setHouses] = useState<House[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [form, setForm] = useState({ name: '', address: '' });
  const [formError, setFormError] = useState<unknown>(null);

  const load = useCallback(async (redirectSingle: boolean) => {
    try {
      const list = await api<House[]>('/api/houses');
      setHouses(list);
      setError(null);
      const single = redirectSingle ? singleActiveHouse(list) : null;
      if (single) router.replace(`/houses/${single.houseId}`);
    } catch (e) {
      setError(e);
    }
  }, [router]);

  useEffect(() => {
    // Vao thang dashboard khi chi co mot nha, tru khi bam link "xem danh sach" o dau trang (khong thi khong toi duoc form tao nha).
    void load(!new URLSearchParams(window.location.search).has('all')).catch(() => {});
  }, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    try {
      await api<House>('/api/houses', 'POST', { name: form.name, address: form.address || null });
      setForm({ name: '', address: '' });
      setFormError(null);
      await load(false);
    } catch (err) {
      setFormError(err);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Nhà yến của {session.user.fullName}</h1>
        <button className={btnGhostCls} onClick={() => logout()}>Đăng xuất</button>
      </header>
      <Banner error={error} onRetry={() => load(false)} />
      {houses === null && !error ? <Loading /> : null}
      {houses && houses.length === 0 ? <Empty>Chưa có nhà nào.</Empty> : null}
      <ul className="mb-6 grid gap-3">
        {houses?.map((h) => (
          <li key={h.houseId}>
            <Link href={`/houses/${h.houseId}`} className="block rounded-lg border border-stone-200 bg-white p-4 hover:border-emerald-600">
              <span className="font-medium">{h.name}</span>
              <span className="ml-2 text-sm text-stone-500">{h.address ?? ''}</span>
              {!h.isActive ? <span className="ml-2 text-xs text-stone-500">(ngừng dùng)</span> : null}
            </Link>
          </li>
        ))}
      </ul>
      <Card title="Tạo nhà mới">
        <form onSubmit={create} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-sm">Tên
            <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={100} pattern={NAME_PATTERN} title="Tên không được để trống" />
            <span className="text-xs text-red-700">{fieldError(formError, 'name')}</span>
          </label>
          <label className="flex flex-col text-sm">Địa chỉ
            <input className={inputCls} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} maxLength={255} />
          </label>
          <button className={btnCls}>Tạo</button>
        </form>
        <Banner error={formError} />
      </Card>
    </main>
  );
}
