import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import type { AuthUser } from '../common/decorators';
import { DbService } from '../db/db.service';
import { RealtimeService } from './realtime.service';
import { handshakeError, roomsFor } from './rooms';

type Code = 'UNAUTHENTICATED' | 'RETRY_LATER';

// Khong co @SubscribeMessage: client khong gui su kien len (hop dong 4.1).
@WebSocketGateway()
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly log = new Logger('Realtime');

  constructor(
    private readonly auth: AuthService,
    private readonly db: DbService,
    private readonly rt: RealtimeService,
  ) {}

  afterInit(server: Server): void {
    this.rt.attach(server);
    server.use((socket, next) => {
      this.handshake(socket).then(
        () => next(),
        (code: Code) => next(handshakeError(code)),
      );
    });
  }

  // Thu tu: chu ky JWT -> CSDL san sang -> doc lai Users (spec backend 6.1). Nem ra ma loi dang chuoi.
  /* eslint-disable @typescript-eslint/only-throw-error -- ma loi dang chuoi, afterInit doi thanh handshakeError */
  async handshake(socket: Socket): Promise<void> {
    const token = (socket.handshake.auth as { token?: unknown } | undefined)
      ?.token;
    if (typeof token !== 'string' || !token) throw 'UNAUTHENTICATED';
    let sig: { sub: number; exp: number };
    try {
      sig = await this.auth.verifySignature(token);
    } catch {
      throw 'UNAUTHENTICATED';
    }
    if (!this.db.isReady()) throw 'RETRY_LATER';
    try {
      (socket.data as { user?: AuthUser }).user =
        await this.auth.loadActiveUser(sig.sub, sig.exp);
    } catch (e) {
      throw (e as { code?: string })?.code === 'UNAUTHENTICATED'
        ? 'UNAUTHENTICATED'
        : 'RETRY_LATER';
    }
  }

  /* eslint-enable @typescript-eslint/only-throw-error */

  async handleConnection(socket: Socket): Promise<void> {
    const data = socket.data as {
      user?: AuthUser;
      expiryTimer?: NodeJS.Timeout;
    };
    const user = data.user;
    if (!user) {
      socket.disconnect(true);
      return;
    }
    try {
      const houses = await this.db.prisma.houses.findMany({
        where: {
          IsActive: true,
          ...(user.role === 'ADMIN' ? {} : { OwnerId: user.userId }),
        },
        select: { HouseId: true, OwnerId: true, IsActive: true },
      });
      await socket.join(roomsFor(user, houses));
    } catch (e) {
      this.log.warn(
        `Khong xep phong duoc cho nguoi dung ${user.userId}: ${(e as Error).message}`,
      );
      socket.disconnect(true);
      return;
    }
    data.expiryTimer = setTimeout(
      () => socket.disconnect(true),
      Math.max(0, user.exp * 1000 - Date.now()),
    );
  }

  handleDisconnect(socket: Socket): void {
    clearTimeout((socket.data as { expiryTimer?: NodeJS.Timeout }).expiryTimer);
  }
}
