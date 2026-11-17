import {
  useState,
} from 'react';

import {
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  Button,
  colors,
  errorText,
  s,
} from '@/components/ui';

import { api } from '@/lib/api';

import {
  useAuth,
} from '@/lib/auth';

import {
  ApiError,
} from '@/lib/errors';

import type {
  LoginResponse,
} from '@/lib/types';

export default function Login() {
  const {
    login,
    notice,
  } = useAuth();

  const [
    username,
    setUsername,
  ] = useState('');

  const [
    password,
    setPassword,
  ] = useState('');

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );

  const [busy, setBusy] =
    useState(false);

  async function submit() {
  if (busy || !username.trim() || !password) {
    return;
  }

  setBusy(true);
  setError(null);

  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const response = await Promise.race([
      api<LoginResponse>(
        '/api/auth/login',
        'POST',
        {
          username: username.trim(),
          password,
        }
      ),

      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new Error(
              'Không kết nối được máy chủ. Vui lòng kiểm tra mạng hoặc thử lại.'
            )
          );
        }, 10000);
      }),
    ]);

    await login(response);
  } catch (e) {
    setError(
      e instanceof ApiError && e.status === 401
        ? 'Sai tên đăng nhập hoặc mật khẩu'
        : e instanceof Error &&
            e.message.startsWith('Không kết nối')
          ? e.message
          : errorText(e)
    );
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }

    setBusy(false);
  }
}

  return (
    <KeyboardAvoidingView
      style={[
        s.screen,
        {
          justifyContent:
            'center',
          padding: 24,
        },
      ]}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
    >
      <Text
        style={{
          fontSize: 24,
          fontWeight: '700',
          marginBottom: 16,
          color: colors.text,
        }}
      >
        SwiftletCare
      </Text>

      {notice ? (
        <Text
          style={{
            color: '#b45309',
            marginBottom: 12,
          }}
        >
          {notice}
        </Text>
      ) : null}

      <View
        style={{ gap: 12 }}
      >
        <TextInput
          style={s.input}
          placeholder="Tên đăng nhập"
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={
            setUsername
          }
        />

        <TextInput
          style={s.input}
          placeholder="Mật khẩu"
          secureTextEntry
          value={password}
          onChangeText={
            setPassword
          }
          onSubmitEditing={
            submit
          }
        />

        {error ? (
          <Text
            style={{
              color:
                colors.danger,
            }}
          >
            {error}
          </Text>
        ) : null}

        <Button
          title={
            busy
              ? 'Đang đăng nhập…'
              : 'Đăng nhập'
          }
          onPress={submit}
          disabled={
            busy ||
            !username ||
            !password
          }
        />
      </View>
    </KeyboardAvoidingView>
  );
}