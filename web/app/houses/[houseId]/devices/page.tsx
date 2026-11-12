'use client';
// Dieu khien tay: bat/tat, Muc FAN 0-100 (0 = tat, giong mobile), MANUAL/AUTO; cap nhat tu PHAN HOI, khong doan truoc; nhat ky phan trang (spec web 2.2).
// web-ui T3: nhom theo khu vuc, moi thiet bi mot hang, nhat ky mo ngay duoi thiet bi.
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { groupByZone, modeText, onBody, stateText } from '@/components/devices';
import { IconClock, IconPower, IconRefresh, IconWifiOff } from '@/components/icons';
import { deviceTitle } from '@/components/overview';
import { Banner, btnCls, btnGhostCls, Card, Empty, Loading, Pill } from '@/components/ui';
import { api } from '@/lib/api';
import { ACTUATORS, DEVICE_LABELS, showOffline } from '@/lib/config';
import { useLiveDevices } from '@/lib/hooks';
import { useReloadOnConnect } from '@/lib/live';
import { applyControlResult } from '@/lib/merge';
import { formatVn } from '@/lib/time';
import type { ControlLog, ControlResult, Device, Page, Zone } from '@/lib/types';

function ControlRow({ device, logsOpen, logsKey, onResult, onShowLogs }: {
  device: Device; logsOpen: boolean; logsKey: number; onResult: (sent: Device, r: ControlResult) => void; onShowLogs: (d: Device) => void;
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
    <li className="border-t border-slate-200/80 py-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 basis-64">
          <p className="font-semibold text-slate-900">{deviceTitle(DEVICE_LABELS[device.deviceType], device.name)}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Pill tone={device.isOn ? 'ok' : 'neutral'} icon={<IconPower className="size-4" />}>{stateText(device)}</Pill>
            {showOffline(device.deviceType, device.status) ? <Pill tone="off" icon={<IconWifiOff className="size-4" />}>OFFLINE</Pill> : null}
          </div>
        </div>
        {isFan ? (
          <label className="flex items-center gap-2 text-base font-medium text-slate-800">Mức
            <input type="range" min={0} max={100} step={10} value={level} onChange={(e) => setLevel(Number(e.target.value))} className="h-10 w-36 accent-emerald-700" />
            <span className="w-12 text-right tabular-nums">{level}%</span>
          </label>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button className={btnCls} disabled={busy} onClick={() => send(onBody(isFan, level))}>Bật</button>
          <button className={btnGhostCls} disabled={busy} onClick={() => send({ mode: 'MANUAL', isOn: false })}>Tắt</button>
          {/* Dang AUTO thi nut tat: nen xam, vien net dut (btnGhostCls disabled) */}
          <button className={btnGhostCls} disabled={busy || device.mode === 'AUTO'} onClick={() => send({ mode: 'AUTO' })}><IconRefresh className="size-4" />Trả về tự động</button>
          <button className={btnGhostCls} onClick={() => onShowLogs(device)}><IconClock className="size-4" />Nhật ký</button>
        </div>
      </div>
      <Banner error={error} />
      {logsOpen ? <Logs key={logsKey} device={device} /> : null}
    </li>
  );
}

function Logs({ device }: { device: Device }) {
  const [page, setPage] = useState<{ items: ControlLog[]; nextBefore: number | null } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const box = useRef<HTMLDivElement>(null);

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
  // Nhat ky nam ngay duoi thiet bi; cuon vao tam nhin neu dang khuat.
  useEffect(() => box.current?.scrollIntoView({ block: 'nearest' }), []);

  return (
    <div ref={box} className="mt-3 scroll-mb-4">
      <Card dense title={`Nhật ký điều khiển — ${device.name}`}>
        <Banner error={error} onRetry={() => load(null)} />
        {!page ? <Loading /> : page.items.length === 0 ? <Empty>Chưa có lần điều khiển nào.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-base">
              <thead className="text-slate-700"><tr><th className="py-2 pr-4 font-semibold">Thời điểm</th><th className="py-2 pr-4 font-semibold">Trạng thái</th><th className="py-2 pr-4 font-semibold">Chế độ</th><th className="py-2 pr-4 font-semibold">Nguồn</th><th className="py-2 font-semibold">Lý do</th></tr></thead>
              <tbody className="text-slate-900">
                {page.items.map((l) => (
                  <tr key={l.logId} className="border-t border-slate-200">
                    <td className="py-2 pr-4 whitespace-nowrap tabular-nums">{formatVn(l.createdAt)}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{l.isOn ? 'Bật' : 'Tắt'}{l.level !== null ? ` ${l.level}%` : ''}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{modeText(l.mode)}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{modeText(l.source)}</td>
                    <td className="py-2">{l.reason ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {page?.nextBefore ? <button className={`${btnGhostCls} mt-3`} onClick={() => load(page.nextBefore)}>Tải thêm</button> : null}
      </Card>
    </div>
  );
}

export default function DevicesPage() {
  const houseId = Number(useParams<{ houseId: string }>().houseId);
  const { devices, setDevices, error, reload } = useLiveDevices(houseId);
  const [zones, setZones] = useState<Zone[] | null>(null);
  const [zoneError, setZoneError] = useState<unknown>(null);
  const [selected, setSelected] = useState<number | null>(null);
  // Tang moi lan dieu khien xong hoac bam "Nhat ky" -> Logs tai lai, co dong moi.
  const [logsKey, setLogsKey] = useState(0);

  const loadZones = useCallback(async () => {
    try {
      setZones(await api<Zone[]>(`/api/houses/${houseId}/zones`));
      setZoneError(null);
    } catch (e) {
      setZoneError(e);
    }
  }, [houseId]);
  useEffect(() => {
    void loadZones().catch(() => {});
  }, [loadZones]);
  useReloadOnConnect(loadZones);

  // Cap nhat tu phan hoi, tru khi device.state moi hon da den trong luc cho (applyControlResult).
  const onResult = (sent: Device, r: ControlResult) => {
    setDevices((list) => list && applyControlResult(list, sent, r));
    setLogsKey((k) => k + 1);
  };
  const showLogs = (d: Device) => {
    setSelected(d.deviceId);
    setLogsKey((k) => k + 1);
  };

  if (error && !devices) return <Banner error={error} onRetry={reload} />;
  if (!devices || (!zones && !zoneError)) return <Loading />;
  const actuators = devices.filter((d) => ACTUATORS.includes(d.deviceType) && d.isActive);
  if (actuators.length === 0) return <Empty>Chưa có thiết bị điều khiển được.</Empty>;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <Banner error={zoneError} onRetry={loadZones} />
      {groupByZone(zones ?? [], actuators).map(({ zone, devices: list }) => (
        <Card key={zone?.zoneId ?? 'khac'} title={<span className="text-xl">{zone ? zone.name : 'Khác'}</span>}>
          <ul>
            {list.map((d) => (
              <ControlRow key={d.deviceId} device={d} logsOpen={selected === d.deviceId} logsKey={logsKey} onResult={onResult} onShowLogs={showLogs} />
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
