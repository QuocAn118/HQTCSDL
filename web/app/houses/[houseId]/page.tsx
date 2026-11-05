'use client';
// Dashboard: the moi khu vuc voi so do moi nhat (to mau ngoai nguong), trang thai thiet bi, so canh bao dang mo.
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Banner, Card, Empty, Loading } from '@/components/ui';
import { api } from '@/lib/api';
import { DEVICE_LABELS, METRIC_LABELS, showOffline } from '@/lib/config';
import { useLiveDevices, useLiveLatest, useLiveOpenAlerts } from '@/lib/hooks';
import { useReloadOnConnect } from '@/lib/live';
import { latestKey } from '@/lib/merge';
import { formatVn } from '@/lib/time';
import type { Device, Metric, Threshold, Zone } from '@/lib/types';

const METRICS: Metric[] = ['TEMP', 'HUMID', 'CO2', 'LIGHT'];

function outOfRange(value: number | null, t: Threshold | undefined): boolean {
  if (value === null || !t) return false;
  return (t.minValue !== null && value < t.minValue) || (t.maxValue !== null && value > t.maxValue);
}

function deviceText(d: Device): string {
  if (d.isOn === null) return '—';
  const lvl = d.deviceType === 'FAN' && d.isOn && d.level !== null ? ` ${d.level}%` : '';
  return `${d.isOn ? 'Bật' : 'Tắt'}${lvl} · ${d.mode === 'MANUAL' ? 'Tay' : 'Tự động'}`;
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

  return (
    <div>
      <Banner error={devError ?? latestError} onRetry={() => Promise.all([reloadDevices(), reloadLatest()])} />
      <p className="mb-4 text-sm">
        Cảnh báo đang mở: <strong className={openAlerts.length ? 'text-red-700' : ''}>{openAlerts.length}</strong>
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {zones.map((zone) => {
          const zoneDevices = (devices ?? []).filter((d) => d.zoneId === zone.zoneId && d.isActive);
          const sensor = zoneDevices.find((d) => d.deviceType === 'SENSOR');
          const zoneAlerts = openAlerts.filter((a) => a.zoneId === zone.zoneId).length;
          return (
            <Card key={zone.zoneId} title={
              <span className="flex items-center gap-2">
                {zone.name}
                {sensor && showOffline(sensor.deviceType, sensor.status) ? <span className="rounded bg-stone-700 px-1.5 text-xs text-white">OFFLINE</span> : null}
                {zoneAlerts ? <span className="rounded bg-red-600 px-1.5 text-xs text-white">{zoneAlerts} cảnh báo</span> : null}
              </span>
            }>
              {sensor ? (
                <dl className="mb-3 grid grid-cols-2 gap-2">
                  {METRICS.map((m) => {
                    const r = latest[latestKey(sensor.deviceId, m)];
                    const bad = outOfRange(r?.value ?? null, thresholds[zone.zoneId]?.find((t) => t.metricCode === m));
                    return (
                      <div key={m} className={`rounded p-2 ${bad ? 'bg-red-100 text-red-800' : 'bg-stone-100'}`}>
                        <dt className="text-xs">{METRIC_LABELS[m]}</dt>
                        <dd className="text-lg font-semibold">{r?.value ?? '—'} <span className="text-xs font-normal">{r?.unit ?? ''}</span></dd>
                        {r ? <dd className="text-xs text-stone-500">{formatVn(r.at)}</dd> : null}
                      </div>
                    );
                  })}
                </dl>
              ) : null}
              {sensor && METRICS.every((m) => !latest[latestKey(sensor.deviceId, m)]) ? <Empty>Chưa có số đo</Empty> : null}
              <ul className="text-sm">
                {zoneDevices.filter((d) => d.deviceType !== 'SENSOR' && d.deviceType !== 'CAMERA').map((d) => (
                  <li key={d.deviceId} className="flex justify-between border-t py-1">
                    <span>{DEVICE_LABELS[d.deviceType]} — {d.name}</span>
                    <span>
                      {deviceText(d)}
                      {showOffline(d.deviceType, d.status) ? <span className="ml-1 rounded bg-stone-700 px-1 text-xs text-white">OFFLINE</span> : null}
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
