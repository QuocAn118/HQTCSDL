import { validateReadings } from './ingest';

const AT = '2026-10-12T10:40:07Z';
const el = (o: Record<string, unknown> = {}) => ({
  device: 'H1-F1-SENSOR',
  metric: 'TEMP',
  value: 28.5,
  at: AT,
  ...o,
});
const run = (payload: unknown, raw?: string) =>
  validateReadings('H1-F1-SENSOR', Buffer.from(raw ?? JSON.stringify(payload)));

describe('validateReadings (hop dong 2.3, spec backend 4.1)', () => {
  it('phan tu hop le vao items, giu thu tu', () => {
    const r = run([el(), el({ metric: 'HUMID', value: 82 })]);
    expect(r.items.map((i) => i.metric)).toEqual(['TEMP', 'HUMID']);
    expect(r.rejected).toEqual([]);
  });

  it.each([
    ['thieu Z', el({ at: '2026-10-12T10:40:07' }), 'THOI_GIAN'],
    ['+07:00', el({ at: '2026-10-12T17:40:07+07:00' }), 'THOI_GIAN'],
    ['device khac topic', el({ device: 'H1-F2-SENSOR' }), 'SAI_THIET_BI'],
    [
      'thieu metric',
      { device: 'H1-F1-SENSOR', value: 1, at: AT },
      'THIEU_TRUONG',
    ],
    ['value chuoi so (Review Focus 1)', el({ value: '28.5' }), 'SAI_KIEU'],
    ['value null', el({ value: null }), 'SAI_KIEU'],
    ['metric khong phai chuoi', el({ metric: 5 }), 'SAI_KIEU'],
    ['phan tu khong phai object', 42, 'SAI_KIEU'],
  ])('%s -> bo phan tu, ly do %s; phan tu dung van nhan', (_l, bad, reason) => {
    const r = run([el(), bad]);
    expect(r.items).toHaveLength(1);
    expect(r.rejected.map((x) => x.reason)).toEqual([reason]);
    expect(r.rejected[0].example.length).toBeLessThanOrEqual(200);
  });

  it('so vo han (1e999) -> SAI_KIEU', () => {
    expect(
      run(
        null,
        `[{"device":"H1-F1-SENSOR","metric":"TEMP","value":1e999,"at":"${AT}"}]`,
      ).rejected[0].reason,
    ).toBe('SAI_KIEU');
  });

  // Review Focus 1: JSON khong co NaN, nen ca tin khong parse duoc.
  it('value NaN -> KHONG_PHAI_JSON, bo ca tin', () => {
    const r = run(
      null,
      `[{"device":"H1-F1-SENSOR","metric":"TEMP","value":NaN,"at":"${AT}"}]`,
    );
    expect(r.items).toEqual([]);
    expect(r.rejected[0].reason).toBe('KHONG_PHAI_JSON');
  });

  it('khong phai JSON / khong phai mang -> bo ca tin', () => {
    expect(run(null, '{hong').rejected).toEqual([
      { reason: 'KHONG_PHAI_JSON', example: '{hong' },
    ]);
    expect(run(el()).items).toEqual([]);
    expect(run(el()).rejected[0].reason).toBe('KHONG_PHAI_MANG');
  });
});
