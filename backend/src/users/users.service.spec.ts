/* eslint-disable @typescript-eslint/require-await -- gia lap ham async cua Prisma trong file test */
import { compareSync } from 'bcryptjs';
import { UsersService } from './users.service';

const ADMIN = { userId: 1, role: 'ADMIN' as const, username: 'admin', exp: 0 };
const row = (o: Record<string, unknown>) => ({
  UserId: 5,
  Username: 'u5',
  PasswordHash: 'h',
  FullName: 'U',
  Email: 'u5@x',
  Phone: null,
  Role: 'OWNER',
  IsActive: true,
  CreatedAt: new Date(0),
  ...o,
});

function setup(target: Record<string, unknown> | null, activeAdmins = 2) {
  const update = jest.fn(async ({ data }: { data: Record<string, unknown> }) =>
    row({ ...target, ...data }),
  );
  const tx = {
    $queryRawUnsafe: jest.fn(async () => [{ n: activeAdmins }]),
    users: { update },
  };
  const prisma = {
    users: {
      findUnique: jest.fn(async () => target && row(target)),
      update,
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) =>
        row(data),
      ),
    },
    $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const rt = { disconnectUser: jest.fn() };
  return {
    svc: new UsersService({ prisma } as never, rt as never),
    prisma,
    tx,
    rt,
    update,
  };
}

describe('UsersService.update', () => {
  it('ADMIN tu khoa minh hoac tu ha vai tro -> 409 CANNOT_MODIFY_SELF', async () => {
    for (const dto of [{ isActive: false }, { role: 'OWNER' as const }]) {
      const { svc, update } = setup({ UserId: 1, Role: 'ADMIN' });
      await expect(svc.update(ADMIN, 1, dto)).rejects.toMatchObject({
        status: 409,
        code: 'CANNOT_MODIFY_SELF',
      });
      expect(update).not.toHaveBeenCalled();
    }
  });

  it('ha ADMIN dang hoat dong cuoi cung -> 409 LAST_ADMIN, dem bang UPDLOCK, HOLDLOCK trong transaction', async () => {
    const { svc, tx, update } = setup({ UserId: 7, Role: 'ADMIN' }, 1);
    await expect(svc.update(ADMIN, 7, { role: 'OWNER' })).rejects.toMatchObject(
      { status: 409, code: 'LAST_ADMIN' },
    );
    expect(tx.$queryRawUnsafe.mock.calls[0][0]).toMatch(
      /WITH \(UPDLOCK, HOLDLOCK\)/,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('con ADMIN khac -> cap nhat trong transaction, ngat socket (doi vai tro)', async () => {
    const { svc, prisma, rt } = setup({ UserId: 7, Role: 'ADMIN' }, 2);
    await expect(
      svc.update(ADMIN, 7, { role: 'OWNER' }),
    ).resolves.toMatchObject({ userId: 7, role: 'OWNER' });
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(rt.disconnectUser).toHaveBeenCalledWith(7);
  });

  it('khoa OWNER -> ngat socket; doi ten -> khong ngat', async () => {
    const a = setup({ UserId: 5 });
    await a.svc.update(ADMIN, 5, { isActive: false });
    expect(a.rt.disconnectUser).toHaveBeenCalledWith(5);
    const b = setup({ UserId: 5 });
    await b.svc.update(ADMIN, 5, { fullName: 'Ten moi' });
    expect(b.rt.disconnectUser).not.toHaveBeenCalled();
  });

  it('khong ton tai -> 404', async () => {
    const { svc } = setup(null);
    await expect(
      svc.update(ADMIN, 99, { fullName: 'x' }),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });
});

describe('UsersService.create / resetPassword', () => {
  it('bam bcrypt cost 10, khong tra passwordHash', async () => {
    const { svc, prisma } = setup({ UserId: 5 });
    const u = await svc.create({
      username: 'moi',
      password: 'mat-khau-dai',
      fullName: 'Moi',
      email: 'moi@x.local',
      role: 'OWNER',
    });
    const hash = prisma.users.create.mock.calls[0][0].data
      .PasswordHash as string;
    expect(hash).toMatch(/^\$2[ab]\$10\$/);
    expect(compareSync('mat-khau-dai', hash)).toBe(true);
    expect(JSON.stringify(u)).not.toContain('$2');
  });

  it('resetPassword: bam mat khau moi', async () => {
    const { svc, update } = setup({ UserId: 5 });
    await svc.resetPassword(5, 'mat-khau-moi-1');
    expect(
      compareSync(
        'mat-khau-moi-1',
        update.mock.calls[0][0].data.PasswordHash as string,
      ),
    ).toBe(true);
  });
});
