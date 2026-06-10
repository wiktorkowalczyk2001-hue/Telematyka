import { DarkTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider, MD3DarkTheme } from 'react-native-paper';
import 'react-native-reanimated';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { AuthContext } from '../src/context/AuthContext';
import { AIContextProvider } from '../src/context/AIContext';
import { ThemeProvider } from '../src/context/ThemeContext';
import { NetworkProvider } from '../src/context/NetworkContext';
import { requestNotificationPermissions } from '../src/services/notificationService';

const customTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#0ABFA3',
    onPrimary: '#fff',
    primaryContainer: '#0F6E56',
    onPrimaryContainer: '#9FE1CB',
    secondary: '#1E3A52',
    onSecondary: '#E8F0F7',
    background: '#0B1220',
    onBackground: '#E8F0F7',
    surface: '#162033',
    onSurface: '#E8F0F7',
    surfaceVariant: '#1C2B40',
    onSurfaceVariant: '#5A7A9A',
    outline: '#1C2B40',
    error: '#E87060',
    onError: '#fff',
    errorContainer: '#4A1B0C',
  },
};

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const checkToken = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        setIsAuthenticated(!!token);
        requestNotificationPermissions();
      } catch (e) {
      } finally {
        setIsReady(true);
      }
    };
    checkToken();
  }, []);

  useEffect(() => {
    if (!isReady) return;
    const inAuthGroup = segments[0] === 'login';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isReady, segments]);

  const signIn = async () => {
    await AsyncStorage.setItem('userToken', 'dummy-auth-token');
    setIsAuthenticated(true);
  };

  const signOut = async () => {
    await AsyncStorage.removeItem('userToken');
    setIsAuthenticated(false);
  };

  if (!isReady) return null;

  return (
    <ThemeProvider>
    <NetworkProvider>
    <AIContextProvider>
    <AuthContext.Provider value={{ isAuthenticated, signIn, signOut }}>
      <PaperProvider theme={customTheme}>
        <NavThemeProvider value={DarkTheme}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="visit-form" options={{ presentation: 'modal', title: 'Formularz Wizyty' }} />
            <Stack.Screen name="patient-edit" options={{ presentation: 'modal', title: 'Nowy Pacjent', headerStyle: { backgroundColor: '#0B1220' }, headerTintColor: '#0ABFA3' }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            <Stack.Screen
              name="ai-assistant"
              options={{
                presentation: 'modal',
                headerShown: false,
                animation: 'slide_from_bottom',
              }}
            />
          </Stack>
          <StatusBar style="light" backgroundColor="#0B1220" />
        </NavThemeProvider>
      </PaperProvider>
    </AuthContext.Provider>
    </AIContextProvider>
    </NetworkProvider>
    </ThemeProvider>
  );
}
