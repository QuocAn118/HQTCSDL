import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';

import {
  Badge,
  Button,
  Card,
  colors,
  Empty,
  ErrorBox,
  Loading,
  s,
} from '@/components/ui';

import { api } from '@/lib/api';

import {
  DEVICE_LABELS,
  METRIC_LABELS,
  showOffline,
} from '@/lib/config';

import {
  useHouse,
  useLiveDevices,
  useLiveLatest,
} from '@/lib/house';

import {
  latestKey,
} from '@/lib/merge';

import {
  formatVn,
} from '@/lib/time';

import type {
  Device,
  Metric,
  Threshold,
  Zone,
} from '@/lib/types';

const METRICS: Metric[] = [
  'TEMP',
  'HUMID',
  'CO2',
  'LIGHT',
];

const outOfRange = (
  value:
    | number
    | null
    | undefined,
  threshold?: Threshold
) =>
  value != null &&
  !!threshold &&
  ((threshold.minValue !==
    null &&
    value <
      threshold.minValue) ||
    (threshold.maxValue !==
      null &&
      value >
        threshold.maxValue));

const stateText = (
  d: Device
) =>
  d.isOn === null
    ? '—'
    : `${
        d.isOn
          ? 'Bật'
          : 'Tắt'
      }${
        d.deviceType ===
          'FAN' &&
        d.isOn
          ? ` ${d.level ?? 0}%`
          : ''
      } · ${
        d.mode === 'MANUAL'
          ? 'Tay'
          : 'Tự động'
      }`;

export default function Overview() {
  const {
    houses,
    houseId,
    setHouseId,
    error: houseError,
    reload: reloadHouses,
  } = useHouse();

  const {
    devices,
    reload:
      reloadDevices,
  } =
    useLiveDevices(houseId);

  const {
    latest,
    error,
    reload:
      reloadLatest,
  } =
    useLiveLatest(houseId);

  const [zones, setZones] =
    useState<Zone[] | null>(
      null
    );

  const [
    thresholds,
    setThresholds,
  ] = useState<
    Record<
      number,
      Threshold[]
    >
  >({});

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const loadZones =
    useCallback(async () => {
      if (houseId === null)
        return;

      const z =
        await api<Zone[]>(
          `/api/houses/${houseId}/zones`
        );

      setZones(z);

      const all =
        await Promise.all(
          z.map((zone) =>
            api<Threshold[]>(
              `/api/zones/${zone.zoneId}/thresholds`
            )
          )
        );

      setThresholds(
        Object.fromEntries(
          z.map(
            (zone, i) => [
              zone.zoneId,
              all[i],
            ]
          )
        )
      );
    }, [houseId]);

  useEffect(() => {
    setZones(null);

    loadZones().catch(() =>
      setZones([])
    );
  }, [loadZones]);

  const refresh =
    async () => {
      setRefreshing(true);

      await Promise.allSettled(
        [
          loadZones(),
          reloadDevices(),
          reloadLatest(),
        ]
      );

      setRefreshing(false);
    };

  if (houseError) {
    return (
      <ErrorBox
        error={houseError}
        onRetry={
          reloadHouses
        }
      />
    );
  }

  if (!houses) {
    return <Loading />;
  }

  if (
    houses.length === 0
  ) {
    return (
      <Empty>
        Chưa có nhà nào.
      </Empty>
    );
  }

  return (
    <ScrollView
      style={s.screen}
      refreshControl={
        <RefreshControl
          refreshing={
            refreshing
          }
          onRefresh={
            refresh
          }
        />
      }
    >
      {houses.length > 1 ? (
        <View
          style={[
            s.row,
            { padding: 12 },
          ]}
        >
          {houses.map((h) => (
            <Button
              key={
                h.houseId
              }
              title={h.name}
              kind={
                h.houseId ===
                houseId
                  ? 'primary'
                  : 'ghost'
              }
              onPress={() =>
                setHouseId(
                  h.houseId
                )
              }
            />
          ))}
        </View>
      ) : null}

      <ErrorBox
        error={error}
        onRetry={refresh}
      />

      {zones === null ? (
        <Loading />
      ) : zones.length ===
        0 ? (
        <Empty>
          Nhà chưa có khu vực
          nào.
        </Empty>
      ) : (
        zones.map((zone) => {
          const zoneDevices =
            (
              devices ?? []
            ).filter(
              (d) =>
                d.zoneId ===
                  zone.zoneId &&
                d.isActive
            );

          const sensor =
            zoneDevices.find(
              (d) =>
                d.deviceType ===
                'SENSOR'
            );

          const hasReading =
            !!sensor &&
            METRICS.some(
              (metric) =>
                latest[
                  latestKey(
                    sensor.deviceId,
                    metric
                  )
                ]
            );

          return (
            <Card
              key={
                zone.zoneId
              }
              title={zone.name}
              right={
                sensor &&
                showOffline(
                  sensor.deviceType,
                  sensor.status
                ) ? (
                  <Badge
                    text="OFFLINE"
                    bg="#44403c"
                  />
                ) : null
              }
            >
              {hasReading &&
              sensor ? (
                <View
                  style={[
                    s.row,
                    {
                      marginBottom: 8,
                    },
                  ]}
                >
                  {METRICS.map(
                    (metric) => {
                      const r =
                        latest[
                          latestKey(
                            sensor.deviceId,
                            metric
                          )
                        ];

                      const bad =
                        outOfRange(
                          r?.value,
                          thresholds[
                            zone
                              .zoneId
                          ]?.find(
                            (
                              t
                            ) =>
                              t.metricCode ===
                              metric
                          )
                        );

                      return (
                        <View
                          key={
                            metric
                          }
                          style={{
                            width:
                              '47%',
                            padding: 8,
                            borderRadius: 8,
                            backgroundColor:
                              bad
                                ? colors.badBg
                                : '#f5f5f4',
                          }}
                        >
                          <Text
                            style={
                              s.muted
                            }
                          >
                            {
                              METRIC_LABELS[
                                metric
                              ]
                            }
                          </Text>

                          <Text
                            style={{
                              fontSize: 18,
                              fontWeight:
                                '700',
                              color:
                                bad
                                  ? colors.danger
                                  : colors.text,
                            }}
                          >
                            {r?.value ??
                              '—'}{' '}
                            <Text
                              style={
                                s.muted
                              }
                            >
                              {r?.unit ??
                                ''}
                            </Text>
                          </Text>

                          {r ? (
                            <Text
                              style={
                                s.muted
                              }
                            >
                              {formatVn(
                                r.at
                              )}
                            </Text>
                          ) : null}
                        </View>
                      );
                    }
                  )}
                </View>
              ) : (
                <Empty>
                  Chưa có số đo
                </Empty>
              )}

              {zoneDevices
                .filter((d) =>
                  [
                    'FAN',
                    'MIST',
                    'HEATER',
                  ].includes(
                    d.deviceType
                  )
                )
                .map((d) => (
                  <View
                    key={
                      d.deviceId
                    }
                    style={[
                      s.row,
                      {
                        justifyContent:
                          'space-between',
                        paddingVertical: 4,
                        borderTopWidth: 1,
                        borderColor:
                          colors.border,
                      },
                    ]}
                  >
                    <Text>
                      {
                        DEVICE_LABELS[
                          d
                            .deviceType
                        ]
                      }
                    </Text>

                    <Text>
                      {stateText(
                        d
                      )}
                    </Text>
                  </View>
                ))}
            </Card>
          );
        })
      )}

      <View
        style={{
          height: 24,
        }}
      />
    </ScrollView>
  );
}