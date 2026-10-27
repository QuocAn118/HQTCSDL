import { validateDto } from '../common/validation';
import { CreateDeviceDto, CreateHouseDto, UpdateHouseDto } from './dto';

describe('DTO nha/thiet bi (spec backend 5.3)', () => {
  it('code thiet bi khop ^[A-Z0-9-]{3,50}$', async () => {
    await expect(
      validateDto(CreateDeviceDto, {
        code: 'H1-F9-FAN',
        name: 'Quat',
        deviceType: 'FAN',
      }),
    ).resolves.toBeDefined();
    for (const code of ['h1-f9-fan', 'H1 F9', 'AB', 'H1/F9', 'H1-F9-FAN#']) {
      await expect(
        validateDto(CreateDeviceDto, { code, name: 'x', deviceType: 'FAN' }),
      ).rejects.toMatchObject({ details: { fields: ['code'] } });
    }
  });
  it('PATCH nha khong nhan ownerId; deviceType la -> 400', async () => {
    await expect(
      validateDto(UpdateHouseDto, { ownerId: 3 }),
    ).rejects.toMatchObject({ details: { fields: ['ownerId'] } });
    await expect(
      validateDto(CreateDeviceDto, {
        code: 'H1-F9-X',
        name: 'x',
        deviceType: 'LAMP',
      }),
    ).rejects.toMatchObject({ details: { fields: ['deviceType'] } });
    await expect(
      validateDto(CreateHouseDto, { name: 'Nha moi', ownerId: 2 }),
    ).resolves.toBeDefined();
  });
});
