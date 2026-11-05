'use client';
// Canh bao: loc trang thai/loai, phan trang before, chi tiet kem history, ACK/RESOLVED kem ghi chu, anh (spec web 2.2).
// Khong ghep phan hoi PATCH vao danh sach (T4W-1): chi su kien alert.* hoac tai lai REST.
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { SnapshotImage } from '@/components/SnapshotImage';
import { Banner, btnCls, btnGhostCls, Card, Empty, inputCls, Loading } from '@/components/ui';
import { api, qs } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { useLive, useReloadOnConnect } from '@/lib/live';
import { createLoadGate, mergeAlert, mergeAlerts } from '@/lib/merge';
import { formatVn } from '@/lib/time';
import type { Alert, AlertCreated, AlertDetail, AlertUpdated, Page } from '@/lib/types';

const STATUS_FILTERS = [['NEW,ACK', 'Đang mở'], ['RESOLVED', 'Đã xử lý'], ['', 'Tất cả']] as const;
const TYPES = [['', 'Mọi loại'], ['THRESHOLD', 'Ngưỡng'], ['PREDATOR', 'Thiên địch'], ['DEVICE_OFFLINE', 'Mất kết nối'], ['POPULATION_DROP', 'Sụt đàn']] as const;
const STATUS_LABEL: Record<string, string> = { NEW: 'Mới', ACK: 'Đã xem', RESOLVED: 'Đã xử lý' };

function Detail({ alertId, onChanged }: { alertId: number; onChanged: () => void }) {
  const [detail, setDetail] = useState<AlertDetail | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setDetail(await api<AlertDetail>(`/api/alerts/${alertId}`));
    } catch (e) {
      setError(e);
    }
  }, [alertId]);
  useEffect(() => {
    void load().catch(() => {});
  }, [load]);

  async function change(status: 'ACK' | 'RESOLVED') {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await api(`/api/alerts/${alertId}`, 'PATCH', { status, note: note || undefined });
      setNote('');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'ALERT_INVALID_TRANSITION') setInfo('Cảnh báo đã đổi trạng thái. Đã tải lại.');
      else setError(e);
    }
    await load();
    onChanged();
    setBusy(false);
  }

  if (!detail) return error ? <Banner error={error} /> : <Loading />;
  return (
    <Card title={`Cảnh báo #${detail.alertId} — ${STATUS_LABEL[detail.status]}`}>
      <p className="mb-2">{detail.message}</p>
      <p className="mb-2 text-sm text-stone-600">{formatVn(detail.createdAt)} · {detail.alertType} · {detail.severity}
        {detail.detectedClass ? ` · ${detail.detectedClass} (${detail.confidence})` : ''}</p>
      {detail.hasSnapshot ? <SnapshotImage alertId={detail.alertId} /> : null}
      <Banner error={error} />
      {info ? <p className="my-2 text-sm text-amber-700">{info}</p> : null}
      {detail.status !== 'RESOLVED' ? (
        <div className="my-3 flex flex-wrap gap-2">
          <input className={`${inputCls} flex-1`} placeholder="Ghi chú (không bắt buộc)" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
          {detail.status === 'NEW' ? <button className={btnGhostCls} disabled={busy} onClick={() => change('ACK')}>Đã xem (ACK)</button> : null}
          <button className={btnCls} disabled={busy} onClick={() => change('RESOLVED')}>Đã xử lý</button>
        </div>
      ) : null}
      <h3 className="mt-3 text-sm font-semibold">Lịch sử</h3>
      <ul className="text-sm">
        {detail.history.map((h) => (
          <li key={h.historyId}>{formatVn(h.changedAt)}: {h.oldStatus ?? '—'} → {h.newStatus}{h.note ? ` — ${h.note}` : ''}</li>
        ))}
      </ul>
    </Card>
  );
}

export default function AlertsPage() {
  const houseId = Number(useParams<{ houseId: string }>().houseId);
  const { subscribe } = useLive();
  const [status, setStatus] = useState<string>('NEW,ACK');
  const [type, setType] = useState<string>('');
  const [list, setList] = useState<Alert[] | null>(null);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [gate] = useState(createLoadGate<Alert | AlertUpdated>);

  // Chi lan tai moi nhat duoc ap (doi bo loc nhanh khong bi ket qua cu de len); su kien trong luc tai ap lai sau REST.
  const load = useCallback(async (before: number | null) => {
    const id = gate.begin();
    try {
      const page = await api<Page<Alert>>(`/api/alerts${qs({ houseId, status, type, limit: 50, before })}`);
      const held = gate.end(id);
      if (!held) return;
      setList((cur) => mergeAlerts(before && cur ? [...cur, ...page.items] : page.items, held));
      setNextBefore(page.nextBefore);
      setError(null);
    } catch (e) {
      const held = gate.end(id);
      if (!held) return;
      setList((cur) => (cur ? mergeAlerts(cur, held) : cur));
      setError(e);
    }
  }, [houseId, status, type, gate]);
  useReloadOnConnect(() => load(null));
  useEffect(() => {
    setList(null);
    setNextBefore(null);
    void load(null).catch(() => {});
  }, [load]);

  useEffect(() => subscribe((event, payload) => {
    const incoming = event === 'alert.created' ? (payload as AlertCreated).alert : event === 'alert.updated' ? (payload as AlertUpdated) : null;
    if (!incoming || incoming.houseId !== houseId || gate.hold(incoming)) return;
    setList((l) => (l ? mergeAlert(l, incoming) : l));
  }), [subscribe, houseId, gate]);

  const allowed = status ? status.split(',') : null;
  const shown = (list ?? []).filter((a) => (!allowed || allowed.includes(a.status)) && (!type || a.alertType === type));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Danh sách cảnh báo">
        <div className="mb-3 flex gap-2">
          <select aria-label="Lọc trạng thái" className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select aria-label="Lọc loại" className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <Banner error={error} onRetry={() => load(null)} />
        {list === null && !error ? <Loading /> : shown.length === 0 && !error ? <Empty>Không có cảnh báo</Empty> : (
          <ul>
            {shown.map((a) => (
              <li key={a.alertId}>
                <button onClick={() => setSelected(a.alertId)} className={`w-full border-t py-2 text-left text-sm ${selected === a.alertId ? 'bg-emerald-50' : ''}`}>
                  <span className="mr-2 rounded bg-stone-200 px-1 text-xs">{STATUS_LABEL[a.status]}</span>
                  {a.message} <span className="text-stone-500">· {formatVn(a.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {nextBefore ? <button className={`${btnGhostCls} mt-2`} onClick={() => load(nextBefore)}>Tải thêm</button> : null}
      </Card>
      {/* key: doi canh bao thi dung moi state, ghi chu dang go khong bi gui nham sang canh bao khac, ket qua cu khong de len. */}
      {selected ? <Detail key={selected} alertId={selected} onChanged={() => load(null)} /> : <Empty>Chọn một cảnh báo để xem chi tiết.</Empty>}
    </div>
  );
}
