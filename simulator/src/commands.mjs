export function commandTopic(code) {
  return `swiftlet/devices/${code}/command`;
}

export function parseCommand(buf) {
  let command;

  try {
    command = JSON.parse(buf.toString());
  } catch {
    throw new Error('Invalid command JSON');
  }

  if (
    typeof command !== 'object' ||
    command === null ||
    typeof command.isOn !== 'boolean' ||
    !(command.level === null || (
      typeof command.level === 'number' &&
      Number.isFinite(command.level) &&
      command.level >= 0 &&
      command.level <= 100
    )) ||
    !['AUTO', 'MANUAL'].includes(command.mode) ||
    typeof command.issuedAt !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(command.issuedAt)
  ) {
    throw new Error('Invalid command format');
  }

  const issuedAtMs = Date.parse(command.issuedAt);

  if (!Number.isFinite(issuedAtMs)) {
    throw new Error('Invalid issuedAt');
  }

  // Reject impossible dates such as February 30.
  const normalized = new Date(issuedAtMs).toISOString();
  if (normalized.slice(0, 19) !== command.issuedAt.slice(0, 19)) {
    throw new Error('Invalid issuedAt');
  }

  return {
    ...command,
    issuedAtMs
  };
}

export class ActuatorState {
  constructor() {
    this.command = null;
  }

  apply(command) {
    if (
      this.command &&
      command.issuedAtMs < this.command.issuedAtMs
    ) {
      return false;
    }

    this.command = command;
    return true;
  }

  getState() {
    return this.command;
  }
}