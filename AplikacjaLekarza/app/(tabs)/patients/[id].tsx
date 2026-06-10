import React, { useState, useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, View, Text, Pressable, Platform } from 'react-native';
import { ActivityIndicator, Button, Dialog, Portal } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { fetchPatientById, deletePatient } from '@/src/services/patientService';
import { fetchPatientVisits } from '@/src/services/visitService';
import { useAIContext } from '@/src/context/AIContext';
import { useColors } from '@/src/context/ThemeContext';

const AVATAR_COLORS = [
  { bg: '#0F6E56', fg: '#9FE1CB' },
  { bg: '#185FA5', fg: '#B5D4F4' },
  { bg: '#533489', fg: '#CECBF6' },
  { bg: '#633806', fg: '#FAC775' },
  { bg: '#993C1D', fg: '#F5C4B3' },
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function formatDate(dateStr: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pl-PL', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateShort(dateStr: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pl-PL');
}

function InfoSection({ title, children, delay = 0 }: any) {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify().damping(18)} style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </Animated.View>
  );
}

function InfoRow({ label, value }: any) {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
  );
}

export default function PatientDetailsScreen() {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [patient, setPatient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [visits, setVisits] = useState<any[]>([]);
  const [visitsExpanded, setVisitsExpanded] = useState(false);
  const { setAIContext } = useAIContext();

  useEffect(() => {
    loadPatientDetails();
    loadVisits();
  }, [id]);

  const loadPatientDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      if (id) {
        const data = await fetchPatientById(id as string);
        setPatient(data);
        setAIContext({
          screen: 'patient_detail',
          screenLabel: `Karta pacjenta: ${data.firstName} ${data.lastName}`,
          patient: {
            name: `${data.firstName} ${data.lastName}`,
            age: data.age,
            diagnosis: data.diagnosis,
            medications: data.currentMedications,
            allergies: data.allergies,
          },
        });
      }
    } catch (err: any) {
      setError(err.message || 'Błąd ładowania');
    } finally {
      setLoading(false);
    }
  };

  const loadVisits = async () => {
    try {
      const data = await fetchPatientVisits(id as string);
      setVisits(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleEditPatient = () => {
    router.push({ pathname: '/patient-edit', params: { patientId: id } });
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      await deletePatient(id as string);
      setDeleteDialogVisible(false);
      router.back();
    } catch (e) {
      setDeleteDialogVisible(false);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator animating color={C.accent} size="large" />
      </View>
    );
  }

  if (error || !patient) {
    return (
      <View style={styles.center}>
        <Text style={[styles.sectionTitle, { color: C.error }]}>Błąd</Text>
        <Text style={styles.infoLabel}>{error || 'Nie znaleziono pacjenta'}</Text>
        <Pressable onPress={loadPatientDetails} style={styles.retryBtn}>
          <Text style={styles.retryText}>Spróbuj ponownie</Text>
        </Pressable>
      </View>
    );
  }

  const avatarColor = getAvatarColor(`${patient.firstName}${patient.lastName}`);
  const initials = `${(patient.firstName || '')[0] || ''}${(patient.lastName || '')[0] || ''}`.toUpperCase();
  const shownVisits = visitsExpanded ? visits : visits.slice(0, 3);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeInDown.springify()} style={styles.header}>
        <View style={[styles.headerAvatar, { backgroundColor: avatarColor.bg }]}>
          <Text style={[styles.headerAvatarText, { color: avatarColor.fg }]}>{initials}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{patient.firstName} {patient.lastName}</Text>
          <Text style={styles.headerAge}>{patient.age} lat</Text>
          {patient.pesel ? (
            <Text style={styles.pesel}>PESEL · {patient.pesel}</Text>
          ) : null}
        </View>
      </Animated.View>

      {patient.diagnosis ? (
        <Animated.View entering={FadeInDown.delay(80).springify()} style={styles.diagBadge}>
          <Text style={styles.diagText}>{patient.diagnosis}</Text>
        </Animated.View>
      ) : null}

      <InfoSection title="Kontakt" delay={140}>
        <InfoRow label="Telefon" value={patient.phone} />
        <InfoRow label="E-mail" value={patient.email} />
        <InfoRow label="Adres" value={patient.address} />
      </InfoSection>

      <InfoSection title="Historia medyczna" delay={200}>
        <InfoRow label="Alergie" value={patient.allergies} />
        <InfoRow label="Choroby przewlekłe" value={patient.chronicConditions} />
        {patient.medicalHistory ? (
          <Text style={styles.bodyText}>{patient.medicalHistory}</Text>
        ) : null}
      </InfoSection>

      <InfoSection title="Aktualne leki" delay={260}>
        {patient.currentMedications ? (
          <Text style={styles.bodyText}>{patient.currentMedications}</Text>
        ) : (
          <Text style={styles.emptyNote}>Brak wpisanych leków</Text>
        )}
      </InfoSection>

      <InfoSection title={`Historia wizyt (${visits.length})`} delay={320}>
        {visits.length === 0 ? (
          <Text style={styles.emptyNote}>Brak wizyt w historii</Text>
        ) : (
          <>
            {shownVisits.map((visit, idx) => (
              <View key={visit.id} style={[styles.visitRow, idx > 0 && styles.visitRowBorder]}>
                <Text style={styles.visitDate}>{formatDateShort(visit.visitDate)}{visit.visitTime ? ` · ${visit.visitTime}` : ''}</Text>
                <Text style={styles.visitReason}>{visit.reason}</Text>
                {visit.soapAssessment ? <Text style={styles.visitSoap}>Rozpoznanie: {visit.soapAssessment}</Text> : null}
                {visit.soapPlan ? <Text style={styles.visitSoap}>Plan: {visit.soapPlan}</Text> : null}
              </View>
            ))}
            {visits.length > 3 && (
              <Pressable onPress={() => setVisitsExpanded(!visitsExpanded)} style={styles.expandBtn}>
                <Text style={styles.expandText}>{visitsExpanded ? 'Zwiń' : `Pokaż wszystkie (${visits.length})`}</Text>
              </Pressable>
            )}
          </>
        )}
      </InfoSection>

      <Animated.View entering={FadeInDown.delay(380).springify()} style={styles.actions}>
        <Pressable
          onPress={handleEditPatient}
          style={({ pressed }) => [styles.btnEdit, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.btnEditText}>Edytuj pacjenta</Text>
        </Pressable>
        <Pressable
          onPress={() => setDeleteDialogVisible(true)}
          style={({ pressed }) => [styles.btnDelete, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.btnDeleteText}>Usuń</Text>
        </Pressable>
      </Animated.View>

      <View style={{ height: 40 }} />

      <Portal>
        <Dialog
          visible={deleteDialogVisible}
          onDismiss={() => setDeleteDialogVisible(false)}
          style={styles.dialog}
        >
          <Dialog.Title style={styles.dialogTitle}>Usuń pacjenta</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogContent}>
              Czy na pewno chcesz usunąć {patient.firstName} {patient.lastName}? Tej operacji nie można cofnąć.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteDialogVisible(false)} disabled={deleting} textColor={C.muted}>Anuluj</Button>
            <Button onPress={handleDeleteConfirm} loading={deleting} textColor={C.error}>Usuń</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

function makeStyles(C: any) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 24 },
  center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  headerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerAvatarText: { fontSize: 20, fontWeight: '700' },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 19, fontWeight: '700', color: C.text, marginBottom: 3 },
  headerAge: { fontSize: 13, color: C.muted, marginBottom: 3 },
  pesel: {
    fontSize: 11,
    color: C.dim,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    letterSpacing: 0.5,
  },
  diagBadge: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.accentDim,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  diagText: { fontSize: 13, color: C.accent, fontWeight: '500' },
  section: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 9,
    borderWidth: 1,
    borderColor: C.border,
  },
  sectionTitle: {
    fontSize: 10,
    color: C.dim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
    fontWeight: '600',
  },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  infoLabel: { fontSize: 12, color: C.muted, flex: 1 },
  infoValue: { fontSize: 12, color: C.text, flex: 2, textAlign: 'right' },
  bodyText: { fontSize: 13, color: C.muted, lineHeight: 20 },
  emptyNote: { fontSize: 12, color: C.dim, fontStyle: 'italic' },
  visitRow: { paddingVertical: 8 },
  visitRowBorder: { borderTopWidth: 1, borderTopColor: C.border },
  visitDate: {
    fontSize: 11,
    color: C.accent,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    marginBottom: 2,
    fontWeight: '600',
  },
  visitReason: { fontSize: 12, color: C.text, marginBottom: 2 },
  visitSoap: { fontSize: 11, color: C.muted, fontStyle: 'italic' },
  expandBtn: { marginTop: 8, alignItems: 'center' },
  expandText: { fontSize: 12, color: C.accent, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btnEdit: {
    flex: 1,
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  btnEditText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  btnDelete: {
    backgroundColor: C.errorBg,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4A1B0C',
  },
  btnDeleteText: { fontSize: 14, fontWeight: '600', color: C.error },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: C.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  retryText: { color: C.accent, fontSize: 13, fontWeight: '600' },
  dialog: { backgroundColor: C.surface, borderRadius: 16 },
  dialogTitle: { color: C.text },
  dialogContent: { color: C.muted, fontSize: 14, lineHeight: 20 },
}); }
