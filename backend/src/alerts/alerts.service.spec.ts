/* eslint-disable @typescript-eslint/require-await -- gia lap Prisma/SP async; mock.calls cua jest.fn la any */
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateDto } from '../common/validation';
import { ListAlertsQuery } from './dto';
import { AlertsService, resolveSnapshot } from './alerts.service';

const OWNER = { userId: 2, role: 'OWNER' as const, username: 'owner1', exp: 0 };
const ADMIN = { userId: 1, role: 'ADMIN' as const, username: 'admin', exp: 0 };
const NOW = new Date(Date.UTC(2026, 9, 12));
const row = (id: number) => ({
  AlertId: id,
  HouseId: 1,
  ZoneId: 2,
  DeviceId: null,
  AlertType: 'THRESHOLD',
  Severity: 'WARNING',
  MetricCode: 'HUMID',
  Value: 72,
  DetectedClass: null,
  Confidence: null,
  SnapshotPath: null,
  Message: 'm',
  Status: 'NEW',
  CreatedAt: NOW,
});

describe('resolveSnapshot (Review Focus 3)', () => {
  const root = join(tmpdir(), 'sc-root');
  it.each([
    [
      'snapshots/2026/10/12/a.jpg',
      join(root, 'snapshots', '2026', '10', '12', 'a.jpg'),
    ],
    ['../../etc/passwd', null],
    ['snapshots/../../x.jpg', null],
    ['C:\\Windows\\win.ini', null],
    ['snapshots\\..\\..\\x.jpg', null],
    ['/etc/passwd', null],
    [null, null],
    ['', null],
  ])('%p -> %p', (p, expected) =>
    expect(resolveSnapshot(root, p)).toBe(expected),
  );
});

describe('ListAlertsQuery (Review Focus 4)', () => {
  it.each([
    [{ limit: '0' }, 'limit'],
    [{ limit: '1000' }, 'limit'],
    [{ limit: 'abc' }, 'limit'],
    [{ before: '-5' }, 'before'],
    [{ status: 'NEW,DONE' }, 'status'],
    [{ type: 'FIRE' }, 'type'],
    [{ houseId: 'x' }, 'houseId'],
  ])('%j -> 400 fields [%s]', async (q, field) => {
    await expect(validateDto(ListAlertsQuery, q)).rejects.toMatchObject({
      status: 400,
      details: { fields: [field] },
    });
  });
  it('mac dinh limit 50', async () => {
    expect((await validateDto(ListAlertsQuery, {})).limit).toBe(50);
  });
});

function setup(houseOwner: number | null = 2) {
  const findMany = jest.fn(async ({ take }: { take: number }) =>
    Array.from({ length: take }, (_, i) => row(100 - i)),
  );
  const prisma = {
    alerts: {
      findMany,
      findUnique: jest.fn(async () => ({
        ...row(9),
        SnapshotPath: 'snapshots/a.jpg',
        History: [
          {
            HistoryId: 1,
            OldStatus: null,
            NewStatus: 'NEW',
            UserId: null,
            Note: null,
            ChangedAt: NOW,
          },
        ],
      })),
    },
    houses: {
      findUnique: jest.fn(async () =>
        houseOwner === null ? null : { HouseId: 1, OwnerId: houseOwner },
      ),
    },
  };
  const sp = {
    updateAlertStatus: jest.fn(async () => ({
      AlertId: 9,
      HouseId: 1,
      ZoneId: 4,
      AlertType: 'THRESHOLD',
      Status: 'ACK',
      ResolvedAt: null,
      ResolvedBy: null,
    })),
  };
  const rt = { emitToHouse: jest.fn() };
  const root = mkdtempSync(join(tmpdir(), 'sc-snap-'));
  return {
    svc: new AlertsService(
      { prisma } as never,
      sp as never,
      rt as never,
      { storageRoot: root } as never,
    ),
    prisma,
    sp,
    rt,
    root,
    findMany,
  };
}

describe('AlertsService', () => {
  it('list: id giam dan, lay limit+1 de biet trang sau, nextBefore = id cuoi trang', async () => {
    const { svc, findMany } = setup();
    const r = await svc.list(OWNER, {
      houseId: 1,
      status: 'NEW,ACK',
      limit: 2,
    });
    expect(findMany.mock.calls[0][0]).toMatchObject({
      where: { HouseId: 1, Status: { in: ['NEW', 'ACK'] } },
      orderBy: { AlertId: 'desc' },
      take: 3,
    });
    expect(r.items.map((a) => (a as { alertId: number }).alertId)).toEqual([
      100, 99,
    ]);
    expect(r.nextBefore).toBe(99);
  });

  it('OWNER khong truyen houseId -> chi nha minh; truyen nha nguoi khac/khong ton tai -> 404', async () => {
    const a = setup();
    await a.svc.list(OWNER, { limit: 50 });
    expect(a.findMany.mock.calls[0][0].where).toMatchObject({
      House: { OwnerId: 2 },
    });
    await expect(
      setup(3).svc.list(OWNER, { houseId: 1, limit: 50 }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      setup(null).svc.list(ADMIN, { houseId: 1, limit: 50 }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('get: kem history, khong lo SnapshotPath', async () => {
    const { svc } = setup();
    const r = await svc.get(9);
    expect(r).toMatchObject({
      alertId: 9,
      hasSnapshot: true,
      history: [{ historyId: 1, newStatus: 'NEW' }],
    });
    expect(JSON.stringify(r)).not.toContain('snapshots/');
  });

  it('PATCH: goi SP voi UserId tu JWT, phat alert.updated, tra cot SP', async () => {
    const { svc, sp, rt } = setup();
    const r = await svc.updateStatus(OWNER, 9, {
      status: 'ACK',
      note: 'Đã kiểm tra',
    });
    expect(sp.updateAlertStatus).toHaveBeenCalledWith(
      9,
      'ACK',
      2,
      'Đã kiểm tra',
    );
    expect(rt.emitToHouse).toHaveBeenCalledWith(1, 'alert.updated', {
      alertId: 9,
      houseId: 1,
      status: 'ACK',
      resolvedAt: null,
      resolvedBy: null,
    });
    expect(r).toEqual({
      alertId: 9,
      houseId: 1,
      zoneId: 4,
      alertType: 'THRESHOLD',
      status: 'ACK',
      resolvedAt: null,
      resolvedBy: null,
    });
  });

  it('snapshotFile: file co -> duong dan; file khong co hoac duong dan la -> 404', async () => {
    const { svc, root, prisma } = setup();
    await expect(svc.snapshotFile(9)).rejects.toMatchObject({ status: 404 });
    mkdirSync(join(root, 'snapshots'), { recursive: true });
    writeFileSync(
      join(root, 'snapshots', 'a.jpg'),
      Buffer.from([0xff, 0xd8, 0xff]),
    );
    await expect(svc.snapshotFile(9)).resolves.toBe(
      join(root, 'snapshots', 'a.jpg'),
    );
    prisma.alerts.findUnique.mockResolvedValueOnce({
      ...row(9),
      SnapshotPath: '../../secret.jpg',
      History: [],
    });
    await expect(svc.snapshotFile(9)).rejects.toMatchObject({ status: 404 });
  });
});
