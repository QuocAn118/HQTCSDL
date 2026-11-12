'use client';
// Canh bao: loc trang thai/loai, phan trang before, chi tiet kem history, ACK/RESOLVED kem ghi chu, anh (spec web 2.2).
// Khong ghep phan hoi PATCH vao danh sach (T4W-1): chi su kien alert.* hoac tai lai REST.
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { historyText, severityTone } from '@/components/alerts';
import { IconCheck, IconEye, IconInfo } from '@/components/icons';
import { ALERT_TYPE_LABEL, PREDATOR_LABEL, viLabel } from '@/components/labels';
import { SnapshotImage } from '@/components/SnapshotImage';
import { AlertStatusBadge, Banner, btnCls, btnGhostCls, Card, Empty, inputCls, Loading, SeverityBadge } from '@/components/ui';
import { api, qs } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { useLive, useReloadOnConnect } from '@/lib/live';
import { createLoadGate, mergeAlert, mergeAlerts } from '@/lib/merge';
import { formatVn } from '@/lib/time';
import type { Alert, AlertCreated, AlertDetail, AlertUpdated, Page } from '@/lib/types';

const STATUS_FILTERS = [['NEW,ACK', 'Đang mở'], ['RESOLVED', 'Đã xử lý'], ['', 'Tất cả']] as const;
const TYPES = [['', 'Mọi loại'], ['THRESHOLD', 'Ngưỡng'], ['PREDATOR', 'Thiên địch'], ['DEVICE_OFFLINE', 'Mất kết nối'], ['POPULATION_DROP', 'Sụt đàn']] as const;
// Vien the theo muc do (di kem nhan co icon + chu, khong chi dung mau).
const SEV_EDGE = { bad: 'border-red-400', warn: 'border-amber-400', neutral: 'border-slate-300' } as const;

function Detail({ alertId, onChanged }: { alertId: number; onChanged: () => void }) {
  const [detail, setDetail] = useState<AlertDetail | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const noteId = useId();
  const box = useRef<HTMLDivElement>(null);
  // Man hinh hep: chi tiet nam duoi danh sach, cuon toi khi chon canh bao.
  useEffect(() => {
    if (window.matchMedia('(max-width: 1023px)').matches) box.current?.scrollIntoView({ block: 'start' });
  }, []);

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
    <div ref={box} className="scroll-mt-36">
      <Card dense title={<span className="flex flex-wrap items-center gap-2">Cảnh báo #{detail.alertId} <AlertStatusBadge status={detail.status} /></span>}>
        <p className="mb-4 text-lg font-medium text-slate-900">{detail.message}</p>
        <dl className="mb-4 grid grid-cols-2 gap-x-6 gap-y-3 text-base">
          <div><dt className="text-slate-700">Mức độ</dt><dd className="mt-1"><SeverityBadge severity={detail.severity} /></dd></div>
          <div><dt className="text-slate-700">Loại</dt><dd className="mt-1 font-semibold text-slate-900">{viLabel(ALERT_TYPE_LABEL, detail.alertType)}</dd></div>
          <div><dt className="text-slate-700">Thời điểm</dt><dd className="mt-1 font-semibold tabular-nums text-slate-900">{formatVn(detail.createdAt)}</dd></div>
          {detail.detectedClass ? <div><dt className="text-slate-700">Đối tượng</dt><dd className="mt-1 font-semibold text-slate-900">{viLabel(PREDATOR_LABEL, detail.detectedClass)}</dd></div> : null}
        </dl>
        {detail.hasSnapshot ? <SnapshotImage alertId={detail.alertId} /> : null}
        <Banner error={error} />
        {info ? (
          <p role="status" className="my-3 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-base text-amber-900">
            <IconInfo className="size-5" />{info}
          </p>
        ) : null}
        {detail.status !== 'RESOLVED' ? (
          <div className="my-4 grid gap-2">
            <label htmlFor={noteId} className="text-base font-medium text-slate-800">Ghi chú (không bắt buộc)</label>
            <div className="flex flex-wrap gap-2">
              <input id={noteId} className={`${inputCls} min-w-0 flex-1 basis-56`} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
              {detail.status === 'NEW' ? <button className={btnGhostCls} disabled={busy} onClick={() => change('ACK')}><IconEye />Đã xem (ACK)</button> : null}
              <button className={btnCls} disabled={busy} onClick={() => change('RESOLVED')}><IconCheck />Đã xử lý</button>
            </div>
          </div>
        ) : null}
        <h3 className="mt-5 mb-2 text-base font-semibold text-slate-900">Lịch sử</h3>
        <ol className="grid gap-2 border-l-2 border-slate-300 pl-4 text-base">
          {detail.history.map((h) => (
            <li key={h.historyId}>
              <span className="tabular-nums text-slate-700">{formatVn(h.changedAt)}</span>{' · '}
              <span className="font-semibold text-slate-900">{historyText(h.oldStatus, h.newStatus)}</span>
              {h.note ? <span className="text-slate-800"> — {h.note}</span> : null}
            </li>
          ))}
        </ol>
      </Card>
    </div>
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
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <Card dense title="Danh sách cảnh báo">
        <div className="mb-4 flex flex-wrap gap-2">
          <select aria-label="Lọc trạng thái" className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select aria-label="Lọc loại" className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <Banner error={error} onRetry={() => load(null)} />
        {list === null && !error ? <Loading /> : shown.length === 0 && !error ? <Empty>Không có cảnh báo</Empty> : (
          <ul className="grid gap-2">
            {shown.map((a) => (
              <li key={a.alertId}>
                {/* Ten nut bat dau bang nhan trang thai (demo tim theo "Mới"/"Đã xem"/"Đã xử lý"). */}
                <button onClick={() => setSelected(a.alertId)} aria-pressed={selected === a.alertId}
                  className={`grid w-full gap-1.5 rounded-xl border-2 ${SEV_EDGE[severityTone(a.severity)]} px-3 py-2.5 text-left text-base transition-colors ${selected === a.alertId ? 'bg-white ring-2 ring-teal-700' : 'bg-white/70 hover:bg-white'}`}>
                  <span className="flex flex-wrap items-center gap-2">
                    <AlertStatusBadge status={a.status} />
                    <SeverityBadge severity={a.severity} />
                    <span className="font-medium text-slate-700">{viLabel(ALERT_TYPE_LABEL, a.alertType)}</span>
                  </span>
                  <span className="font-medium text-slate-900">{a.message}</span>
                  <span className="tabular-nums text-slate-700">{formatVn(a.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {nextBefore ? <button className={`${btnGhostCls} mt-3`} onClick={() => load(nextBefore)}>Tải thêm</button> : null}
      </Card>
      {/* key: doi canh bao thi dung moi state, ghi chu dang go khong bi gui nham sang canh bao khac, ket qua cu khong de len. */}
      {selected ? <Detail key={selected} alertId={selected} onChanged={() => load(null)} /> : <Empty>Chọn một cảnh báo để xem chi tiết.</Empty>}
    </div>
  );
}
