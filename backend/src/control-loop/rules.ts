export type Metric = 'TEMP' | 'HUMID' | 'CO2' | 'LIGHT';
export type ActuatorType = 'FAN' | 'MIST' | 'HEATER';
export type RuleKey =
  'TEMP_HIGH' | 'TEMP_LOW' | 'HUMID_LOW' | 'HUMID_HIGH' | 'CO2_HIGH';
export interface Reading {
  value: number;
  at: Date;
}
export interface Bounds {
  min: number | null;
  max: number | null;
  target: number | null;
  hysteresis: number;
}
export interface ActuatorState {
  deviceId: number;
  type: ActuatorType;
  mode: 'AUTO' | 'MANUAL';
  isOn: boolean;
  level: number | null;
}
export type Latches = Partial<Record<RuleKey, boolean>>;
export interface ZoneInput {
  readings: Partial<Record<Metric, Reading>>;
  bounds: Partial<Record<Metric, Bounds>>;
  actuators: ActuatorState[];
  latches: Latches;
  nowUtc: Date;
  staleMinutes: number;
}
export interface Command {
  deviceId: number;
  isOn: boolean;
  level: number | null;
  reason: string;
}

export const RULES: ReadonlyArray<{
  key: RuleKey;
  metric: Metric;
  dir: 'HIGH' | 'LOW';
  device: ActuatorType;
}> = [
  { key: 'TEMP_HIGH', metric: 'TEMP', dir: 'HIGH', device: 'FAN' },
  { key: 'TEMP_LOW', metric: 'TEMP', dir: 'LOW', device: 'HEATER' },
  { key: 'HUMID_LOW', metric: 'HUMID', dir: 'LOW', device: 'MIST' },
  { key: 'HUMID_HIGH', metric: 'HUMID', dir: 'HIGH', device: 'FAN' },
  { key: 'CO2_HIGH', metric: 'CO2', dir: 'HIGH', device: 'FAN' },
];

const round = (n: number) => Math.round(n * 1e6) / 1e6;

export function offThresholds(b: Bounds): {
  h: number;
  offHi: number | null;
  offLo: number | null;
} {
  const h =
    b.min !== null && b.max !== null
      ? Math.min(b.hysteresis, (b.max - b.min) / 4)
      : b.hysteresis;
  // Lay muc chat hon vi rang buoc cho phep Target = Max (hoac = Min) (spec backend 4.4).
  const offHi =
    b.max === null
      ? null
      : round(b.target !== null ? Math.min(b.target, b.max - h) : b.max - h);
  const offLo =
    b.min === null
      ? null
      : round(b.target !== null ? Math.max(b.target, b.min + h) : b.min + h);
  return { h: round(h), offHi, offLo };
}

interface Evaluation {
  latches: Latches;
  stale: Set<RuleKey>;
  why: Partial<Record<RuleKey, string>>;
}

function evaluate(
  input: Omit<ZoneInput, 'latches'>,
  prev: Latches,
  onInit: boolean,
): Evaluation {
  const ev: Evaluation = { latches: {}, stale: new Set(), why: {} };
  for (const rule of RULES) {
    const b = input.bounds[rule.metric];
    const limit = rule.dir === 'HIGH' ? b?.max : b?.min;
    const r = input.readings[rule.metric];
    if (!b || limit === null || limit === undefined || !r) {
      ev.latches[rule.key] = false;
      continue;
    }
    if (input.nowUtc.getTime() - r.at.getTime() > input.staleMinutes * 60_000) {
      ev.latches[rule.key] = onInit ? false : (prev[rule.key] ?? false);
      ev.stale.add(rule.key);
      continue;
    }
    const { offHi, offLo } = offThresholds(b);
    const keep = onInit
      ? input.actuators.some((a) => a.type === rule.device && a.isOn)
      : (prev[rule.key] ?? false);
    const on =
      rule.dir === 'HIGH'
        ? r.value > limit
          ? true
          : r.value <= (offHi as number)
            ? false
            : keep
        : r.value < limit
          ? true
          : r.value >= (offLo as number)
            ? false
            : keep;
    ev.latches[rule.key] = on;
    ev.why[rule.key] = on
      ? `${rule.metric} ${r.value} ${rule.dir === 'HIGH' ? '> Max' : '< Min'} ${limit}`
      : `Nha chot: ${rule.metric} ${r.value}`;
  }
  return ev;
}

export function initLatches(input: Omit<ZoneInput, 'latches'>): Latches {
  return evaluate(input, {}, true).latches;
}

export function decide(input: ZoneInput): {
  commands: Command[];
  latches: Latches;
} {
  const ev = evaluate(input, input.latches, false);
  const commands: Command[] = [];
  for (const a of input.actuators) {
    if (a.mode !== 'AUTO') continue;
    const rules = RULES.filter((r) => r.device === a.type);
    const isOn = rules.some((r) => ev.latches[r.key]);
    if (!isOn && rules.some((r) => ev.stale.has(r.key))) continue; // so do cu -> thiet bi giu trang thai
    const level = a.type === 'FAN' ? (isOn ? 100 : 0) : null;
    if (a.isOn === isOn && (a.type !== 'FAN' || a.level === level)) continue;
    const reason = isOn
      ? rules
          .filter((r) => ev.latches[r.key])
          .map((r) => ev.why[r.key])
          .join('; ')
      : (rules
          .map((r) =>
            input.latches[r.key] && !ev.latches[r.key]
              ? ev.why[r.key]
              : undefined,
          )
          .find(Boolean) ?? 'Khong con luat nao can bat');
    commands.push({ deviceId: a.deviceId, isOn, level, reason });
  }
  return { commands, latches: ev.latches };
}
