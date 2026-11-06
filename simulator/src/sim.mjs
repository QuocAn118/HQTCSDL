
import { loadDevices, isSensor, isActuator } from './devices.mjs';

import {
  equilibrium,
  step,
  outputValue,
  METRICS
} from './model.mjs';

import { baseFor, loadScenario } from './scenarios.mjs';
import { ActuatorState } from './commands.mjs';

import {
  buildReadings,
  readingsTopic,
  nextAt,
  buildHeartbeat,
  heartbeatTopic
} from './readings.mjs';

import { makeNoise } from './noise.mjs';

// Khoảng 2,8 giờ số đo ở nhịp 10 giây; đầy thì bỏ tin cũ nhất (spec 2.6).
export const MAX_QUEUE_PER_DEVICE = 1000;

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
  const flushing = new Set();
  const overflowed = new Set();

  // Khởi động từ mức normal rồi trôi dần về nền kịch bản (spec 2.2).
  const normal = loadScenario('normal');

  for (const zone of zones) {
    const values = {};

    for (const metric of METRICS) {
      values[metric] = baseFor(normal, zone, metric);
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

    const queue = messageQueues.get(code);

    if (queue.length >= MAX_QUEUE_PER_DEVICE) {
      queue.shift();

      if (!overflowed.has(code)) {
        overflowed.add(code);
        console.warn(
          `[QUEUE] ${code}: full (${MAX_QUEUE_PER_DEVICE}), dropping oldest readings`
        );
      }
    }

    queue.push({
      topic,
      payload
    });
  }

  function queueSize(code) {
    return messageQueues.get(code)?.length ?? 0;
  }

  // Gửi dữ liệu QoS 1, hoặc xếp hàng nếu đang mất kết nối hay còn tin chưa gửi bù (giữ thứ tự).
  function send(code, topic, payload, qos = 1) {
    const client = clients.get(code);

    if (!client) {
      throw new Error(`Missing MQTT client: ${code}`);
    }

    if (
      dropped.has(code) ||
      client.connected === false ||
      queueSize(code) > 0
    ) {
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

  // Gửi bù hàng đợi theo thứ tự; lỗi giữa chừng thì giữ phần còn lại cho lần kết nối sau.
  async function flush(code) {
    if (dropped.has(code) || flushing.has(code) || queueSize(code) === 0) {
      return;
    }

    const queue = messageQueues.get(code);

    flushing.add(code);

    try {
      while (queue.length > 0) {
        const client = clients.get(code);

        if (client.connected === false) {
          return;
        }

        const message = queue[0];

        await publishQueuedMessage(client, message);

        // Hàng đợi đầy có thể đã bỏ tin này trong lúc chờ PUBACK.
        if (queue[0] === message) {
          queue.shift();
        }
      }

      overflowed.delete(code);
    } catch (error) {
      console.error(`[QUEUE] ${code}: flush failed: ${error.message}`);
    } finally {
      flushing.delete(code);
    }
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

      clients.set(code, await reconnectClient(code));

      console.log(
        `[RESTORE] ${code}: ${queueSize(code)} queued messages`
      );

      dropped.delete(code);

      await flush(code);

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
    flush,
    queueSize,
    dropped,

    getEnvironment: zone => environment.get(zone),

    getActuatorState: code =>
      actuatorStates.get(code)?.getState() ?? null
  };
}
