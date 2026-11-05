'use client';
// Khung trang cua mot nha: menu, thanh trang thai ket noi, mot socket chung cho moi trang con.
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { btnGhostCls, Empty } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/errors';
import { HouseChangedContext } from '@/lib/houses';
import { LiveProvider, useLive } from '@/lib/live';
import type { House } from '@/lib/types';

const TABS = [
  ['', 'Tổng quan'], ['/devices', 'Thiết bị'], ['/alerts', 'Cảnh báo'], ['/history', 'Lịch sử'],
  ['/settings', 'Cài đặt'],
] as const;

function ConnectionBar() {
  const { status } = useLive();
  if (status === 'connected') return null;
  return (
    <div className="bg-amber-100 px-4 py-1 text-center text-sm text-amber-900">
      {status === 'connecting' ? 'Đang kết nối máy chủ…' : 'Mất kết nối máy chủ, đang kết nối lại…'}
    </div>
  );
}

export default function HouseLayout({ children }: { children: ReactNode }) {
  const { houseId } = useParams<{ houseId: string }>();
  const pathname = usePathname();
  const { logout } = useAuth();
  const [house, setHouse] = useState<House | null>(null);
  const [notFound, setNotFound] = useState(false);
  const base = `/houses/${houseId}`;

  useEffect(() => {
    api<House>(`/api/houses/${houseId}`)
      .then(setHouse)
      .catch((e) => setNotFound(e instanceof ApiError && e.status === 404));
  }, [houseId]);

  if (notFound || !/^\d+$/.test(houseId)) return <main className="p-8"><Empty>Không tìm thấy</Empty></main>;

  return (
    <LiveProvider>
      <HouseChangedContext.Provider value={setHouse}>
      <ConnectionBar />
      <header className="flex flex-wrap items-center gap-4 border-b border-stone-200 bg-white px-6 py-3">
        <Link href="/houses?all=1" className="font-semibold">{house?.name ?? 'Nhà yến'}</Link>
        <nav className="flex flex-wrap gap-1">
          {TABS.map(([path, label]) => {
            const href = base + path;
            const active = pathname === href;
            return (
              <Link key={path} href={href} className={`rounded px-3 py-1 text-sm ${active ? 'bg-emerald-700 text-white' : 'hover:bg-stone-100'}`}>
                {label}
              </Link>
            );
          })}
        </nav>
        <button className={`${btnGhostCls} ml-auto`} onClick={() => logout()}>Đăng xuất</button>
      </header>
      <main className="mx-auto max-w-6xl p-6">{children}</main>
      </HouseChangedContext.Provider>
    </LiveProvider>
  );
}
