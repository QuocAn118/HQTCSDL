'use client';
// Thanh phan dung chung: thong bao loi (chi cau tieng Viet theo ma), trang thai trong, dang tai, the kinh, nhan trang thai.
import type { ReactNode } from 'react';
import { ApiError, GENERIC_MESSAGE, messageFor } from '@/lib/errors';
import { IconAlert, IconBell, IconCheck, IconEye } from './icons';
import { ALERT_STATUS_LABEL } from './labels';

export function errorText(e: unknown): string {
  return e instanceof ApiError ? messageFor(e.code) : GENERIC_MESSAGE;
}

export function Banner({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (!error) return null;
  const retry = error instanceof ApiError && (error.code === 'RETRY_LATER' || error.code === 'NETWORK') && onRetry;
  return (
    <div role="alert" className="my-3 flex flex-wrap items-center gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-base text-red-900">
      <IconAlert className="size-5 text-red-700" />
      <span className="flex-1">{errorText(error)}</span>
      {retry ? <button className="min-h-10 rounded-lg border border-red-400 bg-white px-3 font-medium hover:bg-red-100" onClick={onRetry}>Thử lại</button> : null}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-base text-slate-600">{children}</p>;
}

export function Loading() {
  return <p className="py-6 text-center text-base text-slate-600">Đang tải…</p>;
}

// dense: bang day va bieu do dat tren nen it trong suot hon.
export function Card({ title, children, dense = false }: { title: ReactNode; children: ReactNode; dense?: boolean }) {
  return (
    <section className={`${dense ? 'glass-dense' : 'glass'} rounded-2xl p-5`}>
      <h2 className="mb-4 text-lg font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

export const inputCls = 'min-h-10 rounded-lg border border-slate-300 bg-white/90 px-3 py-1.5 text-base text-slate-900 placeholder:text-slate-500 hover:border-slate-400 focus:border-teal-700 disabled:cursor-not-allowed disabled:bg-slate-100';
const btnBase = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-1.5 text-base font-medium transition-colors disabled:cursor-not-allowed';
// Nut bi tat: nen xam, vien net dut, chu xam dam (van doc duoc) -> nhin ra "khong bam duoc", khong giong nut hong.
export const btnCls = `${btnBase} bg-emerald-700 text-white shadow-sm hover:bg-emerald-800 disabled:border disabled:border-dashed disabled:border-slate-400 disabled:bg-slate-200 disabled:text-slate-600 disabled:shadow-none`;
export const btnGhostCls = `${btnBase} border border-slate-300 bg-white/85 text-slate-800 hover:border-slate-400 hover:bg-white disabled:border-dashed disabled:border-slate-400 disabled:bg-slate-100/80 disabled:text-slate-600`;

export function fieldError(error: unknown, field: string): string | null {
  return error instanceof ApiError && error.fields.includes(field) ? 'Giá trị chưa hợp lệ' : null;
}

const TONES = {
  bad: 'border-red-300 bg-red-50 text-red-800',
  warn: 'border-amber-300 bg-amber-50 text-amber-900',
  ok: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  off: 'border-slate-700 bg-slate-700 text-white',
  neutral: 'border-slate-300 bg-white/80 text-slate-700',
} as const;
export type Tone = keyof typeof TONES;

// Nhan trang thai: luon co icon + chu + vien, khong chi dung mau.
export function Pill({ tone, icon, children }: { tone: Tone; icon?: ReactNode; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-base font-semibold ${TONES[tone]}`}>
      {icon}
      {children}
    </span>
  );
}

const STATUS_STYLE: Record<string, [Tone, ReactNode]> = {
  NEW: ['bad', <IconBell key="i" className="size-4" />],
  ACK: ['warn', <IconEye key="i" className="size-4" />],
  RESOLVED: ['ok', <IconCheck key="i" className="size-4" />],
};

// Chu cua nhan la chu dau tien trong ten nut canh bao (demo tim nut theo ten bat dau "Mới"/"Đã xem"/"Đã xử lý").
export function AlertStatusBadge({ status }: { status: string }) {
  const [tone, icon] = STATUS_STYLE[status] ?? ['neutral', null];
  return <Pill tone={tone} icon={icon}>{ALERT_STATUS_LABEL[status] ?? status}</Pill>;
}
