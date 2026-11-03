import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { backoffDelay, classifyConnectError, classifyDisconnect, createLiveSocket } from '../lib/socket';

describe('socket (spec web 2.4)', () => {
  it('day gian cach 2, 4, 8, 16, 30, 30 giay', () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(backoffDelay)).toEqual([2000, 4000, 8000, 16000, 30000, 30000, 30000]);
  });

  it('connect_error: UNAUTHENTICATED -> dang xuat; RETRY_LATER va loi khac -> thu lai', () => {
    expect(classifyConnectError({ data: { code: 'UNAUTHENTICATED' } })).toBe('logout');
    expect(classifyConnectError({ data: { code: 'RETRY_LATER' } })).toBe('retry');
    expect(classifyConnectError({})).toBe('retry');
    expect(classifyConnectError(null)).toBe('retry');
  });

  it('disconnect: server ngat -> dang xuat; client tu dong -> khong lam gi; mat mang -> dang ket noi lai', () => {
    expect(classifyDisconnect('io server disconnect')).toBe('logout');
    expect(classifyDisconnect('io client disconnect')).toBe('none');
    expect(classifyDisconnect('transport close')).toBe('reconnecting');
    expect(classifyDisconnect('ping timeout')).toBe('reconnecting');
  });
});

// socket.io-client gia: chi giu listener, co active, ghi lai connect/disconnect.
type Fn = (...a: unknown[]) => void;
const fake = vi.hoisted(() => {
  class FakeSocket {
    listeners = new Map<string, Fn[]>();
    active = false;
    eventsAtConnect: string[][] = [];
    connect = vi.fn(() => { this.eventsAtConnect.push([...this.listeners.keys()]); return this; });
    disconnect = vi.fn(() => this);
    removeAllListeners = vi.fn(() => { this.listeners.clear(); return this; });
    constructor(public url: string, public opts: { autoConnect?: boolean; auth?: (cb: (d: object) => void) => void }) {}
    on(ev: string, fn: Fn) {
      this.listeners.set(ev, [...(this.listeners.get(ev) ?? []), fn]);
      return this;
    }
    fire(ev: string, ...args: unknown[]) {
      for (const fn of this.listeners.get(ev) ?? []) fn(...args);
    }
  }
  return { FakeSocket, last: undefined as InstanceType<typeof FakeSocket> | undefined };
});
vi.mock('socket.io-client', () => ({
  io: (url: string, opts: ConstructorParameters<typeof fake.FakeSocket>[1]) => (fake.last = new fake.FakeSocket(url, opts)),
}));

const err = (code?: string) => Object.assign(new Error('x'), code ? { data: { code } } : {});

describe('createLiveSocket (io gia)', () => {
  let token: string | null;
  let o: { onLogout: Mock<() => void>; onStatus: Mock<(s: string) => void>; onConnect: Mock<() => void>; reading: Mock<(p: unknown) => void> };
  let live: { close: () => void };
  const sock = () => fake.last!;

  beforeEach(() => {
    vi.useFakeTimers();
    token = 'tok-1';
    o = { onLogout: vi.fn<() => void>(), onStatus: vi.fn<(s: string) => void>(), onConnect: vi.fn<() => void>(), reading: vi.fn<(p: unknown) => void>() };
    live = createLiveSocket({
      url: 'http://api', getToken: () => token, onLogout: o.onLogout, onStatus: o.onStatus, onConnect: o.onConnect,
      handlers: { 'readings.new': o.reading },
    });
  });
  afterEach(() => vi.useRealTimers());

  it('khoi tao: autoConnect tat, nghe su kien truoc khi connect, bao connecting', () => {
    expect(sock().opts.autoConnect).toBe(false);
    expect(sock().connect).toHaveBeenCalledTimes(1);
    expect(sock().eventsAtConnect[0]).toEqual(expect.arrayContaining(['readings.new', 'connect', 'connect_error', 'disconnect']));
    expect(o.onStatus).toHaveBeenCalledWith('connecting');
    sock().fire('readings.new', { houseId: 1 });
    expect(o.reading).toHaveBeenCalledWith({ houseId: 1 });
  });

  it('(a) UNAUTHENTICATED -> onLogout, khong len lich connect lai', () => {
    sock().fire('connect_error', err('UNAUTHENTICATED'));
    expect(o.onLogout).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(120_000);
    expect(sock().connect).toHaveBeenCalledTimes(1);
  });

  it('(b) RETRY_LATER, active=false -> connect() sau 2,4,8,16,30,30 giay; ket noi duoc thi attempt ve 0', () => {
    let calls = 1;
    for (const d of [2000, 4000, 8000, 16000, 30000, 30000]) {
      sock().fire('connect_error', err('RETRY_LATER'));
      expect(o.onStatus).toHaveBeenLastCalledWith('reconnecting');
      vi.advanceTimersByTime(d - 1);
      expect(sock().connect).toHaveBeenCalledTimes(calls);
      vi.advanceTimersByTime(1);
      expect(sock().connect).toHaveBeenCalledTimes(++calls);
    }
    sock().fire('connect');
    expect(o.onStatus).toHaveBeenLastCalledWith('connected');
    expect(o.onConnect).toHaveBeenCalledTimes(1);
    sock().fire('connect_error', err('RETRY_LATER'));
    vi.advanceTimersByTime(2000);
    expect(sock().connect).toHaveBeenCalledTimes(calls + 1);
    expect(o.onLogout).not.toHaveBeenCalled();
  });

  it('(c) active=true (Socket.IO tu thu lai) -> khong tu goi connect() them', () => {
    sock().active = true;
    sock().fire('connect_error', err());
    sock().fire('connect_error', err('RETRY_LATER'));
    vi.advanceTimersByTime(120_000);
    expect(sock().connect).toHaveBeenCalledTimes(1);
    expect(o.onStatus).toHaveBeenLastCalledWith('reconnecting');
  });

  it("(d) 'io server disconnect' -> onLogout; 'io client disconnect' -> khong lam gi; 'transport close' -> reconnecting", () => {
    sock().fire('disconnect', 'io client disconnect');
    expect(o.onLogout).not.toHaveBeenCalled();
    expect(o.onStatus).toHaveBeenCalledTimes(1); // chi 'connecting' luc khoi tao
    sock().fire('disconnect', 'transport close');
    expect(o.onStatus).toHaveBeenLastCalledWith('reconnecting');
    sock().fire('disconnect', 'io server disconnect');
    expect(o.onLogout).toHaveBeenCalledTimes(1);
  });

  it('(e) close(): don timer, go listener, goi disconnect; sau close khong goi onLogout', () => {
    const s = sock();
    s.fire('connect_error', err('RETRY_LATER'));
    live.close();
    vi.advanceTimersByTime(120_000);
    expect(s.connect).toHaveBeenCalledTimes(1);
    expect(s.removeAllListeners).toHaveBeenCalled();
    expect(s.disconnect).toHaveBeenCalledTimes(1);
    s.fire('connect_error', err('UNAUTHENTICATED'));
    s.fire('disconnect', 'io server disconnect');
    expect(o.onLogout).not.toHaveBeenCalled();
  });

  it('(f) auth la ham, moi lan ket noi doc token hien tai', () => {
    const auth = sock().opts.auth!;
    expect(typeof auth).toBe('function');
    const cb = vi.fn();
    auth(cb);
    token = 'tok-2';
    auth(cb);
    expect(cb.mock.calls).toEqual([[{ token: 'tok-1' }], [{ token: 'tok-2' }]]);
  });
});
