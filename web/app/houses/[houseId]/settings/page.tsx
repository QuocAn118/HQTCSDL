'use client';
// Cai dat: sua nha; them/sua khu vuc; them thiet bi, doi ten, ngung dung; sua nguong Min/Max/Target (spec web 2.2).
import { useParams } from 'next/navigation';
import { useCallback, useContext, useEffect, useState, type FormEvent } from 'react';
import { groupByZone } from '@/components/devices';
import { IconCheck, IconPower } from '@/components/icons';
import { Banner, btnCls, btnGhostCls, Card, fieldError, inputCls, Loading, Pill } from '@/components/ui';
import { api } from '@/lib/api';
import { DEVICE_LABELS } from '@/lib/config';
import { cleanName, NAME_PATTERN, parseDecimal } from '@/lib/form';
import { HouseChangedContext } from '@/lib/houses';
import type { Device, DeviceType, House, MetricInfo, Threshold, Zone } from '@/lib/types';

const TYPES: DeviceType[] = ['SENSOR', 'FAN', 'MIST', 'HEATER', 'SPEAKER', 'CAMERA'];
const KEYS = ['min', 'max', 'target'] as const;
const KEY_LABELS = { min: 'Min', max: 'Max', target: 'Mục tiêu' };
const str = (n: number | null) => (n === null ? '' : String(n));
const labelCls = 'flex flex-col gap-1.5 text-base font-medium text-slate-800';
const fieldErrCls = 'text-base font-normal text-red-800';

function Thresholds({ zone, metrics }: { zone: Zone; metrics: MetricInfo[] }) {
  const [rows, setRows] = useState<Record<string, { min: string; max: string; target: string }>>({});
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const list = await api<Threshold[]>(`/api/zones/${zone.zoneId}/thresholds`);
    setRows(Object.fromEntries(metrics.map((m) => {
      const t = list.find((x) => x.metricCode === m.metricCode);
      return [m.metricCode, { min: str(t?.minValue ?? null), max: str(t?.maxValue ?? null), target: str(t?.targetValue ?? null) }];
    })));
  }, [zone.zoneId, metrics]);
  useEffect(() => {
    load().catch(setError);
  }, [load]);

  async function save(code: string) {
    setError(null);
    setSaved(null);
    const [minValue, maxValue, targetValue] = KEYS.map((k) => parseDecimal(rows[code][k]));
    if (minValue === 'invalid' || maxValue === 'invalid' || targetValue === 'invalid') {
      setInvalid(code);
      return;
    }
    setInvalid(null);
    setBusy(true);
    try {
      await api(`/api/zones/${zone.zoneId}/thresholds/${code}`, 'PUT', { minValue, maxValue, targetValue });
      setSaved(code);
    } catch (e) {
      setError(e);
    }
    setBusy(false);
  }

  const set = (code: string, key: (typeof KEYS)[number], v: string) => setRows({ ...rows, [code]: { ...rows[code], [key]: v } });
  return (
    <div className="mt-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-left text-base">
          <thead className="text-slate-800"><tr><th className="py-2 pr-3 font-semibold">Chỉ số</th><th className="py-2 pr-3 font-semibold">Min</th><th className="py-2 pr-3 font-semibold">Max</th><th className="py-2 pr-3 font-semibold">Mục tiêu</th><th /></tr></thead>
          <tbody className="text-slate-900">
            {metrics.map((m) => rows[m.metricCode] ? (
              <tr key={m.metricCode} className="border-t border-slate-200">
                <th scope="row" className="py-2 pr-3 font-medium whitespace-nowrap">{m.name} ({m.unit})</th>
                {KEYS.map((k) => (
                  <td key={k} className="py-2 pr-3"><input aria-label={`${zone.name} ${m.metricCode} ${KEY_LABELS[k]}`} className={`${inputCls} w-24`} inputMode="decimal" value={rows[m.metricCode][k]} onChange={(e) => set(m.metricCode, k, e.target.value)} /></td>
                ))}
                <td className="py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button aria-label={`Lưu ngưỡng ${zone.name} ${m.metricCode}`} className={btnGhostCls} disabled={busy} onClick={() => save(m.metricCode)}>Lưu</button>
                    {saved === m.metricCode ? <span className="inline-flex items-center gap-1 text-base text-emerald-800"><IconCheck className="size-4" />Đã lưu</span> : null}
                    {invalid === m.metricCode ? <span className="text-base text-red-800">Min, Max, Mục tiêu phải là số, nhỏ hơn 10 triệu</span> : null}
                  </div>
                </td>
              </tr>
            ) : null)}
          </tbody>
        </table>
      </div>
      <Banner error={error} />
    </div>
  );
}

type FormCard = 'house' | 'zone' | 'device';

export default function SettingsPage() {
  const houseId = Number(useParams<{ houseId: string }>().houseId);
  const onHouseChanged = useContext(HouseChangedContext);
  const [house, setHouse] = useState<House | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [metrics, setMetrics] = useState<MetricInfo[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [houseForm, setHouseForm] = useState({ name: '', address: '' });
  const [zoneForm, setZoneForm] = useState({ name: '', floorNo: '1' });
  const [devForm, setDevForm] = useState({ zoneId: '', code: '', name: '', deviceType: 'SENSOR' as DeviceType });
  // Loi hien ngay trong the dang thao tac: trang dai, va truong "name" co o ca ba form.
  const [formError, setFormError] = useState<{ card: FormCard; error: unknown } | null>(null);
  const [busy, setBusy] = useState(false);
  const errorOf = (card: FormCard) => (formError?.card === card ? formError.error : null);

  const load = useCallback(async () => {
    try {
      const [h, z, d, m] = await Promise.all([
        api<House>(`/api/houses/${houseId}`), api<Zone[]>(`/api/houses/${houseId}/zones`),
        api<Device[]>(`/api/houses/${houseId}/devices`), api<MetricInfo[]>('/api/metrics'),
      ]);
      setHouse(h);
      onHouseChanged(h);
      // Tai lai sau moi thao tac: khong xoa phan dang go o form nha, khong doi metrics de ngung tai lai (va mat) o nhap nguong.
      setHouseForm((f) => (f.name ? f : { name: h.name, address: h.address ?? '' }));
      setZones(z);
      setDevices(d);
      setMetrics((cur) => (cur.length ? cur : m));
      setDevForm((f) => ({ ...f, zoneId: f.zoneId || String(z[0]?.zoneId ?? '') }));
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, [houseId, onHouseChanged]);
  useEffect(() => {
    void load().catch(() => {});
  }, [load]);

  async function run(card: FormCard, fn: () => Promise<unknown>) {
    setFormError(null);
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e) {
      setFormError({ card, error: e });
    }
    setBusy(false);
  }

  const submit = (card: FormCard, fn: () => Promise<unknown>) => (e: FormEvent) => {
    e.preventDefault();
    void run(card, fn).catch(() => {});
  };

  if (error && !house) return <Banner error={error} onRetry={load} />;
  if (!house) return <Loading />;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <Banner error={error} onRetry={load} />
      <Card title="Nhà">
        <form className="grid items-start gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={submit('house', () => api(`/api/houses/${houseId}`, 'PATCH', { name: houseForm.name, address: houseForm.address || null }))}>
          <label className={labelCls}>Tên<input className={inputCls} value={houseForm.name} maxLength={100} required pattern={NAME_PATTERN} title="Tên không được để trống" onChange={(e) => setHouseForm({ ...houseForm, name: e.target.value })} />
            <span className={fieldErrCls}>{fieldError(errorOf('house'), 'name')}</span></label>
          <label className={labelCls}>Địa chỉ<input className={inputCls} value={houseForm.address} maxLength={255} onChange={(e) => setHouseForm({ ...houseForm, address: e.target.value })} />
            <span className={fieldErrCls}>{fieldError(errorOf('house'), 'address')}</span></label>
          <button className={`${btnCls} sm:mt-[1.875rem]`} disabled={busy}>Lưu</button>
        </form>
        <Banner error={errorOf('house')} />
      </Card>

      <Card title="Khu vực và ngưỡng">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
          {zones.map((z) => (
            <details key={z.zoneId} className="min-w-0 rounded-xl border border-slate-300 bg-white/60 px-4 py-1">
              <summary className="min-h-10 cursor-pointer py-2 text-base font-semibold text-slate-900">{z.name} (tầng {z.floorNo})</summary>
              <div className="pb-3">
                <button className={`${btnGhostCls} mt-2`} disabled={busy} onClick={() => {
                  const name = cleanName(window.prompt('Tên khu vực mới', z.name));
                  if (name) void run('zone', () => api(`/api/zones/${z.zoneId}`, 'PATCH', { name })).catch(() => {});
                }}>Đổi tên</button>
                <Thresholds zone={z} metrics={metrics} />
              </div>
            </details>
          ))}
        </div>
        <form className="mt-4 grid items-start gap-3 border-t border-slate-200 pt-4 sm:grid-cols-[1fr_8rem_auto]" onSubmit={submit('zone', async () => {
          await api(`/api/houses/${houseId}/zones`, 'POST', { name: zoneForm.name, floorNo: Number(zoneForm.floorNo) });
          setZoneForm({ name: '', floorNo: '1' });
        })}>
          <label className={labelCls}>Tên khu vực<input className={inputCls} value={zoneForm.name} maxLength={50} required pattern={NAME_PATTERN} title="Tên không được để trống" onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })} />
            <span className={fieldErrCls}>{fieldError(errorOf('zone'), 'name')}</span></label>
          <label className={labelCls}>Tầng<input className={inputCls} type="number" min={0} max={255} required value={zoneForm.floorNo} onChange={(e) => setZoneForm({ ...zoneForm, floorNo: e.target.value })} />
            <span className={fieldErrCls}>{fieldError(errorOf('zone'), 'floorNo')}</span></label>
          <button className={`${btnCls} sm:mt-[1.875rem]`} disabled={busy}>Thêm khu vực</button>
        </form>
        <Banner error={errorOf('zone')} />
      </Card>

      <Card title="Thiết bị">
        <div className="grid gap-5">
          {groupByZone(zones, devices).map(({ zone, devices: list }) => (
            <section key={zone?.zoneId ?? 'khac'}>
              <h3 className="mb-1 text-base font-semibold text-slate-900">{zone ? zone.name : 'Khác'}</h3>
              <ul>
                {list.map((d) => (
                  <li key={d.deviceId} className={`flex flex-wrap items-center gap-x-4 gap-y-2 border-t py-2.5 ${d.isActive ? 'border-slate-200' : 'border-dashed border-slate-300 bg-slate-100/70'}`}>
                    <div className="min-w-0 flex-1 basis-56">
                      <p className={`font-semibold ${d.isActive ? 'text-slate-900' : 'text-slate-700'}`}>{d.name}</p>
                      <p className="text-base text-slate-700">{d.code} · {DEVICE_LABELS[d.deviceType]}</p>
                    </div>
                    {/* Thiet bi ngung dung: nen xam, vien net dut, nhan icon + chu (khong chi lam mo chu). */}
                    {d.isActive ? null : <Pill tone="neutral" icon={<IconPower className="size-4" />}>Ngừng dùng</Pill>}
                    <div className="flex gap-2">
                      <button className={btnGhostCls} disabled={busy} onClick={() => {
                        const name = cleanName(window.prompt('Tên thiết bị mới', d.name));
                        if (name) void run('device', () => api(`/api/devices/${d.deviceId}`, 'PATCH', { name })).catch(() => {});
                      }}>Đổi tên</button>
                      <button className={btnGhostCls} disabled={busy} onClick={() => run('device', () => api(`/api/devices/${d.deviceId}`, 'PATCH', { isActive: !d.isActive }))}>
                        {d.isActive ? 'Ngừng dùng' : 'Dùng lại'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <form className="mt-4 grid items-start gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2 lg:grid-cols-[auto_1fr_1fr_auto_auto]" onSubmit={submit('device', async () => {
          await api(`/api/zones/${devForm.zoneId}/devices`, 'POST', { code: devForm.code, name: devForm.name, deviceType: devForm.deviceType });
          setDevForm((f) => ({ ...f, code: '', name: '' }));
        })}>
          <label className={labelCls}>Khu vực
            <select aria-label="Khu vực của thiết bị" className={inputCls} value={devForm.zoneId} onChange={(e) => setDevForm({ ...devForm, zoneId: e.target.value })}>
              {zones.map((z) => <option key={z.zoneId} value={z.zoneId}>{z.name}</option>)}
            </select>
          </label>
          <label className={labelCls}>Mã (A-Z, 0-9, -)<input className={inputCls} value={devForm.code} required pattern="[A-Z0-9\-]{3,50}" title="3-50 ký tự: chữ A-Z, số 0-9, dấu gạch ngang" onChange={(e) => setDevForm({ ...devForm, code: e.target.value.toUpperCase() })} />
            <span className={fieldErrCls}>{fieldError(errorOf('device'), 'code')}</span></label>
          <label className={labelCls}>Tên<input className={inputCls} value={devForm.name} required maxLength={100} pattern={NAME_PATTERN} title="Tên không được để trống" onChange={(e) => setDevForm({ ...devForm, name: e.target.value })} />
            <span className={fieldErrCls}>{fieldError(errorOf('device'), 'name')}</span></label>
          <label className={labelCls}>Loại
            <select aria-label="Loại thiết bị" className={inputCls} value={devForm.deviceType} onChange={(e) => setDevForm({ ...devForm, deviceType: e.target.value as DeviceType })}>
              {TYPES.map((t) => <option key={t} value={t}>{DEVICE_LABELS[t]}</option>)}
            </select>
          </label>
          <button className={`${btnCls} lg:mt-[1.875rem]`} disabled={busy || !devForm.zoneId}>Thêm thiết bị</button>
        </form>
        <Banner error={errorOf('device')} />
      </Card>
    </div>
  );
}
