import { Stack } from 'expo-router';

import * as SplashScreen from 'expo-splash-screen';

import {
  StatusBar,
} from 'expo-status-bar';

import {
  useEffect,
  type ReactNode,
} from 'react';

import { View } from 'react-native';

import {
  SafeAreaProvider,
} from 'react-native-safe-area-context';

import {
  AlertBanner,
} from '@/components/AlertBanner';

import {
  AuthProvider,
  useAuth,
} from '@/lib/auth';

import {
  LiveProvider,
} from '@/lib/live';

void SplashScreen.preventAutoHideAsync();

function WithLive({
  children,
}: {
  children: ReactNode;
}) {
  const { session } =
    useAuth();

  if (!session) {
    return <>{children}</>;
  }

  return (
    <LiveProvider>
      {children}

      <AlertBanner />
    </LiveProvider>
  );
}

function RootStack() {
  const {
    ready,
    session,
  } = useAuth();

  useEffect(() => {
    if (ready) {
      void SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) return null;

  return (
    <WithLive>
      <Stack
        screenOptions={{
          headerTitleAlign:
            'center',
        }}
      >
        <Stack.Protected
          guard={!!session}
        >
          <Stack.Screen
            name="(tabs)"
            options={{
              headerShown:
                false,
            }}
          />

          <Stack.Screen
            name="alerts/[alertId]"
            options={{
              title:
                'Chi tiết cảnh báo',
            }}
          />
        </Stack.Protected>

        <Stack.Protected
          guard={!session}
        >
          <Stack.Screen
            name="login"
            options={{
              headerShown:
                false,
            }}
          />
        </Stack.Protected>
      </Stack>
    </WithLive>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <View
          style={{ flex: 1 }}
        >
          <RootStack />
        </View>
      </AuthProvider>

      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}