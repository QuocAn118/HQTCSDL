import { RealtimeService } from './realtime.service';

function fakeServer() {
  const calls: Array<[string, ...unknown[]]> = [];
  const room = (name: string) => ({
    emit: (e: string, p: unknown) => calls.push(['emit', name, e, p]),
    socketsJoin: (r: string) => calls.push(['join', name, r]),
    socketsLeave: (r: string) => calls.push(['leave', name, r]),
    disconnectSockets: (close: boolean) =>
      calls.push(['disconnect', name, close]),
  });
  return { server: { to: room, in: room }, calls };
}

describe('RealtimeService', () => {
  it('emitToHouse: qua serialize, phat vao house:{id}', () => {
    const { server, calls } = fakeServer();
    const rt = new RealtimeService();
    rt.attach(server as never);
    rt.emitToHouse(1, 'device.state', { DeviceId: 3, at: new Date(0) });
    expect(calls).toEqual([
      [
        'emit',
        'house:1',
        'device.state',
        { deviceId: 3, at: '1970-01-01T00:00:00.000Z' },
      ],
    ]);
  });

  it('chua attach hoac phat loi -> khong nem', () => {
    const rt = new RealtimeService();
    expect(() => rt.emitToHouse(1, 'x', {})).not.toThrow();
    rt.attach({
      to: () => {
        throw new Error('hong');
      },
    } as never);
    expect(() => rt.emitToHouse(1, 'x', {})).not.toThrow();
  });

  it('cap nhat phong khi dang ket noi (spec backend 6.2)', () => {
    const { server, calls } = fakeServer();
    const rt = new RealtimeService();
    rt.attach(server as never);
    rt.houseActivated(5, 2);
    rt.houseDeactivated(5);
    rt.disconnectUser(2);
    expect(calls).toEqual([
      ['join', 'user:2', 'house:5'],
      ['join', 'role:ADMIN', 'house:5'],
      ['leave', 'house:5', 'house:5'],
      ['disconnect', 'user:2', true],
    ]);
  });
});
