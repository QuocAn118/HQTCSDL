import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { connect as mqttConnect, MqttClient } from 'mqtt';
import { APP_CONFIG } from '../config/config';
import type { AppConfig } from '../config/config';
import { MqttStatus } from '../common/status';
import { EXIT } from '../db/db.service';

export const MQTT_CONNECT = 'MQTT_CONNECT';
const TOPIC = /^swiftlet\/devices\/([A-Z0-9-]+)\/(readings|heartbeat)$/;
type Handler = (code: string, payload: Buffer) => void;

// Cua duy nhat noi chuyen voi broker (spec backend 2.2). Client id co dinh, giu phien (hop dong 2.2).
@Injectable()
export class MqttService extends MqttStatus {
  private readonly log = new Logger('MQTT');
  private client: MqttClient | null = null;
  private connected = false;
  private readingsHandler: Handler | null = null;
  private heartbeatHandler: Handler | null = null;
  private readonly connectHandlers: Array<() => void> = [];

  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    @Optional()
    @Inject(MQTT_CONNECT)
    private readonly connectFn: typeof mqttConnect = mqttConnect,
    @Optional()
    @Inject(EXIT)
    private readonly exit: (code: number) => void = (code) =>
      process.exit(code),
  ) {
    super();
  }

  onReadings(fn: Handler): void {
    this.readingsHandler = fn;
  }
  onHeartbeat(fn: Handler): void {
    this.heartbeatHandler = fn;
  }
  onConnect(fn: () => void): void {
    this.connectHandlers.push(fn);
  }
  isConnected(): boolean {
    return this.connected;
  }

  start(): void {
    const c = this.connectFn(this.cfg.mqtt.url, {
      clientId: 'swiftlet-backend',
      clean: false,
      username: this.cfg.mqtt.username,
      password: this.cfg.mqtt.password,
      reconnectPeriod: 1000,
    });
    this.client = c;
    c.on('connect', () => {
      if (!this.connected) this.log.log('Da ket noi broker');
      this.connected = true;
      c.subscribe('swiftlet/devices/+/readings', { qos: 1 });
      if (this.heartbeatHandler)
        c.subscribe('swiftlet/devices/+/heartbeat', { qos: 0 });
      for (const fn of this.connectHandlers) {
        try {
          fn();
        } catch (e) {
          this.log.error(`onConnect loi: ${(e as Error).message}`);
        }
      }
    });
    c.on('close', () => {
      if (this.connected)
        this.log.warn('Mat ket noi broker, mqtt.js tu ket noi lai');
      this.connected = false;
    });
    c.on('error', (err: Error & { code?: number | string }) => {
      // CONNACK 4 "Bad username or password" / 5 "Not authorized": mqtt.js khong tu ket noi lai (S9) -> dung ngay.
      if (err.code === 4 || err.code === 5) {
        this.log.error(
          `Broker tu choi tai khoan (CONNACK ${err.code}), kiem tra MQTT_USERNAME/MQTT_PASSWORD; dung backend`,
        );
        this.exit(1);
        return;
      }
      this.log.warn(`Loi MQTT: ${err.code ?? err.message}`);
    });
    c.on('message', (topic: string, payload: Buffer) => {
      const m = TOPIC.exec(topic);
      if (!m) return;
      const h =
        m[2] === 'readings' ? this.readingsHandler : this.heartbeatHandler;
      try {
        h?.(m[1], payload);
      } catch (e) {
        this.log.error(`Xu ly tin ${m[2]} loi: ${(e as Error).message}`);
      }
    });
  }

  async publishCommand(
    code: string,
    s: { isOn: boolean; level: number | null; mode: 'AUTO' | 'MANUAL' },
  ): Promise<void> {
    if (!this.client) throw new Error('MQTT chua khoi dong');
    const payload = JSON.stringify({
      isOn: s.isOn,
      level: s.level,
      mode: s.mode,
      issuedAt: new Date().toISOString(),
    });
    await this.client.publishAsync(
      `swiftlet/devices/${code}/command`,
      payload,
      { qos: 1, retain: true },
    );
  }

  async end(): Promise<void> {
    await this.client?.endAsync(false);
    this.connected = false;
  }
}
