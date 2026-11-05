import { SCENARIOS } from './scenarios.mjs';

export function parseArgs(argv = []) {
  const options = {
    scenario: 'normal',
    drop: [],
    dropAfter: null,
    dropFor: null
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--scenario') {
      const value = argv[++i];

      if (!value || !SCENARIOS.includes(value)) {
        throw new Error('Invalid scenario');
      }

      options.scenario = value;
    } else if (arg === '--drop') {
      const value = argv[++i];

      if (!value) {
        throw new Error('Missing device code for --drop');
      }

      options.drop.push(
        ...value.split(',').map(code => code.trim()).filter(Boolean)
      );
    } else if (arg === '--drop-after') {
      const value = Number(argv[++i]);

      if (!Number.isFinite(value) || value < 0) {
        throw new Error('Invalid --drop-after value');
      }

      options.dropAfter = value;
    } else if (arg === '--drop-for') {
      const value = Number(argv[++i]);

      if (!Number.isFinite(value) || value <= 0) {
        throw new Error('Invalid --drop-for value');
      }

      options.dropFor = value;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.drop.length > 0) {
    if (options.dropAfter === null || options.dropFor === null) {
      throw new Error(
        '--drop requires both --drop-after and --drop-for'
      );
    }
  } else if (
    options.dropAfter !== null ||
    options.dropFor !== null
  ) {
    throw new Error(
      '--drop-after and --drop-for require --drop'
    );
  }

  options.drop = [...new Set(options.drop)];

  return options;
}