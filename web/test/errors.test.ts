import { describe, expect, it } from 'vitest';
import { GENERIC_MESSAGE, MESSAGES, messageFor, toApiError } from '../lib/errors';

describe('errors (spec web 2.2)', () => {
  it.each(Object.entries(MESSAGES))('%s -> cau rieng', (code, text) => {
    expect(messageFor(code)).toBe(text);
  });

  it('du cac ma cua bang 2.2', () => {
    for (const code of ['ALERT_INVALID_TRANSITION', 'DEVICE_NOT_CONTROLLABLE', 'CONSTRAINT_VIOLATION', 'DUPLICATE',
      'VALIDATION_ERROR', 'NOT_FOUND', 'RETRY_LATER', 'NETWORK']) expect(MESSAGES[code]).toBeTruthy();
  });

  it('ma la hoac rong -> cau chung', () => {
    expect(messageFor('INTERNAL')).toBe(GENERIC_MESSAGE);
    expect(messageFor(null)).toBe(GENERIC_MESSAGE);
  });

  it('toApiError doc dinh dang hop dong 3.4, khong giu message tho', () => {
    const e = toApiError(400, { error: { code: 'VALIDATION_ERROR', message: 'SQL loi …', sqlNumber: null, details: { fields: ['minValue'] } } });
    expect(e.code).toBe('VALIDATION_ERROR');
    expect(e.fields).toEqual(['minValue']);
    expect(e.message).toBe('VALIDATION_ERROR');
    expect(toApiError(502, '<html>').code).toBe('HTTP_502');
  });
});
