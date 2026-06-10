import React from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import Animated, { FadeInDown, FadeIn, ZoomIn } from 'react-native-reanimated';
import { useAuth } from '../context/AuthContext';
import { useColors } from '../context/ThemeContext';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const C = useColors();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeIn.duration(600)} style={styles.bg} />

      <View style={styles.content}>
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.logoWrap}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoIcon}>✚</Text>
          </View>
        </Animated.View>

        <Animated.Text entering={FadeInDown.delay(200).springify()} style={styles.title}>
          Telematyka
        </Animated.Text>

        <Animated.Text entering={FadeInDown.delay(280).springify()} style={styles.subtitle}>
          Panel Lekarza
        </Animated.Text>

        <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.card}>
          <Text style={styles.cardLabel}>Wybierz konto, aby rozpocząć pracę</Text>
          <Pressable
            onPress={signIn}
            style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          >
            <Text style={styles.btnText}>Zaloguj jako Lekarz</Text>
          </Pressable>
        </Animated.View>

        <Animated.Text entering={FadeIn.delay(700)} style={styles.version}>
          v1.0 · Obsidian Clinic
        </Animated.Text>
      </View>
    </View>
  );
}

function makeStyles(C) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.bg,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  logoWrap: { marginBottom: 20 },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: '#0F6E56',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#0ABFA3',
  },
  logoIcon: { fontSize: 32, color: '#0ABFA3' },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#E8F0F7',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: C.muted,
    marginBottom: 48,
    letterSpacing: 0.3,
  },
  card: {
    width: '100%',
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    marginBottom: 32,
  },
  cardLabel: {
    fontSize: 14,
    color: C.muted,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  btn: {
    width: '100%',
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnPressed: { opacity: 0.8 },
  btnText: { fontSize: 15, fontWeight: '700', color: '#fff', letterSpacing: 0.2 },
  version: { fontSize: 11, color: '#1C2B40', letterSpacing: 0.5 },
}); }
