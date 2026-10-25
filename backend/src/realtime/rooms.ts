import type { Role } from '../common/decorators';

export function roomsFor(
  user: { userId: number; role: Role },
  houses: Array<{ HouseId: number; OwnerId: number; IsActive: boolean }>,
): string[] {
  const own = houses
    .filter(
      (h) => h.IsActive && (user.role === 'ADMIN' || h.OwnerId === user.userId),
    )
    .map((h) => `house:${h.HouseId}`);
  return [
    `user:${user.userId}`,
    ...own,
    ...(user.role === 'ADMIN' ? ['role:ADMIN'] : []),
  ];
}

// Client doc connect_error.data.code (spec backend 6.1).
export function handshakeError(
  code: 'UNAUTHENTICATED' | 'RETRY_LATER',
): Error & { data: { code: string } } {
  return Object.assign(new Error(code), { data: { code } });
}
