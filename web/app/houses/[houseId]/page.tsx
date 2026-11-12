'use client';
// Dashboard: dai tom tat, the moi khu vuc voi so do moi nhat (o ngoai nguong co vien + icon + chu), trang thai thiet bi.
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { IconAlert, IconBell, IconPower, IconWifiOff } from '@/components/icons';
import { deviceTitle, latestAt, summarize, thresholdBreach } from '@/components/overview';
import { Banner, Card, Empty, Loading, Pill } from '@/components/ui';
import { api } from '@/lib/api';
import { DEVICE_LABELS, METRIC_LABELS, showOffline } from '@/lib/config';
import { useLiveDevices, useLiveLatest, useLiveOpenAlerts } from '@/lib/hooks';
import { useReloadOnConnect } from '@/lib/live';
import { latestKey } from '@/lib/merge';
import { formatVn } from '@/lib/time';
import type { Device, Metric, Threshold, Zone } from '@/lib/types';

const METRICS: Metric[] = ['TEMP', 'HUMID', 'CO2', 'LIGHT'];

function deviceText(d: Device): string {
  if (d.isOn === null) return '—';
  const lvl = d.deviceType === 'FAN' && d.isOn && d.level !== null ? ` ${d.level}%` : '';
  return `${d.isOn ? 'Bật' : 'Tắt'}${lvl} · ${d.mode === 'MANUAL' ? 'Tay' : 'Tự động'}`;
}

function SummaryTile({ label, value, icon, alarm }: { label: string; value: ReactNode; icon: ReactNode; alarm: boolean }) {
  return (
    <div className={`glass flex items-center gap-4 rounded-2xl p-4 ${alarm ? 'ring-2 ring-red-600' : ''}`}>
      <span className={`grid size-12 place-items-center rounded-xl border ${alarm ? 'border-red-300 bg-red-50 text-red-700' : 'border-slate-200 bg-white/80 text-emerald-800'}`}>{icon}</span>
      <div>
        <p className="text-base font-medium text-slate-700">{label}</p>
        <p className={`text-3xl font-bold tabular-nums ${alarm ? 'text-red-800' : 'text-slate-900'}`}>{value}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const houseId = Number(useParams<{ houseId: string }>().houseId);
  const [zones, setZones] = useState<Zone[] | null>(null);
  const [thresholds, setThresholds] = useState<Record<number, Threshold[]>>({});
  const [error, setError] = useState<unknown>(null);
  const { devices, error: devError, reload: reloadDevices } = useLiveDevices(houseId);
  const { latest, error: latestError, reload: reloadLatest } = useLiveLatest(houseId);
  const openAlerts = useLiveOpenAlerts(houseId);

  const load = useCallback(async () => {
    try {
      const z = await api<Zone[]>(`/api/houses/${houseId}/zones`);
      setZones(z);
      const all = await Promise.all(z.map((zone) => api<Threshold[]>(`/api/zones/${zone.zoneId}/thresholds`)));
      setThresholds(Object.fromEntries(z.map((zone, i) => [zone.zoneId, all[i]])));
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, [houseId]);
  useEffect(() => {
    void load().catch(() => {});
  }, [load]);
  // Tai trang luc backend loi thi khong ket o thong bao sau khi noi lai.
  useReloadOnConnect(load);

  if (error) return <Banner error={error} onRetry={load} />;
  if (!zones) return <Loading />;
  if (zones.length === 0) return <Empty>Nhà chưa có khu vực nào.</Empty>;

  const sum = summarize(devices);
  return (
    <div className="grid gap-5">
      <Banner error={devError ?? latestError} onRetry={() => Promise.all([reloadDevices(), reloadLatest()])} />
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryTile label="Cảnh báo đang mở" value={openAlerts.length} icon={<IconBell className="size-6" />} alarm={openAlerts.length > 0} />
        <SummaryTile label="Thiết bị đang bật" value={sum ? `${sum.on}/${sum.total}` : '—'} icon={<IconPower className="size-6" />} alarm={false} />
        <SummaryTile label="Cảm biến OFFLINE" value={sum ? sum.offlineSensors : '—'} icon={<IconWifiOff className="size-6" />} alarm={!!sum?.offlineSensors} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {zones.map((zone) => {
          const zoneDevices = (devices ?? []).filter((d) => d.zoneId === zone.zoneId && d.isActive);
          const sensor = zoneDevices.find((d) => d.deviceType === 'SENSOR');
          const zoneAlerts = openAlerts.filter((a) => a.zoneId === zone.zoneId).length;
          const readings = sensor ? METRICS.map((m) => latest[latestKey(sensor.deviceId, m)]) : [];
          const updated = latestAt(readings.filter((r) => r !== undefined).map((r) => r.at));
          return (
            <Card key={zone.zoneId} title={
              <span className="flex flex-wrap items-center gap-2 text-xl">
                {zone.name}
                {sensor && showOffline(sensor.deviceType, sensor.status) ? <Pill tone="off" icon={<IconWifiOff className="size-4" />}>OFFLINE</Pill> : null}
                {zoneAlerts ? <Pill tone="bad" icon={<IconBell className="size-4" />}>{zoneAlerts} cảnh báo</Pill> : null}
              </span>
            }>
              {updated ? <p className="-mt-2 mb-3 text-base text-slate-700">Cập nhật lúc {formatVn(updated)}</p> : null}
              {sensor ? (
                <dl className="mb-4 grid grid-cols-2 gap-3">
                  {METRICS.map((m, i) => {
                    const r = readings[i];
                    const breach = thresholdBreach(r?.value ?? null, thresholds[zone.zoneId]?.find((t) => t.metricCode === m));
                    return (
                      <div key={m} className={`rounded-xl border-2 p-3 ${breach ? 'border-red-600 bg-red-50' : 'border-white/80 bg-white/75'}`}>
                        <dt className={`text-base font-medium ${breach ? 'text-red-900' : 'text-slate-700'}`}>{METRIC_LABELS[m]}</dt>
                        <dd className={`text-[32px] leading-tight font-bold tabular-nums ${breach ? 'text-red-800' : 'text-slate-900'}`}>
                          {r?.value ?? '—'} <span className="text-lg font-medium">{r?.unit ?? ''}</span>
                        </dd>
                        {breach ? (
                          <dd className="mt-1 flex items-center gap-1.5 text-base font-semibold text-red-800">
                            <IconAlert className="size-5" />
                            {breach.kind === 'max' ? `Vượt ngưỡng (Max ${breach.limit})` : `Dưới ngưỡng (Min ${breach.limit})`}
                          </dd>
                        ) : null}
                      </div>
                    );
                  })}
                </dl>
              ) : null}
              {sensor && !updated ? <Empty>Chưa có số đo</Empty> : null}
              <ul className="text-base">
                {zoneDevices.filter((d) => d.deviceType !== 'SENSOR' && d.deviceType !== 'CAMERA').map((d) => (
                  <li key={d.deviceId} className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 py-2">
                    <span className="font-medium text-slate-900">{deviceTitle(DEVICE_LABELS[d.deviceType], d.name)}</span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Pill tone={d.isOn ? 'ok' : 'neutral'} icon={<IconPower className="size-4" />}>{deviceText(d)}</Pill>
                      {showOffline(d.deviceType, d.status) ? <Pill tone="off" icon={<IconWifiOff className="size-4" />}>OFFLINE</Pill> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
