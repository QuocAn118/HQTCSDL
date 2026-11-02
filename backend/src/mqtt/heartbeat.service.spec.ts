import { HeartbeatService, validateHeartbeat } from './heartbeat.service';

const AT = '2026-10-12T10:40:07Z';
const buf = (o: unknown) => Buffer.from(JSON.stringify(o));

describe('validateHeartbeat', () => {
  it.each([
    [{ device: 'H1-F1-FAN', at: AT }, true],
    [{ device: 'H1-F2-FAN', at: AT }, false],
    [{ device: 'H1-F1-FAN', at: '2026-10-12T10:40:07' }, false],
    [[], false],
  ])('%j -> hop le %s', (p, ok) =>
    expect(validateHeartbeat('H1-F1-FAN', buf(p)) !== null).toBe(ok),
  );

  it('JSON hong -> null', () =>
    expect(validateHeartbeat('H1-F1-FAN', Buffer.from('{'))).toBeNull());
});

describe('HeartbeatService', () => {
  it('gom cung nhip, goi sp_RecordHeartbeat, phat alert.updated; loi thi bo, khong thu lai', async () => {
    const recordHeartbeat = jest
      .fn()
      .mockResolvedValueOnce({
        accepted: 2,
        rejected: 0,
        resolvedAlertIds: [5],
      })
      .mockRejectedValueOnce(new Error('x'));
    // eslint-disable-next-line @typescript-eslint/require-await -- gia lap ham async
    const ingest = { emitResolved: jest.fn(async () => undefined) };
    const svc = new HeartbeatService(
      { isReady: () => true, reportFailure: jest.fn() } as never,
      { recordHeartbeat } as never,
      ingest as never,
      { onHeartbeat: jest.fn() } as never,
    );
    svc.receive('H1-F1-FAN', buf({ device: 'H1-F1-FAN', at: AT }));
    svc.receive('H1-F2-FAN', buf({ device: 'H1-F2-FAN', at: AT }));
    await svc.tick();
    expect(recordHeartbeat).toHaveBeenCalledWith([
      { device: 'H1-F1-FAN', at: AT },
      { device: 'H1-F2-FAN', at: AT },
    ]);
    expect(ingest.emitResolved).toHaveBeenCalledWith([5]);
    svc.receive('H1-F1-FAN', buf({ device: 'H1-F1-FAN', at: AT }));
    await svc.tick();
    await svc.tick();
    expect(recordHeartbeat).toHaveBeenCalledTimes(2);
  });

  // CR-3: mat ket noi luc chi co heartbeat -> bao DbService de ket noi lai.
  it('loi ket noi -> goi db.reportFailure voi loi do', async () => {
    const lost = { code: 'P1001' };
    const reportFailure = jest.fn();
    const svc = new HeartbeatService(
      { isReady: () => true, reportFailure } as never,
      { recordHeartbeat: jest.fn().mockRejectedValue(lost) } as never,
      {} as never,
      { onHeartbeat: jest.fn() } as never,
    );
    jest
      .spyOn(
        (svc as unknown as { log: { warn: (m: string) => void } }).log,
        'warn',
      )
      .mockImplementation(() => undefined);
    svc.receive('H1-F1-FAN', buf({ device: 'H1-F1-FAN', at: AT }));
    await svc.tick();
    expect(reportFailure).toHaveBeenCalledWith(lost);
  });

  it('CSDL chua san sang -> giu hang cho, khong goi SP', async () => {
    const recordHeartbeat = jest.fn();
    const svc = new HeartbeatService(
      { isReady: () => false } as never,
      { recordHeartbeat } as never,
      {} as never,
      { onHeartbeat: jest.fn() } as never,
    );
    svc.receive('H1-F1-FAN', buf({ device: 'H1-F1-FAN', at: AT }));
    await svc.tick();
    expect(recordHeartbeat).not.toHaveBeenCalled();
  });
});
