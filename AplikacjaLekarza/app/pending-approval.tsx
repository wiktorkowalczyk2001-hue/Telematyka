import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { useColors } from '@/src/context/ThemeContext';

export default function PendingApprovalScreen() {
  const router = useRouter();
  const { signOut, user } = useAuth() as any;
  const C = useColors();
  const S = useMemo(() => makeStyles(C), [C]);

  const handleLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  return (
    <ScrollView style={S.container} contentContainerStyle={S.content}>
      <View style={S.iconWrap}>
        <View style={S.iconCircle}>
          <Text style={{ fontSize: 36 }}>⏳</Text>
        </View>
      </View>

      <Text style={S.title}>Konto oczekuje na potwierdzenie</Text>
      {user?.firstName ? (
        <Text style={S.subtitle}>Witaj, dr {user.firstName} {user.lastName}!</Text>
      ) : null}

      <View style={S.card}>
        <Text style={S.cardText}>
          Twoja rejestracja została przyjęta. Administrator zweryfikuje Twoje dane (PWZ, NIP, przychodnia) i aktywuje konto.
        </Text>
        <Text style={S.cardText}>Weryfikacja trwa zazwyczaj do 24 godzin.</Text>
      </View>

      {user && (
        <View style={S.infoBox}>
          {[
            ['Email', user.email],
            ['Specjalizacja', user.specialization],
            ['Przychodnia', user.clinicName],
            ['PWZ', user.pwzNumber],
          ].map(([label, value]) => value ? (
            <View key={label} style={S.infoRow}>
              <Text style={S.infoLabel}>{label}</Text>
              <Text style={S.infoValue}>{value}</Text>
            </View>
          ) : null)}
          <View style={S.infoRow}>
            <Text style={S.infoLabel}>Status</Text>
            <Text style={[S.infoValue, { color: '#F59E0B' }]}>⏳ Oczekuje</Text>
          </View>
        </View>
      )}

      <Pressable style={S.logoutBtn} onPress={handleLogout}>
        <Text style={S.logoutText}>Wyloguj się</Text>
      </Pressable>
    </ScrollView>
  );
}

function makeStyles(C: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    content: { padding: 24, alignItems: 'center', paddingTop: 60 },
    iconWrap: { marginBottom: 24 },
    iconCircle: {
      width: 88,
      height: 88,
      borderRadius: 24,
      backgroundColor: C.accentDim,
      borderWidth: 1,
      borderColor: C.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: C.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      color: C.muted,
      marginBottom: 28,
    },
    card: {
      width: '100%',
      backgroundColor: C.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      padding: 16,
      marginBottom: 20,
      gap: 8,
    },
    cardText: { fontSize: 14, color: C.text, lineHeight: 20 },
    infoBox: {
      width: '100%',
      backgroundColor: C.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      padding: 4,
      marginBottom: 32,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    infoLabel: { fontSize: 13, color: C.muted },
    infoValue: { fontSize: 13, color: C.text, fontWeight: '600' },
    logoutBtn: {
      paddingVertical: 14,
      paddingHorizontal: 40,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surface,
    },
    logoutText: { fontSize: 14, color: C.muted, fontWeight: '600' },
  });
}
