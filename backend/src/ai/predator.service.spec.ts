/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-assignment -- gia lap SP/Prisma async; expect.objectContaining la any */
import { existsSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PredatorService, snapshotRelPath } from './predator.service';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const META = {
  camera: 'H1-F0-CAMERA',
  class: 'snake',
  confidence: 0.87,
  at: '2026-10-12T10:40:07Z',
};
const ALERT = {
  AlertId: 11,
  HouseId: 1,
  ZoneId: 2,
  DeviceId: 3,
  AlertType: 'PREDATOR',
  Severity: 'CRITICAL',
  MetricCode: null,
  Value: null,
  DetectedClass: 'snake',
  Confidence: 0.87,
  HasSnapshot: true,
  Message: 'm',
  Status: 'NEW',
  CreatedAt: META.at,
};

function setup(
  createPredatorAlert?: jest.Mock,
  camera: object | null = { DeviceId: 3 },
) {
  const root = mkdtempSync(join(tmpdir(), 'sc-ai-'));
  const sp = {
    createPredatorAlert:
      createPredatorAlert ??
      jest.fn(async () => ({
        created: true,
        alertId: 11,
        skipReason: null,
        alert: ALERT,
      })),
  };
  const db = {
    prisma: { devices: { findFirst: jest.fn(async () => camera) } },
  };
  const rt = { emitToHouse: jest.fn() };
  const svc = new PredatorService(
    { storageRoot: root } as never,
    db as never,
    sp as never,
    rt as never,
  );
  return {
    svc,
    sp,
    db,
    rt,
    root,
    tmp: () =>
      existsSync(join(root, 'tmp')) ? readdirSync(join(root, 'tmp')) : [],
  };
}

describe('snapshotRelPath (hop dong 2.4 buoc 4)', () => {
  it('chi tu gia tri da kiem, UTC', () => {
    expect(
      snapshotRelPath('H1-F0-CAMERA', 'snake', '2026-10-12T23:59:59.000Z'),
    ).toBe('snapshots/2026/10/12/H1-F0-CAMERA_snake_20261012T235959Z.jpg');
  });
});

describe('PredatorService.handle', () => {
  it('Created = 1: file chinh thuc dung cho, khong con file tam, phat alert.created, tra {created, alertId, skipReason}', async () => {
    const { svc, sp, rt, root, tmp } = setup();
    const r = await svc.handle(JSON.stringify(META), { buffer: JPEG });
    expect(r).toEqual({ created: true, alertId: 11, skipReason: null });
    expect(sp.createPredatorAlert).toHaveBeenCalledWith({
      ...META,
      snapshot: 'snapshots/2026/10/12/H1-F0-CAMERA_snake_20261012T104007Z.jpg',
    });
    expect(
      existsSync(
        join(
          root,
          'snapshots',
          '2026',
          '10',
          '12',
          'H1-F0-CAMERA_snake_20261012T104007Z.jpg',
        ),
      ),
    ).toBe(true);
    expect(tmp()).toEqual([]);
    expect(rt.emitToHouse).toHaveBeenCalledWith(1, 'alert.created', {
      alert: expect.objectContaining({
        alertId: 11,
        alertType: 'PREDATOR',
        hasSnapshot: true,
      }),
    });
  });

  it('COOLDOWN / LOW_CONFIDENCE: khong giu file nao, khong phat', async () => {
    const { svc, root, tmp, rt } = setup(
      jest.fn(async () => ({
        created: false,
        alertId: null,
        skipReason: 'COOLDOWN',
        alert: null,
      })),
    );
    expect(await svc.handle(JSON.stringify(META), { buffer: JPEG })).toEqual({
      created: false,
      alertId: null,
      skipReason: 'COOLDOWN',
    });
    expect(existsSync(join(root, 'snapshots', '2026'))).toBe(false);
    expect(tmp()).toEqual([]);
    expect(rt.emitToHouse).not.toHaveBeenCalled();
  });

  it('SP loi -> file tam bi xoa, loi duoc nem tiep', async () => {
    const { svc, tmp } = setup(
      jest.fn(async () => {
        throw Object.assign(new Error('x'), { number: 50013 });
      }),
    );
    await expect(
      svc.handle(JSON.stringify(META), { buffer: JPEG }),
    ).rejects.toMatchObject({ number: 50013 });
    expect(tmp()).toEqual([]);
  });

  it.each([
    ['metadata khong phai JSON', '{hong', JPEG, 400, ['metadata']],
    [
      'class la',
      JSON.stringify({ ...META, class: 'cat' }),
      JPEG,
      400,
      ['class'],
    ],
    [
      'at +07:00',
      JSON.stringify({ ...META, at: '2026-10-12T17:40:07+07:00' }),
      JPEG,
      400,
      ['at'],
    ],
    ['thieu image', JSON.stringify(META), undefined, 400, ['image']],
  ])(
    '%s -> %i fields %j, khong ghi file',
    async (_l, meta, buffer, status, fields) => {
      const { svc, sp, tmp } = setup();
      await expect(
        svc.handle(meta, buffer ? { buffer } : undefined),
      ).rejects.toMatchObject({ status, details: { fields } });
      expect(sp.createPredatorAlert).not.toHaveBeenCalled();
      expect(tmp()).toEqual([]);
    },
  );

  it('camera khong ton tai/ngung dung/khong phai CAMERA -> 404 CAMERA_NOT_FOUND truoc khi ghi file', async () => {
    const { svc, tmp } = setup(undefined, null);
    await expect(
      svc.handle(JSON.stringify(META), { buffer: JPEG }),
    ).rejects.toMatchObject({ status: 404, code: 'CAMERA_NOT_FOUND' });
    expect(tmp()).toEqual([]);
  });

  it('khong phai JPEG that (PNG) -> 415', async () => {
    const { svc } = setup();
    await expect(
      svc.handle(JSON.stringify(META), {
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      }),
    ).rejects.toMatchObject({ status: 415, code: 'UNSUPPORTED_MEDIA_TYPE' });
  });

  it('cung su kien gui hai lan song song: dung mot file chinh thuc, khong con file tam (spec backend 5.9)', async () => {
    let n = 0;
    const sp = jest.fn(async () =>
      n++ === 0
        ? { created: true, alertId: 11, skipReason: null, alert: ALERT }
        : {
            created: false,
            alertId: null,
            skipReason: 'COOLDOWN',
            alert: null,
          },
    );
    const { svc, root, tmp } = setup(sp);
    const rs = await Promise.all([
      svc.handle(JSON.stringify(META), { buffer: JPEG }),
      svc.handle(JSON.stringify(META), { buffer: JPEG }),
    ]);
    expect(rs.map((r) => r.created).sort()).toEqual([false, true]);
    expect(
      readdirSync(join(root, 'snapshots', '2026', '10', '12')),
    ).toHaveLength(1);
    expect(tmp()).toEqual([]);
  });
});
