import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import Animated, { FadeInDown } from 'react-native-reanimated';
import ScreenHeader from '@/src/components/ScreenHeader';
import { useFocusEffect } from 'expo-router';
import { fetchAllPatients } from '@/src/services/patientService';
import { fetchMarkedDates } from '@/src/services/visitService';
import { useColors } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';

function StatCard({ value, label, color, delay = 0 }: { value: string | number; label: string; color?: string; delay?: number }) {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify().damping(18)} style={styles.statCard}>
      <Text style={[styles.statValue, { color: color ?? C.accent }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );
}

function SectionTitle({ title, delay = 0 }: { title: string; delay?: number }) {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <Animated.Text entering={FadeInDown.delay(delay).springify()} style={styles.sectionLabel}>
      {title}
    </Animated.Text>
  );
}

export default function StatsScreen() {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { user } = useAuth() as any;

  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState<any[]>([]);
  const [visitDates, setVisitDates] = useState<Record<string, number>>({});

  useFocusEffect(
    useCallback(() => {
      if (user?.id) loadData();
    }, [user?.id])
  );

  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [p, d] = await Promise.all([fetchAllPatients(user.id), fetchMarkedDates(user.id)]);
      setPatients(p);
      setVisitDates(d);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
  const thisMonth = today.slice(0, 7);

  const totalVisits = Object.values(visitDates).reduce((a, b) => a + b, 0);
  const visitsThisMonth = Object.entries(visitDates).filter(([k]) => k.startsWith(thisMonth)).reduce((a, [, v]) => a + v, 0);
  const visitsThisYear = Object.entries(visitDates).filter(([k]) => k.startsWith(today.slice(0, 4))).reduce((a, [, v]) => a + v, 0);

  const diagnosisCounts: Record<string, number> = {};
  patients.forEach(p => {
    if (p.diagnosis) {
      diagnosisCounts[p.diagnosis] = (diagnosisCounts[p.diagnosis] || 0) + 1;
    }
  });
  const topDiagnoses = Object.entries(diagnosisCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const ageBuckets = { '0-18': 0, '19-40': 0, '41-60': 0, '61+': 0 };
  patients.forEach(p => {
    const age = p.age || 0;
    if (age <= 18) ageBuckets['0-18']++;
    else if (age <= 40) ageBuckets['19-40']++;
    else if (age <= 60) ageBuckets['41-60']++;
    else ageBuckets['61+']++;
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator animating color={C.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Statystyki" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <SectionTitle title="Ogólne" delay={0} />
        <View style={styles.grid}>
          <StatCard value={patients.length} label="Pacjentów" delay={60} />
          <StatCard value={totalVisits} label="Wizyt łącznie" color="#B5D4F4" delay={120} />
          <StatCard value={visitsThisMonth} label="Wizyt (ten mies.)" color="#CECBF6" delay={180} />
          <StatCard value={visitsThisYear} label="Wizyt (ten rok)" color="#FAC775" delay={240} />
        </View>

        {topDiagnoses.length > 0 && (
          <>
            <SectionTitle title="Najczęstsze rozpoznania" delay={300} />
            <Animated.View entering={FadeInDown.delay(340).springify().damping(18)} style={styles.card}>
              {topDiagnoses.map(([diag, count], i) => (
                <View key={diag} style={[styles.diagRow, i > 0 && styles.diagRowBorder]}>
                  <Text style={styles.diagName} numberOfLines={1}>{diag}</Text>
                  <View style={styles.diagBadge}>
                    <Text style={styles.diagCount}>{count}</Text>
                  </View>
                </View>
              ))}
            </Animated.View>
          </>
        )}

        <SectionTitle title="Grupy wiekowe" delay={400} />
        <Animated.View entering={FadeInDown.delay(440).springify().damping(18)} style={styles.card}>
          {Object.entries(ageBuckets).map(([range, count], i) => {
            const max = Math.max(...Object.values(ageBuckets), 1);
            const pct = Math.round((count / max) * 100);
            return (
              <View key={range} style={[styles.ageRow, i > 0 && styles.diagRowBorder]}>
                <Text style={styles.ageRange}>{range} lat</Text>
                <View style={styles.ageBarWrap}>
                  <View style={[styles.ageBar, { width: `${pct}%` }]} />
                </View>
                <Text style={styles.ageCount}>{count}</Text>
              </View>
            );
          })}
        </Animated.View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 14, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 10,
    color: C.dim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
  },
  statValue: { fontSize: 32, fontWeight: '700', marginBottom: 4 },
  statLabel: { fontSize: 11, color: C.muted, textAlign: 'center' },
  card: {
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    marginBottom: 14,
  },
  diagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  diagRowBorder: { borderTopWidth: 1, borderTopColor: C.border },
  diagName: { fontSize: 13, color: C.text, flex: 1 },
  diagBadge: {
    backgroundColor: C.accentDim,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  diagCount: { fontSize: 12, color: C.accent, fontWeight: '700' },
  ageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  ageRange: { fontSize: 12, color: C.muted, width: 56 },
  ageBarWrap: { flex: 1, height: 6, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' },
  ageBar: { height: '100%', backgroundColor: C.accent, borderRadius: 3 },
  ageCount: { fontSize: 12, color: C.text, width: 20, textAlign: 'right' },
}); }
