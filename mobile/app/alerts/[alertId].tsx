import {
  useLocalSearchParams,
} from 'expo-router';

import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  Image,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  Button,
  Card,
  ErrorBox,
  Loading,
  s,
} from '@/components/ui';

import {
  api,
  fetchSnapshot,
} from '@/lib/api';

import {
  ApiError,
} from '@/lib/errors';

import {
  formatVn,
} from '@/lib/time';

import type {
  AlertDetail,
} from '@/lib/types';

const STATUS_LABEL:
  Record<string, string> =
  {
    NEW: 'Mới',
    ACK: 'Đã xem',
    RESOLVED:
      'Đã xử lý',
  };

function Snapshot({
  alertId,
}: {
  alertId: number;
}) {
  const [
    uri,
    setUri,
  ] = useState<string | null>(null);

  const [
    failed,
    setFailed,
  ] = useState(false);

  useEffect(() => {
    let alive = true;
    setUri(null);
    setFailed(false);
    fetchSnapshot(alertId).then(
      (u) => alive && setUri(u),
      () => alive && setFailed(true)
    );
    return () => {
      alive = false;
    };
  }, [alertId]);

  if (failed) {
    return (
      <Text style={s.muted}>
        Không có ảnh
      </Text>
    );
  }

  return (
    <Image
      source={uri ? { uri } : undefined}
      onError={() =>
        setFailed(true)
      }
      resizeMode="contain"
      style={{
        width: '100%',
        aspectRatio: 4 / 3,
        borderRadius: 8,
        backgroundColor:
          '#e7e5e4',
      }}
    />
  );
}

export default function AlertDetailScreen() {
  const { alertId } =
    useLocalSearchParams<{
      alertId: string;
    }>();

  const id =
    Number(alertId);

  const [
    detail,
    setDetail,
  ] =
    useState<AlertDetail | null>(
      null
    );

  const [note, setNote] =
    useState('');

  const [error, setError] =
    useState<unknown>(null);

  const [info, setInfo] =
    useState<string | null>(
      null
    );

  const [busy, setBusy] =
    useState(false);

  const load =
    useCallback(async () => {
      try {
        setDetail(
          await api<AlertDetail>(
            `/api/alerts/${id}`
          )
        );

        setError(null);
      } catch (e) {
        setError(e);
      }
    }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function change(
    status:
      | 'ACK'
      | 'RESOLVED'
  ) {
    setBusy(true);

    setError(null);

    setInfo(null);

    try {
      await api(
        `/api/alerts/${id}`,
        'PATCH',
        {
          status,
          note:
            note ||
            undefined,
        }
      );

      setNote('');
    } catch (e) {
      if (
        e instanceof
          ApiError &&
        e.code ===
          'ALERT_INVALID_TRANSITION'
      ) {
        setInfo(
          'Cảnh báo đã đổi trạng thái. Đã tải lại.'
        );
      } else {
        setError(e);
      }
    }

    await load();

    setBusy(false);
  }

  if (!detail) {
    return error ? (
      <ErrorBox
        error={error}
        onRetry={load}
      />
    ) : (
      <Loading />
    );
  }

  return (
    <ScrollView
      style={s.screen}
    >
      <Card
        title={`#${detail.alertId} — ${STATUS_LABEL[detail.status]}`}
      >
        <Text
          style={{
            marginBottom: 6,
          }}
        >
          {detail.message}
        </Text>

        <Text style={s.muted}>
          {formatVn(
            detail.createdAt
          )}{' '}
          · {detail.alertType}{' '}
          · {detail.severity}
          {detail.detectedClass
            ? ` · ${detail.detectedClass} (${detail.confidence})`
            : ''}
        </Text>

        {detail.hasSnapshot ? (
          <View
            style={{
              marginTop: 10,
            }}
          >
            <Snapshot
              alertId={
                detail.alertId
              }
            />
          </View>
        ) : null}

        <ErrorBox
          error={error}
        />

        {info ? (
          <Text
            style={{
              color: '#b45309',
              marginTop: 8,
            }}
          >
            {info}
          </Text>
        ) : null}

        {detail.status !==
        'RESOLVED' ? (
          <View
            style={{
              gap: 8,
              marginTop: 12,
            }}
          >
            <TextInput
              style={s.input}
              placeholder="Ghi chú (không bắt buộc)"
              maxLength={500}
              value={note}
              onChangeText={
                setNote
              }
            />

            <View
              style={s.row}
            >
              {detail.status ===
              'NEW' ? (
                <Button
                  title="Đã xem (ACK)"
                  kind="ghost"
                  disabled={
                    busy
                  }
                  onPress={() =>
                    change(
                      'ACK'
                    )
                  }
                />
              ) : null}

              <Button
                title="Đã xử lý"
                disabled={
                  busy
                }
                onPress={() =>
                  change(
                    'RESOLVED'
                  )
                }
              />
            </View>
          </View>
        ) : null}
      </Card>

      <Card title="Lịch sử">
        {detail.history.map(
          (h) => (
            <Text
              key={
                h.historyId
              }
              style={{
                marginBottom: 4,
              }}
            >
              {formatVn(
                h.changedAt
              )}
              :{' '}
              {h.oldStatus ??
                '—'}{' '}
              → {h.newStatus}
              {h.note
                ? ` — ${h.note}`
                : ''}
            </Text>
          )
        )}
      </Card>

      <View
        style={{ height: 24 }}
      />
    </ScrollView>
  );
}