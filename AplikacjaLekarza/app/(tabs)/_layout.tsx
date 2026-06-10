import { Tabs } from 'expo-router';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useColors } from '@/src/context/ThemeContext';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const C = useColors();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.dim,
        tabBarStyle: {
          backgroundColor: C.headerBg,
          borderTopColor: C.border,
          borderTopWidth: 1,
          height: 58 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 6,
          paddingTop: 6,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Kalendarz',
          tabBarIcon: ({ color }) => <MaterialIcons size={24} name="event" color={color} />,
        }}
      />
      <Tabs.Screen
        name="patients"
        options={{
          title: 'Pacjenci',
          tabBarIcon: ({ color }) => <MaterialIcons size={24} name="people" color={color} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Statystyki',
          tabBarIcon: ({ color }) => <MaterialIcons size={24} name="bar-chart" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ustawienia',
          tabBarIcon: ({ color }) => <MaterialIcons size={24} name="settings" color={color} />,
        }}
      />
    </Tabs>
  );
}
