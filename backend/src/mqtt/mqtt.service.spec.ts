/* eslint-disable @typescript-eslint/require-await -- gia lap ham async cua mqtt.js trong file test */
import { EventEmitter } from 'node:events';
import { MqttService } from './mqtt.service';

const cfg = {
  mqtt: { url: 'mqtt://localhost:1883', username: 'backend', password: 'mk' },
} as never;

function fake() {
  const client = Object.assign(new EventEmitter(), {
    subscribe: jest.fn(),
    publishAsync: jest.fn(async () => undefined),
    endAsync: jest.fn(async () => undefined),
  });
  const connect = jest.fn(() => client);
  return { client, connect };
}

describe('MqttService', () => {
  it('ket noi: client id swiftlet-backend, clean false, tai khoan backend; subscribe readings QoS 1', () => {
    const { client, connect } = fake();
    const m = new MqttService(cfg, connect as never, jest.fn());
    m.onReadings(() => undefined);
    m.start();
    expect(connect).toHaveBeenCalledWith(
      'mqtt://localhost:1883',
      expect.objectContaining({
        clientId: 'swiftlet-backend',
        clean: false,
        username: 'backend',
        password: 'mk',
      }),
    );
    client.emit('connect');
    expect(m.isConnected()).toBe(true);
    expect(client.subscribe).toHaveBeenCalledWith(
      'swiftlet/devices/+/readings',
      { qos: 1 },
    );
    expect(client.subscribe).not.toHaveBeenCalledWith(
      'swiftlet/devices/+/heartbeat',
      expect.anything(),
    );
  });

  it('co handler heartbeat -> subscribe heartbeat QoS 0; dinh tuyen tin theo topic, bo topic la', () => {
    const { client, connect } = fake();
    const m = new MqttService(cfg, connect as never, jest.fn());
    const got: string[] = [];
    m.onReadings((code) => got.push(`r:${code}`));
    m.onHeartbeat((code) => got.push(`h:${code}`));
    m.start();
    client.emit('connect');
    expect(client.subscribe).toHaveBeenCalledWith(
      'swiftlet/devices/+/heartbeat',
      { qos: 0 },
    );
    client.emit(
      'message',
      'swiftlet/devices/H1-F1-SENSOR/readings',
      Buffer.from('[]'),
    );
    client.emit(
      'message',
      'swiftlet/devices/H1-F1-FAN/heartbeat',
      Buffer.from('{}'),
    );
    client.emit(
      'message',
      'swiftlet/devices/h1 bad/readings',
      Buffer.from('[]'),
    );
    client.emit('message', 'khac/topic', Buffer.from('x'));
    expect(got).toEqual(['r:H1-F1-SENSOR', 'h:H1-F1-FAN']);
  });

  it('publishCommand: retained QoS 1, payload dung 4 khoa, issuedAt co Z', async () => {
    const { client, connect } = fake();
    const m = new MqttService(cfg, connect as never, jest.fn());
    m.start();
    await m.publishCommand('H1-F1-FAN', {
      isOn: true,
      level: 80,
      mode: 'MANUAL',
    });
    const [topic, body, opts] = client.publishAsync.mock.calls[0] as [
      string,
      string,
      object,
    ];
    expect(topic).toBe('swiftlet/devices/H1-F1-FAN/command');
    expect(opts).toEqual({ qos: 1, retain: true });
    const p = JSON.parse(body) as { issuedAt: string };
    expect(Object.keys(p)).toEqual(['isOn', 'level', 'mode', 'issuedAt']);
    expect(p.issuedAt).toMatch(/Z$/);
  });

  it('goi onConnect moi lan ket noi', () => {
    const { client, connect } = fake();
    const m = new MqttService(cfg, connect as never, jest.fn());
    const onConnect = jest.fn();
    m.onConnect(onConnect);
    m.start();
    client.emit('connect');
    client.emit('connect');
    expect(onConnect).toHaveBeenCalledTimes(2);
  });

  // S9: mqtt.js khong tu ket noi lai sau CONNACK 4/5, nen dung ngay lan dau.
  it.each([
    [5, 'Connection refused: Not authorized'],
    [4, 'Connection refused: Bad username or password'],
  ])('sai tai khoan (CONNACK %i) -> exit(1) ngay lan dau', (code, msg) => {
    const { client, connect } = fake();
    const exit = jest.fn();
    const m = new MqttService(cfg, connect as never, exit);
    m.start();
    client.emit('error', Object.assign(new Error(msg), { code }));
    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('loi khac (ECONNREFUSED) -> khong dung, de mqtt.js tu ket noi lai', () => {
    const { client, connect } = fake();
    const exit = jest.fn();
    const m = new MqttService(cfg, connect as never, exit);
    m.start();
    for (let i = 0; i < 6; i++)
      client.emit(
        'error',
        Object.assign(new Error('connect ECONNREFUSED'), {
          code: 'ECONNREFUSED',
        }),
      );
    expect(exit).not.toHaveBeenCalled();
  });

  it('close -> het ket noi', () => {
    const { client, connect } = fake();
    const m = new MqttService(cfg, connect as never, jest.fn());
    m.start();
    client.emit('connect');
    client.emit('close');
    expect(m.isConnected()).toBe(false);
  });
});
