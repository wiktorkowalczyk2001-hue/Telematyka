import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, Switch, Platform } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuth } from '@/src/context/AuthContext';
import { useRouter } from 'expo-router';
import ScreenHeader from '@/src/components/ScreenHeader';
import { useColors, useTheme } from '@/src/context/ThemeContext';

function SettingRow({
  label, value, onPress, danger, right,
}: {
  label: string; value?: string; onPress?: () => void; danger?: boolean; right?: React.ReactNode;
}) {
  const C = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 14, paddingVertical: 13,
          borderBottomWidth: 1, borderBottomColor: C.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
      disabled={!onPress && !right}
    >
      <Text style={{ fontSize: 14, color: danger ? C.error : C.text }}>{label}</Text>
      {right ?? (
        value
          ? <Text style={{ fontSize: 13, color: C.muted }}>{value}</Text>
          : <Text style={{ fontSize: 16, color: C.dim }}>›</Text>
      )}
    </Pressable>
  );
}

function Section({ title, children, delay }: { title: string; children: React.ReactNode; delay?: number }) {
  const C = useColors();
  return (
    <Animated.View entering={FadeInDown.delay(delay ?? 0).springify().damping(18)} style={{ marginBottom: 14 }}>
      <Text style={{
        fontSize: 10, color: C.dim, textTransform: 'uppercase',
        letterSpacing: 0.8, fontWeight: '600', marginBottom: 6, paddingHorizontal: 2,
      }}>
        {title}
      </Text>
      <View style={{
        backgroundColor: C.surface, borderRadius: 14,
        borderWidth: 1, borderColor: C.border, overflow: 'hidden',
      }}>
        {children}
      </View>
    </Animated.View>
  );
}

export default function SettingsScreen() {
  const { signOut } = useAuth();
  const router = useRouter();
  const C = useColors();
  const { isDark, toggleTheme } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Czy na pewno chcesz się wylogować?')) {
        signOut();
      }
    } else {
      Alert.alert('Wyloguj', 'Czy na pewno chcesz się wylogować?', [
        { text: 'Anuluj', style: 'cancel' },
        { text: 'Wyloguj', style: 'destructive', onPress: signOut },
      ]);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Ustawienia" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>LK</Text>
          </View>
          <View>
            <Text style={styles.profileName}>Lekarz Kliniczny</Text>
            <Text style={styles.profileRole}>Administrator · Obsidian Clinic</Text>
          </View>
        </Animated.View>

        <Section title="Wygląd" delay={60}>
          <SettingRow
            label={isDark ? '🌙 Motyw ciemny' : '☀️ Motyw jasny'}
            right={
              <Switch
                value={!isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: C.border, true: C.accent }}
                thumbColor="#FFFFFF"
              />
            }
          />
        </Section>

        <Section title="Aplikacja" delay={120}>
          <SettingRow label="Wersja aplikacji" value="1.0.0" />
          <SettingRow label="Środowisko" value="Development" />
          <SettingRow label="API" value="192.168.0.31:3001" />
        </Section>

        <Section title="Asystent AI" delay={180}>
          <Pressable
            onPress={() => router.push('/ai-assistant')}
            style={({ pressed }) => [styles.aiBtn, pressed && { opacity: 0.8 }]}
          >
            <View style={styles.aiBtnLeft}>
              <View style={styles.aiBtnIcon}>
                <Text style={{ fontSize: 20 }}>🤖</Text>
              </View>
              <View>
                <Text style={styles.aiBtnTitle}>Asystent głosowy AI</Text>
                <Text style={styles.aiBtnSub}>LM Studio · 127.0.0.1:1234</Text>
              </View>
            </View>
            <Text style={styles.aiBtnArrow}>›</Text>
          </Pressable>
        </Section>

        <Section title="Dane" delay={240}>
          <SettingRow label="Eksportuj pacjentów" onPress={() => Alert.alert('Wkrótce', 'Funkcja w przygotowaniu.')} />
          <SettingRow label="Synchronizuj bazę" onPress={() => Alert.alert('Wkrótce', 'Funkcja w przygotowaniu.')} />
        </Section>

        <Section title="Konto" delay={300}>
          <SettingRow label="Wyloguj" onPress={handleLogout} danger />
        </Section>

        <Animated.Text entering={FadeInDown.delay(320).springify()} style={styles.version}>
          Obsidian Clinic · v1.0 · 2026
        </Animated.Text>
      </ScrollView>
    </View>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    content: { padding: 14, paddingBottom: 40 },
    profileCard: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: C.surface, borderRadius: 16, padding: 16,
      marginBottom: 20, borderWidth: 1, borderColor: C.border,
    },
    profileAvatar: {
      width: 52, height: 52, borderRadius: 16,
      backgroundColor: C.accentDim,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: C.accent,
    },
    profileAvatarText: { fontSize: 18, fontWeight: '700', color: C.accent },
    profileName: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 3 },
    profileRole: { fontSize: 12, color: C.muted },
    version: { textAlign: 'center', fontSize: 11, color: C.dim, marginTop: 8, letterSpacing: 0.5 },
    aiBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: C.surface, borderRadius: 14, padding: 14,
      borderWidth: 1, borderColor: C.accentDim,
    },
    aiBtnLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    aiBtnIcon: {
      width: 44, height: 44, borderRadius: 13,
      backgroundColor: C.accentDim,
      borderWidth: 1, borderColor: C.accent,
      alignItems: 'center', justifyContent: 'center',
    },
    aiBtnTitle: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 2 },
    aiBtnSub: { fontSize: 11, color: C.muted },
    aiBtnArrow: { fontSize: 20, color: C.dim },
  });
}
