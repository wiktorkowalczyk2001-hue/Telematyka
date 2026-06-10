import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, KeyboardAvoidingView, Platform, Alert, Text, Pressable } from 'react-native';
import { TextInput, ActivityIndicator, Snackbar } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { saveVisitSOAP } from '../services/visitService';

const C = {
  bg: '#0B1220',
  surface: '#162033',
  border: '#1C2B40',
  accent: '#0ABFA3',
  text: '#E8F0F7',
  muted: '#5A7A9A',
  dim: '#2D4560',
  error: '#E87060',
};

const INPUT_THEME = {
  colors: {
    primary: C.accent,
    background: C.surface,
    onSurfaceVariant: C.muted,
    outline: C.border,
    onSurface: C.text,
  },
};

export default function VisitFormScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();

  const [subjective, setSubjective] = useState('');
  const [objective, setObjective] = useState('');
  const [assessment, setAssessment] = useState('');
  const [plan, setPlan] = useState('');
  const [loading, setLoading] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  const handleClear = () => {
    Alert.alert('Wyczyść formularz', 'Czy na pewno chcesz usunąć wszystkie wpisane dane?', [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Wyczyść',
        style: 'destructive',
        onPress: () => { setSubjective(''); setObjective(''); setAssessment(''); setPlan(''); },
      },
    ]);
  };

  const handleSaveVisit = async () => {
    if (!subjective && !objective && !assessment && !plan) {
      Alert.alert('Błąd', 'Wypełnij przynajmniej jedno pole przed zapisem.');
      return;
    }
    setLoading(true);
    try {
      if (params.visitId) {
        await saveVisitSOAP(params.visitId, { subjective, objective, assessment, plan });
      }
      setSnackbarVisible(true);
      setTimeout(() => router.back(), 1500);
    } catch (e) {
      console.error(e);
      setSnackbarVisible(true);
      setTimeout(() => router.back(), 1500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.springify()} style={styles.headerCard}>
          <Text style={styles.headerName}>{params.patientName || 'Nieznany pacjent'}</Text>
          <Text style={styles.headerMeta}>
            {params.patientAge ? `${params.patientAge} lat` : ''}
            {params.patientPesel ? ` · ${params.patientPesel}` : ''}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).springify()} style={styles.soapLabel}>
          <Text style={styles.soapLabelText}>Formularz wizyty — SOAP</Text>
        </Animated.View>

        {[
          { label: 'S — Wywiad lekarski (Subjective)', placeholder: 'Objawy, dolegliwości zgłaszane przez pacjenta...', value: subjective, onChange: setSubjective, delay: 100 },
          { label: 'O — Badanie fizykalne (Objective)', placeholder: 'Wyniki badań, ciśnienie, tętno, temperatura...', value: objective, onChange: setObjective, delay: 160 },
          { label: 'A — Rozpoznanie (Assessment)', placeholder: 'Wstępna diagnoza, kod ICD-10...', value: assessment, onChange: setAssessment, delay: 220 },
          { label: 'P — Zalecenia i leczenie (Plan)', placeholder: 'Zalecenia, recepty, skierowania, termin kontroli...', value: plan, onChange: setPlan, delay: 280 },
        ].map((field) => (
          <Animated.View key={field.label} entering={FadeInDown.delay(field.delay).springify()}>
            <TextInput
              label={field.label}
              placeholder={field.placeholder}
              mode="outlined"
              multiline
              numberOfLines={4}
              value={field.value}
              onChangeText={field.onChange}
              style={styles.input}
              theme={INPUT_THEME}
              textColor={C.text}
              placeholderTextColor={C.dim}
            />
          </Animated.View>
        ))}

        <Animated.View entering={FadeInDown.delay(360).springify()} style={styles.actions}>
          <Pressable onPress={handleClear} style={styles.clearBtn} disabled={loading}>
            <Text style={styles.clearBtnText}>Wyczyść</Text>
          </Pressable>
          {loading ? (
            <ActivityIndicator animating color={C.accent} style={styles.saveBtn} />
          ) : (
            <Pressable
              onPress={handleSaveVisit}
              style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.saveBtnText}>Zakończ i zapisz</Text>
            </Pressable>
          )}
        </Animated.View>
      </ScrollView>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={1500}
        style={{ backgroundColor: C.surface }}
      >
        <Text style={{ color: C.accent }}>Wizyta zapisana pomyślnie!</Text>
      </Snackbar>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 14, paddingBottom: 40 },
  headerCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 3,
    borderLeftColor: C.accent,
  },
  headerName: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 4 },
  headerMeta: {
    fontSize: 12,
    color: C.muted,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
  },
  soapLabel: { marginBottom: 10 },
  soapLabelText: { fontSize: 11, color: C.dim, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '600' },
  input: { marginBottom: 10, backgroundColor: C.surface },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    gap: 10,
  },
  clearBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  clearBtnText: { fontSize: 13, color: C.muted, fontWeight: '600' },
  saveBtn: {
    flex: 1,
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
