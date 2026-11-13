'use client';
// Lich su: bieu do so do theo bucket (+ noi so do truc tiep khi khoang chua hien tai), thong ke theo ngay,
// dem chim ra/vao theo ngay (tai lai khi birdcount.updated, gom trong 2 giay). Spec web 2.2, 2.3, 2.4.
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { pivotDaily } from '@/components/history';
import { Banner, btnCls, Card, Empty, inputCls, Loading } from '@/components/ui';
import { api, qs } from '@/lib/api';
import { METRIC_LABELS } from '@/lib/config';
import { useLive, useReloadOnConnect } from '@/lib/live';
import { appendLive, createLoadGate, type ChartPoint } from '@/lib/merge';
import { formatVnTime, msToVnInput, todayVn, toMs, vnInputToIso } from '@/lib/time';
import type { BirdFlow, DailyStat, Metric, MetricInfo, ReadingBucket, ReadingsNew, Zone } from '@/lib/types';

const METRICS: Metric[] = ['TEMP', 'HUMID', 'CO2', 'LIGHT'];
const BUCKETS = [5, 15, 60, 1440];
const DAY = 24 * 60 * 60 * 1000;
const labelCls = 'flex flex-col gap-1.5 text-base font-medium text-slate-800';
const tick = { fill: '#334155', fontSize: 14 };

export default function HistoryPage() {
  const houseId = Number(useParams<{ houseId: string }>().houseId);
  const { subscribe } = useLive();
  const [zones, setZones] = useState<Zone[] | null>(null);
  const [zoneId, setZoneId] = useState<number | null>(null);
  const [metric, setMetric] = useState<Metric>('TEMP');
  const [from, setFrom] = useState(() => msToVnInput(Date.now() - DAY));
  const [to, setTo] = useState(() => msToVnInput(Date.now() + 60 * 60 * 1000));
  const [bucket, setBucket] = useState(15);
  const [points, setPoints] = useState<ChartPoint[] | null>(null);
  const [stats, setStats] = useState<DailyStat[] | null>(null);
  const [flow, setFlow] = useState<BirdFlow[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [statsError, setStatsError] = useState<unknown>(null);
  const [flowError, setFlowError] = useState<unknown>(null);
  // Don vi lay tu /api/metrics; loi thi chi thieu don vi, khong chan trang.
  const [units, setUnits] = useState<Record<string, string>>({});
  const view = useRef<{ zoneId: number; metric: string; fromMs: number; toMs: number } | null>(null);
  const [gate] = useState(createLoadGate<ReadingsNew>);
  const statsSeq = useRef(0);

  const loadZones = useCallback(async () => {
    try {
      const z = await api<Zone[]>(`/api/houses/${houseId}/zones`);
      setZones(z);
      setZoneId((cur) => cur ?? z[0]?.zoneId ?? null);
    } catch (e) {
      setError(e);
    }
  }, [houseId]);

  // Chi lan tai moi nhat duoc ap (doi khu vuc nhanh khong bi ket qua cu de len); so do den trong luc tai noi lai sau REST.
  const loadChart = useCallback(async () => {
    if (zoneId === null) return;
    const id = gate.begin();
    setError(null);
    try {
      const fromIso = vnInputToIso(from);
      const toIso = vnInputToIso(to);
      const rows = await api<ReadingBucket[]>(`/api/zones/${zoneId}/readings${qs({ metric, from: fromIso, to: toIso, bucketMinutes: bucket })}`);
      const held = gate.end(id);
      if (!held) return;
      const v = { zoneId, metric, fromMs: toMs(fromIso), toMs: toMs(toIso) };
      view.current = v;
      const base = rows.filter((r) => r.avgValue !== null).map((r) => ({ key: `b:${toMs(r.bucketUtc)}`, t: toMs(r.bucketUtc), value: r.avgValue as number }));
      setPoints(held.reduce((p, ev) => appendLive(p, ev.readings, v, Date.now()), base));
    } catch (e) {
      if (gate.end(id)) setError(e);
    }
  }, [zoneId, metric, from, to, bucket, gate]);

  // Tach khoi bieu do: view thong ke cham hon nhieu (1,7-2,8 giay), khong de bieu do cho; chi phu thuoc khu vuc.
  const loadStats = useCallback(async () => {
    if (zoneId === null) return;
    const id = ++statsSeq.current;
    setStatsError(null);
    try {
      const daily = await api<DailyStat[]>(`/api/zones/${zoneId}/daily-stats${qs({ fromVnDate: todayVn(Date.now() - 6 * DAY), toVnDate: todayVn(Date.now() + DAY) })}`);
      if (id === statsSeq.current) setStats(daily);
    } catch (e) {
      if (id === statsSeq.current) setStatsError(e);
    }
  }, [zoneId]);

  const loadFlow = useCallback(async () => {
    setFlowError(null);
    try {
      setFlow(await api<BirdFlow[]>(`/api/houses/${houseId}/bird-flow${qs({ fromVnDate: todayVn(Date.now() - 13 * DAY), toVnDate: todayVn(Date.now() + DAY) })}`));
    } catch (e) {
      setFlowError(e);
    }
  }, [houseId]);

  useEffect(() => {
    void loadZones().catch(() => {});
  }, [loadZones]);
  useEffect(() => {
    api<MetricInfo[]>('/api/metrics').then((m) => setUnits(Object.fromEntries(m.map((x) => [x.metricCode, x.unit])))).catch(() => {});
  }, []);
  // Doi khu vuc/chi so/khoang: bo duong cu ngay, de loi hoac tai cham khong hien so cu duoi nhan moi.
  useEffect(() => {
    setPoints(null);
    void loadChart().catch(() => {});
  }, [loadChart]);
  useEffect(() => {
    setStats(null);
    void loadStats().catch(() => {});
  }, [loadStats]);
  useEffect(() => {
    void loadFlow().catch(() => {});
  }, [loadFlow]);
  const reloadAll = () => Promise.all([loadZones(), loadChart(), loadStats(), loadFlow()]);
  // Noi lai sau khi mat ket noi: bu phan da lo (spec web 2.4).
  useReloadOnConnect(reloadAll);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = subscribe((event, payload) => {
      if (event === 'readings.new') {
        const ev = payload as ReadingsNew;
        if (ev.houseId === houseId && !gate.hold(ev) && view.current) {
          const v = view.current;
          setPoints((p) => (p ? appendLive(p, ev.readings, v, Date.now()) : p));
        }
      } else if (event === 'birdcount.updated' && (payload as { houseId: number }).houseId === houseId) {
        clearTimeout(timer);
        timer = setTimeout(() => void loadFlow().catch(() => {}), 2000);
      }
    });
    return () => {
      off();
      clearTimeout(timer);
    };
  }, [subscribe, houseId, loadFlow, gate]);

  const noZones = zones?.length === 0;
  const withUnit = (m: Metric) => (units[m] ? `${METRIC_LABELS[m]} (${units[m]})` : METRIC_LABELS[m]);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <Banner error={error} onRetry={reloadAll} />
      <Card dense title="Số đo môi trường">
        <div className="mb-4 grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap">
          <label className={labelCls}>Khu vực
            <select aria-label="Khu vực" className={inputCls} value={zoneId ?? ''} onChange={(e) => setZoneId(Number(e.target.value))}>
              {zones?.map((z) => <option key={z.zoneId} value={z.zoneId}>{z.name}</option>)}
            </select>
          </label>
          <label className={labelCls}>Chỉ số
            <select aria-label="Chỉ số" className={inputCls} value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
              {METRICS.map((m) => <option key={m} value={m}>{METRIC_LABELS[m]}</option>)}
            </select>
          </label>
          <label className={`${labelCls} col-span-2 sm:col-auto`}>Từ (giờ VN)<input type="datetime-local" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className={`${labelCls} col-span-2 sm:col-auto`}>Đến (giờ VN)<input type="datetime-local" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <label className={labelCls}>Gom theo
            <select aria-label="Gom theo" className={inputCls} value={bucket} onChange={(e) => setBucket(Number(e.target.value))}>
              {BUCKETS.map((b) => <option key={b} value={b}>{b} phút</option>)}
            </select>
          </label>
          <button className={btnCls} onClick={reloadAll}>Xem</button>
        </div>
        {noZones ? <Empty>Chưa có khu vực</Empty> : points === null ? (error ? null : <Loading />) : points.length === 0 ? <Empty>Không có dữ liệu</Empty> : (
          <div className="h-80">
            <ResponsiveContainer>
              <LineChart data={points} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} tickFormatter={formatVnTime} tick={tick} />
                <YAxis domain={['auto', 'auto']} tick={tick} width={64} label={{ value: withUnit(metric), angle: -90, position: 'insideLeft', fill: '#1e293b', fontSize: 14, style: { textAnchor: 'middle' } }} />
                <Tooltip labelFormatter={(t) => formatVnTime(Number(t))} />
                <Line dataKey="value" name={withUnit(metric)} stroke="#047857" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
      <Card dense title="Thống kê theo ngày (7 ngày)">
        <Banner error={statsError} onRetry={loadStats} />
        {noZones ? <Empty>Chưa có khu vực</Empty> : stats === null ? (statsError ? null : <Loading />) : stats.length === 0 ? <Empty>Không có dữ liệu</Empty> : (
          <div className="overflow-x-auto">
            <p id="giai-thich-o" className="sticky left-0 mb-2 text-base text-slate-700">Mỗi ô: TB, dòng dưới là thấp nhất – cao nhất.</p>
            <table aria-describedby="giai-thich-o" className="w-full min-w-[40rem] text-left text-base">
              <thead className="text-slate-800">
                <tr><th className="py-2 pr-4 font-semibold">Ngày</th>{METRICS.map((m) => <th key={m} className="py-2 pr-4 font-semibold">{withUnit(m)}</th>)}</tr>
              </thead>
              <tbody className="text-slate-900">
                {pivotDaily(stats, METRICS).map((row) => (
                  <tr key={row.dayVn} className="border-t border-slate-200">
                    <th scope="row" className="py-2 pr-4 font-medium whitespace-nowrap tabular-nums">{row.dayVn}</th>
                    {METRICS.map((m) => {
                      const c = row.cells[m];
                      return (
                        <td key={m} className="py-2 pr-4 tabular-nums">
                          {c ? <><span className="block font-semibold">TB {c.avgValue ?? '—'}</span><span className="block text-slate-700">{c.minValue ?? '—'} – {c.maxValue ?? '—'}</span></> : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card dense title="Chim ra/vào theo ngày (14 ngày)">
        <Banner error={flowError} onRetry={loadFlow} />
        {flow === null ? (flowError ? null : <Loading />) : flow.length === 0 ? <Empty>Không có dữ liệu</Empty> : (
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={flow} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
                {/* Ra: cot soc cheo, Vao: cot dac -> phan biet duoc ca khi khong nhin ra mau. */}
                <defs>
                  <pattern id="soc-ra" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="8" height="8" fill="#fef3c7" />
                    <rect width="4" height="8" fill="#b45309" />
                  </pattern>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dayVn" tick={tick} />
                <YAxis tick={tick} />
                <Tooltip />
                <Legend verticalAlign="top" height={36} wrapperStyle={{ color: '#1e293b', fontSize: 16 }} />
                <Bar dataKey="inTotal" name="Vào (cột đặc)" fill="#047857" isAnimationActive={false} />
                <Bar dataKey="outTotal" name="Ra (cột sọc)" fill="url(#soc-ra)" stroke="#b45309" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}
