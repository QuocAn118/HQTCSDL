// Ham thuan cho trang Lich su (web-ui T5): xoay thong ke ngay thanh mot dong moi ngay, mot o moi chi so.
import type { DailyStat, Metric } from '../lib/types';

export interface DayRow { dayVn: string; cells: Record<Metric, DailyStat | null> }

// Giu thu tu ngay nhu API tra; ngay thieu chi so nao thi o do la null.
export function pivotDaily(stats: DailyStat[], metrics: readonly Metric[]): DayRow[] {
  const rows = new Map<string, DayRow>();
  for (const s of stats) {
    let row = rows.get(s.dayVn);
    if (!row) rows.set(s.dayVn, (row = { dayVn: s.dayVn, cells: Object.fromEntries(metrics.map((m) => [m, null])) as DayRow['cells'] }));
    if (s.metric in row.cells) row.cells[s.metric] = s;
  }
  return [...rows.values()];
}
