import { SpService } from './sp';

function spWith(rows: unknown[] | Error | Array<unknown[] | Error>) {
  const queue =
    Array.isArray(rows) &&
    rows.length &&
    (Array.isArray(rows[0]) || rows[0] instanceof Error)
      ? [...(rows as Array<unknown[] | Error>)]
      : [rows as unknown[]];
  const prisma = {
    // eslint-disable-next-line @typescript-eslint/require-await -- gia lap ham async cua Prisma
    $queryRawUnsafe: jest.fn(async () => {
      const r = queue.length > 1 ? queue.shift()! : queue[0];
      if (r instanceof Error) throw r;
      return r;
    }),
  };
  return { sp: new SpService({ prisma } as never), prisma };
}

describe('SpService', () => {
  it('ingestReadings: gui JSON qua @P1, doc 1 dong, parse 3 cot JSON', async () => {
    const { sp, prisma } = spWith([
      {
        Received: 2,
        Accepted: 1,
        Duplicates: 1,
        Rejected: 0,
        AcceptedJson:
          '[{"DeviceId":5,"DeviceCode":"H1-F1-SENSOR","HouseId":1,"ZoneId":2,"MetricCode":"TEMP","Value":31.2,"RecordedAt":"2026-10-12T10:40:07Z"}]',
        NewAlertsJson: '[]',
        ResolvedAlertIdsJson: '[{"AlertId":9}]',
      },
    ]);
    const items = [
      {
        device: 'H1-F1-SENSOR',
        metric: 'TEMP',
        value: 31.2,
        at: '2026-10-12T10:40:07Z',
      },
    ];
    const r = await sp.ingestReadings(items);
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
      'EXEC dbo.sp_IngestReadings @Json = @P1',
      JSON.stringify(items),
    );
    expect(r).toMatchObject({
      received: 2,
      accepted: 1,
      duplicates: 1,
      rejected: 0,
      newAlerts: [],
      resolvedAlertIds: [9],
    });
    expect(r.acceptedRows[0].ZoneId).toBe(2);
  });

  it('setActuator: dung thu tu tham so, doc Changed/Mode/IsOn/Level', async () => {
    const { sp, prisma } = spWith([
      {
        Changed: true,
        DeviceCode: 'H1-F1-FAN',
        Mode: 'MANUAL',
        IsOn: true,
        Level: 80,
      },
    ]);
    const r = await sp.setActuator({
      deviceId: 3,
      isOn: true,
      level: 80,
      source: 'MANUAL',
      mode: 'MANUAL',
      userId: 2,
      reason: 'x',
    });
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
      'EXEC dbo.sp_SetActuator @DeviceId = @P1, @IsOn = @P2, @Level = @P3, @Source = @P4, @Mode = @P5, @UserId = @P6, @Reason = @P7',
      3,
      true,
      80,
      'MANUAL',
      'MANUAL',
      2,
      'x',
    );
    expect(r).toEqual({
      changed: true,
      deviceCode: 'H1-F1-FAN',
      mode: 'MANUAL',
      isOn: true,
      level: 80,
    });
  });

  it('1205 -> tu thu lai dung 1 lan', async () => {
    const deadlock = Object.assign(new Error('deadlock victim'), {
      number: 1205,
    });
    const { sp, prisma } = spWith([
      deadlock,
      [{ WindowsUpserted: 1, WindowsUnchanged: 0 }],
    ]);
    await expect(
      sp.recordBirdCount([
        {
          camera: 'H1-F0-CAMERA',
          windowStart: '2026-10-12T10:00:00Z',
          in: 1,
          out: 0,
        },
      ]),
    ).resolves.toEqual({ windowsUpserted: 1, windowsUnchanged: 0 });
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(2);
  });

  it('1205 hai lan -> nem loi (filter doi thanh 503)', async () => {
    const deadlock = Object.assign(new Error('deadlock victim'), {
      number: 1205,
    });
    const { sp } = spWith([deadlock, deadlock]);
    await expect(sp.recordBirdCount([])).rejects.toMatchObject({
      number: 1205,
    });
  });

  it('SP tra 0 dong -> Error (vi pham quy uoc 1 tap ket qua 1 dong)', async () => {
    const { sp } = spWith([[]]);
    await expect(sp.updateAlertStatus(1, 'ACK', 2, null)).rejects.toThrow(
      /0 dong/,
    );
  });

  it('createPredatorAlert: AlertJson -> object; detectAnomalies mac dinh 5 phut', async () => {
    const { sp } = spWith([
      {
        Created: true,
        AlertId: 11,
        SkipReason: null,
        AlertJson: '{"AlertId":11}',
      },
    ]);
    expect(
      await sp.createPredatorAlert({
        camera: 'H1-F0-CAMERA',
        class: 'snake',
        confidence: 0.87,
        snapshot: 'snapshots/a.jpg',
        at: '2026-10-12T10:40:07Z',
      }),
    ).toEqual({
      created: true,
      alertId: 11,
      skipReason: null,
      alert: { AlertId: 11 },
    });
    const d = spWith([{ NewAlertsJson: '[]' }]);
    await d.sp.detectAnomalies();
    expect(d.prisma.$queryRawUnsafe).toHaveBeenCalledWith(
      'EXEC dbo.sp_DetectAnomalies @OfflineMinutes = @P1, @NowUtc = @P2',
      5,
      null,
    );
  });
});
