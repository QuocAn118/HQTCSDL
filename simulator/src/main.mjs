
import mqtt from 'mqtt';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import { loadConfig } from './config.mjs';
import { parseArgs } from './args.mjs';
import { loadDevices, isActuator } from './devices.mjs';
import { loadScenario } from './scenarios.mjs';
import { createSimulator } from './sim.mjs';
import { commandTopic, parseCommand } from './commands.mjs';

const HEARTBEAT_SECONDS = 30;

export function startMain({
  env = process.env,
  argv = process.argv.slice(2),
  connect = mqtt.connect,
  logger = console,
  processLike = process,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout
} = {}) {
  const config = loadConfig(env);
  const options = parseArgs(argv);
  const scenario = loadScenario(options.scenario);
  const devices = loadDevices();

  const clients = new Map();

  const devicesByCode = new Map(
    devices.map(device => [device.code, device])
  );

  let simulator;

  logger.log('[MAIN] Starting SwiftletCare Simulator');
  logger.log(`[MAIN] Scenario: ${options.scenario}`);
  logger.log(`[SIM] Loaded ${devices.length} devices`);
  logger.log(`[NOISE] Seed: ${config.noiseSeed}`);

  // Tạo MQTT client cho từng thiết bị.
  function createDeviceClient(device) {
    const client = connect(config.mqttUrl, {
      username: config.username,
      password: config.password,
      clientId: device.code,
      clean: true,
      reconnectPeriod: 3000
    });

    client.on('connect', () => {
      logger.log(`[${device.code}] Connected`);

      if (isActuator(device)) {
        client.subscribe(
          commandTopic(device.code),
          { qos: 1 }
        );
      }

      simulator?.flush(device.code);
    });

    client.on('message', (topic, message) => {
      if (!isActuator(device) || !simulator) {
        return;
      }

      try {
        const command = parseCommand(message);

        const accepted = simulator.setCommand(
          device.code,
          command
        );

        logger.log(
          `[${device.code}] Command ${accepted ? 'accepted' : 'rejected'}`
        );
      } catch (error) {
        logger.error(
          `[${device.code}] Invalid command: ${error.message}`
        );
      }
    });

    client.on('error', error => {
      logger.error(
        `[${device.code}] MQTT connection error: ${error.message}`
      );
    });

    return client;
  }

  // Tạo kết nối ban đầu.
  for (const device of devices) {
    try {
      clients.set(
        device.code,
        createDeviceClient(device)
      );
    } catch (error) {
      logger.error(
        `[${device.code}] MQTT connection failed: ${error.message}`
      );
    }
  }

  // Tạo client mới và chờ kết nối thành công.
  function reconnectClient(code) {
    const device = devicesByCode.get(code);

    if (!device) {
      return Promise.reject(
        new Error(`Unknown device: ${code}`)
      );
    }

    const client = createDeviceClient(device);

    // Ghi ngay để Ctrl+C đóng được client đang chờ broker bật lại.
    clients.set(code, client);

    // Broker còn tắt thì mqtt.js tự thử lại; chờ tới khi kết nối được.
    return new Promise(resolve => {
      client.once('connect', () => resolve(client));
    });
  }

  // Khởi tạo Simulator và truyền seed cho Noise.
  simulator = createSimulator({
    scenario,
    clients,
    reconnectClient,
    devices,
    noiseSeed: config.noiseSeed
  });

  // Vòng lặp gửi dữ liệu cảm biến.
  const timer = setIntervalFn(() => {
    try {
      simulator.tick();
    } catch (error) {
      logger.error(`[SIM] Tick error: ${error.message}`);
    }
  }, config.readingIntervalSeconds * 1000);

  // Vòng lặp heartbeat.
  const heartbeatTimer = setIntervalFn(() => {
    try {
      simulator.heartbeat();
    } catch (error) {
      logger.error(`[SIM] Heartbeat error: ${error.message}`);
    }
  }, HEARTBEAT_SECONDS * 1000);

  const dropTimers = [];

  // Tự động drop sau thời gian được cấu hình.
  if (options.drop.length > 0) {
    const dropTimer = setTimeoutFn(async () => {
      try {
        logger.log(
          `[MAIN] Drop scheduled: ${options.drop.join(', ')}`
        );

        await simulator.drop(options.drop);

        logger.log('[MAIN] Drop completed');

        // Khôi phục sau --drop-for phút.
        const restoreTimer = setTimeoutFn(async () => {
          try {
            logger.log('[MAIN] Restore scheduled');

            await simulator.restore(options.drop);

            logger.log('[MAIN] Restore completed');
          } catch (error) {
            logger.error(
              `[MAIN] Restore error: ${error.message}`
            );
          }
        }, options.dropFor * 60 * 1000);

        dropTimers.push(restoreTimer);
      } catch (error) {
        logger.error(`[MAIN] Drop error: ${error.message}`);
      }
    }, options.dropAfter * 60 * 1000);

    dropTimers.push(dropTimer);
  }

  logger.log('[SIM] Simulation started');
  logger.log(`[MAIN] Heartbeat interval: ${HEARTBEAT_SECONDS}s`);

  if (options.drop.length > 0) {
    logger.log(
      `[MAIN] Drop devices: ${options.drop.join(', ')}`
    );

    logger.log(`[MAIN] Drop after: ${options.dropAfter} minute(s)`);
    logger.log(`[MAIN] Drop duration: ${options.dropFor} minute(s)`);
  }

  let stopped = false;

  function stop() {
    if (stopped) {
      return;
    }

    stopped = true;

    clearIntervalFn(timer);
    clearIntervalFn(heartbeatTimer);

    for (const timerId of dropTimers) {
      clearTimeoutFn(timerId);
    }

    logger.log('[MAIN] Stopping simulator');

    for (const client of clients.values()) {
      try {
        client.end();
      } catch {
        logger.error('[MAIN] Failed to close MQTT client');
      }
    }

    logger.log('[MAIN] Simulator stopped');
  }

  processLike.on('SIGINT', stop);
  processLike.on('SIGTERM', stop);

  return {
    simulator,
    clients,
    stop
  };
}

// Chỉ chạy khi main.mjs được gọi trực tiếp.
const currentFile = fileURLToPath(import.meta.url);

const executedFile = process.argv[1]
  ? resolve(process.argv[1])
  : '';

if (executedFile === currentFile) {
  try {
    startMain();
  } catch (error) {
    console.error(`[MAIN] ${error.message}`);
    process.exitCode = 1;
  }
}
