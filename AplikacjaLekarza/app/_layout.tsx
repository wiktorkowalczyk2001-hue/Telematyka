import { DarkTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider, MD3DarkTheme } from 'react-native-paper';
import 'react-native-reanimated';
import { useEffect } from 'react';

import { AuthProvider, useAuth } from '../src/context/AuthContext';
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
  useEffect(() => {
    requestNotificationPermissions();
  }, []);

  return (
    <ThemeProvider>
    <NetworkProvider>
    <AIContextProvider>
    <AuthProvider>
      <PaperProvider theme={customTheme}>
        <NavThemeProvider value={DarkTheme}>
          <RootLayoutNav />
        </NavThemeProvider>
      </PaperProvider>
    </AuthProvider>
    </AIContextProvider>
    </NetworkProvider>
    </ThemeProvider>
  );
}

function RootLayoutNav() {
  const { isAuthenticated, userStatus, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    
    const inAuthGroup = segments[0] === 'login';
    const inPendingGroup = segments[0] === 'pending-approval';
    const inAdminGroup = segments[0] === 'admin';

    // Not authenticated → go to login
    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/login');
      return;
    }

    // Authenticated but on login page → redirect
    if (isAuthenticated && inAuthGroup) {
      if (userStatus === 'pending') {
        router.replace('/pending-approval');
      } else if (userStatus === 'approved') {
        router.replace('/(tabs)');
      } else if (userStatus === 'rejected') {
        router.replace('/login');
      }
      return;
    }

    // Authenticated with pending status
    if (isAuthenticated && userStatus === 'pending' && !inPendingGroup) {
      router.replace('/pending-approval');
      return;
    }

    // Authenticated with approved status
    if (isAuthenticated && userStatus === 'approved' && (inPendingGroup || inAuthGroup)) {
      router.replace('/(tabs)');
      return;
    }
  }, [isAuthenticated, userStatus, loading, segments]);

  if (loading) return null;

  return (
    <>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="pending-approval" options={{ headerShown: false }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
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
    </>
  );
}
