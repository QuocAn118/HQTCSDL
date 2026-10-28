import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import mqtt from 'mqtt';
import { bakExists } from './sql.mjs';

let done = false;

// Kiem truoc khi chay (spec backend 7.2); thieu thi dung, thong bao ro. Chay mot lan moi tien trinh test.
export async function precheck(env) {
  if (done) return;
  execSync('npm run build', { stdio: 'inherit' }); // khong test ma cu
  const dev = await fetch('http://localhost:3000/api/health').then(() => true, () => false);
  assert.equal(dev, false, 'Backend dev dang chay o cong 3000: tat backend dev va simulator truoc khi test (spec backend 2.4)');
  await new Promise((resolve, reject) => {
    const c = mqtt.connect(env.MQTT_URL, { clientId: 'contract-test-probe', username: env.SIM_MQTT_USERNAME, password: env.SIM_MQTT_PASSWORD, reconnectPeriod: 0, connectTimeout: 5000 });
    c.once('connect', () => { c.end(true); resolve(); });
    c.once('error', (e) => reject(new Error(`Mosquitto khong ket noi duoc bang tai khoan simulator: ${e.message}`)));
  });
  assert.ok(bakExists(env), `Chua co ${env.DB_NAME}_seed.bak: lam Task 22 Step 1 (spec hop dong 4.3 quy tac 12)`);
  done = true;
}
