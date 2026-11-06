// Cach A (spec simulator 2.6): huy luong mang, de hang doi offline cua mqtt.js giu tin QoS 1, roi reconnect().
// Chay: node --env-file=.env spikes/drop-a.mjs
import mqtt from 'mqtt';

const options = {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const got = [];

const sub = mqtt.connect(process.env.MQTT_URL, { ...options, clientId: 'spike-drop-sub' });
await new Promise(resolve => sub.once('connect', resolve));
await sub.subscribeAsync('spike/drop-a', { qos: 1 });
sub.on('message', (_topic, payload) => got.push(payload.toString()));

const pub = mqtt.connect(process.env.MQTT_URL, {
  ...options,
  clientId: 'spike-drop-pub',
  reconnectPeriod: 1000
});
await new Promise(resolve => pub.once('connect', resolve));

pub.publish('spike/drop-a', '1', { qos: 1 });
await sleep(500);

pub.options.reconnectPeriod = 0;
pub.stream.destroy();
await sleep(500);
console.log('dang ket noi sau khi huy luong:', pub.connected);

for (const n of ['2', '3', '4']) {
  pub.publish('spike/drop-a', n, { qos: 1 });
}
await sleep(1000);
console.log('nhan trong luc ngat:', got.join(','));

pub.options.reconnectPeriod = 1000;
pub.reconnect();
await sleep(3000);
console.log('nhan sau khi ket noi lai:', got.join(','));
console.log(got.join(',') === '1,2,3,4' ? 'CACH A DAT' : 'CACH A KHONG DAT');

pub.end(true);
sub.end(true);
