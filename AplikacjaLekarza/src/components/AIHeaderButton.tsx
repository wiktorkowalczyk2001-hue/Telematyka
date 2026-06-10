import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming, ZoomIn,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useColors } from '../context/ThemeContext';
import { useNetwork } from '../context/NetworkContext';

export default function AIHeaderButton() {
  const router = useRouter();
  const C = useColors();
  const { isOnline } = useNetwork();
  const glow = useSharedValue(0.5);

  useEffect(() => {
    if (!isOnline) { glow.value = 0.2; return; }
    glow.value = withRepeat(
      withSequence(withTiming(1, { duration: 2000 }), withTiming(0.5, { duration: 2000 })),
      -1, true,
    );
  }, [isOnline]);

  const glowStyle = useAnimatedStyle(() => ({
    borderColor: isOnline
      ? `rgba(10,191,163,${glow.value})`
      : C.border,
    opacity: isOnline ? 1 : 0.45,
  }));

  const styles = useMemo(() => makeStyles(C), [C]);

  return (
    <Animated.View entering={ZoomIn.delay(300).springify()} style={[styles.wrap, glowStyle]}>
      <Pressable
        onPress={() => isOnline && router.push('/ai-assistant')}
        style={({ pressed }) => [styles.btn, pressed && isOnline && { opacity: 0.7, transform: [{ scale: 0.93 }] }]}
        android_ripple={isOnline ? { color: `${C.accent}30`, borderless: true, radius: 18 } : undefined}
      >
        <Text style={styles.icon}>{isOnline ? '🤖' : '🔌'}</Text>
      </Pressable>
    </Animated.View>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    wrap: {
      width: 34,
      height: 34,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.accent,
      backgroundColor: C.accentDim,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btn: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    icon: { fontSize: 16 },
  });
}
