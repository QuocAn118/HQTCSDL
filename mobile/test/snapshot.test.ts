import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSnapshot, setApiToken } from '../lib/api';

// Android <Image> bo qua source.headers -> 401; anh phai tai bang fetch co Authorization.
describe('fetchSnapshot', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setApiToken(null);
  });

  it('gui Bearer token va tra data URI JPEG dung noi dung', async () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const fetchMock = vi.fn(async () => new Response(jpeg, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    setApiToken('tok-123');

    const uri = await fetchSnapshot(5);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/alerts\/5\/snapshot$/);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok-123');
    expect(uri).toBe(`data:image/jpeg;base64,${Buffer.from(jpeg).toString('base64')}`);
  });

  it('anh lon hon mot khoi chuyen doi van dung', async () => {
    const big = new Uint8Array(100_000).map((_, i) => i % 256);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(big, { status: 200 })));
    setApiToken('t');

    expect(await fetchSnapshot(1)).toBe(`data:image/jpeg;base64,${Buffer.from(big).toString('base64')}`);
  });

  it('HTTP loi (401/404) thi nem loi de man hinh hien "Khong co anh"', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 401 })));
    await expect(fetchSnapshot(5)).rejects.toThrow('401');
  });
});
