'use client';
// Thanh phan dung chung: thong bao loi (chi cau tieng Viet theo ma), trang thai trong, dang tai.
import type { ReactNode } from 'react';
import { ApiError, GENERIC_MESSAGE, messageFor } from '@/lib/errors';

export function errorText(e: unknown): string {
  return e instanceof ApiError ? messageFor(e.code) : GENERIC_MESSAGE;
}

export function Banner({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (!error) return null;
  const retry = error instanceof ApiError && (error.code === 'RETRY_LATER' || error.code === 'NETWORK') && onRetry;
  return (
    <div role="alert" className="my-3 flex items-center gap-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
      <span>{errorText(error)}</span>
      {retry ? <button className="rounded border border-red-400 px-2 py-0.5" onClick={onRetry}>Thử lại</button> : null}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-stone-500">{children}</p>;
}

export function Loading() {
  return <p className="py-6 text-center text-sm text-stone-500">Đang tải…</p>;
}

export function Card({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export const inputCls = 'rounded border border-stone-300 px-2 py-1 text-sm';
export const btnCls = 'rounded bg-emerald-700 px-3 py-1 text-sm text-white disabled:opacity-50';
export const btnGhostCls = 'rounded border border-stone-300 px-3 py-1 text-sm disabled:opacity-50';

export function fieldError(error: unknown, field: string): string | null {
  return error instanceof ApiError && error.fields.includes(field) ? 'Giá trị chưa hợp lệ' : null;
}
