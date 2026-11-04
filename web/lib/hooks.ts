'use client';
// Du lieu song cua mot nha: thiet bi (giu device.state trong luc REST tai, roi ap lai), so do moi nhat, canh bao dang mo.
import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { ApiError } from './errors';
import { useLive, useReloadOnConnect } from './live';
import { applyDeviceState, createLoadGate, markOnline, mergeAlert, mergeAlerts, mergeLatest, replayDeviceStates, type LatestMap } from './merge';
import type { Alert, AlertCreated, AlertUpdated, Device, DeviceState, LatestReading, Page, ReadingsNew } from './types';

export function useLiveDevices(houseId: number) {
  const { subscribe } = useLive();
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [gate] = useState(createLoadGate<DeviceState>);

  useEffect(() => subscribe((event, payload) => {
    if (event === 'readings.new') {
      const r = payload as ReadingsNew;
      if (r.houseId === houseId) setDevices((d) => (d ? markOnline(d, r.readings) : d));
      return;
    }
    if (event !== 'device.state') return;
    const ev = payload as DeviceState;
    if (ev.houseId !== houseId) return;
    if (!gate.hold(ev)) setDevices((d) => (d ? applyDeviceState(d, ev) : d));
  }), [subscribe, houseId, gate]);

  // Mount va connect deu tai lai -> hai lan tai co the chong nhau; chi lan moi nhat ap REST + su kien da giu.
  const load = useCallback(async () => {
    const id = gate.begin();
    try {
      const rest = await api<Device[]>(`/api/houses/${houseId}/devices`);
      const held = gate.end(id);
      if (held) {
        setDevices(replayDeviceStates(rest, held));
        setError(null);
      }
    } catch (e) {
      const held = gate.end(id);
      if (held) {
        setDevices((d) => (d ? replayDeviceStates(d, held) : d));
        setError(e as ApiError);
      }
    }
  }, [houseId, gate]);
  useReloadOnConnect(load);

  return { devices, setDevices, error, reload: load };
}

export function useLiveLatest(houseId: number) {
  const { subscribe } = useLive();
  const [latest, setLatest] = useState<LatestMap>({});
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => subscribe((event, payload) => {
    if (event !== 'readings.new') return;
    const ev = payload as ReadingsNew;
    if (ev.houseId === houseId) setLatest((m) => mergeLatest(m, ev.readings));
  }), [subscribe, houseId]);

  useReloadOnConnect(async () => {
    try {
      const rest = await api<LatestReading[]>(`/api/houses/${houseId}/latest-readings`);
      setLatest((m) => mergeLatest(m, rest));
      setError(null);
    } catch (e) {
      setError(e as ApiError);
    }
  });
  return { latest, error };
}

export function useLiveOpenAlerts(houseId: number) {
  const { subscribe } = useLive();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [gate] = useState(createLoadGate<Alert | AlertUpdated>);

  useEffect(() => subscribe((event, payload) => {
    const incoming = event === 'alert.created' ? (payload as AlertCreated).alert : event === 'alert.updated' ? (payload as AlertUpdated) : null;
    if (!incoming || incoming.houseId !== houseId || gate.hold(incoming)) return;
    setAlerts((l) => mergeAlert(l, incoming));
  }), [subscribe, houseId, gate]);

  // Tai lai THAY danh sach (T7W-3): canh bao dong trong luc mat ket noi khong co trong REST, gop thi con dem la dang mo.
  useReloadOnConnect(async () => {
    const id = gate.begin();
    try {
      const page = await api<Page<Alert>>(`/api/alerts?houseId=${houseId}&status=NEW,ACK&limit=200`);
      const held = gate.end(id);
      if (held) setAlerts(mergeAlerts(page.items, held));
    } catch {
      // dashboard van hien so do khi khong tai duoc canh bao
      const held = gate.end(id);
      if (held) setAlerts((l) => mergeAlerts(l, held));
    }
  });
  return alerts.filter((a) => a.status !== 'RESOLVED');
}
