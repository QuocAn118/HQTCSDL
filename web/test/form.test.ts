import { describe, expect, it } from 'vitest';
import { parseDecimal } from '../lib/form';

describe('parseDecimal (nhap nguong)', () => {
  it('rong hoac toan khoang trang -> null (bo nguong)', () => {
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('   ')).toBeNull();
  });

  it('so hop le, co khoang trang, so am, 0', () => {
    expect(parseDecimal(' 30.5 ')).toBe(30.5);
    expect(parseDecimal('-5')).toBe(-5);
    expect(parseDecimal('0')).toBe(0);
  });

  it('dau phay thap phan kieu Viet Nam', () => {
    expect(parseDecimal('30,5')).toBe(30.5);
  });

  it('vuot DECIMAL(9,2) -> invalid, khong de backend bao 500', () => {
    expect(parseDecimal('9999999.99')).toBe(9999999.99);
    expect(parseDecimal('-9999999.99')).toBe(-9999999.99);
    expect(parseDecimal('10000000')).toBe('invalid');
    expect(parseDecimal('9999999.999')).toBe('invalid'); // lam tron 2 so le thanh 10000000.00
    expect(parseDecimal('-99999999')).toBe('invalid');
  });

  // Number('abc') = NaN, JSON.stringify doi thanh null -> am tham xoa nguong.
  it.each(['abc', '3o', '1.2.3', '1,2,3', 'Infinity', '1e3', '0x10', '.', '-'])('%s -> invalid', (s) => {
    expect(parseDecimal(s)).toBe('invalid');
  });
});
