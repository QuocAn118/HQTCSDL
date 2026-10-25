/* eslint-disable @typescript-eslint/require-await -- gia lap ham async trong file test */
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';
import { ApiError } from '../common/errors';

function setup(opts: { ready?: boolean; active?: boolean } = {}) {
  const auth = {
    verifySignature: jest.fn(async (t: string) => {
      if (t !== 'good') throw new ApiError(401, 'UNAUTHENTICATED');
      return { sub: 2, exp: Math.floor(Date.now() / 1000) + 60 };
    }),
    loadActiveUser: jest.fn(async (sub: number, exp: number) => {
      if (opts.active === false) throw new ApiError(401, 'UNAUTHENTICATED');
      return { userId: sub, role: 'OWNER', username: 'owner1', exp };
    }),
  };
  const db = {
    isReady: () => opts.ready ?? true,
    prisma: {
      houses: {
        findMany: jest.fn(async () => [
          { HouseId: 1, OwnerId: 2, IsActive: true },
        ]),
      },
    },
  };
  return {
    gw: new RealtimeGateway(auth as never, db as never, new RealtimeService()),
    auth,
    db,
  };
}
const socket = (token?: unknown) => ({
  handshake: { auth: { token } },
  data: {} as Record<string, unknown>,
  join: jest.fn(),
  disconnect: jest.fn(),
});

describe('RealtimeGateway.handshake (thu tu spec backend 6.1)', () => {
  it.each([
    ['khong co token', undefined, {}, 'UNAUTHENTICATED'],
    ['token sai', 'bad', {}, 'UNAUTHENTICATED'],
    ['CSDL chua san sang', 'good', { ready: false }, 'RETRY_LATER'],
    ['nguoi dung bi khoa', 'good', { active: false }, 'UNAUTHENTICATED'],
  ])('%s -> %s', async (_l, token, opts, code) => {
    const { gw } = setup(opts);
    await expect(gw.handshake(socket(token) as never)).rejects.toBe(code);
  });

  it('token sai thi khong kiem CSDL; hop le thi gan socket.data.user', async () => {
    const { gw, auth } = setup({ ready: false });
    await expect(gw.handshake(socket('bad') as never)).rejects.toBe(
      'UNAUTHENTICATED',
    );
    expect(auth.loadActiveUser).not.toHaveBeenCalled();
    const ok = setup();
    const s = socket('good');
    await ok.gw.handshake(s as never);
    expect(s.data.user).toMatchObject({ userId: 2, role: 'OWNER' });
  });
});

describe('RealtimeGateway.handleConnection', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('vao phong, hen gio ngat dung exp, huy hen gio khi ngat truoc', async () => {
    const { gw } = setup();
    const s = socket('good');
    s.data.user = {
      userId: 2,
      role: 'OWNER',
      username: 'owner1',
      exp: Math.floor(Date.now() / 1000) + 60,
    };
    await gw.handleConnection(s as never);
    expect(s.join).toHaveBeenCalledWith(['user:2', 'house:1']);
    await jest.advanceTimersByTimeAsync(59_000);
    expect(s.disconnect).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1_500);
    expect(s.disconnect).toHaveBeenCalledWith(true);

    const s2 = socket('good');
    s2.data.user = {
      userId: 2,
      role: 'OWNER',
      username: 'owner1',
      exp: Math.floor(Date.now() / 1000) + 60,
    };
    await gw.handleConnection(s2 as never);
    gw.handleDisconnect(s2 as never);
    await jest.advanceTimersByTimeAsync(120_000);
    expect(s2.disconnect).not.toHaveBeenCalled();
  });
});
