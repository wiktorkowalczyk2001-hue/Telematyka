import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import AIHeaderButton from './AIHeaderButton';
import { useColors } from '../context/ThemeContext';
import { useNetwork } from '../context/NetworkContext';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  badge?: number | null;
  left?: React.ReactNode;
  extra?: React.ReactNode;
  delay?: number;
};

export default function ScreenHeader({
  title, subtitle, badge, left, extra, delay = 0,
}: ScreenHeaderProps) {
  const C = useColors();
  const { isOnline } = useNetwork();
  const styles = useMemo(() => makeStyles(C), [C]);

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).springify().damping(18)}
      style={styles.header}
    >
      <View style={styles.left}>
        {left ?? (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.title}>{title}</Text>
              {!isOnline && (
                <View style={styles.offlineBadge}>
                  <Text style={styles.offlineText}>offline</Text>
                </View>
              )}
            </View>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
        )}
      </View>
      <View style={styles.right}>
        {badge != null && badge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
        {extra}
        <AIHeaderButton />
      </View>
    </Animated.View>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 56,
      backgroundColor: C.headerBg,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
      paddingHorizontal: 16,
    },
    left: { flex: 1 },
    right: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    title: { fontSize: 17, fontWeight: '700', color: C.text },
    subtitle: { fontSize: 11, color: C.muted, marginTop: 1 },
    badge: {
      backgroundColor: C.accentDim,
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderWidth: 1,
      borderColor: C.accent,
    },
    badgeText: { fontSize: 11, fontWeight: '700', color: C.accent },
    offlineBadge: {
      backgroundColor: C.errorBg,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderWidth: 1,
      borderColor: C.error,
    },
    offlineText: { fontSize: 9, fontWeight: '700', color: C.error, textTransform: 'uppercase', letterSpacing: 0.5 },
  });
}
