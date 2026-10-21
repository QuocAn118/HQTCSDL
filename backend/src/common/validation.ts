import { ValidationError, ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { ValidateBy, validate } from 'class-validator';
import { ApiError } from './errors';

export const ISO_Z_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const VN_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isUtcIso(v: unknown): boolean {
  if (typeof v !== 'string' || !ISO_Z_RE.test(v)) return false;
  const t = Date.parse(v);
  // Date tu tran ngay (30/02 -> 02/03): so lai phan ngay gio de bat ngay khong co that.
  return (
    Number.isFinite(t) &&
    new Date(t).toISOString().slice(0, 19) === v.slice(0, 19)
  );
}

export function isVnDate(v: unknown): boolean {
  return (
    typeof v === 'string' && VN_DATE_RE.test(v) && isUtcIso(`${v}T00:00:00Z`)
  );
}

export const IsUtcIso = () =>
  ValidateBy({
    name: 'isUtcIso',
    validator: {
      validate: isUtcIso,
      defaultMessage: () => 'phai la ISO 8601 UTC co Z',
    },
  });
export const IsVnDate = () =>
  ValidateBy({
    name: 'isVnDate',
    validator: {
      validate: isVnDate,
      defaultMessage: () => 'phai la YYYY-MM-DD',
    },
  });

// Ten truong la (bo khung long nhau va chi so mang), giu thu tu, khong trung (bo sung hop dong B7).
export function leafFields(errors: ValidationError[]): string[] {
  const out: string[] = [];
  const visit = (e: ValidationError) => {
    if (e.children?.length) e.children.forEach(visit);
    else if (!out.includes(e.property)) out.push(e.property);
  };
  errors.forEach(visit);
  return out;
}

export const validationError = (errors: ValidationError[]) =>
  new ApiError(400, 'VALIDATION_ERROR', null, { fields: leafFields(errors) });

export function validationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: validationError,
  });
}

export async function validateDto<T extends object>(
  cls: new () => T,
  plain: unknown,
): Promise<T> {
  const obj = plainToInstance(cls, plain);
  if (obj === null || typeof obj !== 'object')
    throw new ApiError(400, 'VALIDATION_ERROR', null, { fields: [cls.name] });
  const errors = await validate(obj, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  if (errors.length) throw validationError(errors);
  return obj;
}
