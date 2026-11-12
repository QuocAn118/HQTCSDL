import { describe, expect, it } from 'vitest';
import { ALERT_STATUS_LABEL, ALERT_TYPE_LABEL, PREDATOR_LABEL, SEVERITY_LABEL, viLabel } from '../components/labels';

describe('bang tra chu tieng Viet cho ma canh bao (web-ui T0)', () => {
  it('trang thai, loai, muc do, lop thien dich ra tieng Viet', () => {
    expect([ALERT_STATUS_LABEL.NEW, ALERT_STATUS_LABEL.ACK, ALERT_STATUS_LABEL.RESOLVED]).toEqual(['Mới', 'Đã xem', 'Đã xử lý']);
    expect(viLabel(ALERT_TYPE_LABEL, 'PREDATOR')).toBe('Thiên địch');
    expect(viLabel(ALERT_TYPE_LABEL, 'POPULATION_DROP')).toBe('Sụt đàn');
    expect(viLabel(SEVERITY_LABEL, 'CRITICAL')).toBe('Nghiêm trọng');
    expect(viLabel(SEVERITY_LABEL, 'WARNING')).toBe('Cần chú ý');
    expect(viLabel(PREDATOR_LABEL, 'snake')).toBe('Rắn');
  });

  it('ma la giu nguyen de khong mat thong tin; null ra gach ngang', () => {
    expect(viLabel(SEVERITY_LABEL, 'LOW')).toBe('LOW');
    expect(viLabel(PREDATOR_LABEL, 'cat')).toBe('cat');
    expect(viLabel(ALERT_STATUS_LABEL, null)).toBe('—');
  });
});
