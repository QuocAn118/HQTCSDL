import { router } from 'expo-router';

import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Pressable,
  Text,
  Vibration,
} from 'react-native';

import {
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { useLive } from '@/lib/live';

import type {
  Alert,
  AlertCreated,
} from '@/lib/types';

const SHOW_MS = 6000;

export function AlertBanner() {
  const { subscribe } =
    useLive();

  const insets =
    useSafeAreaInsets();

  const [alert, setAlert] =
    useState<Alert | null>(
      null
    );

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const off = subscribe(
      (event, payload) => {
        if (
          event !==
          'alert.created'
        )
          return;

        setAlert(
          (
            payload as AlertCreated
          ).alert
        );

        Vibration.vibrate(300);

        clearTimeout(
          timer.current
        );

        timer.current =
          setTimeout(
            () =>
              setAlert(null),
            SHOW_MS
          );
      }
    );

    return () => {
      off();

      clearTimeout(
        timer.current
      );
    };
  }, [subscribe]);

  if (!alert) return null;

  return (
    <Pressable
      onPress={() => {
        setAlert(null);

        router.push(
          `/alerts/${alert.alertId}`
        );
      }}
      style={{
        position: 'absolute',
        top: insets.top + 8,
        left: 12,
        right: 12,
        zIndex: 100,
        backgroundColor:
          '#b91c1c',
        borderRadius: 12,
        padding: 14,
        elevation: 6,
      }}
    >
      <Text
        style={{
          color: '#fff',
          fontWeight: '700',
        }}
      >
        Cảnh báo mới
      </Text>

      <Text
        style={{
          color: '#fff',
        }}
        numberOfLines={2}
      >
        {alert.message}
      </Text>
    </Pressable>
  );
}