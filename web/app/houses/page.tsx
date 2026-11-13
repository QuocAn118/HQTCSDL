'use client';
// Danh sach nha; chi co mot nha thi vao thang dashboard; tao nha (spec web 2.2).
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { IconHouse, IconLogout, IconPower } from '@/components/icons';
import { Banner, btnCls, btnGhostCls, Card, Empty, fieldError, inputCls, Loading, Pill } from '@/components/ui';
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
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <header className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-slate-900">Danh sách nhà</h1>
          <p className="text-base text-slate-700">Tài khoản: {session.user.fullName}</p>
        </div>
        <button className={btnGhostCls} onClick={() => logout()}><IconLogout className="size-5" />Đăng xuất</button>
      </header>
      <Banner error={error} onRetry={() => load(false)} />
      {houses === null && !error ? <Loading /> : null}
      {houses && houses.length === 0 ? <Empty>Chưa có nhà nào.</Empty> : null}
      <ul className="mb-6 grid gap-4 sm:grid-cols-2">
        {houses?.map((h) => (
          <li key={h.houseId}>
            <Link href={`/houses/${h.houseId}`} className="glass flex h-full items-start gap-3 rounded-2xl p-5 transition-shadow hover:ring-2 hover:ring-emerald-700/50">
              <IconHouse className="mt-0.5 size-6 shrink-0 text-emerald-700" />
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-semibold text-slate-900">{h.name}</span>
                {h.address ? <span className="block text-base text-slate-700">{h.address}</span> : null}
              </span>
              {!h.isActive ? <Pill tone="neutral" icon={<IconPower className="size-4" />}>Ngừng dùng</Pill> : null}
            </Link>
          </li>
        ))}
      </ul>
      <Card title="Tạo nhà mới">
        <form onSubmit={create} className="grid items-start gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <label className="flex flex-col gap-1.5 text-base font-medium text-slate-800">Tên
            <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={100} pattern={NAME_PATTERN} title="Tên không được để trống" />
            <span className="text-base font-normal text-red-800">{fieldError(formError, 'name')}</span>
          </label>
          <label className="flex flex-col gap-1.5 text-base font-medium text-slate-800">Địa chỉ
            <input className={inputCls} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} maxLength={255} />
          </label>
          <button className={`${btnCls} sm:mt-[1.875rem]`}>Tạo</button>
        </form>
        <Banner error={formError} />
      </Card>
    </main>
  );
}
