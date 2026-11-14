import { Tabs } from 'expo-router';

import {
  Pressable,
  Text,
  View,
} from 'react-native';

import {
  useAuth,
} from '@/lib/auth';

import {
  HouseProvider,
} from '@/lib/house';

import {
  useLive,
} from '@/lib/live';

function ConnectionBar() {
  const { status } =
    useLive();

  if (
    status === 'connected'
  ) {
    return null;
  }

  return (
    <View
      style={{
        backgroundColor:
          '#fef3c7',
        paddingVertical: 4,
      }}
    >
      <Text
        style={{
          textAlign: 'center',
          color: '#78350f',
          fontSize: 12,
        }}
      >
        {status ===
        'connecting'
          ? 'Đang kết nối máy chủ…'
          : 'Mất kết nối máy chủ, đang kết nối lại…'}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const { logout } =
    useAuth();

  const logoutButton = () => (
    <Pressable
      onPress={() => logout()}
      style={{
        paddingHorizontal: 12,
      }}
    >
      <Text
        style={{
          color: '#047857',
        }}
      >
        Đăng xuất
      </Text>
    </Pressable>
  );

  return (
    <HouseProvider>
      <ConnectionBar />

      <Tabs
        screenOptions={{
          headerRight:
            logoutButton,

          tabBarActiveTintColor:
            '#047857',
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Tổng quan',
          }}
        />

        <Tabs.Screen
          name="alerts"
          options={{
            title: 'Cảnh báo',
          }}
        />

        <Tabs.Screen
          name="devices"
          options={{
            title: 'Thiết bị',
          }}
        />
      </Tabs>
    </HouseProvider>
  );
}