/* eslint-disable @typescript-eslint/require-await -- gia lap ham async cua Prisma trong file test */
import { JwtService } from '@nestjs/jwt';
import { hashSync } from 'bcryptjs';
import { AuthService, JWT_TTL_SECONDS } from './auth.service';

const SECRET = 's'.repeat(32);
const HASH = hashSync('dung-mat-khau', 4);

function setup(users: Record<string, unknown>[]) {
  const findUnique = jest.fn(
    async ({ where }: { where: { Username?: string; UserId?: number } }) =>
      users.find((u) =>
        where.Username !== undefined
          ? u.Username === where.Username
          : u.UserId === where.UserId,
      ) ?? null,
  );
  const db = { prisma: { users: { findUnique } } };
  const jwt = new JwtService({
    secret: SECRET,
    signOptions: { algorithm: 'HS256', expiresIn: JWT_TTL_SECONDS },
  });
  return { auth: new AuthService(db as never, jwt), jwt, findUnique };
}

const owner = {
  UserId: 2,
  Username: 'owner1',
  PasswordHash: HASH,
  FullName: 'Chủ nhà yến H1',
  Email: 'owner1@swiftletcare.local',
  Phone: null,
  Role: 'OWNER',
  IsActive: true,
};

describe('AuthService.login', () => {
  it('dung mat khau -> token HS256 {sub, role}, expiresIn 28800, user khong co passwordHash', async () => {
    const { auth, jwt } = setup([owner]);
    await auth.onModuleInit();
    const r = await auth.login('owner1', 'dung-mat-khau');
    expect(r.expiresIn).toBe(28800);
    expect(r.user).toEqual({
      userId: 2,
      username: 'owner1',
      fullName: 'Chủ nhà yến H1',
      email: 'owner1@swiftletcare.local',
      phone: null,
      role: 'OWNER',
      isActive: true,
    });
    const header = JSON.parse(
      Buffer.from(r.accessToken.split('.')[0], 'base64url').toString(),
    ) as { alg: string };
    expect(header.alg).toBe('HS256');
    const p = jwt.decode<{
      sub: number;
      role: string;
      exp: number;
      iat: number;
    }>(r.accessToken);
    expect([p.sub, p.role, p.exp - p.iat]).toEqual([2, 'OWNER', 28800]);
  });

  it.each([
    ['sai mat khau', 'owner1', 'sai'],
    ['khong co tai khoan', 'khongco', 'dung-mat-khau'],
  ])('%s -> 401 UNAUTHENTICATED', async (_l, u, p) => {
    const { auth } = setup([owner]);
    await auth.onModuleInit();
    await expect(auth.login(u, p)).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHENTICATED',
    });
  });

  it('tai khoan bi khoa -> cung loi 401', async () => {
    const { auth } = setup([{ ...owner, IsActive: false }]);
    await auth.onModuleInit();
    await expect(auth.login('owner1', 'dung-mat-khau')).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHENTICATED',
    });
  });
});

describe('AuthService.verifyToken', () => {
  it('vai tro lay tu CSDL, khong tin token (Review Focus 2)', async () => {
    const { auth, jwt } = setup([
      { ...owner, UserId: 1, Username: 'admin', Role: 'OWNER' },
    ]);
    const token = jwt.sign({ sub: 1, role: 'ADMIN' });
    await expect(auth.verifyToken(token)).resolves.toMatchObject({
      userId: 1,
      role: 'OWNER',
      username: 'admin',
    });
  });

  it('alg none -> 401', async () => {
    const { auth } = setup([owner]);
    const b64 = (o: object) =>
      Buffer.from(JSON.stringify(o)).toString('base64url');
    await expect(
      auth.verifyToken(
        `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: 2, role: 'ADMIN' })}.`,
      ),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('ky bang khoa khac, het han, sub khong phai so, nguoi dung bi khoa -> 401', async () => {
    const { auth, jwt } = setup([{ ...owner, IsActive: false }]);
    const other = new JwtService({ secret: 'x'.repeat(32) });
    for (const t of [
      other.sign({ sub: 2 }),
      jwt.sign({ sub: 2 }, { expiresIn: -10 }),
      jwt.sign({ sub: 'abc' }),
      jwt.sign({ sub: 2 }),
    ]) {
      await expect(auth.verifyToken(t)).rejects.toMatchObject({
        status: 401,
        code: 'UNAUTHENTICATED',
      });
    }
  });
});
