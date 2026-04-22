import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import 'react-native-reanimated';
import { useEffect, useState, createContext, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthContext } from '../src/context/AuthContext';

// Custom theme for medical mHealth application
const customTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#2B5B84', // Professional blue
    background: '#F5F7FA', // Light grey background
    surface: '#FFFFFF', // Clean white cards
    onSurface: '#1C2B36', // Dark text for high readability
    error: '#D32F2F', // Red for diagnoses
    onBackground: '#1C2B36',
    surfaceVariant: '#E8EEF5',
  },
};

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const checkToken = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        setIsAuthenticated(!!token);
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
    <AuthContext.Provider value={{ isAuthenticated, signIn, signOut }}>
      <PaperProvider theme={customTheme}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="visit-form" options={{ presentation: 'modal', title: 'Formularz Wizyty' }} />
            <Stack.Screen name="patient-edit" options={{ presentation: 'modal', title: 'Nowy Pacjent' }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </PaperProvider>
    </AuthContext.Provider>
  );
}
