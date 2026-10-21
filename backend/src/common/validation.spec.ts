import { IsInt, IsOptional, ValidateNested, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiError } from './errors';
import { IsUtcIso, IsVnDate, isUtcIso, validateDto } from './validation';

class Inner {
  @IsUtcIso() at!: string;
}
class Outer {
  @IsString() camera!: string;
  @IsInt() count!: number;
  @IsOptional() @IsVnDate() day?: string;
  @ValidateNested() @Type(() => Inner) inner!: Inner;
}

describe('isUtcIso', () => {
  it.each([
    ['2026-10-12T10:40:00Z', true],
    ['2026-10-12T10:40:00.000Z', true],
    ['2026-10-12T10:40:00.5Z', true],
    ['2026-10-12T10:40:00', false],
    ['2026-10-12T17:40:00+07:00', false],
    ['2026-02-30T00:00:00Z', false],
    ['2026-10-12', false],
    [1760265600000, false],
    [null, false],
  ])('%p -> %p', (v, ok) => expect(isUtcIso(v)).toBe(ok));
});

describe('validateDto', () => {
  it('hop le -> tra instance', async () => {
    const o = await validateDto(Outer, {
      camera: 'H1-F0-CAMERA',
      count: 1,
      day: '2026-10-12',
      inner: { at: '2026-10-12T10:40:00Z' },
    });
    expect(o).toBeInstanceOf(Outer);
  });

  it('loi long nhau -> fields la ten truong la; truong la -> VALIDATION_ERROR', async () => {
    await expect(
      validateDto(Outer, {
        camera: 'x',
        count: 1,
        inner: { at: '2026-10-12T17:40:00+07:00' },
      }),
    ).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      details: { fields: ['at'] },
    });
    await expect(
      validateDto(Outer, {
        camera: 'x',
        count: 1,
        inner: { at: '2026-10-12T10:40:00Z' },
        extra: 1,
      }),
    ).rejects.toMatchObject({ details: { fields: ['extra'] } });
    await expect(
      validateDto(Outer, {
        camera: 'x',
        count: 1.5,
        day: '12/10/2026',
        inner: { at: '2026-10-12T10:40:00Z' },
      }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
