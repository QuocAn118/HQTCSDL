import { describe, expect, it } from 'vitest';
import { pivotDaily } from '../components/history';
import type { DailyStat, Metric } from '../lib/types';

const st = (dayVn: string, metric: Metric, avgValue: number): DailyStat => ({ zoneId: 1, metric, dayVn, avgValue, minValue: avgValue - 1, maxValue: avgValue + 1, samples: 10 });
const M: Metric[] = ['TEMP', 'HUMID', 'CO2', 'LIGHT'];

describe('pivotDaily (bang thong ke: mot dong moi ngay)', () => {
  it('mot dong moi ngay theo thu tu API, o theo chi so', () => {
    const a = st('2026-11-12', 'CO2', 600);
    const b = st('2026-11-12', 'TEMP', 28);
    const c = st('2026-11-13', 'TEMP', 29);
    const rows = pivotDaily([a, b, c], M);
    expect(rows.map((r) => r.dayVn)).toEqual(['2026-11-12', '2026-11-13']);
    expect(rows[0].cells).toEqual({ TEMP: b, HUMID: null, CO2: a, LIGHT: null });
  });
  it('ngay thieu mot chi so -> o do la null, cac o khac van du', () => {
    const rows = pivotDaily([st('2026-11-13', 'TEMP', 28), st('2026-11-13', 'HUMID', 82), st('2026-11-13', 'CO2', 600)], M);
    expect(rows).toHaveLength(1);
    expect(rows[0].cells.LIGHT).toBeNull();
    expect(rows[0].cells.HUMID?.avgValue).toBe(82);
  });
  it('rong -> []', () => expect(pivotDaily([], M)).toEqual([]));
});
