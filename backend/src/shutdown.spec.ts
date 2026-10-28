/* eslint-disable @typescript-eslint/require-await -- gia lap buoc tat async */
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { connect } from 'node:net';
import { closeHttpServer, createShutdown } from './shutdown';

function deps(lost = 0) {
  const order: string[] = [];
  const d = {
    closeHttp: jest.fn(async () => {
      order.push('http');
    }),
    stopTimers: jest.fn(() => {
      order.push('timers');
    }),
    flush: jest.fn(async () => {
      order.push('flush');
      return lost;
    }),
    endMqtt: jest.fn(async () => {
      order.push('mqtt');
    }),
    closeApp: jest.fn(async () => {
      order.push('app');
    }),
    exit: jest.fn((code: number) => {
      order.push(`exit ${code}`);
    }),
    log: { log: jest.fn(), warn: jest.fn() },
  };
  return { d, order };
}

describe('createShutdown (spec backend 3.6)', () => {
  it('thu tu: ngung nhan request -> ngung nhip -> ghi not lo (5 giay) -> ngat MQTT giu phien -> dong app -> exit 0', async () => {
    const { d, order } = deps();
    await createShutdown(d)('SIGINT');
    expect(order).toEqual(['http', 'timers', 'flush', 'mqtt', 'app', 'exit 0']);
    expect(d.flush).toHaveBeenCalledWith(5000);
  });

  it('khong kip ghi -> log so phan tu mat', async () => {
    const { d } = deps(12);
    await createShutdown(d)('SIGINT');
    expect(d.log.warn).toHaveBeenCalledWith(expect.stringContaining('12'));
  });

  it('Ctrl+C lan hai -> thoat ngay, khong cho buoc nao', async () => {
    const { d } = deps();
    d.flush.mockImplementation(() => new Promise(() => undefined));
    const stop = createShutdown(d);
    void stop('SIGINT');
    await stop('SIGINT');
    expect(d.exit).toHaveBeenCalledWith(1);
    expect(d.endMqtt).not.toHaveBeenCalled();
  });

  // K6: web dang mo giu WebSocket Socket.IO -> server.close(cb) khong bao gio goi cb, tien trinh treo.
  it('closeHttpServer: ngung nhan ket noi moi, khong cho WebSocket dang mo', async () => {
    const server = createServer();
    server.on('upgrade', (_req, socket) => {
      socket.write(
        'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n',
      );
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const { port } = server.address() as AddressInfo;
    const ws = connect(port, '127.0.0.1');
    await new Promise<void>((r) => {
      ws.write(
        `GET / HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n`,
      );
      ws.once('data', () => r());
    });
    const t0 = Date.now();
    await closeHttpServer(server);
    expect(Date.now() - t0).toBeLessThan(500);
    expect(server.listening).toBe(false);
    ws.destroy();
  });

  it('loi o mot buoc khong chan buoc sau', async () => {
    const { d, order } = deps();
    d.endMqtt.mockRejectedValue(new Error('x'));
    await createShutdown(d)('SIGTERM');
    expect(order).toEqual(['http', 'timers', 'flush', 'app', 'exit 0']);
  });
});
