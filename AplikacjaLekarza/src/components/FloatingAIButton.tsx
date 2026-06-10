import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence,
  withTiming, withSpring, ZoomIn,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Text } from 'react-native';

const C = {
  accent: '#0ABFA3',
  accentDim: '#0F6E56',
  bg: '#0B1220',
};

export default function FloatingAIButton({ tabBarHeight = 58 }: { tabBarHeight?: number }) {
  const router = useRouter();
  const pulse = useSharedValue(1);
  const ringOpacity = useSharedValue(0.6);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1800 }),
        withTiming(1.0, { duration: 1800 }),
      ),
      -1,
      true,
    );
    ringOpacity.value = withRepeat(
      withSequence(
        withTiming(0.15, { duration: 1800 }),
        withTiming(0.45, { duration: 1800 }),
      ),
      -1,
      true,
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
  }));

  return (
    <Animated.View entering={ZoomIn.delay(400).springify()} style={[styles.wrap, { bottom: tabBarHeight + 12 }]}>
      <Animated.View style={[styles.ring, ringStyle]} />
      <Pressable
        onPress={() => router.push('/ai-assistant')}
        style={({ pressed }) => [styles.pressable, pressed && { opacity: 0.85 }]}
      >
        <Animated.View style={[styles.btn, pulseStyle]}>
          <Text style={styles.icon}>🤖</Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const SIZE = 52;
const RING = SIZE + 16;

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 0,
    right: 16,
    width: RING,
    height: RING,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  ring: {
    position: 'absolute',
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 1.5,
    borderColor: C.accent,
  },
  pressable: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
  },
  btn: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: C.accentDim,
    borderWidth: 1.5,
    borderColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  icon: { fontSize: 22 },
});
