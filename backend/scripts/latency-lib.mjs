// Ham thuan cho script do do tre (spec backend 7.3). Test: npm run test:scripts.

export function percentile(values, p) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
}

export function summarize(values, targetMs, lost = 0) {
  if (!values.length) return { n: 0, p50: 0, p95: 0, p99: 0, max: 0, overTarget: 0, lost };
  return {
    n: values.length,
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    p99: percentile(values, 99),
    max: Math.max(...values),
    overTarget: values.filter((v) => v > targetMs).length / values.length,
    lost,
  };
}

export function toCsv(rows) {
  return ['kind,zone,at,ms,status', ...rows.map((r) => `${r.kind},${r.zone},${r.at},${r.ms},${r.status}`)].join('\n') + '\n';
}

// Khoa duy nhat cua so do trong CSDL: UQ(DeviceId, MetricCode, RecordedAt) (hop dong 2.2).
const keyOf = (device, metric, at) => `${device}|${metric}|${Date.parse(at)}`;

// Ghep mau tu gui voi su kien readings.new. Thoi gian (ms) do nguoi goi dua vao, de test khong phu thuoc dong ho.
// ok: nhan dung gia tri da gui; mat: qua han; trung: cung giay voi so do khac (simulator) nen mau bi CSDL bo.
export function createTracker(timeoutMs) {
  const pending = new Map();
  const seen = new Set();
  const rows = [];
  return {
    rows,
    pending: () => pending.size,
    sent(p, t) {
      const k = keyOf(p.device, p.metric, p.at);
      if (seen.has(k) || pending.has(k)) return false;
      pending.set(k, { ...p, t });
      return true;
    },
    received(r, t) {
      const k = keyOf(r.deviceCode, r.metric, r.at);
      seen.add(k);
      const p = pending.get(k);
      if (!p) return false;
      pending.delete(k);
      const ok = Number(r.value) === p.value;
      rows.push({ kind: 'probe', zone: p.device, at: p.at, ms: ok ? Math.round(t - p.t) : '', status: ok ? 'ok' : 'trung' });
      return ok;
    },
    expire(t) {
      for (const [k, p] of pending) {
        if (t - p.t <= timeoutMs) continue;
        pending.delete(k);
        rows.push({ kind: 'probe', zone: p.device, at: p.at, ms: '', status: 'mat' });
      }
    },
  };
}

const r2 = (v) => Math.round(v * 100) / 100; // DECIMAL(9,2)

// Gia tri de mo canh bao nguong tren (> Max) va dong lai (<= Max - Hysteresis, sp_IngestReadings).
export function alertValues(th) {
  if (th?.maxValue == null) return null;
  const max = Number(th.maxValue);
  return { high: r2(max + 1.5), close: r2(th.targetValue != null ? Number(th.targetValue) : max - 2) };
}

export const isProbeAlert = (a, p) =>
  a.alertType === 'THRESHOLD' && a.zoneId === p.zoneId && a.metricCode === p.metric && Number(a.value) === p.value;

// Ket qua mot lan do canh bao, theo co alert.created khong va dong cua so do mo canh bao trong tracker.
export const alertStatus = (created, readingRow) =>
  created ? 'ok' : readingRow?.status === 'trung' ? 'trung' : readingRow?.status === 'ok' ? 'khong-mo' : 'mat';
