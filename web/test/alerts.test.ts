import { describe, expect, it } from 'vitest';
import { historyText, severityTone } from '../components/alerts';

describe('severityTone', () => {
  it('CRITICAL do, WARNING vang, con lai trung tinh', () => {
    expect(severityTone('CRITICAL')).toBe('bad');
    expect(severityTone('WARNING')).toBe('warn');
    expect(severityTone('INFO')).toBe('neutral');
    expect(severityTone('LA')).toBe('neutral');
  });
});

describe('historyText', () => {
  it('doi ma trang thai sang tieng Viet', () => {
    expect(historyText('NEW', 'ACK')).toBe('Mới → Đã xem');
    expect(historyText('ACK', 'RESOLVED')).toBe('Đã xem → Đã xử lý');
  });
  it('trang thai cu null hien gach ngang', () => {
    expect(historyText(null, 'NEW')).toBe('— → Mới');
  });
});
