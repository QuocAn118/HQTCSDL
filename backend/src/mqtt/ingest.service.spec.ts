/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call -- gia lap SP async; mock.calls cua jest.Mock la any */
import { IngestService } from './ingest.service';

const NOW = new Date(Date.UTC(2026, 9, 12, 10, 40, 7));
const AT = NOW.toISOString();
const payload = (n: number, start = 0) =>
  Buffer.from(
    JSON.stringify(
      Array.from({ length: n }, (_, i) => ({
        device: 'H1-F1-SENSOR',
        metric: 'TEMP',
        value: start + i,
        at: AT,
      })),
    ),
  );
const ok = (o: Record<string, unknown> = {}) => ({
  received: 1,
  accepted: 1,
  duplicates: 0,
  rejected: 0,
  newAlerts: [],
  resolvedAlertIds: [],
  acceptedRows: [
    {
      DeviceId: 5,
      DeviceCode: 'H1-F1-SENSOR',
      HouseId: 1,
      ZoneId: 10,
      MetricCode: 'TEMP',
      Value: 31.2,
      RecordedAt: AT,
    },
    {
      DeviceId: 9,
      DeviceCode: 'H2-F1-SENSOR',
      HouseId: 2,
      ZoneId: 20,
      MetricCode: 'TEMP',
      Value: 28,
      RecordedAt: AT,
    },
  ],
  ...o,
});

function setup(
  ingest: jest.Mock,
  opts: { ready?: boolean; max?: number } = {},
) {
  let now = NOW.getTime();
  const deps = {
    cfg: { ingestRetryMaxItems: opts.max ?? 10000 },
    db: {
      isReady: () => opts.ready ?? true,
      reportFailure: jest.fn(),
      prisma: {
        alerts: {
          findMany: jest.fn(async () => [
            {
              AlertId: 9,
              HouseId: 1,
              Status: 'RESOLVED',
              ResolvedAt: NOW,
              ResolvedBy: null,
            },
          ]),
        },
      },
    },
    sp: { ingestReadings: ingest },
    cache: { applyReadings: jest.fn() },
    loop: { runZones: jest.fn(async () => undefined) },
    rt: { emitToHouse: jest.fn() },
    mqtt: { onReadings: jest.fn() },
  };
  const svc = new IngestService(
    deps.cfg as never,
    deps.db as never,
    deps.sp as never,
    deps.cache as never,
    deps.loop as never,
    deps.rt as never,
    deps.mqtt as never,
    () => new Date(now),
  );
  return {
    svc,
    ...deps,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('IngestService', () => {
  it('lo toi da 200 phan tu, hang cho dai thi goi nhieu lan lien tiep, giu thu tu', async () => {
    const ingest = jest.fn(async () => ok());
    const { svc } = setup(ingest);
    svc.receive('H1-F1-SENSOR', payload(450));
    // receive >= 200 tu kich tick() chay nen; tick() cua test gap busy nen tra ve ngay -> cho het microtask.
    await new Promise((r) => setImmediate(r));
    expect(ingest.mock.calls.map((c) => c[0].length)).toEqual([200, 200, 50]);
    expect(ingest.mock.calls[1][0][0].value).toBe(200);
  });

  it('thanh cong: bo nho dem, readings.new moi nha, alert.created, alert.updated, chay vong cho khu vuc', async () => {
    const alert = {
      AlertId: 7,
      HouseId: 1,
      ZoneId: 10,
      DeviceId: null,
      AlertType: 'THRESHOLD',
      Severity: 'WARNING',
      MetricCode: 'TEMP',
      Value: 31.2,
      DetectedClass: null,
      Confidence: null,
      HasSnapshot: false,
      Message: 'm',
      Status: 'NEW',
      CreatedAt: AT,
    };
    const { svc, cache, rt, loop } = setup(
      jest.fn(async () => ok({ newAlerts: [alert], resolvedAlertIds: [9] })),
    );
    svc.receive('H1-F1-SENSOR', payload(1));
    await svc.tick();
    expect(cache.applyReadings).toHaveBeenCalled();
    const events = rt.emitToHouse.mock.calls.map((c) => [c[0], c[1]]);
    expect(events).toEqual([
      [1, 'readings.new'],
      [2, 'readings.new'],
      [1, 'alert.created'],
      [1, 'alert.updated'],
    ]);
    expect(rt.emitToHouse.mock.calls[0][2]).toEqual({
      houseId: 1,
      readings: [
        {
          deviceId: 5,
          deviceCode: 'H1-F1-SENSOR',
          zoneId: 10,
          metric: 'TEMP',
          value: 31.2,
          at: AT,
        },
      ],
    });
    expect(rt.emitToHouse.mock.calls[3][2]).toEqual({
      alertId: 9,
      houseId: 1,
      status: 'RESOLVED',
      resolvedAt: NOW,
      resolvedBy: null,
    });
    expect(loop.runZones).toHaveBeenCalledWith([10, 20]);
  });

  it('loi phat Socket.IO khong chan vong dieu khien', async () => {
    const { svc, rt, loop } = setup(jest.fn(async () => ok()));
    rt.emitToHouse.mockImplementation(() => {
      throw new Error('hong');
    });
    svc.receive('H1-F1-SENSOR', payload(1));
    await svc.tick();
    expect(loop.runZones).toHaveBeenCalled();
  });

  it('mat ket noi: giu lo o dau hang cho, thu lai theo lich, so do moi noi vao cuoi, bao DbHealth', async () => {
    const ingest = jest
      .fn()
      .mockRejectedValueOnce({ code: 'P1001' })
      .mockResolvedValue(ok());
    const { svc, db, advance } = setup(ingest);
    svc.receive('H1-F1-SENSOR', payload(2, 0));
    await svc.tick();
    svc.receive('H1-F1-SENSOR', payload(1, 100));
    await svc.tick(); // chua toi 1 giay -> khong goi
    expect(ingest).toHaveBeenCalledTimes(1);
    advance(1000);
    await svc.tick();
    expect(
      ingest.mock.calls[1][0].map((x: { value: number }) => x.value),
    ).toEqual([0, 1, 100]);
    expect(db.reportFailure).toHaveBeenCalled();
  });

  it('vuot INGEST_RETRY_MAX_ITEMS -> bo phan cu nhat', async () => {
    const { svc } = setup(jest.fn().mockRejectedValue({ code: 'P1001' }), {
      max: 5,
    });
    svc.receive('H1-F1-SENSOR', payload(4, 0));
    await svc.tick();
    svc.receive('H1-F1-SENSOR', payload(3, 10));
    expect(svc.queueLength()).toBe(5);
  });

  it.each([50030, 50042, 547])('%i -> bo lo, khong thu lai', async (n) => {
    const ingest = jest
      .fn()
      .mockRejectedValueOnce({ number: n })
      .mockResolvedValue(ok());
    const { svc } = setup(ingest);
    svc.receive('H1-F1-SENSOR', payload(2));
    await svc.tick();
    expect(svc.queueLength()).toBe(0);
    expect(ingest).toHaveBeenCalledTimes(1);
  });

  it('loi chua biet -> thu lai 3 lan theo 1, 2, 5 giay roi bo', async () => {
    const ingest = jest.fn().mockRejectedValue(new Error('la'));
    const { svc, advance } = setup(ingest);
    svc.receive('H1-F1-SENSOR', payload(2));
    await svc.tick();
    for (const ms of [1000, 2000, 5000]) {
      advance(ms);
      await svc.tick();
    }
    expect(ingest).toHaveBeenCalledTimes(4);
    expect(svc.queueLength()).toBe(0);
  });

  it('khong bao gio hai lan goi SP song song; CSDL chua san sang thi khong goi', async () => {
    let release!: () => void;
    const ingest = jest.fn(
      () =>
        new Promise((r) => {
          release = () => r(ok());
        }),
    );
    const { svc } = setup(ingest);
    svc.receive('H1-F1-SENSOR', payload(1));
    const t1 = svc.tick();
    await svc.tick();
    expect(ingest).toHaveBeenCalledTimes(1);
    release();
    await t1;
    const notReady = setup(jest.fn(), { ready: false });
    notReady.svc.receive('H1-F1-SENSOR', payload(1));
    await notReady.svc.tick();
    expect(notReady.sp.ingestReadings).not.toHaveBeenCalled();
  });

  // code-review: flush khong duoc quay vong chiem event loop khi tick() dang ban.
  it('flush cho lo dang ghi xong (SP tra loi qua setTimeout) -> tra 0', async () => {
    const ingest = jest.fn(
      () => new Promise((r) => setTimeout(() => r(ok()), 20)),
    );
    const { svc } = setup(ingest);
    svc.receive('H1-F1-SENSOR', payload(1));
    void svc.tick();
    expect(await svc.flush(300)).toBe(0);
  });

  // code-review: loi tu runZones khong thanh unhandled rejection.
  it('runZones bi tu choi -> log loi, khong nem ra ngoai', async () => {
    const { svc, loop } = setup(jest.fn(async () => ok()));
    loop.runZones.mockRejectedValue(new Error('vong hong'));
    const err = jest
      .spyOn(
        (svc as unknown as { log: { error: (m: string) => void } }).log,
        'error',
      )
      .mockImplementation(() => undefined);
    svc.receive('H1-F1-SENSOR', payload(1));
    await svc.tick();
    await new Promise((r) => setImmediate(r));
    expect(err).toHaveBeenCalledWith(expect.stringContaining('vong hong'));
  });
});
