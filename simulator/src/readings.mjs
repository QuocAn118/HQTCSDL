
import { METRICS } from './model.mjs';

export function isoSecond(ms) {
  return new Date(Math.floor(ms / 1000) * 1000).toISOString();
}

export function nextAt(prevMs, nowMs) {
  const current = Math.floor(nowMs / 1000) * 1000;

  if (current <= prevMs) {
    return prevMs + 1000;
  }

  return current;
}

export function buildReadings(code, values, atMs) {
  return METRICS.map(metric => ({
    device: code,
    metric,
    value: values[metric],
    at: isoSecond(atMs)
  }));
}

export function readingsTopic(code) {
  return `swiftlet/devices/${code}/readings`;
}
export function heartbeatTopic(code) {
  return `swiftlet/devices/${code}/heartbeat`;
}

export function buildHeartbeat(code, atMs) {
  return {
    device: code,
    at: isoSecond(atMs)
  };
}