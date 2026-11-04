// O nhap so cua form. Number('abc') = NaN, JSON.stringify doi thanh null -> am tham xoa gia tri, nen phai chan truoc khi gui.
export function parseDecimal(s: string): number | null | 'invalid' {
  const t = s.trim();
  if (t === '') return null;
  if (!/^-?\d+([.,]\d+)?$/.test(t)) return 'invalid';
  const n = Number(t.replace(',', '.'));
  return Math.abs(n) < 9999999.995 ? n : 'invalid'; // cot DECIMAL(9,2), SQL lam tron 2 so le
}

// Backend chi kiem do dai nen nhan ca ten toan khoang trang; huy prompt tra null.
export function cleanName(s: string | null): string | null {
  return s?.trim() || null;
}

// Thuoc tinh pattern cua o nhap ten: phai co it nhat mot ky tu khac khoang trang.
export const NAME_PATTERN = '.*\\S.*';
