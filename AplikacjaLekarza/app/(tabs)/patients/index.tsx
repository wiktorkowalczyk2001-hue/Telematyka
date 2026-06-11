import React, { useState, useCallback, useMemo } from 'react';
import { View, FlatList, StyleSheet, Pressable, Text, Platform } from 'react-native';
import { Searchbar, ActivityIndicator, FAB } from 'react-native-paper';
import { useRouter, useFocusEffect } from 'expo-router';
import Animated, {
  FadeInDown, FadeIn, ZoomIn, FadeInRight,
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  interpolate,
} from 'react-native-reanimated';
import { fetchAllPatients, searchPatients } from '@/src/services/patientService';
import { useAIContext } from '@/src/context/AIContext';
import ScreenHeader from '@/src/components/ScreenHeader';
import { useColors } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';

const AVATAR_COLORS = [
  { bg: '#0F6E56', fg: '#9FE1CB' },
  { bg: '#185FA5', fg: '#B5D4F4' },
  { bg: '#533489', fg: '#CECBF6' },
  { bg: '#633806', fg: '#FAC775' },
  { bg: '#993C1D', fg: '#F5C4B3' },
];

const ACCENT_LINES = ['#0ABFA3', '#378ADD', '#7F77DD', '#EF9F27', '#D85A30'];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function getAccentLine(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return ACCENT_LINES[hash % ACCENT_LINES.length];
}

function getInitials(first: string, last: string) {
  return `${(first || '')[0] || ''}${(last || '')[0] || ''}`.toUpperCase();
}

function formatDate(dateStr: string) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('pl-PL');
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Dzień dobry';
  if (h < 18) return 'Dzień dobry';
  return 'Dobry wieczór';
}

function SkeletonCard({ index }: { index: number }) {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <Animated.View entering={FadeIn.delay(index * 60)} style={styles.skeletonCard}>
      <View style={styles.skeletonAvatar} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={[styles.skeletonLine, { width: '60%' }]} />
        <View style={[styles.skeletonLine, { width: '40%', opacity: 0.5 }]} />
        <View style={[styles.skeletonLine, { width: '30%', opacity: 0.3 }]} />
      </View>
    </Animated.View>
  );
}

function PatientCard({ item, index, onPress }: any) {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  const color = getAvatarColor(`${item.firstName}${item.lastName}`);
  const accentLine = getAccentLine(`${item.firstName}${item.lastName}`);
  const initials = getInitials(item.firstName, item.lastName);
  const visitDate = formatDate(item.lastVisitDate);

  const pressed = useSharedValue(0);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.965]) }],
    opacity: interpolate(pressed.value, [0, 1], [1, 0.88]),
    shadowOpacity: interpolate(pressed.value, [0, 1], [0.22, 0.05]),
  }));

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify().damping(16).stiffness(120)}>
      <Pressable
        onPress={() => onPress(item)}
        onPressIn={() => { pressed.value = withSpring(1, { damping: 15 }); }}
        onPressOut={() => { pressed.value = withSpring(0, { damping: 15 }); }}
      >
        <Animated.View style={[styles.card, animStyle]}>
          <View style={[styles.cardAccentLine, { backgroundColor: accentLine }]} />
          <View style={[styles.avatar, { backgroundColor: color.bg }]}>
            <Text style={[styles.avatarText, { color: color.fg }]}>{initials}</Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.patientName}>{item.firstName} {item.lastName}</Text>
            {item.diagnosis ? (
              <View style={styles.diagChip}>
                <Text style={styles.diagChipText} numberOfLines={1}>{item.diagnosis}</Text>
              </View>
            ) : (
              <Text style={styles.noDiag}>Brak rozpoznania</Text>
            )}
            {visitDate && (
              <Text style={styles.lastVisit}>Ost. wizyta: {visitDate}</Text>
            )}
          </View>
          {item.age ? <Text style={styles.ageBadge}>{item.age}l</Text> : null}
          <Text style={styles.chevron}>›</Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

function EmptyState({ searching }: { searching: boolean }) {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <Animated.View entering={FadeIn.delay(200)} style={styles.emptyContainer}>
      <Animated.View entering={ZoomIn.delay(300).springify()} style={styles.emptyIconWrap}>
        <Text style={styles.emptyIcon}>🏥</Text>
      </Animated.View>
      <Text style={styles.emptyTitle}>
        {searching ? 'Brak wyników' : 'Brak pacjentów'}
      </Text>
      <Text style={styles.emptySubtext}>
        {searching ? 'Spróbuj innej frazy' : 'Dodaj pierwszego pacjenta przyciskiem +'}
      </Text>
    </Animated.View>
  );
}

export default function PatientListScreen() {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();
  const { setAIContext } = useAIContext();
  const { user } = useAuth() as any;

  useFocusEffect(
    useCallback(() => {
      if (!searchQuery) loadPatients();
      setAIContext({ screen: 'patients', screenLabel: 'Lista Pacjentów' });
    }, [])
  );

  const loadPatients = async () => {
    if (!user?.id) { setError('Brak danych użytkownika. Zaloguj się ponownie.'); setLoading(false); return; }
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAllPatients(user.id);
      setPatients(data);
      setAIContext({ screen: 'patients', screenLabel: 'Lista Pacjentów', totalPatients: data.length });
    } catch (err: any) {
      setError(err.message || 'Błąd ładowania');
      setPatients([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!user?.id) return;
    try {
      setLoading(true);
      const data = query.trim() ? await searchPatients(query, user.id) : await fetchAllPatients(user.id);
      setPatients(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const today = new Date();
  const dateStr = today.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={`${getGreeting()}, Doktorze`}
        subtitle={dateStr}
        badge={!loading && patients.length > 0 ? patients.length : null}
      />

      <Animated.View entering={FadeInDown.delay(60).springify()} style={styles.searchWrap}>
        <Searchbar
          placeholder="Szukaj po nazwisku, diagnozie, PESEL..."
          onChangeText={handleSearch}
          value={searchQuery}
          style={styles.searchbar}
          inputStyle={{ color: C.text, fontSize: 13 }}
          placeholderTextColor={C.dim}
          iconColor={C.muted}
          theme={{ colors: { primary: C.accent } }}
        />
      </Animated.View>

      {loading ? (
        <View style={styles.list}>
          {[0, 1, 2, 3].map(i => <SkeletonCard key={i} index={i} />)}
        </View>
      ) : error && patients.length === 0 ? (
        <Animated.View entering={FadeIn} style={styles.emptyContainer}>
          <Text style={[styles.emptyIcon, { fontSize: 40 }]}>⚠️</Text>
          <Text style={[styles.emptyTitle, { color: C.error }]}>Błąd połączenia</Text>
          <Text style={styles.emptySubtext}>{error}</Text>
          <Pressable onPress={loadPatients} style={styles.retryBtn}>
            <Text style={styles.retryText}>Spróbuj ponownie</Text>
          </Pressable>
        </Animated.View>
      ) : (
        <FlatList
          data={patients}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <PatientCard
              item={item}
              index={index}
              onPress={(p: any) => router.push(`/patients/${p.id}`)}
            />
          )}
          contentContainerStyle={[styles.list, patients.length === 0 && { flex: 1 }]}
          ListEmptyComponent={<EmptyState searching={!!searchQuery} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Animated.View entering={ZoomIn.delay(400).springify()} style={styles.fabWrap}>
        <FAB
          icon="plus"
          style={styles.fab}
          color="#fff"
          onPress={() => router.push('/patient-edit')}
        />
      </Animated.View>
    </View>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  searchWrap: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6 },
  searchbar: {
    backgroundColor: C.surface,
    borderRadius: 12,
    elevation: 0,
    borderWidth: 1,
    borderColor: C.border,
  },
  list: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 100 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
    gap: 12,
    overflow: 'hidden',
    paddingRight: 14,
    paddingVertical: 13,
    shadowColor: C.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 5,
  },
  cardAccentLine: { width: 4, alignSelf: 'stretch', borderRadius: 0, marginRight: 0 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { fontSize: 15, fontWeight: '700' },
  cardInfo: { flex: 1, minWidth: 0 },
  patientName: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 4 },
  diagChip: {
    alignSelf: 'flex-start',
    backgroundColor: C.accentDim,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: C.accent,
    marginBottom: 4,
    maxWidth: '90%',
  },
  diagChipText: { fontSize: 10, color: C.accent, fontWeight: '700' },
  noDiag: { fontSize: 11, color: C.dim, marginBottom: 4 },
  lastVisit: { fontSize: 10, color: C.dim },
  ageBadge: { fontSize: 11, color: C.muted, fontWeight: '600', minWidth: 28, textAlign: 'right' },
  chevron: { fontSize: 20, color: C.dim, marginLeft: 2 },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  skeletonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  skeletonAvatar: { width: 44, height: 44, borderRadius: 13, backgroundColor: C.border },
  skeletonLine: { height: 10, backgroundColor: C.border, borderRadius: 5 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  emptyIcon: { fontSize: 36 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: C.muted, marginBottom: 8 },
  emptySubtext: { fontSize: 13, color: C.dim, textAlign: 'center', paddingHorizontal: 32 },
  retryBtn: {
    marginTop: 16, paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: C.surface, borderRadius: 10,
    borderWidth: 1, borderColor: C.border,
  },
  retryText: { color: C.accent, fontSize: 13, fontWeight: '600' },
  fabWrap: { position: 'absolute', bottom: 24, right: 20 },
  fab: { backgroundColor: C.accent },
}); }
