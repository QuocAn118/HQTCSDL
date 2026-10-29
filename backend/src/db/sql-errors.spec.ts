import {
  isConnectionError,
  isDbConfigError,
  isRequestTimeout,
  mapSqlError,
  sqlNumberOf,
} from './sql-errors';

const REQUEST_TIMEOUT = {
  code: 'ETIMEOUT',
  message:
    'Invalid `prisma.$queryRawUnsafe()` invocation:\nTimeout: Request failed to complete in 15000ms',
};

describe('sqlNumberOf', () => {
  it.each([
    ['so o tang ngoai', { number: 1205 }, 1205],
    [
      'so trong cause (driver)',
      { message: 'x', cause: { originalCode: 50021 } },
      50021,
    ],
    [
      'so trong meta.driverAdapterError.cause',
      { meta: { driverAdapterError: { cause: { kind: 'mssql', code: 547 } } } },
      547,
    ],
    ['so dang chuoi', { cause: { code: '2627' } }, 2627],
    ['Prisma P2002 -> trung khoa', { code: 'P2002' }, 2627],
    ['Prisma P2003 -> khoa ngoai', { code: 'P2003' }, 547],
    [
      'message deadlock',
      new Error(
        'Transaction (Process ID 55) was deadlocked ... chosen as the deadlock victim',
      ),
      1205,
    ],
    [
      'message CHECK',
      new Error(
        'The UPDATE statement conflicted with the CHECK constraint "CK_Thresholds_MinMax"',
      ),
      547,
    ],
    [
      'message duplicate',
      new Error(
        'Violation of UNIQUE KEY constraint. Cannot insert duplicate key',
      ),
      2627,
    ],
    [
      'message login',
      new Error("Login failed for user 'swiftlet_dev'."),
      18456,
    ],
    [
      'message db',
      new Error('Cannot open database "X" requested by the login.'),
      4060,
    ],
    ['khong co so', new Error('loi la'), null],
  ])('%s', (_label, err, expected) => {
    expect(sqlNumberOf(err)).toBe(expected);
  });

  // Hinh loi that chep tu spike S6 (Prisma 7.10.0 + adapter-mssql, CSDL that).
  const real = (kind: string, message: string, code?: number) => ({
    code: 'P2010',
    message: `Raw query failed. Code: \`EREQUEST\`. Message: \`${message}\``,
    meta: {
      driverAdapterError: {
        cause: { originalCode: 'EREQUEST', kind, ...(code && { code }) },
      },
    },
  });
  it.each([
    [
      'THROW 50030 (so o cause.code)',
      real('mssql', 'Chuoi JSON khong hop le (can mot mang).', 50030),
      50030,
    ],
    [
      'THROW 50042',
      real('mssql', '@StaleMinutes phai lon hon 0.', 50042),
      50042,
    ],
    [
      '547 CHECK (khong co so, chi co kind + message)',
      real(
        'ForeignKeyConstraintViolation',
        'The UPDATE statement conflicted with the CHECK constraint "CK_Thresholds_MinMax".',
      ),
      547,
    ],
    [
      '2627 UNIQUE KEY',
      real(
        'UniqueConstraintViolation',
        "Violation of UNIQUE KEY constraint 'Users_Username_key'. Cannot insert duplicate key in object 'dbo.Users'.",
      ),
      2627,
    ],
    [
      '2601 chi muc duy nhat',
      real(
        'UniqueConstraintViolation',
        "Cannot insert duplicate key row in object 'dbo.Alerts' with unique index 'UX_Alerts_OpenThreshold'.",
      ),
      2601,
    ],
    [
      '1205 deadlock',
      real(
        'TransactionWriteConflict',
        'Transaction (Process ID 82) was deadlocked on lock resources with another process and has been chosen as the deadlock victim. Rerun the transaction.',
      ),
      1205,
    ],
  ])('hinh loi that S6: %s', (_label, err, expected) => {
    expect(sqlNumberOf(err)).toBe(expected);
  });

  it('khong lap vo han voi vong tham chieu', () => {
    const a: Record<string, unknown> = {};
    a.self = a;
    expect(sqlNumberOf(a)).toBeNull();
  });
});

describe('isConnectionError', () => {
  it.each([
    [{ code: 'P1001' }, true],
    [{ cause: { code: 'ESOCKET' } }, true],
    [{ cause: { code: 'ETIMEOUT' } }, true],
    [new Error('Failed to connect to localhost:1'), true],
    [{ number: 547 }, false],
    [new Error('loi khac'), false],
    // T23-1: qua han request (hinh dang that qua Prisma) khong phai mat ket noi; qua han KET NOI van la.
    [REQUEST_TIMEOUT, false],
    [
      {
        code: 'ETIMEOUT',
        message: 'Failed to connect to localhost:1433 in 15000ms',
      },
      true,
    ],
  ])('%j -> %s', (err, expected) => {
    expect(isConnectionError(err)).toBe(expected);
  });

  it('isRequestTimeout chi nhan qua han request', () => {
    expect(isRequestTimeout(REQUEST_TIMEOUT)).toBe(true);
    expect(
      isRequestTimeout({
        code: 'ETIMEOUT',
        message: 'Failed to connect to x in 15000ms',
      }),
    ).toBe(false);
    expect(isRequestTimeout(new Error('la'))).toBe(false);
  });
});

describe('mapSqlError (hop dong 3.5)', () => {
  it.each([
    [50001, 500, 'INTERNAL', null],
    [50002, 500, 'INTERNAL', null],
    [50003, 409, 'DEVICE_NOT_CONTROLLABLE', null],
    [50010, 404, 'CAMERA_NOT_FOUND', null],
    [50012, 400, 'VALIDATION_ERROR', { fields: ['in', 'out'] }],
    [50013, 400, 'VALIDATION_ERROR', { fields: ['class'] }],
    [50014, 400, 'VALIDATION_ERROR', { fields: ['windowStart'] }],
    [50020, 404, 'ALERT_NOT_FOUND', null],
    [50021, 409, 'ALERT_INVALID_TRANSITION', null],
    [50030, 400, 'INVALID_JSON', null],
    [50040, 400, 'INVALID_PARAMETER', null],
    [50041, 400, 'INVALID_PARAMETER', null],
    [50042, 400, 'INVALID_PARAMETER', null],
    [547, 400, 'CONSTRAINT_VIOLATION', null],
    [2627, 409, 'DUPLICATE', null],
    [2601, 409, 'DUPLICATE', null],
    [1205, 503, 'RETRY_LATER', null],
    // T23F-1: CSDL OFFLINE/RESTORE luc dang chay (REST chi toi CSDL khi da san sang).
    [942, 503, 'RETRY_LATER', null],
    [18456, 503, 'RETRY_LATER', null],
    [4060, 503, 'RETRY_LATER', null],
    [8152, 500, 'INTERNAL', null],
  ])('%i -> %i %s', (n, status, code, details) => {
    const e = mapSqlError(n);
    expect([e.status, e.code, e.details]).toEqual([status, code, details]);
    expect(e.sqlNumber).toBe(n);
  });

  it('isDbConfigError chi 18456 va 4060', () => {
    expect([18456, 4060, 547, null].map(isDbConfigError)).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });
});
