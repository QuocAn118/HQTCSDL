import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiError, MESSAGES } from './errors';
import { AllExceptionsFilter, toApiError } from './all-exceptions.filter';

function hostFor(res: { status: jest.Mock; json: jest.Mock }) {
  return {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => ({
        method: 'GET',
        route: { path: '/api/x' },
        url: '/api/x?secret=1',
      }),
    }),
  } as never;
}

describe('toApiError', () => {
  it.each([
    [new NotFoundException(), 404, 'NOT_FOUND'],
    [new PayloadTooLargeException(), 413, 'PAYLOAD_TOO_LARGE'],
    [new UnauthorizedException(), 401, 'UNAUTHENTICATED'],
    [new ForbiddenException(), 403, 'FORBIDDEN'],
    [
      new BadRequestException('Unexpected token } in JSON'),
      400,
      'VALIDATION_ERROR',
    ],
    [{ number: 50021 }, 409, 'ALERT_INVALID_TRANSITION'],
    [{ code: 'P1001' }, 503, 'RETRY_LATER'],
    [new Error('bat ngo'), 500, 'INTERNAL'],
  ])('%p -> %i %s', (e, status, code) => {
    const a = toApiError(e);
    expect([a.status, a.code]).toEqual([status, code]);
  });

  it('ApiError giu nguyen', () => {
    const e = new ApiError(409, 'LAST_ADMIN');
    expect(toApiError(e)).toBe(e);
  });
});

describe('AllExceptionsFilter', () => {
  it('tra dung dinh dang hop dong 3.4, message tu bang co dinh, khong lo loi SQL', () => {
    const res = { status: jest.fn(), json: jest.fn() };
    res.status.mockReturnValue(res);
    const failures: unknown[] = [];
    new AllExceptionsFilter({ reportFailure: (e) => failures.push(e) }).catch(
      Object.assign(
        new Error(
          'The UPDATE statement conflicted with the CHECK constraint "CK_X" in C:\\db',
        ),
        { number: 547 },
      ),
      hostFor(res),
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'CONSTRAINT_VIOLATION',
        message: MESSAGES.CONSTRAINT_VIOLATION,
        sqlNumber: 547,
        details: null,
      },
    });
    expect(JSON.stringify(res.json.mock.calls[0] as unknown[])).not.toMatch(
      /CHECK|C:\\/,
    );
    expect(failures).toEqual([]);
  });

  it('loi ket noi -> 503 RETRY_LATER va bao DbHealth', () => {
    const res = { status: jest.fn(), json: jest.fn() };
    res.status.mockReturnValue(res);
    const failures: unknown[] = [];
    new AllExceptionsFilter({ reportFailure: (e) => failures.push(e) }).catch(
      { code: 'P1001' },
      hostFor(res),
    );
    expect(res.status).toHaveBeenCalledWith(503);
    expect(failures).toHaveLength(1);
  });

  it('moi code trong MESSAGES la cau tieng Viet khong rong', () => {
    for (const code of [
      'VALIDATION_ERROR',
      'UNAUTHENTICATED',
      'FORBIDDEN',
      'NOT_FOUND',
      'CANNOT_MODIFY_SELF',
      'LAST_ADMIN',
      'PAYLOAD_TOO_LARGE',
      'UNSUPPORTED_MEDIA_TYPE',
      'INTERNAL',
      'RETRY_LATER',
      'DEVICE_NOT_CONTROLLABLE',
      'CAMERA_NOT_FOUND',
      'ALERT_NOT_FOUND',
      'ALERT_INVALID_TRANSITION',
      'INVALID_JSON',
      'INVALID_PARAMETER',
      'CONSTRAINT_VIOLATION',
      'DUPLICATE',
    ]) {
      expect(MESSAGES[code]?.length).toBeGreaterThan(5);
    }
  });
});
