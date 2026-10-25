import { Injectable, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { ApiError } from '../common/errors';
import type { AuthUser, Role } from '../common/decorators';
import * as pick from '../common/pickers';
import { DbService } from '../db/db.service';

export const JWT_TTL_SECONDS = 28800;
const unauthenticated = () => new ApiError(401, 'UNAUTHENTICATED');

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyHash = '';

  constructor(
    private readonly db: DbService,
    private readonly jwt: JwtService,
  ) {}

  // Hash gia hop le cost 10, tao mot lan: tai khoan khong ton tai van ton thoi gian bcrypt nhu that (spec backend 5.1).
  async onModuleInit(): Promise<void> {
    this.dummyHash = await hash(randomBytes(16).toString('hex'), 10);
  }

  async login(username: string, password: string) {
    const u = await this.db.prisma.users.findUnique({
      where: { Username: username },
    });
    const ok = await compare(password, u?.PasswordHash ?? this.dummyHash);
    if (!u || !ok || !u.IsActive) throw unauthenticated();
    const accessToken = await this.jwt.signAsync({
      sub: u.UserId,
      role: u.Role,
    });
    return {
      accessToken,
      expiresIn: JWT_TTL_SECONDS as 28800,
      user: pick.user(u),
    };
  }

  // Chi kiem chu ky + han, chi nhan HS256 (spec backend 5.1); Socket.IO goi rieng truoc khi kiem CSDL san sang (6.1).
  async verifySignature(token: string): Promise<{ sub: number; exp: number }> {
    let payload: { sub?: unknown; exp?: number };
    try {
      payload = await this.jwt.verifyAsync(token, { algorithms: ['HS256'] });
    } catch {
      throw unauthenticated();
    }
    if (!Number.isInteger(payload.sub)) throw unauthenticated();
    return { sub: payload.sub as number, exp: payload.exp ?? 0 };
  }

  // Doc lai Users theo khoa chinh; vai tro lay tu CSDL, khong tin token (hop dong 3.1).
  async loadActiveUser(sub: number, exp: number): Promise<AuthUser> {
    const u = await this.db.prisma.users.findUnique({ where: { UserId: sub } });
    if (!u || !u.IsActive) throw unauthenticated();
    return {
      userId: u.UserId,
      role: u.Role as Role,
      username: u.Username,
      exp,
    };
  }

  async verifyToken(token: string): Promise<AuthUser> {
    const p = await this.verifySignature(token);
    return this.loadActiveUser(p.sub, p.exp);
  }
}
