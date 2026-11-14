import { describe, expect, it } from 'vitest';
import { formatVn, msToVnInput, sameInstant, todayVn, toMs, vnInputToIso } from '../lib/time';

describe('time (spec web 2.3)', () => {
  it('hai dang cua cung mot moc cho cung getTime()', () => {
    expect(sameInstant('2026-10-12T10:40:00.000Z', '2026-10-12T10:40:00Z')).toBe(true);
    expect(toMs('2026-10-12T10:40:00.000Z')).toBe(toMs('2026-10-12T10:40:00Z'));
  });

  it.each([
    ['2026-10-12T10:40:00Z', '12/10/2026 17:40'],
    ['2026-10-12T18:30:00Z', '13/10/2026 01:30'],
    ['2026-10-31T17:00:00Z', '01/11/2026 00:00'],
    ['2026-12-31T17:00:00Z', '01/01/2027 00:00'],
    ['2026-10-12T10:40:00.000Z', '12/10/2026 17:40'],
  ])('formatVn(%s) = %s', (iso, text) => {
    expect(formatVn(iso)).toBe(text);
  });

  it.each([
    ['2026-11-01T03:00', '2026-10-31T20:00:00Z'],
    ['2027-01-01T05:00', '2026-12-31T22:00:00Z'],
    ['2026-10-12T17:40', '2026-10-12T10:40:00Z'],
  ])('gio VN nhap %s -> %s', (local, iso) => {
    expect(vnInputToIso(local)).toBe(iso);
  });

  it('gio nhap sai dang -> loi', () => {
    expect(() => vnInputToIso('2026-10-12 17:40')).toThrow();
  });

  it('msToVnInput nguoc voi vnInputToIso', () => {
    expect(msToVnInput(toMs('2026-10-31T20:00:00Z'))).toBe('2026-11-01T03:00');
  });

  it('hom nay VN luc 2026-12-31T18:00:00Z la 2027-01-01', () => {
    expect(todayVn(toMs('2026-12-31T18:00:00Z'))).toBe('2027-01-01');
    expect(todayVn(toMs('2026-12-31T16:59:59Z'))).toBe('2026-12-31');
  });

  it('ngay nghiep vu YYYY-MM-DD giu nguyen chuoi (khong qua Date)', () => {
    const dayVn = '2026-10-12';
    expect(`${dayVn}`).toBe('2026-10-12');
  });
});
