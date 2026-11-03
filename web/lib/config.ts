// Huy hieu OFFLINE cho co cau chap hanh/camera chi bat khi heartbeat (duoi ranh gioi cat) cua simulator,
// backend, ai-vision da lam xong (spec web 2.2). Chua lam -> chi SENSOR co huy hieu.
export const HEARTBEAT_ENABLED = false;

export const METRIC_LABELS: Record<string, string> = { TEMP: 'Nhiệt độ', HUMID: 'Độ ẩm', CO2: 'CO₂', LIGHT: 'Ánh sáng' };
export const DEVICE_LABELS: Record<string, string> = {
  SENSOR: 'Cảm biến', FAN: 'Quạt', MIST: 'Phun sương', HEATER: 'Sưởi', SPEAKER: 'Loa', CAMERA: 'Camera',
};
export const ACTUATORS = ['FAN', 'MIST', 'HEATER', 'SPEAKER'];

export function showOffline(deviceType: string, status: string): boolean {
  return status !== 'ONLINE' && (deviceType === 'SENSOR' || HEARTBEAT_ENABLED);
}
