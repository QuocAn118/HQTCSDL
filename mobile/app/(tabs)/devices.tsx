import {
  useEffect,
  useState,
} from 'react';

import {
  ScrollView,
  Text,
  View,
} from 'react-native';

import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorBox,
  Loading,
  s,
} from '@/components/ui';

import { api } from '@/lib/api';

import {
  ACTUATORS,
  DEVICE_LABELS,
  showOffline,
} from '@/lib/config';

import {
  AUTO_BODY,
  FAN_STEPS,
  fanBody,
  switchBody,
  type ControlBody,
} from '@/lib/control';

import {
  useHouse,
  useLiveDevices,
} from '@/lib/house';

import type {
  ControlResult,
  Device,
  Zone,
} from '@/lib/types';

function DeviceRow({
  device,
  onResult,
}: {
  device: Device;

  onResult: (
    id: number,
    result: ControlResult
  ) => void;
}) {
  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState<unknown>(null);

  async function send(
    body: ControlBody
  ) {
    setBusy(true);

    setError(null);

    try {
      const result =
        await api<ControlResult>(
          `/api/devices/${device.deviceId}/control`,
          'POST',
          body
        );

      onResult(
        device.deviceId,
        result
      );
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  const isFan =
    device.deviceType ===
    'FAN';

  const current =
    device.isOn
      ? isFan
        ? device.level ??
          100
        : 100
      : 0;

  return (
    <View
      style={{
        paddingVertical: 10,
        borderTopWidth: 1,
        borderColor:
          '#e7e5e4',
        gap: 8,
      }}
    >
      <View
        style={[
          s.row,
          {
            justifyContent:
              'space-between',
          },
        ]}
      >
        <Text
          style={{
            fontWeight: '600',
          }}
        >
          {
            DEVICE_LABELS[
              device.deviceType
            ]
          }{' '}
          — {device.name}
        </Text>

        {showOffline(
          device.deviceType,
          device.status
        ) ? (
          <Badge
            text="OFFLINE"
            bg="#44403c"
          />
        ) : null}
      </View>

      <Text style={s.muted}>
        {device.isOn
          ? 'Đang bật'
          : 'Đang tắt'}
        {isFan &&
        device.isOn
          ? ` ${device.level ?? 0}%`
          : ''}{' '}
        ·{' '}
        {device.mode ===
        'MANUAL'
          ? 'Điều khiển tay'
          : 'Tự động'}
      </Text>

      <View style={s.row}>
        {isFan ? (
          FAN_STEPS.map(
            (level) => (
              <Button
                key={level}
                title={
                  level === 0
                    ? 'Tắt'
                    : `${level}%`
                }
                kind={
                  device.mode ===
                    'MANUAL' &&
                  current ===
                    level
                    ? 'primary'
                    : 'ghost'
                }
                disabled={
                  busy
                }
                onPress={() =>
                  send(
                    fanBody(
                      level
                    )
                  )
                }
              />
            )
          )
        ) : (
          <>
            <Button
              title="Bật"
              kind={
                device.isOn
                  ? 'primary'
                  : 'ghost'
              }
              disabled={busy}
              onPress={() =>
                send(
                  switchBody(
                    true
                  )
                )
              }
            />

            <Button
              title="Tắt"
              kind={
                device.isOn
                  ? 'ghost'
                  : 'primary'
              }
              disabled={busy}
              onPress={() =>
                send(
                  switchBody(
                    false
                  )
                )
              }
            />
          </>
        )}

        <Button
          title="Trả về tự động"
          kind="ghost"
          disabled={
            busy ||
            device.mode ===
              'AUTO'
          }
          onPress={() =>
            send(AUTO_BODY)
          }
        />
      </View>

      <ErrorBox
        error={error}
      />
    </View>
  );
}

export default function Devices() {
  const { houseId } =
    useHouse();

  const {
    devices,
    setDevices,
    error,
    reload,
  } =
    useLiveDevices(houseId);

  const [zones, setZones] =
    useState<Zone[]>([]);

  useEffect(() => {
    if (
      houseId !== null
    ) {
      api<Zone[]>(
        `/api/houses/${houseId}/zones`
      )
        .then(setZones)
        .catch(() =>
          setZones([])
        );
    }
  }, [houseId]);

  const onResult = (
    id: number,
    result: ControlResult
  ) =>
    setDevices(
      (list) =>
        list &&
        list.map((d) =>
          d.deviceId === id
            ? {
                ...d,
                mode:
                  result.mode,
                isOn:
                  result.isOn,
                level:
                  result.level,
              }
            : d
        )
    );

  if (
    error &&
    !devices
  ) {
    return (
      <ErrorBox
        error={error}
        onRetry={reload}
      />
    );
  }

  if (!devices) {
    return <Loading />;
  }

  const actuators =
    devices.filter(
      (d) =>
        ACTUATORS.includes(
          d.deviceType
        ) &&
        d.isActive
    );

  if (
    actuators.length === 0
  ) {
    return (
      <Empty>
        Chưa có thiết bị điều
        khiển được.
      </Empty>
    );
  }

  return (
    <ScrollView
      style={s.screen}
    >
      {zones.map((zone) => {
        const list =
          actuators.filter(
            (d) =>
              d.zoneId ===
              zone.zoneId
          );

        if (!list.length) {
          return null;
        }

        return (
          <Card
            key={
              zone.zoneId
            }
            title={zone.name}
          >
            {list.map((d) => (
              <DeviceRow
                key={
                  d.deviceId
                }
                device={d}
                onResult={
                  onResult
                }
              />
            ))}
          </Card>
        );
      })}

      <View
        style={{ height: 24 }}
      />
    </ScrollView>
  );
}