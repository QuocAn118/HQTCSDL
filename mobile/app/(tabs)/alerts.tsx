import {
  router,
} from 'expo-router';

import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  FlatList,
  Pressable,
  Text,
  View,
} from 'react-native';

import {
  Badge,
  Button,
  colors,
  Empty,
  ErrorBox,
  Loading,
  s,
} from '@/components/ui';

import {
  api,
  qs,
} from '@/lib/api';

import {
  useHouse,
} from '@/lib/house';

import {
  useLive,
  useReloadOnConnect,
} from '@/lib/live';

import {
  mergeAlert,
} from '@/lib/merge';

import {
  formatVn,
} from '@/lib/time';

import type {
  Alert,
  AlertCreated,
  AlertUpdated,
  Page,
} from '@/lib/types';

const STATUS_LABEL:
  Record<string, string> =
  {
    NEW: 'Mới',
    ACK: 'Đã xem',
    RESOLVED:
      'Đã xử lý',
  };

const STATUS_BG:
  Record<string, string> =
  {
    NEW: '#b91c1c',
    ACK: '#b45309',
    RESOLVED:
      '#57534e',
  };

export default function Alerts() {
  const { houseId } =
    useHouse();

  const { subscribe } =
    useLive();

  const [
    openOnly,
    setOpenOnly,
  ] = useState(true);

  const [list, setList] =
    useState<
      Alert[] | null
    >(null);

  const [
    nextBefore,
    setNextBefore,
  ] =
    useState<number | null>(
      null
    );

  const [error, setError] =
    useState<unknown>(null);

  const load =
    useCallback(
      async (
        before:
          | number
          | null
      ) => {
        if (
          houseId === null
        )
          return;

        try {
          const page =
            await api<
              Page<Alert>
            >(
              `/api/alerts${qs(
                {
                  houseId,
                  status:
                    openOnly
                      ? 'NEW,ACK'
                      : null,
                  limit: 30,
                  before,
                }
              )}`
            );

          setList((cur) =>
            before && cur
              ? [
                  ...cur,
                  ...page.items,
                ]
              : page.items
          );

          setNextBefore(
            page.nextBefore
          );

          setError(null);
        } catch (e) {
          setError(e);
        }
      },
      [
        houseId,
        openOnly,
      ]
    );

  useReloadOnConnect(() =>
    void load(null)
  );

  useEffect(() => {
    setList(null);

    void load(null);
  }, [load]);

  useEffect(
    () =>
      subscribe(
        (event, payload) => {
          if (
            event ===
            'alert.created'
          ) {
            const alert =
              (
                payload as AlertCreated
              ).alert;

            if (
              alert.houseId ===
              houseId
            ) {
              setList((list) =>
                list
                  ? mergeAlert(
                      list,
                      alert
                    )
                  : list
              );
            }
          }

          if (
            event ===
            'alert.updated'
          ) {
            const updated =
              payload as AlertUpdated;

            if (
              updated.houseId ===
              houseId
            ) {
              setList((list) =>
                list
                  ? mergeAlert(
                      list,
                      updated
                    )
                  : list
              );
            }
          }
        }
      ),
    [
      subscribe,
      houseId,
    ]
  );

  const shown =
    (list ?? []).filter(
      (a) =>
        !openOnly ||
        a.status !==
          'RESOLVED'
    );

  return (
    <View style={s.screen}>
      <View
        style={[
          s.row,
          { padding: 12 },
        ]}
      >
        <Button
          title="Đang mở"
          kind={
            openOnly
              ? 'primary'
              : 'ghost'
          }
          onPress={() =>
            setOpenOnly(true)
          }
        />

        <Button
          title="Tất cả"
          kind={
            openOnly
              ? 'ghost'
              : 'primary'
          }
          onPress={() =>
            setOpenOnly(false)
          }
        />
      </View>

      <ErrorBox
        error={error}
        onRetry={() =>
          load(null)
        }
      />

      {list === null &&
      !error ? (
        <Loading />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(a) =>
            String(
              a.alertId
            )
          }
          ListEmptyComponent={
            error
              ? undefined
              : (
                <Empty>
                  Không có cảnh báo
                </Empty>
              )
          }
          onEndReached={() =>
            nextBefore &&
            load(
              nextBefore
            )
          }
          onEndReachedThreshold={
            0.3
          }
          renderItem={({
            item,
          }) => (
            <Pressable
              onPress={() =>
                router.push(
                  `/alerts/${item.alertId}`
                )
              }
              style={{
                backgroundColor:
                  colors.card,
                marginHorizontal: 12,
                marginTop: 8,
                padding: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor:
                  colors.border,
              }}
            >
              <View
                style={[
                  s.row,
                  {
                    marginBottom: 4,
                  },
                ]}
              >
                <Badge
                  text={
                    STATUS_LABEL[
                      item.status
                    ]
                  }
                  bg={
                    STATUS_BG[
                      item.status
                    ]
                  }
                />

                <Text
                  style={
                    s.muted
                  }
                >
                  {formatVn(
                    item.createdAt
                  )}
                </Text>
              </View>

              <Text
                numberOfLines={
                  2
                }
              >
                {item.message}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}