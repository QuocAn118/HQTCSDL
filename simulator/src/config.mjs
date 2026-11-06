
export function loadConfig(env = process.env) {
  const required = [
    'MQTT_URL',
    'MQTT_USERNAME',
    'MQTT_PASSWORD',
    'READING_INTERVAL_SECONDS',
    'NOISE_SEED'
  ];

  for (const key of required) {
    if (env[key] === undefined || env[key].trim() === '') {
      throw new Error(`Missing environment variable: ${key}`);
    }
  }

  const interval = Number(env.READING_INTERVAL_SECONDS);
  const seed = Number(env.NOISE_SEED);

  if (!Number.isFinite(interval) || interval <= 0) {
    throw new Error('READING_INTERVAL_SECONDS must be positive');
  }

  if (!Number.isInteger(seed)) {
    throw new Error('NOISE_SEED must be an integer');
  }

  let url;

  try {
    url = new URL(env.MQTT_URL);
  } catch {
    throw new Error('Invalid MQTT_URL');
  }

  if (!['mqtt:', 'mqtts:'].includes(url.protocol)) {
    throw new Error('MQTT_URL must use mqtt or mqtts');
  }

  return {
    mqttUrl: env.MQTT_URL,
    username: env.MQTT_USERNAME,
    password: env.MQTT_PASSWORD,
    readingIntervalSeconds: interval,
    noiseSeed: seed
  };
}
