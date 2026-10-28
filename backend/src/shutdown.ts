import type { Server } from 'node:http';

export interface ShutdownDeps {
  closeHttp(): Promise<void>;
  stopTimers(): void;
  flush(ms: number): Promise<number>;
  endMqtt(): Promise<void>;
  closeApp(): Promise<void>;
  exit(code: number): void;
  log: { log(m: string): void; warn(m: string): void };
}

export const FLUSH_ON_EXIT_MS = 5000;

// Chi ngung nhan ket noi moi: callback cua close() cho moi ket noi dong, ma WebSocket Socket.IO
// giu mai -> treo (K6). Ket noi dang mo do app.close() o buoc cuoi dong.
export function closeHttpServer(server: Server): Promise<void> {
  server.close();
  return Promise.resolve();
}

// Thu tu tat theo spec backend 3.6.
export function createShutdown(
  d: ShutdownDeps,
): (signal: string) => Promise<void> {
  let stopping = false;
  const step = async (fn: () => unknown) => {
    try {
      await fn();
    } catch {
      /* buoc loi khong chan buoc sau */
    }
  };
  return async (signal: string) => {
    if (stopping) {
      d.log.warn('Nhan tin hieu lan hai: thoat ngay');
      d.exit(1);
      return;
    }
    stopping = true;
    d.log.log(`Nhan ${signal}, dang tat`);
    await step(() => d.closeHttp());
    await step(() => d.stopTimers());
    let lost = 0;
    await step(async () => {
      lost = await d.flush(FLUSH_ON_EXIT_MS);
    });
    if (lost > 0) d.log.warn(`Khong kip ghi ${lost} so do trong hang cho`);
    await step(() => d.endMqtt());
    await step(() => d.closeApp());
    d.exit(0);
  };
}
