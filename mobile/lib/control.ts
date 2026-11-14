export const FAN_STEPS = [0, 25, 50, 75, 100] as const;

export type ControlBody =
  | {
      mode: 'MANUAL';
      isOn: boolean;
      level?: number;
    }
  | {
      mode: 'AUTO';
    };

export function fanBody(level: number): ControlBody {
  if (!(FAN_STEPS as readonly number[]).includes(level)) {
    throw new Error(`Level quat khong hop le: ${level}`);
  }

  if (level === 0) {
    return {
      mode: 'MANUAL',
      isOn: false,
    };
  }

  return {
    mode: 'MANUAL',
    isOn: true,
    level,
  };
}

export function switchBody(isOn: boolean): ControlBody {
  return {
    mode: 'MANUAL',
    isOn,
  };
}

export const AUTO_BODY: ControlBody = {
  mode: 'AUTO',
};