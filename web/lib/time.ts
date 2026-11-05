// Thoi gian (spec web 2.3): moc ISO doc bang Date va so bang getTime(); hien thi = cong 7 gio + getUTC*();
// ngay VN giu la chuoi; gio nguoi dung nhap tach bang regex roi Date.UTC(..., gio - 7, ...). Khong dung Intl.
export const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, '0');
const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export function toMs(iso: string): number {
  return new Date(iso).getTime();
}

export function sameInstant(a: string, b: string): boolean {
  return toMs(a) === toMs(b);
}

function shifted(iso: string | number): Date {
  return new Date((typeof iso === 'number' ? iso : toMs(iso)) + VN_OFFSET_MS);
}

export function formatVn(iso: string): string {
  const d = shifted(iso);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function formatVnTime(ms: number): string {
  const d = shifted(ms);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

// "YYYY-MM-DDTHH:mm" theo gio VN (datetime-local) -> ISO UTC co Z. Khong dua chuoi vao new Date.
export function vnInputToIso(local: string): string {
  const m = LOCAL_INPUT.exec(local);
  if (!m) throw new Error(`gio nhap sai dang: ${local}`);
  const [, y, mo, d, h, mi] = m.map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h - 7, mi)).toISOString().slice(0, 19) + 'Z';
}

// Moc -> gia tri mac dinh cho datetime-local theo gio VN.
export function msToVnInput(ms: number): string {
  const d = shifted(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

// "Hom nay" theo gio VN dang YYYY-MM-DD.
export function todayVn(nowMs: number = Date.now()): string {
  const d = shifted(nowMs);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
