'use client';
// Lich su: bieu do so do theo bucket (+ noi so do truc tiep khi khoang chua hien tai), thong ke theo ngay,
// dem chim ra/vao theo ngay (tai lai khi birdcount.updated, gom trong 2 giay). Spec web 2.2, 2.3, 2.4.
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Banner, btnCls, Card, Empty, inputCls, Loading } from '@/components/ui';
import { api, qs } from '@/lib/api';
import { METRIC_LABELS } from '@/lib/config';
import { useLive, useReloadOnConnect } from '@/lib/live';
import { appendLive, createLoadGate, type ChartPoint } from '@/lib/merge';
import { formatVnTime, msToVnInput, todayVn, toMs, vnInputToIso } from '@/lib/time';
import type { BirdFlow, DailyStat, Metric, ReadingBucket, ReadingsNew, Zone } from '@/lib/types';

const METRICS: Metric[] = ['TEMP', 'HUMID', 'CO2', 'LIGHT'];
const BUCKETS = [5, 15, 60, 1440];
const DAY = 24 * 60 * 60 * 1000;

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
  return (
    <div className="grid gap-4">
      <Banner error={error} onRetry={reloadAll} />
      <Card title="Số đo môi trường">
        <div className="mb-3 flex flex-wrap items-end gap-2 text-sm">
          <select aria-label="Khu vực" className={inputCls} value={zoneId ?? ''} onChange={(e) => setZoneId(Number(e.target.value))}>
            {zones?.map((z) => <option key={z.zoneId} value={z.zoneId}>{z.name}</option>)}
          </select>
          <select aria-label="Chỉ số" className={inputCls} value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
            {METRICS.map((m) => <option key={m} value={m}>{METRIC_LABELS[m]}</option>)}
          </select>
          <label className="flex flex-col">Từ (giờ VN)<input type="datetime-local" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="flex flex-col">Đến (giờ VN)<input type="datetime-local" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <select aria-label="Gom theo" className={inputCls} value={bucket} onChange={(e) => setBucket(Number(e.target.value))}>
            {BUCKETS.map((b) => <option key={b} value={b}>{b} phút</option>)}
          </select>
          <button className={btnCls} onClick={reloadAll}>Xem</button>
        </div>
        {noZones ? <Empty>Chưa có khu vực</Empty> : points === null ? (error ? null : <Loading />) : points.length === 0 ? <Empty>Không có dữ liệu</Empty> : (
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={points}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} tickFormatter={formatVnTime} />
                <YAxis domain={['auto', 'auto']} />
                <Tooltip labelFormatter={(t) => formatVnTime(Number(t))} />
                <Line dataKey="value" name={METRIC_LABELS[metric]} stroke="#047857" dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
      <Card title="Thống kê theo ngày (7 ngày)">
        <Banner error={statsError} onRetry={loadStats} />
        {noZones ? <Empty>Chưa có khu vực</Empty> : stats === null ? (statsError ? null : <Loading />) : stats.length === 0 ? <Empty>Không có dữ liệu</Empty> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left"><th>Ngày</th><th>Chỉ số</th><th>TB</th><th>Thấp nhất</th><th>Cao nhất</th><th>Số mẫu</th></tr></thead>
            <tbody>
              {stats.map((s) => (
                <tr key={`${s.dayVn}-${s.metric}`} className="border-t">
                  <td>{s.dayVn}</td><td>{METRIC_LABELS[s.metric]}</td><td>{s.avgValue}</td><td>{s.minValue}</td><td>{s.maxValue}</td><td>{s.samples}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <Card title="Chim ra/vào theo ngày (14 ngày)">
        <Banner error={flowError} onRetry={loadFlow} />
        {flow === null ? (flowError ? null : <Loading />) : flow.length === 0 ? <Empty>Không có dữ liệu</Empty> : (
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={flow}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dayVn" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="inTotal" name="Vào" fill="#047857" />
                <Bar dataKey="outTotal" name="Ra" fill="#b45309" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}
