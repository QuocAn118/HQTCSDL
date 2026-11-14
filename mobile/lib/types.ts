// Dang du lieu theo hop dong 3.3, 4.2 va bo chon truong cua backend (plan backend Task 5).
export type Role = 'ADMIN' | 'OWNER';
export type Metric = 'TEMP' | 'HUMID' | 'CO2' | 'LIGHT';
export type DeviceType = 'SENSOR' | 'MIST' | 'FAN' | 'HEATER' | 'SPEAKER' | 'CAMERA';
export type AlertStatus = 'NEW' | 'ACK' | 'RESOLVED';
export type AlertType = 'THRESHOLD' | 'PREDATOR' | 'DEVICE_OFFLINE' | 'POPULATION_DROP';

export interface User { userId: number; username: string; fullName: string; email: string | null; phone: string | null; role: Role; isActive: boolean }
export interface LoginResponse { accessToken: string; expiresIn: number; user: User }
export interface House { houseId: number; ownerId: number; name: string; address: string | null; isActive: boolean; createdAt: string }
export interface Zone { zoneId: number; houseId: number; name: string; floorNo: number }
export interface Device {
  deviceId: number; zoneId: number; code: string; name: string; deviceType: DeviceType; status: string;
  lastSeenAt: string | null; mode: 'AUTO' | 'MANUAL' | null; isOn: boolean | null; level: number | null; isActive: boolean;
}
export interface MetricInfo { metricCode: Metric; name: string; unit: string; validMin: number; validMax: number; hysteresis: number }
export interface Threshold { zoneId: number; metricCode: Metric; minValue: number | null; maxValue: number | null; targetValue: number | null; updatedBy: number | null; updatedAt: string | null }
export interface LatestReading {
  houseId: number; zoneId: number; zoneName: string; deviceId: number; deviceCode: string; deviceStatus: string;
  metric: Metric; unit: string; value: number | null; at: string;
}
export interface ReadingBucket { bucketUtc: string; avgValue: number | null; minValue: number | null; maxValue: number | null }
export interface DailyStat { zoneId: number; metric: Metric; dayVn: string; avgValue: number | null; minValue: number | null; maxValue: number | null; samples: number }
export interface ControlResult { changed: boolean; deviceCode: string; mode: 'AUTO' | 'MANUAL'; isOn: boolean; level: number | null }
export interface ControlLog { logId: number; deviceId: number; isOn: boolean; level: number | null; mode: string; source: string; userId: number | null; reason: string | null; createdAt: string }
export interface Alert {
  alertId: number; houseId: number; zoneId: number | null; deviceId: number | null; alertType: AlertType; severity: string;
  metricCode: Metric | null; value: number | null; detectedClass: string | null; confidence: number | null;
  hasSnapshot: boolean; message: string; status: AlertStatus; createdAt: string;
}
export interface AlertHistory { historyId: number; oldStatus: AlertStatus | null; newStatus: AlertStatus; userId: number | null; note: string | null; changedAt: string }
export interface AlertDetail extends Alert { history: AlertHistory[] }
export interface Page<T> { items: T[]; nextBefore: number | null }
export interface BirdFlow { houseId: number; dayVn: string; inTotal: number; outTotal: number; net: number }
export interface Harvest { harvestId: number; zoneId: number; harvestDate: string; nestCount: number; weightGram: number; grade: 'A' | 'B' | 'C' | null; recordedBy: number | null; createdAt: string }

// Su kien Socket.IO (hop dong 4.2)
export interface ReadingEvent { deviceId: number; deviceCode: string; zoneId: number; metric: Metric; value: number; at: string }
export interface ReadingsNew { houseId: number; readings: ReadingEvent[] }
export interface AlertCreated { alert: Alert }
export interface AlertUpdated { alertId: number; houseId: number; status: AlertStatus; resolvedAt: string | null; resolvedBy: number | null }
export interface DeviceState { deviceId: number; deviceCode: string; houseId: number; zoneId: number; mode: 'AUTO' | 'MANUAL'; isOn: boolean; level: number | null; source: string; at: string }
export interface BirdcountUpdated { houseId: number; cameraId: number }
