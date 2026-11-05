
import { SEED_REFS } from '../../contracts/lib/seed-refs.mjs';

export const DEVICE_TYPES = [
  'SENSOR',
  'MIST',
  'FAN',
  'HEATER',
  'SPEAKER'
];

export function parseCode(code) {
  if (typeof code !== 'string') {
    throw new Error('Invalid device code');
  }

  const parts = code.split('-');

  if (parts.length !== 3) {
    throw new Error(`Invalid device code: ${code}`);
  }

  const [house, floor, type] = parts;
  const zone = `${house}-${floor}`;

  if (!SEED_REFS.zone.includes(zone) || !DEVICE_TYPES.includes(type)) {
    throw new Error(`Unknown device: ${code}`);
  }

  return {
    code,
    type,
    zone
  };
}

export function loadDevices(codes = SEED_REFS.device) {
  return codes
    .filter(code => !code.endsWith('-CAMERA'))
    .map(parseCode);
}

export function isSensor(device) {
  return device.type === 'SENSOR';
}

export function isActuator(device) {
  return DEVICE_TYPES.includes(device.type) &&
    device.type !== 'SENSOR';
}
