import {
  ActuatorState,
  Bounds,
  ZoneInput,
  decide,
  initLatches,
  offThresholds,
} from './rules';

const NOW = new Date(Date.UTC(2026, 9, 12, 10, 40, 7));
const fresh = (value: number) => ({ value, at: NOW });
const stale = (value: number) => ({
  value,
  at: new Date(NOW.getTime() - 3 * 60_000),
});
const TEMP: Bounds = { min: 26, max: 30, target: 28, hysteresis: 0.5 };
const HUMID: Bounds = { min: 75, max: 90, target: 82, hysteresis: 2 };
const CO2: Bounds = { min: null, max: 1000, target: null, hysteresis: 50 };
const fan = (o: Partial<ActuatorState> = {}): ActuatorState => ({
  deviceId: 1,
  type: 'FAN',
  mode: 'AUTO',
  isOn: false,
  level: 0,
  ...o,
});
const mist = (o: Partial<ActuatorState> = {}): ActuatorState => ({
  deviceId: 2,
  type: 'MIST',
  mode: 'AUTO',
  isOn: false,
  level: null,
  ...o,
});
const heater = (o: Partial<ActuatorState> = {}): ActuatorState => ({
  deviceId: 3,
  type: 'HEATER',
  mode: 'AUTO',
  isOn: false,
  level: null,
  ...o,
});

function zone(o: Partial<ZoneInput>): ZoneInput {
  return {
    readings: {},
    bounds: { TEMP, HUMID, CO2 },
    actuators: [fan(), mist(), heater()],
    latches: {},
    nowUtc: NOW,
    staleMinutes: 2,
    ...o,
  };
}
const cmds = (o: Partial<ZoneInput>) =>
  decide(zone(o)).commands.map((c) => [c.deviceId, c.isOn, c.level]);

describe('offThresholds', () => {
  it('co Min va Max: h = MIN(Hysteresis, (Max-Min)/4); lay muc chat hon voi Target', () => {
    expect(offThresholds(TEMP)).toEqual({ h: 0.5, offHi: 28, offLo: 28 });
    expect(offThresholds(HUMID)).toEqual({ h: 2, offHi: 82, offLo: 82 });
  });
  it('h bi chan boi (Max-Min)/4', () => {
    expect(
      offThresholds({ min: 28, max: 30, target: null, hysteresis: 2 }),
    ).toEqual({ h: 0.5, offHi: 29.5, offLo: 28.5 });
  });
  it('chi Max (CO2): offHi = Max - Hysteresis', () => {
    expect(offThresholds(CO2)).toEqual({ h: 50, offHi: 950, offLo: null });
  });
  it('Target = Max: offHi = Max - h (khong bat tat lien tuc quanh Max)', () => {
    expect(
      offThresholds({ min: 26, max: 30, target: 30, hysteresis: 0.5 }).offHi,
    ).toBe(29.5);
  });
});

describe('decide - bat/nha tung luat', () => {
  it.each([
    ['TEMP > Max -> FAN bat 100', { TEMP: fresh(30.6) }, {}, [[1, true, 100]]],
    [
      'TEMP < Min -> HEATER bat, Level NULL',
      { TEMP: fresh(25.4) },
      {},
      [[3, true, null]],
    ],
    ['HUMID < Min -> MIST bat', { HUMID: fresh(74.9) }, {}, [[2, true, null]]],
    ['HUMID > Max -> FAN bat', { HUMID: fresh(91) }, {}, [[1, true, 100]]],
    ['CO2 > Max -> FAN bat', { CO2: fresh(1050) }, {}, [[1, true, 100]]],
    [
      'trong vung tre, chot dang bat -> giu bat (khong lenh)',
      { TEMP: fresh(29) },
      { TEMP_HIGH: true },
      [],
    ],
  ])('%s', (_l, readings, latches, expected) => {
    const act =
      'TEMP_HIGH' in latches
        ? [fan({ isOn: true, level: 100 }), mist(), heater()]
        : undefined;
    expect(
      cmds({
        readings,
        latches: latches,
        ...(act ? { actuators: act } : {}),
      }),
    ).toEqual(expected);
  });

  it('nha: TEMP <= offHi (28) -> FAN tat Level 0', () => {
    const r = decide(
      zone({
        readings: { TEMP: fresh(28) },
        latches: { TEMP_HIGH: true },
        actuators: [fan({ isOn: true, level: 100 }), mist(), heater()],
      }),
    );
    expect(r.commands.map((c) => [c.deviceId, c.isOn, c.level])).toEqual([
      [1, false, 0],
    ]);
    expect(r.latches.TEMP_HIGH).toBe(false);
  });

  it('nha CO2 o 950 (Max - h), giu o 951', () => {
    const on = [fan({ isOn: true, level: 100 }), mist(), heater()];
    expect(
      cmds({
        readings: { CO2: fresh(951) },
        latches: { CO2_HIGH: true },
        actuators: on,
      }),
    ).toEqual([]);
    expect(
      cmds({
        readings: { CO2: fresh(950) },
        latches: { CO2_HIGH: true },
        actuators: on,
      }),
    ).toEqual([[1, false, 0]]);
  });
});

describe('decide - quy tac', () => {
  const fanOn = [fan({ isOn: true, level: 100 }), mist(), heater()];

  it('FAN do hai luat cung can: nha mot luat FAN van bat; nha ca hai moi tat', () => {
    expect(
      cmds({
        readings: { TEMP: fresh(27), CO2: fresh(1100) },
        latches: { TEMP_HIGH: true, CO2_HIGH: true },
        actuators: fanOn,
      }),
    ).toEqual([]);
    expect(
      cmds({
        readings: { TEMP: fresh(27), CO2: fresh(900) },
        latches: { TEMP_HIGH: true, CO2_HIGH: true },
        actuators: fanOn,
      }),
    ).toEqual([[1, false, 0]]);
  });

  it('moi luat mot chot: FAN bat vi CO2 khong lam luat TEMP tu giu', () => {
    const r = decide(
      zone({
        readings: { TEMP: fresh(29), CO2: fresh(1100) },
        latches: { CO2_HIGH: true },
        actuators: fanOn,
      }),
    );
    expect(r.latches.TEMP_HIGH).toBe(false);
  });

  it('gia tri cu hon staleMinutes -> bo qua, giu nguyen chot, khong lenh', () => {
    const r = decide(
      zone({
        readings: { TEMP: stale(25) },
        latches: { TEMP_HIGH: true },
        actuators: fanOn,
      }),
    );
    expect(r.commands).toEqual([]);
    expect(r.latches.TEMP_HIGH).toBe(true);
  });

  it('thiet bi MANUAL -> khong sinh lenh du chot doi', () => {
    expect(
      cmds({
        readings: { TEMP: fresh(31) },
        actuators: [fan({ mode: 'MANUAL' }), mist(), heater()],
      }),
    ).toEqual([]);
  });

  it('thieu nguong luat can (khong co Min HUMID) -> luat do tat han', () => {
    const r = decide(
      zone({
        readings: { HUMID: fresh(10) },
        bounds: { HUMID: { min: null, max: 90, target: null, hysteresis: 2 } },
      }),
    );
    expect(r.latches.HUMID_LOW).toBe(false);
    expect(r.commands).toEqual([]);
  });

  it('FAN tra ve AUTO voi Level 80 -> lenh Level 100 (can bat) hoac 0 (can tat)', () => {
    expect(
      cmds({
        readings: { TEMP: fresh(31) },
        actuators: [fan({ isOn: true, level: 80 }), mist(), heater()],
      }),
    ).toEqual([[1, true, 100]]);
    expect(
      cmds({
        readings: { TEMP: fresh(27) },
        actuators: [fan({ isOn: true, level: 80 }), mist(), heater()],
      }),
    ).toEqual([[1, false, 0]]);
  });

  it('khong co doi -> khong lenh; reason ghi luat va gia tri', () => {
    expect(cmds({ readings: { TEMP: fresh(28) } })).toEqual([]);
    expect(
      decide(zone({ readings: { TEMP: fresh(30.6) } })).commands[0].reason,
    ).toBe('TEMP 30.6 > Max 30');
  });
});

describe('initLatches', () => {
  const base = { bounds: { TEMP, HUMID, CO2 }, nowUtc: NOW, staleMinutes: 2 };
  it('khong cu, da vuot nguong bat -> chot bat', () => {
    expect(
      initLatches({
        ...base,
        readings: { TEMP: fresh(31) },
        actuators: [fan(), mist(), heater()],
      }).TEMP_HIGH,
    ).toBe(true);
  });
  it('khong cu, giua nguong bat va nha, thiet bi dang bat -> chot bat; thiet bi tat -> chot tat', () => {
    expect(
      initLatches({
        ...base,
        readings: { TEMP: fresh(29) },
        actuators: [fan({ isOn: true, level: 100 }), mist(), heater()],
      }).TEMP_HIGH,
    ).toBe(true);
    expect(
      initLatches({
        ...base,
        readings: { TEMP: fresh(29) },
        actuators: [fan(), mist(), heater()],
      }).TEMP_HIGH,
    ).toBe(false);
  });
  it('ca kho: cam bien mat ket noi luc khoi dong, thiet bi dang bat -> chot tat, decide khong tat thiet bi', () => {
    const latches = initLatches({
      ...base,
      readings: { TEMP: stale(31) },
      actuators: [fan({ isOn: true, level: 100 }), mist(), heater()],
    });
    expect(latches.TEMP_HIGH).toBe(false);
    expect(
      decide({
        ...base,
        readings: { TEMP: stale(31) },
        latches,
        actuators: [fan({ isOn: true, level: 100 }), mist(), heater()],
      }).commands,
    ).toEqual([]);
  });
});
