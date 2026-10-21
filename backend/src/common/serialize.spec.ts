import { assertSerialized, parseJsonColumn, serialize } from './serialize';

class Decimal {
  constructor(private readonly s: string) {}
  toFixed() {
    return this.s;
  }
  toString() {
    return this.s;
  }
}

describe('serialize', () => {
  it('doi kieu theo gia tri va khoa camelCase, giu thu tu khoa', () => {
    const out = serialize({
      HouseId: 1,
      Value: new Decimal('31.20'),
      ReadingId: 9007199254740993n,
      CreatedAt: new Date(Date.UTC(2026, 9, 12, 10, 40)),
      Nested: [{ MetricCode: 'TEMP', X: undefined }],
    });
    expect(out).toEqual({
      houseId: 1,
      value: 31.2,
      readingId: '9007199254740993',
      createdAt: '2026-10-12T10:40:00.000Z',
      nested: [{ metricCode: 'TEMP', x: null }],
    });
    expect(Object.keys(out as object)).toEqual([
      'houseId',
      'value',
      'readingId',
      'createdAt',
      'nested',
    ]);
  });

  it('chuoi thoi gian tu cot JSON cua SP giu nguyen (...Z)', () => {
    expect(serialize({ CreatedAt: '2026-10-12T10:40:00Z' })).toEqual({
      createdAt: '2026-10-12T10:40:00Z',
    });
  });

  it('assertSerialized bat khoa PascalCase, Date, Decimal, bigint', () => {
    expect(() => assertSerialized({ HouseId: 1 })).toThrow(/HouseId/);
    expect(() => assertSerialized({ a: new Date() })).toThrow(/Date/);
    expect(() => assertSerialized({ a: [{ b: new Decimal('1') }] })).toThrow(
      /Decimal/,
    );
    expect(() => assertSerialized({ a: 1n })).toThrow(/bigint/);
    expect(() =>
      assertSerialized(serialize({ HouseId: 1, V: new Decimal('2') })),
    ).not.toThrow();
  });

  it('parseJsonColumn', () => {
    expect(parseJsonColumn('[{"AlertId":1}]', [])).toEqual([{ AlertId: 1 }]);
    expect(parseJsonColumn(null, [])).toEqual([]);
  });
});
