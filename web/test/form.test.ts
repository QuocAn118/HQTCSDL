import { describe, expect, it } from 'vitest';
import { cleanName, NAME_PATTERN, parseDecimal } from '../lib/form';

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

describe('cleanName (ten nhap qua window.prompt)', () => {
  it('huy, rong, toan khoang trang -> null: khong gui', () => {
    expect(cleanName(null)).toBeNull();
    expect(cleanName('')).toBeNull();
    expect(cleanName('   ')).toBeNull();
  });

  it('co chu -> bo khoang trang hai dau', () => {
    expect(cleanName('  Tang 2 ')).toBe('Tang 2');
  });
});

describe('NAME_PATTERN (o nhap ten, trinh duyet bao ca chuoi)', () => {
  const ok = (v: string) => new RegExp(`^(?:${NAME_PATTERN})$`).test(v);

  it('ten bat ky co chu -> hop le', () => {
    expect(ok('Nhà 1')).toBe(true);
    expect(ok(' f2')).toBe(true);
  });

  it('toan khoang trang -> khong hop le', () => {
    expect(ok('   ')).toBe(false);
  });
});
