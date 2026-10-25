import { Injectable, Logger } from '@nestjs/common';
import type { Server } from 'socket.io';
import { serialize } from '../common/serialize';

// Cua duy nhat phat Socket.IO (spec backend 2.2, 6.3).
@Injectable()
export class RealtimeService {
  private server: Server | null = null;
  private readonly log = new Logger('Realtime');

  attach(server: Server): void {
    this.server = server;
  }

  emitToHouse(houseId: number, event: string, payload: object): void {
    try {
      this.server?.to(`house:${houseId}`).emit(event, serialize(payload));
    } catch (e) {
      this.log.error(
        `Phat ${event} cho nha ${houseId} loi: ${(e as Error).message}`,
      );
    }
  }

  houseActivated(houseId: number, ownerId: number): void {
    this.safe(() => {
      this.server?.in(`user:${ownerId}`).socketsJoin(`house:${houseId}`);
      this.server?.in('role:ADMIN').socketsJoin(`house:${houseId}`);
    });
  }

  houseDeactivated(houseId: number): void {
    this.safe(() =>
      this.server?.in(`house:${houseId}`).socketsLeave(`house:${houseId}`),
    );
  }

  disconnectUser(userId: number): void {
    this.safe(() => this.server?.in(`user:${userId}`).disconnectSockets(true));
  }

  private safe(fn: () => void): void {
    try {
      fn();
    } catch (e) {
      this.log.error(`Cap nhat phong loi: ${(e as Error).message}`);
    }
  }
}
