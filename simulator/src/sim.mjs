
import { loadDevices, isSensor, isActuator } from './devices.mjs';

import {
  equilibrium,
  step,
  outputValue,
  METRICS
} from './model.mjs';

import { baseFor } from './scenarios.mjs';
import { ActuatorState } from './commands.mjs';

import {
  buildReadings,
  readingsTopic,
  nextAt,
  buildHeartbeat,
  heartbeatTopic
} from './readings.mjs';

import { makeNoise } from './noise.mjs';

export function createSimulator({
  scenario,
  clients,
  reconnectClient,
  now = () => Date.now(),
  devices = loadDevices(),
  noiseSeed = null
}) {
  const zones = [...new Set(devices.map(device => device.zone))];

  const environment = new Map();
  const actuatorStates = new Map();

  // Khởi tạo bộ tạo nhiễu với seed cố định.
  const noise = makeNoise(noiseSeed);

  // Hàng đợi các bản tin QoS 1 của thiết bị bị ngắt.
  const dropped = new Set();
  const messageQueues = new Map();

  // Khởi tạo môi trường cho từng khu vực.
  for (const zone of zones) {
    const values = {};

    for (const metric of METRICS) {
      values[metric] = baseFor(scenario, zone, metric);
    }

    environment.set(zone, values);
  }

  // Khởi tạo trạng thái thiết bị chấp hành.
  for (const device of devices.filter(isActuator)) {
    actuatorStates.set(device.code, new ActuatorState());
  }

  let previousNow = null;
  let previousAt = 0;

  function queueMessage(code, topic, payload) {
    if (!messageQueues.has(code)) {
      messageQueues.set(code, []);
    }

    messageQueues.get(code).push({
      topic,
      payload
    });
  }

  // Gửi dữ liệu QoS 1 hoặc lưu lại nếu thiết bị đang bị drop.
  function send(code, topic, payload, qos = 1) {
    const client = clients.get(code);

    if (!client) {
      throw new Error(`Missing MQTT client: ${code}`);
    }

    if (dropped.has(code) || client.connected === false) {
      if (qos === 1) {
        queueMessage(code, topic, payload);
      }

      // QoS 0 không được lưu vào hàng đợi.
      return;
    }

    client.publish(topic, payload, {
      qos,
      retain: false
    });
  }

  // Gửi heartbeat cho thiết bị chấp hành.
  function heartbeat() {
    const atMs = now();

    for (const device of devices.filter(isActuator)) {
      const payload = JSON.stringify(
        buildHeartbeat(device.code, atMs)
      );

      send(
        device.code,
        heartbeatTopic(device.code),
        payload,
        0
      );
    }
  }

  // Nhận lệnh điều khiển thiết bị.
  function setCommand(code, command) {
    const state = actuatorStates.get(code);

    if (!state) {
      throw new Error(`Unknown actuator: ${code}`);
    }

    return state.apply(command);
  }

  // Ngắt kết nối MQTT thật.
  async function drop(codes) {
    const selectedCodes = Array.isArray(codes)
      ? codes
      : [codes];

    for (const code of selectedCodes) {
      const client = clients.get(code);

      if (!client) {
        throw new Error(`Unknown MQTT client: ${code}`);
      }

      if (dropped.has(code)) {
        continue;
      }

      // Đánh dấu trước khi đóng kết nối.
      dropped.add(code);

      console.log(`[DROP] Disconnecting: ${code}`);

      await client.endAsync();

      console.log(`[DROP] Disconnected: ${code}`);
    }
  }

  // Gửi một bản tin và chờ PUBACK của QoS 1.
  function publishQueuedMessage(client, message) {
    return new Promise((resolve, reject) => {
      client.publish(
        message.topic,
        message.payload,
        {
          qos: 1,
          retain: false
        },
        error => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        }
      );
    });
  }

  // Tạo kết nối mới và gửi bù dữ liệu theo thứ tự.
  async function restore(codes) {
    const selectedCodes = Array.isArray(codes)
      ? codes
      : [codes];

    for (const code of selectedCodes) {
      if (!dropped.has(code)) {
        continue;
      }

      if (typeof reconnectClient !== 'function') {
        throw new Error('Missing reconnectClient function');
      }

      console.log(`[RESTORE] Reconnecting: ${code}`);

      const client = await reconnectClient(code);

      clients.set(code, client);

      const queue = messageQueues.get(code) ?? [];

      console.log(
        `[RESTORE] ${code}: ${queue.length} queued messages`
      );

      // Chỉ xóa từng tin sau khi gửi thành công.
      while (queue.length > 0) {
        try {
          await publishQueuedMessage(client, queue[0]);
          queue.shift();
        } catch (error) {
          throw new Error(
            `[RESTORE] Failed to send queued message for ${code}: ${error.message}`
          );
        }
      }

      messageQueues.delete(code);
      dropped.delete(code);

      console.log(`[RESTORE] Completed: ${code}`);
    }
  }

  // Mô phỏng môi trường và gửi dữ liệu cảm biến.
  function tick() {
    const currentNow = now();

    const dtSeconds = previousNow === null
      ? 0
      : (currentNow - previousNow) / 1000;

    previousNow = currentNow;

    // Cập nhật môi trường theo trạng thái thiết bị.
    for (const zone of zones) {
      const values = environment.get(zone);

      const actuators = devices
        .filter(device => device.zone === zone && isActuator(device))
        .map(device => ({
          type: device.type,
          ...(actuatorStates.get(device.code).getState() ?? {
            isOn: false,
            level: 0
          })
        }));

      for (const metric of METRICS) {
        const base = baseFor(scenario, zone, metric);

        const target = equilibrium(
          metric,
          base,
          actuators
        );

        values[metric] = step(
          values[metric],
          target,
          dtSeconds
        );
      }
    }

    const atMs = nextAt(previousAt, currentNow);
    previousAt = atMs;

    const published = [];

    // Tạo dữ liệu cho từng cảm biến.
    for (const device of devices.filter(isSensor)) {
      const values = environment.get(device.zone);

      const readings = buildReadings(
        device.code,

        Object.fromEntries(
          METRICS.map(metric => {
            const originalValue = values[metric];

            // Thêm nhiễu vào giá trị môi trường.
            const noisyValue = originalValue + noise(metric);

            return [
              metric,
              outputValue(metric, noisyValue)
            ];
          })
        ),

        atMs
      );

      send(
        device.code,
        readingsTopic(device.code),
        JSON.stringify(readings),
        1
      );

      published.push(...readings);
    }

    return published;
  }

  return {
    tick,
    heartbeat,
    setCommand,
    drop,
    restore,
    dropped,

    getEnvironment: zone => environment.get(zone),

    getActuatorState: code =>
      actuatorStates.get(code)?.getState() ?? null
  };
}
