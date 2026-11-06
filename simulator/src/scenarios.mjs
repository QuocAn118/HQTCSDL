
import { readFileSync } from 'node:fs';

export const SCENARIOS = ['normal', 'hot', 'dry'];

export function loadScenario(name = 'normal') {
  if (!SCENARIOS.includes(name)) {
    throw new Error(`Unknown scenario: ${name}`);
  }

  const url = new URL(`./scenarios/${name}.json`, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8'));
}

export function baseFor(scenario, zone, metric) {
  return scenario.zones?.[zone]?.[metric]
    ?? scenario.defaults[metric];
}
