import type { ReactNode } from 'react';

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  ApiError,
  GENERIC_MESSAGE,
  messageFor,
} from '@/lib/errors';

export const colors = {
  bg: '#fafaf9',
  card: '#ffffff',
  text: '#1c1917',
  muted: '#78716c',
  primary: '#047857',
  danger: '#b91c1c',
  warnBg: '#fef3c7',
  badBg: '#fee2e2',
  border: '#e7e5e4',
};

export function errorText(
  e: unknown
): string {
  return e instanceof ApiError
    ? messageFor(e.code)
    : GENERIC_MESSAGE;
}

export function ErrorBox({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  if (!error) return null;

  const retry =
    error instanceof ApiError &&
    (error.code ===
      'RETRY_LATER' ||
      error.code ===
        'NETWORK') &&
    onRetry;

  return (
    <View style={s.error}>
      <Text
        style={{
          color: colors.danger,
          flex: 1,
        }}
      >
        {errorText(error)}
      </Text>

      {retry ? (
        <Button
          title="Thử lại"
          kind="ghost"
          onPress={onRetry}
        />
      ) : null}
    </View>
  );
}

export function Empty({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Text style={s.empty}>
      {children}
    </Text>
  );
}

export function Loading() {
  return (
    <ActivityIndicator
      style={{
        marginVertical: 24,
      }}
      color={colors.primary}
    />
  );
}

export function Button({
  title,
  onPress,
  kind = 'primary',
  disabled,
}: {
  title: string;
  onPress: () => void;
  kind?:
    | 'primary'
    | 'ghost'
    | 'danger';
  disabled?: boolean;
}) {
  const bg =
    kind === 'primary'
      ? colors.primary
      : kind === 'danger'
        ? colors.danger
        : 'transparent';

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        {
          backgroundColor: bg,
          opacity: disabled
            ? 0.5
            : pressed
              ? 0.7
              : 1,
        },
        kind === 'ghost' &&
          s.btnGhost,
      ]}
    >
      <Text
        style={{
          color:
            kind === 'ghost'
              ? colors.text
              : '#fff',
          fontWeight: '600',
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export function Card({
  title,
  right,
  children,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <Text
          style={s.cardTitle}
        >
          {title}
        </Text>

        {right}
      </View>

      {children}
    </View>
  );
}

export function Badge({
  text,
  bg,
}: {
  text: string;
  bg: string;
}) {
  return (
    <Text
      style={[
        s.badge,
        {
          backgroundColor: bg,
        },
      ]}
    >
      {text}
    </Text>
  );
}

export const s =
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor:
        colors.bg,
    },

    error: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      margin: 12,
      padding: 10,
      borderRadius: 8,
      backgroundColor:
        colors.badBg,
    },

    empty: {
      textAlign: 'center',
      color: colors.muted,
      marginVertical: 24,
    },

    btn: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 8,
      alignItems: 'center',
      minHeight: 44,
      justifyContent:
        'center',
    },

    btnGhost: {
      borderWidth: 1,
      borderColor:
        colors.border,
    },

    card: {
      backgroundColor:
        colors.card,
      margin: 12,
      marginBottom: 0,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor:
        colors.border,
    },

    cardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      marginBottom: 8,
    },

    cardTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },

    badge: {
      color: '#fff',
      fontSize: 12,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      overflow: 'hidden',
    },

    input: {
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 8,
      padding: 10,
      backgroundColor:
        '#fff',
      color: colors.text,
    },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },

    muted: {
      color: colors.muted,
      fontSize: 12,
    },
  });