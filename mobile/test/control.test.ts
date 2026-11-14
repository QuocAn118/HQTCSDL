import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  AUTO_BODY,
  FAN_STEPS,
  fanBody,
  switchBody,
} from '../lib/control';

describe(
  'than lenh dieu khien',
  () => {
    it(
      'FAN_STEPS',
      () => {
        expect(
          [...FAN_STEPS]
        ).toEqual([
          0,
          25,
          50,
          75,
          100,
        ]);
      }
    );

    it(
      'Level 0 la tat',
      () => {
        expect(
          fanBody(0)
        ).toEqual({
          mode: 'MANUAL',
          isOn: false,
        });

        expect(
          fanBody(0)
        ).not.toHaveProperty(
          'level'
        );
      }
    );

    it(
      'Level 50',
      () => {
        expect(
          fanBody(50)
        ).toEqual({
          mode: 'MANUAL',
          isOn: true,
          level: 50,
        });
      }
    );

    it(
      'level sai',
      () => {
        expect(() =>
          fanBody(60)
        ).toThrow();
      }
    );

    it(
      'switch va auto',
      () => {
        expect(
          switchBody(true)
        ).toEqual({
          mode: 'MANUAL',
          isOn: true,
        });

        expect(
          AUTO_BODY
        ).toEqual({
          mode: 'AUTO',
        });
      }
    );
  }
);