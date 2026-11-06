// BAN SAO chi cong thuc offThresholds cua backend (backend/src/control-loop/rules.ts, spec simulator 3.2).
// Khong import ma backend. Backend doi cong thuc -> TV2 bao TV5 sua file nay.
const round = n => Math.round(n * 1e6) / 1e6;

export function offThresholds(b) {
  const h = b.min !== null && b.max !== null
    ? Math.min(b.hysteresis, (b.max - b.min) / 4)
    : b.hysteresis;

  const offHi = b.max === null
    ? null
    : round(b.target !== null ? Math.min(b.target, b.max - h) : b.max - h);

  const offLo = b.min === null
    ? null
    : round(b.target !== null ? Math.max(b.target, b.min + h) : b.min + h);

  return { h: round(h), offHi, offLo };
}
