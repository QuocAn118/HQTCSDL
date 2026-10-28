/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-assignment -- gia lap SP async; expect.objectContaining la any */
import { AnomalyService } from './anomaly.service';

const ALERT = {
  AlertId: 50,
  HouseId: 2,
  ZoneId: null,
  DeviceId: null,
  AlertType: 'POPULATION_DROP',
  Severity: 'CRITICAL',
  MetricCode: null,
  Value: null,
  DetectedClass: null,
  Confidence: null,
  HasSnapshot: false,
  Message: 'm',
  Status: 'NEW',
  CreatedAt: '2026-10-12T13:30:00Z',
};

function setup(
  detect: jest.Mock,
  opts: { ready?: boolean; scheduler?: boolean } = {},
) {
  const registry = {
    addInterval: jest.fn(),
    deleteInterval: jest.fn(),
    doesExist: jest.fn(() => true),
  };
  const rt = { emitToHouse: jest.fn() };
  const svc = new AnomalyService(
    { anomalyScheduler: opts.scheduler ?? true } as never,
    { isReady: () => opts.ready ?? true } as never,
    { detectAnomalies: detect } as never,
    rt as never,
    registry as never,
  );
  return { svc, registry, rt };
}

describe('AnomalyService', () => {
  afterEach(() => jest.useRealTimers());

  it('ANOMALY_SCHEDULER=off -> khong dang ky nhip; on -> dang ky 60 giay', () => {
    jest.useFakeTimers(); // registry gia khong xoa setInterval that -> Jest khong thoat
    const off = setup(jest.fn(), { scheduler: false });
    off.svc.onModuleInit();
    expect(off.registry.addInterval).not.toHaveBeenCalled();
    const on = setup(jest.fn());
    on.svc.onModuleInit();
    expect(on.registry.addInterval).toHaveBeenCalledWith(
      'detect-anomalies',
      expect.anything(),
    );
    on.svc.stop();
  });

  it('tick: tham so mac dinh, phat alert.created moi canh bao', async () => {
    const detect = jest.fn(async () => [ALERT]);
    const { svc, rt } = setup(detect);
    await svc.tick();
    expect(detect).toHaveBeenCalledWith({});
    expect(rt.emitToHouse).toHaveBeenCalledWith(2, 'alert.created', {
      alert: expect.objectContaining({
        alertId: 50,
        alertType: 'POPULATION_DROP',
      }),
    });
  });

  it('CSDL chua san sang -> bo luot; dang chay -> bo luot; SP loi -> luot sau van chay', async () => {
    const notReady = setup(jest.fn(), { ready: false });
    await notReady.svc.tick();
    expect(notReady.svc).toBeDefined();

    let release!: () => void;
    const detect = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((r) => {
            release = () => r([]);
          }),
      )
      .mockRejectedValueOnce(new Error('loi SP'))
      .mockResolvedValue([]);
    const { svc } = setup(detect);
    const first = svc.tick();
    await svc.tick(); // dang chay -> bo luot
    expect(detect).toHaveBeenCalledTimes(1);
    release();
    await first;
    await svc.tick(); // loi -> khong nem
    await svc.tick();
    expect(detect).toHaveBeenCalledTimes(3);
  });

  it('detectNow: @NowUtc = nowUtc, @OfflineMinutes = 525600, tra alert 14 khoa', async () => {
    const detect = jest.fn(async () => [ALERT]);
    const { svc } = setup(detect);
    const now = new Date('2026-10-12T13:30:00Z');
    const r = await svc.detectNow(now);
    expect(detect).toHaveBeenCalledWith({
      nowUtc: now,
      offlineMinutes: 525600,
    });
    expect(Object.keys(r[0])).toHaveLength(14);
  });

  it('detectNow cho nhip dang chay toi da 10 giay roi 503 RETRY_LATER', async () => {
    jest.useFakeTimers();
    const detect = jest.fn(() => new Promise(() => undefined));
    const { svc } = setup(detect);
    void svc.tick();
    const p = svc.detectNow(new Date());
    const assertion = expect(p).rejects.toMatchObject({
      status: 503,
      code: 'RETRY_LATER',
    });
    await jest.advanceTimersByTimeAsync(10_100);
    await assertion;
  });

  it('mot lan goi qua 30 giay -> nha khoa', async () => {
    jest.useFakeTimers();
    const detect = jest
      .fn()
      .mockImplementationOnce(() => new Promise(() => undefined))
      .mockResolvedValue([]);
    const { svc } = setup(detect);
    void svc.tick();
    await jest.advanceTimersByTimeAsync(30_001);
    await svc.tick();
    expect(detect).toHaveBeenCalledTimes(2);
  });
});
