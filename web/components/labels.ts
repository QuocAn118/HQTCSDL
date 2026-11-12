// Bang tra chu tieng Viet cho ma canh bao hien tren giao dien (API van tra ma goc, khong doi hop dong).
export const ALERT_STATUS_LABEL: Record<string, string> = { NEW: 'Mới', ACK: 'Đã xem', RESOLVED: 'Đã xử lý' };
export const ALERT_TYPE_LABEL: Record<string, string> = {
  THRESHOLD: 'Ngưỡng', PREDATOR: 'Thiên địch', DEVICE_OFFLINE: 'Mất kết nối', POPULATION_DROP: 'Sụt đàn',
};
export const SEVERITY_LABEL: Record<string, string> = { INFO: 'Thông tin', WARNING: 'Cần chú ý', CRITICAL: 'Nghiêm trọng' };
export const PREDATOR_LABEL: Record<string, string> = { snake: 'Rắn', rat: 'Chuột', owl: 'Cú' };

// Ma chua co trong bang thi giu nguyen ma (khong giau thong tin), null -> gach ngang.
export function viLabel(map: Record<string, string>, code: string | null): string {
  if (code === null) return '—';
  return map[code] ?? code;
}
