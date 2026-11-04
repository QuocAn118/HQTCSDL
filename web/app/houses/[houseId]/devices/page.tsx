'use client';
// Dieu khien tay: bat/tat, Level FAN 0-100 (0 = tat, giong mobile), MANUAL/AUTO; cap nhat tu PHAN HOI, khong doan truoc; nhat ky phan trang (spec web 2.2).
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Banner, btnCls, btnGhostCls, Card, Empty, Loading } from '@/components/ui';
import { api } from '@/lib/api';
import { ACTUATORS, DEVICE_LABELS, showOffline } from '@/lib/config';
import { useLiveDevices } from '@/lib/hooks';
import { applyControlResult } from '@/lib/merge';
import { formatVn } from '@/lib/time';
import type { ControlLog, ControlResult, Device, Page } from '@/lib/types';

function ControlRow({ device, onResult, onShowLogs }: {
  device: Device; onResult: (sent: Device, r: ControlResult) => void; onShowLogs: (d: Device) => void;
}) {
  const [level, setLevel] = useState(device.level ?? 100);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      onResult(device, await api<ControlResult>(`/api/devices/${device.deviceId}/control`, 'POST', body));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  const isFan = device.deviceType === 'FAN';
  return (
    <li className="border-t py-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="w-56 font-medium">{DEVICE_LABELS[device.deviceType]} — {device.name}</span>
        <span className="text-sm">
          {device.isOn ? 'Đang bật' : 'Đang tắt'}{isFan && device.isOn ? ` ${device.level ?? 0}%` : ''} · {device.mode === 'MANUAL' ? 'Điều khiển tay' : 'Tự động'}
          {showOffline(device.deviceType, device.status) ? <span className="ml-1 rounded bg-stone-700 px-1 text-xs text-white">OFFLINE</span> : null}
        </span>
        <button className={btnCls} disabled={busy} onClick={() => send(isFan && level === 0 ? { mode: 'MANUAL', isOn: false } : { mode: 'MANUAL', isOn: true, ...(isFan ? { level } : {}) })}>Bật</button>
        <button className={btnGhostCls} disabled={busy} onClick={() => send({ mode: 'MANUAL', isOn: false })}>Tắt</button>
        {isFan ? (
          <label className="flex items-center gap-2 text-sm">Level
            <input type="range" min={0} max={100} step={10} value={level} onChange={(e) => setLevel(Number(e.target.value))} />
            <span className="w-10">{level}%</span>
          </label>
        ) : null}
        <button className={btnGhostCls} disabled={busy || device.mode === 'AUTO'} onClick={() => send({ mode: 'AUTO' })}>Trả về tự động</button>
        <button className="text-sm text-emerald-700 underline" onClick={() => onShowLogs(device)}>Nhật ký</button>
      </div>
      <Banner error={error} />
    </li>
  );
}

function Logs({ device }: { device: Device }) {
  const [page, setPage] = useState<{ items: ControlLog[]; nextBefore: number | null } | null>(null);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async (before: number | null) => {
    try {
      const q = before ? `&before=${before}` : '';
      const p = await api<Page<ControlLog>>(`/api/devices/${device.deviceId}/control-logs?limit=20${q}`);
      setPage((cur) => ({ items: before && cur ? [...cur.items, ...p.items] : p.items, nextBefore: p.nextBefore }));
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, [device.deviceId]);
  useEffect(() => {
    setPage(null);
    void load(null).catch(() => {});
  }, [load]);

  return (
    <Card title={`Nhật ký điều khiển — ${device.name}`}>
      <Banner error={error} onRetry={() => load(null)} />
      {!page ? <Loading /> : page.items.length === 0 ? <Empty>Chưa có lần điều khiển nào.</Empty> : (
        <table className="w-full text-sm">
          <thead><tr className="text-left"><th>Thời điểm</th><th>Trạng thái</th><th>Chế độ</th><th>Nguồn</th><th>Lý do</th></tr></thead>
          <tbody>
            {page.items.map((l) => (
              <tr key={l.logId} className="border-t">
                <td>{formatVn(l.createdAt)}</td>
                <td>{l.isOn ? 'Bật' : 'Tắt'}{l.level !== null ? ` ${l.level}%` : ''}</td>
                <td>{l.mode}</td><td>{l.source}</td><td>{l.reason ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {page?.nextBefore ? <button className={`${btnGhostCls} mt-2`} onClick={() => load(page.nextBefore)}>Tải thêm</button> : null}
    </Card>
  );
}

export default function DevicesPage() {
  const houseId = Number(useParams<{ houseId: string }>().houseId);
  const { devices, setDevices, error, reload } = useLiveDevices(houseId);
  const [selected, setSelected] = useState<Device | null>(null);
  // Tang moi lan dieu khien xong hoac bam "Nhat ky" -> Logs tai lai, co dong moi.
  const [logsKey, setLogsKey] = useState(0);

  // Cap nhat tu phan hoi, tru khi device.state moi hon da den trong luc cho (applyControlResult).
  const onResult = (sent: Device, r: ControlResult) => {
    setDevices((list) => list && applyControlResult(list, sent, r));
    setLogsKey((k) => k + 1);
  };
  const showLogs = (d: Device) => {
    setSelected(d);
    setLogsKey((k) => k + 1);
  };

  if (error && !devices) return <Banner error={error} onRetry={reload} />;
  if (!devices) return <Loading />;
  const actuators = devices.filter((d) => ACTUATORS.includes(d.deviceType) && d.isActive);

  return (
    <div className="grid gap-4">
      <Card title="Cơ cấu chấp hành">
        {actuators.length === 0 ? <Empty>Chưa có thiết bị điều khiển được.</Empty> : (
          <ul>{actuators.map((d) => <ControlRow key={d.deviceId} device={d} onResult={onResult} onShowLogs={showLogs} />)}</ul>
        )}
      </Card>
      {selected ? <Logs key={logsKey} device={selected} /> : null}
    </div>
  );
}
