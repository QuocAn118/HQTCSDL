// Khoa {{ref:<kind>:<key>}} hop le theo du lieu mau database-core (seed/01-reference.sql, seed/04-alerts.sql).
const zones = ['H1-F0', 'H1-F1', 'H1-F2', 'H1-F3', 'H2-F0', 'H2-F1'];

export const SEED_REFS = {
  house: ['H1', 'H2'],
  zone: zones,
  device: [
    ...zones.flatMap((z) => ['SENSOR', 'MIST', 'FAN', 'HEATER'].map((t) => `${z}-${t}`)),
    'H1-F0-SPEAKER', 'H1-F0-CAMERA', 'H2-F0-SPEAKER', 'H2-F0-CAMERA',
  ],
  user: ['admin', 'owner1', 'owner2'],
  // Canh bao THRESHOLD dang mo: <khu vuc>-<chi so>.
  alert: ['H1-F3-HUMID'],
};
