import { describe, expect, it } from 'vitest';
import { singleActiveHouse } from '../lib/houses';
import type { House } from '../lib/types';

const house = (houseId: number, isActive: boolean): House => ({ houseId, ownerId: 2, name: `N${houseId}`, address: null, isActive, createdAt: '2026-10-12T10:00:00Z' });

describe('singleActiveHouse (T11W-1)', () => {
  it('dung mot nha dang dung -> nha do, ke ca khi con nha da ngung dung', () => {
    expect(singleActiveHouse([house(1, true)])?.houseId).toBe(1);
    expect(singleActiveHouse([house(4, false), house(1, true)])?.houseId).toBe(1);
  });

  it('khong co hoac nhieu nha dang dung -> null, o lai danh sach', () => {
    expect(singleActiveHouse([])).toBeNull();
    expect(singleActiveHouse([house(4, false)])).toBeNull();
    expect(singleActiveHouse([house(1, true), house(2, true)])).toBeNull();
  });
});
