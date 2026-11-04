// Nha: chon nha de vao thang; cho trang con bao layout khi thong tin nha doi (tieu de dau trang).
import { createContext } from 'react';
import type { House } from './types';

export function singleActiveHouse(list: House[]): House | null {
  const active = list.filter((h) => h.isActive);
  return active.length === 1 ? active[0] : null;
}

export const HouseChangedContext = createContext<(h: House) => void>(() => {});
