// Mo 26 ket noi cung tai khoan simulator toi Mosquitto (spec simulator 3.5).
// Chay: node --env-file=.env spikes/connections.mjs
import mqtt from 'mqtt';
import { loadDevices } from '../src/devices.mjs';

const codes = loadDevices().map(device => device.code);
let ok = 0;

const clients = codes.map(code => {
  const client = mqtt.connect(process.env.MQTT_URL, {
    clientId: code,
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    reconnectPeriod: 0
  });

  client.once('connect', () => {
    ok += 1;
  });
  client.once('error', error => console.log(code, 'loi', error.message));

  return client;
});

await new Promise(resolve => setTimeout(resolve, 10_000));

console.log(`ket noi duoc ${ok}/${codes.length}`);

await Promise.all(clients.map(client => client.endAsync(true)));
