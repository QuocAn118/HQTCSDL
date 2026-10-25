import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ServiceKeyGuard } from './service-key.guard';
import { JwtAuthGuard } from './jwt-auth.guard';

const ctx = (req: object, meta: Record<string, unknown> = {}) => {
  const handler = () => undefined;
  Object.entries(meta).forEach(([k, v]) =>
    Reflect.defineMetadata(k, v, handler),
  );
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => handler,
    getClass: () => class {},
  } as never;
};

const thrown = (fn: () => unknown): unknown => {
  try {
    fn();
  } catch (e) {
    return e;
  }
  throw new Error('mong nem loi');
};

describe('RolesGuard', () => {
  const g = new RolesGuard(new Reflector());
  it('OWNER goi route ADMIN -> 403 FORBIDDEN', () => {
    expect(
      thrown(() =>
        g.canActivate(ctx({ user: { role: 'OWNER' } }, { roles: ['ADMIN'] })),
      ),
    ).toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });
  it('khong khai bao vai tro -> qua', () =>
    expect(g.canActivate(ctx({ user: { role: 'OWNER' } }))).toBe(true));
});

describe('ServiceKeyGuard', () => {
  const g = new ServiceKeyGuard({ aiServiceKey: 'k'.repeat(32) } as never);
  it('dung khoa -> qua; sai/thieu -> 401', () => {
    expect(
      g.canActivate(ctx({ headers: { 'x-service-key': 'k'.repeat(32) } })),
    ).toBe(true);
    for (const h of [{ 'x-service-key': 'khoa-sai' }, {}]) {
      expect(thrown(() => g.canActivate(ctx({ headers: h })))).toMatchObject({
        status: 401,
        code: 'UNAUTHENTICATED',
      });
    }
  });
});

describe('JwtAuthGuard', () => {
  it('route Public -> qua khong doc header; thieu Bearer -> 401; hop le -> gan req.user', async () => {
    const auth = {
      // eslint-disable-next-line @typescript-eslint/require-await -- gia lap ham async
      verifyToken: jest.fn(async () => ({
        userId: 2,
        role: 'OWNER',
        username: 'owner1',
        exp: 0,
      })),
    };
    const g = new JwtAuthGuard(new Reflector(), auth as never);
    await expect(
      g.canActivate(ctx({ headers: {} }, { isPublic: true })),
    ).resolves.toBe(true);
    await expect(g.canActivate(ctx({ headers: {} }))).rejects.toMatchObject({
      status: 401,
    });
    const req: { headers: object; user?: unknown } = {
      headers: { authorization: 'Bearer abc' },
    };
    await expect(g.canActivate(ctx(req))).resolves.toBe(true);
    expect(req.user).toMatchObject({ userId: 2 });
    expect(auth.verifyToken).toHaveBeenCalledWith('abc');
  });
});
