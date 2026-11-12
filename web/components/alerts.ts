// Ham thuan cho trang Canh bao (web-ui T4): mau theo muc do, dong lich su bang chu Viet.
import { ALERT_STATUS_LABEL, viLabel } from './labels';

export function severityTone(severity: string): 'bad' | 'warn' | 'neutral' {
  return severity === 'CRITICAL' ? 'bad' : severity === 'WARNING' ? 'warn' : 'neutral';
}

export function historyText(oldStatus: string | null, newStatus: string): string {
  return `${viLabel(ALERT_STATUS_LABEL, oldStatus)} → ${viLabel(ALERT_STATUS_LABEL, newStatus)}`;
}
