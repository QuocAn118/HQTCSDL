import { handshakeError, roomsFor } from './rooms';

const houses = [
  { HouseId: 1, OwnerId: 2, IsActive: true },
  { HouseId: 2, OwnerId: 3, IsActive: true },
  { HouseId: 3, OwnerId: 2, IsActive: false },
];

describe('roomsFor (hop dong 4.1)', () => {
  it('OWNER: user + nha dang hoat dong cua minh', () => {
    expect(roomsFor({ userId: 2, role: 'OWNER' }, houses)).toEqual([
      'user:2',
      'house:1',
    ]);
  });
  it('ADMIN: user + moi nha dang hoat dong + role:ADMIN', () => {
    expect(roomsFor({ userId: 1, role: 'ADMIN' }, houses)).toEqual([
      'user:1',
      'house:1',
      'house:2',
      'role:ADMIN',
    ]);
  });
  it('handshakeError mang data.code', () => {
    expect(handshakeError('RETRY_LATER')).toMatchObject({
      message: 'RETRY_LATER',
      data: { code: 'RETRY_LATER' },
    });
  });
});
