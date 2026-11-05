
export const METRICS = ['TEMP', 'HUMID', 'CO2', 'LIGHT'];

export const TAU_MINUTES = 3;

export const EFFECTS = {
  FAN: {
    TEMP: -1.5,
    CO2: -150
  },
  HEATER: {
    TEMP: 1.5
  },
  MIST: {
    HUMID: 5
  }
};

const LIMITS = {
  TEMP: [-10, 60],
  HUMID: [0, 100],
  CO2: [0, 10000],
  LIGHT: [0, 100000]
};

export function effectPerMinute(metric, actuators) {
  let total = 0;

  for (const actuator of actuators) {
    if (!actuator.isOn) continue;

    const effect = EFFECTS[actuator.type]?.[metric] ?? 0;
    const level = actuator.level ?? 100;

    total += effect * level / 100;
  }

  return total;
}

export function equilibrium(metric, base, actuators) {
  return base + TAU_MINUTES *
    effectPerMinute(metric, actuators);
}

export function step(current, target, dtSeconds) {
  if (dtSeconds <= 0) return current;

  return target +
    (current - target) *
    Math.exp(-(dtSeconds / 60) / TAU_MINUTES);
}

export function outputValue(metric, value) {
  const [min, max] = LIMITS[metric];

  const clamped = Math.min(max, Math.max(min, value));

  return Math.round(clamped * 100) / 100;
}
