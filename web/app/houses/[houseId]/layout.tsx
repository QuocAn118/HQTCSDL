'use client';
// Khung trang cua mot nha: menu, thanh trang thai ket noi, mot socket chung cho moi trang con.
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { IconAlert, IconClock, IconGrid, IconHouse, IconLogout, IconSettings, IconSliders, IconWifiOff } from '@/components/icons';
import { btnGhostCls, Empty } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/errors';
import { HouseChangedContext } from '@/lib/houses';
import { LiveProvider, useLive } from '@/lib/live';
import type { House } from '@/lib/types';

const TABS = [
  ['', 'Tổng quan', IconGrid], ['/devices', 'Thiết bị', IconSliders], ['/alerts', 'Cảnh báo', IconAlert],
  ['/history', 'Lịch sử', IconClock], ['/settings', 'Cài đặt', IconSettings],
] as const;

function ConnectionBar() {
  const { status } = useLive();
  if (status === 'connected') return null;
  return (
    <div role="status" className="flex items-center justify-center gap-2 border-b border-amber-300 bg-amber-100 px-4 py-2 text-base font-medium text-amber-950">
      <IconWifiOff className="size-5" />
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
      <div className="sticky top-0 z-20">
      <ConnectionBar />
      <header className="glass rounded-none border-x-0 border-t-0">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 sm:px-6">
          <Link href="/houses?all=1" className="inline-flex min-h-10 items-center gap-2 rounded-lg pr-2 text-lg font-bold text-slate-900 hover:text-emerald-800">
            <IconHouse className="size-6 text-emerald-700" />
            {house?.name ?? 'Nhà yến'}
          </Link>
          <nav className="order-last -mx-1 flex w-full gap-1 overflow-x-auto px-1 pb-1 md:order-none md:w-auto md:pb-0">
            {TABS.map(([path, label, Icon]) => {
              const href = base + path;
              const active = pathname === href;
              return (
                <Link key={path} href={href} aria-current={active ? 'page' : undefined}
                  className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-base whitespace-nowrap ${active
                    ? 'bg-white font-semibold text-emerald-800 shadow-sm ring-1 ring-emerald-700/40'
                    : 'text-slate-700 hover:bg-white/70 hover:text-slate-900'}`}>
                  <Icon className="size-5" />
                  {label}
                </Link>
              );
            })}
          </nav>
          <button className={`${btnGhostCls} ml-auto`} onClick={() => logout()}><IconLogout className="size-5" />Đăng xuất</button>
        </div>
      </header>
      </div>
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">{children}</main>
      </HouseChangedContext.Provider>
    </LiveProvider>
  );
}
