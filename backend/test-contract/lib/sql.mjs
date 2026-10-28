import { execFileSync } from 'node:child_process';

// -C: ODBC 18 tu choi chung chi tu ky cua SQL Server Express (T22-L1).
export function sql(env, db, query) {
  const out = execFileSync('sqlcmd', ['-S', `${env.DB_SERVER},${env.DB_PORT}`, '-U', env.DB_USER, '-d', db, '-b', '-C', '-I', '-h', '-1', '-W', '-Q', `SET NOCOUNT ON; ${query}`],
    { env: { ...process.env, SQLCMDPASSWORD: env.DB_PASSWORD }, encoding: 'utf8' });
  return out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

export function bakExists(env) {
  try { sql(env, 'master', `RESTORE HEADERONLY FROM DISK = N'${env.DB_NAME}_seed.bak';`); return true; } catch { return false; }
}

// Nguyen van spec hop dong 4.3 quy tac 12; chay qua ket noi vao master.
export function restore(env) {
  const t = Date.now();
  const db = env.DB_NAME;
  sql(env, 'master', `ALTER DATABASE ${db} SET SINGLE_USER WITH ROLLBACK IMMEDIATE; RESTORE DATABASE ${db} FROM DISK = N'${db}_seed.bak' WITH REPLACE; ALTER DATABASE ${db} SET MULTI_USER;`);
  return Date.now() - t;
}

// {{ref:kind:key}} suy tu ma thiet bi (khong phu thuoc ten nha/khu vuc trong seed).
const REFS_SQL = `
SELECT 'device|' + Code + '|' + CAST(DeviceId AS VARCHAR(12)) FROM dbo.Devices
UNION ALL SELECT 'zone|' + LEFT(Code, LEN(Code) - 7) + '|' + CAST(ZoneId AS VARCHAR(12)) FROM dbo.Devices WHERE DeviceType = 'SENSOR'
UNION ALL SELECT 'house|' + LEFT(d.Code, CHARINDEX('-', d.Code) - 1) + '|' + CAST(z.HouseId AS VARCHAR(12))
  FROM dbo.Devices d JOIN dbo.Zones z ON z.ZoneId = d.ZoneId WHERE d.DeviceType = 'CAMERA'
UNION ALL SELECT 'user|' + Username + '|' + CAST(UserId AS VARCHAR(12)) FROM dbo.Users
UNION ALL SELECT 'alert|' + LEFT(d.Code, LEN(d.Code) - 7) + '-' + a.MetricCode + '|' + CAST(a.AlertId AS VARCHAR(12))
  FROM dbo.Alerts a JOIN dbo.Devices d ON d.ZoneId = a.ZoneId AND d.DeviceType = 'SENSOR'
  WHERE a.AlertType = 'THRESHOLD' AND a.Status <> 'RESOLVED';`;

export function loadRefs(env) {
  const map = new Map();
  for (const row of sql(env, env.DB_NAME, REFS_SQL)) {
    const [kind, key, id] = row.split('|');
    map.set(`${kind}:${key}`, Number(id));
  }
  return (kind, key) => {
    const id = map.get(`${kind}:${key}`);
    if (!id) throw new Error(`Khong tra duoc {{ref:${kind}:${key}}}`);
    return id;
  };
}
