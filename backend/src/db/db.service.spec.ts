import { AppConfig } from '../config/config';
import { adapterConfig, DbService } from './db.service';

const cfg = {
  db: { server: 's', port: 1433, database: 'd', user: 'u', password: 'p' },
} as AppConfig;

function fakePrisma(results: Array<'ok' | Error>) {
  const p = {
    // eslint-disable-next-line @typescript-eslint/require-await -- gia lap ham async cua Prisma
    $queryRawUnsafe: jest.fn(async () => {
      const r = results.length > 1 ? results.shift()! : results[0];
      if (r instanceof Error) throw r;
      return [{ ok: 1 }];
    }),
    // eslint-disable-next-line @typescript-eslint/require-await -- gia lap ham async cua Prisma
    $disconnect: jest.fn(async () => undefined),
  };
  return p;
}

describe('DbService', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('thu lai 1, 2 giay roi san sang; chay loader truoc khi bao san sang', async () => {
    const prisma = fakePrisma([
      Object.assign(new Error('Failed to connect'), {}),
      new Error('Failed to connect'),
      'ok',
    ]);
    const db = new DbService(cfg, () => prisma as never, jest.fn());
    const loaded: string[] = [];
    // eslint-disable-next-line @typescript-eslint/require-await -- loader gia
    db.addLoader('cache', async () => {
      loaded.push('cache');
    });
    db.start();
    await jest.advanceTimersByTimeAsync(0);
    expect(db.isReady()).toBe(false);
    await jest.advanceTimersByTimeAsync(1000);
    expect(db.isReady()).toBe(false);
    await jest.advanceTimersByTimeAsync(2000);
    expect(db.isReady()).toBe(true);
    expect(loaded).toEqual(['cache']);
  });

  it('loi cau hinh 18456 lien tiep 5 lan -> goi exit(1), khong in mat khau', async () => {
    const exit = jest.fn();
    const logged: string[] = [];
    const prisma = fakePrisma([
      Object.assign(new Error("Login failed for user 'u'."), { number: 18456 }),
    ]);
    const db = new DbService(cfg, () => prisma as never, exit);
    (
      db as unknown as {
        log: {
          error: (m: string) => void;
          warn: (m: string) => void;
          log: (m: string) => void;
        };
      }
    ).log = {
      error: (m) => logged.push(m),
      warn: (m) => logged.push(m),
      log: (m) => logged.push(m),
    };
    db.start();
    await jest.advanceTimersByTimeAsync(1000 + 2000 + 5000 + 10000 + 1);
    expect(exit).toHaveBeenCalledWith(1);
    expect(logged.join('\n')).toContain('DB_USER');
    // K7: CSDL khong ton tai cung ra "Login failed" (S6) -> goi y ca DB_NAME.
    expect(logged.join('\n')).toContain('DB_NAME');
    expect(logged.join('\n')).not.toMatch(/password=|PWD=/i);
  });

  it('reportFailure -> het san sang, tao lai client, ket noi lai', async () => {
    const created: unknown[] = [];
    const factory = () => {
      const p = fakePrisma(['ok']);
      created.push(p);
      return p as never;
    };
    const db = new DbService(cfg, factory, jest.fn());
    db.start();
    await jest.advanceTimersByTimeAsync(0);
    expect(db.isReady()).toBe(true);
    db.reportFailure(new Error('Connection lost'));
    expect(db.isReady()).toBe(false);
    await jest.advanceTimersByTimeAsync(0);
    expect(db.isReady()).toBe(true);
    expect(created).toHaveLength(2);
  });

  // T23-1: mssql mac dinh 15 s -> dat 35 s (lon hon CALL_TIMEOUT_MS 30 s cua nhip).
  it('adapterConfig: requestTimeout 35000, useUTC', () => {
    const c = adapterConfig(cfg);
    expect(c.requestTimeout).toBe(35000);
    expect(c.options?.useUTC).toBe(true);
  });

  it('reportFailure voi loi qua han request -> van san sang, khong tao lai client', async () => {
    const created: unknown[] = [];
    const factory = () => {
      const p = fakePrisma(['ok']);
      created.push(p);
      return p as never;
    };
    const db = new DbService(cfg, factory, jest.fn());
    db.start();
    await jest.advanceTimersByTimeAsync(0);
    db.reportFailure({
      code: 'ETIMEOUT',
      message: 'Timeout: Request failed to complete in 35000ms',
    });
    expect(db.isReady()).toBe(true);
    expect(created).toHaveLength(1);
  });

  // T23-2: CSDL OFFLINE/RESTORE luc dang chay -> dang nhap lai bi 18456; chi luc khoi dong moi dem 5 lan roi dung.
  it('da san sang roi mat ket noi, ket noi lai gap 18456 nhieu lan -> khong exit, hoi phuc khi CSDL tro lai', async () => {
    const exit = jest.fn();
    const login = Object.assign(new Error("Login failed for user 'u'."), {
      code: 'ELOGIN',
    });
    let n = 0;
    const factory = () => {
      n += 1;
      return fakePrisma(
        n === 1 ? ['ok'] : [login, login, login, login, login, login, 'ok'],
      ) as never;
    };
    const db = new DbService(cfg, factory, exit);
    db.start();
    await jest.advanceTimersByTimeAsync(0);
    db.reportFailure(new Error('Connection lost'));
    await jest.advanceTimersByTimeAsync(
      1000 + 2000 + 5000 + 10000 + 30000 + 30000 + 1,
    );
    expect(exit).not.toHaveBeenCalled();
    expect(db.isReady()).toBe(true);
  });

  it('ping luu tam 5 giay', async () => {
    const prisma = fakePrisma(['ok']);
    const db = new DbService(cfg, () => prisma as never, jest.fn());
    db.start();
    await jest.advanceTimersByTimeAsync(0);
    const before = prisma.$queryRawUnsafe.mock.calls.length;
    await db.ping();
    await db.ping();
    expect(prisma.$queryRawUnsafe.mock.calls.length).toBe(before + 1);
    await jest.advanceTimersByTimeAsync(5001);
    await db.ping();
    expect(prisma.$queryRawUnsafe.mock.calls.length).toBe(before + 2);
  });
});
