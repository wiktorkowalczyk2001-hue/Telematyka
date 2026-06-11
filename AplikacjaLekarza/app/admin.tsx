import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Pressable, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { useColors } from '@/src/context/ThemeContext';

const getApiUrl = () => typeof window !== 'undefined' ? '/api' : 'http://192.168.0.31:3001';

interface PendingDoctor {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  specialization: string;
  pwz_number: string;
  nip: string;
  clinic_name: string;
  created_at: string;
  status: string;
}

export default function AdminScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const C = useColors();
  const S = useMemo(() => makeStyles(C), [C]);

  const [doctors, setDoctors] = useState<PendingDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => { fetchPending(); }, []);

  const fetchPending = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${getApiUrl()}/users?status=eq.pending&order=created_at.asc`);
      if (!res.ok) throw new Error('Błąd pobierania');
      setDoctors(await res.json());
    } catch (e: any) {
      Alert.alert('Błąd', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleDecision = async (doctor: PendingDoctor, approved: boolean) => {
    if (!approved) {
      Alert.alert(
        'Odrzucić rejestrację?',
        `${doctor.first_name} ${doctor.last_name} (${doctor.email})`,
        [
          { text: 'Anuluj', style: 'cancel' },
          { text: 'Odrzuć', style: 'destructive', onPress: () => doDecision(doctor.id, false) },
        ],
      );
    } else {
      doDecision(doctor.id, true);
    }
  };

  const doDecision = async (doctorId: string, approved: boolean) => {
    try {
      setProcessingId(doctorId);
      const res = await fetch(`${getApiUrl()}/users?id=eq.${doctorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({ status: approved ? 'approved' : 'rejected' }),
      });
      if (!res.ok) throw new Error('Błąd zapisu');
      fetchPending();
    } catch (e: any) {
      Alert.alert('Błąd', e.message);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <View style={[S.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  return (
    <View style={S.container}>
      <View style={S.header}>
        <Pressable onPress={() => router.back()} style={S.backBtn}>
          <Text style={S.backText}>‹</Text>
        </Pressable>
        <Text style={S.headerTitle}>Panel admina</Text>
        <View style={S.badge}>
          <Text style={S.badgeText}>{doctors.length}</Text>
        </View>
      </View>

      {doctors.length === 0 ? (
        <View style={S.empty}>
          <Text style={S.emptyIcon}>✓</Text>
          <Text style={S.emptyTitle}>Brak oczekujących rejestracji</Text>
          <Text style={S.emptyText}>Wszyscy lekarze zweryfikowani</Text>
        </View>
      ) : (
        <ScrollView
          style={S.list}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPending(); }} tintColor={C.accent} />}
        >
          {doctors.map(doc => (
            <View key={doc.id} style={S.card}>
              <View style={S.cardHeader}>
                <View>
                  <Text style={S.doctorName}>dr {doc.first_name} {doc.last_name}</Text>
                  <Text style={S.doctorEmail}>{doc.email}</Text>
                </View>
                <Text style={S.date}>{new Date(doc.created_at).toLocaleDateString('pl-PL')}</Text>
              </View>

              <View style={S.details}>
                {[
                  ['Specjalizacja', doc.specialization],
                  ['Przychodnia', doc.clinic_name],
                  ['PWZ', doc.pwz_number],
                  ['NIP', doc.nip],
                ].map(([label, value]) => value ? (
                  <View key={label} style={S.detailRow}>
                    <Text style={S.detailLabel}>{label}</Text>
                    <Text style={S.detailValue}>{value}</Text>
                  </View>
                ) : null)}
              </View>

              <View style={S.actions}>
                <Pressable
                  style={[S.btn, S.rejectBtn]}
                  onPress={() => handleDecision(doc, false)}
                  disabled={processingId === doc.id}
                >
                  {processingId === doc.id
                    ? <ActivityIndicator size="small" color={C.error} />
                    : <Text style={[S.btnText, { color: C.error }]}>Odrzuć</Text>}
                </Pressable>
                <Pressable
                  style={[S.btn, S.approveBtn]}
                  onPress={() => handleDecision(doc, true)}
                  disabled={processingId === doc.id}
                >
                  {processingId === doc.id
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={S.btnText}>Zatwierdź</Text>}
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function makeStyles(C: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 56,
      backgroundColor: C.surface,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
      paddingHorizontal: 12,
      gap: 10,
    },
    backBtn: { padding: 8 },
    backText: { fontSize: 24, color: C.accent, lineHeight: 28 },
    headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: C.text },
    badge: {
      backgroundColor: C.accentDim,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: C.accent,
    },
    badgeText: { fontSize: 13, fontWeight: '700', color: C.accent },
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
    emptyIcon: { fontSize: 48 },
    emptyTitle: { fontSize: 16, fontWeight: '600', color: C.text },
    emptyText: { fontSize: 13, color: C.muted },
    list: { flex: 1 },
    card: {
      backgroundColor: C.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      overflow: 'hidden',
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    doctorName: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 2 },
    doctorEmail: { fontSize: 12, color: C.muted },
    date: { fontSize: 11, color: C.accent, fontWeight: '600' },
    details: { padding: 14, gap: 8 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
    detailLabel: { fontSize: 12, color: C.muted },
    detailValue: { fontSize: 12, color: C.text, fontWeight: '600' },
    actions: {
      flexDirection: 'row',
      gap: 10,
      padding: 14,
      borderTopWidth: 1,
      borderTopColor: C.border,
    },
    btn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: 'center',
    },
    approveBtn: { backgroundColor: C.accent },
    rejectBtn: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.error ?? '#E87060' },
    btnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  });
}
