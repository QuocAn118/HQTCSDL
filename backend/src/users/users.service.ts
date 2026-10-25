import { Injectable } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { ApiError } from '../common/errors';
import type { AuthUser } from '../common/decorators';
import * as pick from '../common/pickers';
import { DbService } from '../db/db.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CreateUserDto, UpdateUserDto } from './dto';

const notFound = () => new ApiError(404, 'NOT_FOUND');

@Injectable()
export class UsersService {
  constructor(
    private readonly db: DbService,
    private readonly rt: RealtimeService,
  ) {}

  async list() {
    return (
      await this.db.prisma.users.findMany({ orderBy: { UserId: 'asc' } })
    ).map(pick.user);
  }

  async get(id: number) {
    const u = await this.db.prisma.users.findUnique({ where: { UserId: id } });
    if (!u) throw notFound();
    return pick.user(u);
  }

  async create(dto: CreateUserDto) {
    const u = await this.db.prisma.users.create({
      data: {
        Username: dto.username,
        PasswordHash: await hash(dto.password, 10),
        FullName: dto.fullName,
        Email: dto.email,
        Phone: dto.phone ?? null,
        Role: dto.role,
      },
    });
    return pick.user(u);
  }

  async update(actor: AuthUser, id: number, dto: UpdateUserDto) {
    const target = await this.db.prisma.users.findUnique({
      where: { UserId: id },
    });
    if (!target) throw notFound();
    const deactivate = dto.isActive === false && target.IsActive;
    const roleChanged = dto.role !== undefined && dto.role !== target.Role;
    if (
      id === actor.userId &&
      (deactivate || (roleChanged && dto.role !== 'ADMIN'))
    )
      throw new ApiError(409, 'CANNOT_MODIFY_SELF');
    const data = {
      FullName: dto.fullName,
      Email: dto.email,
      Phone: dto.phone,
      Role: dto.role,
      IsActive: dto.isActive,
    };

    let updated;
    if (
      target.Role === 'ADMIN' &&
      target.IsActive &&
      (deactivate || roleChanged)
    ) {
      // Hai ADMIN ha nhau dong thoi: dem va cap nhat trong cung transaction, khoa UPDLOCK, HOLDLOCK (hop dong 3.3).
      updated = await this.db.prisma.$transaction(async (tx) => {
        const [{ n }] = await tx.$queryRawUnsafe<Array<{ n: number }>>(
          'SELECT COUNT(*) AS n FROM dbo.Users WITH (UPDLOCK, HOLDLOCK) WHERE Role = @P1 AND IsActive = 1',
          'ADMIN',
        );
        if (Number(n) <= 1) throw new ApiError(409, 'LAST_ADMIN');
        return tx.users.update({ where: { UserId: id }, data });
      });
    } else {
      updated = await this.db.prisma.users.update({
        where: { UserId: id },
        data,
      });
    }
    if (deactivate || roleChanged) this.rt.disconnectUser(id); // spec backend 6.2
    return pick.user(updated);
  }

  async resetPassword(id: number, newPassword: string) {
    if (!(await this.db.prisma.users.findUnique({ where: { UserId: id } })))
      throw notFound();
    return pick.user(
      await this.db.prisma.users.update({
        where: { UserId: id },
        data: { PasswordHash: await hash(newPassword, 10) },
      }),
    );
  }
}
