import React, { useState, useEffect, useContext } from 'react';
import { StyleSheet, ScrollView, KeyboardAvoidingView, Platform, View, Text, Pressable } from 'react-native';
import { TextInput, ActivityIndicator, Snackbar, HelperText } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { addPatient, updatePatient, fetchPatientById } from '../services/patientService';
import { AuthContext } from '../context/AuthContext';

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
    error: C.error,
  },
};

function SectionLabel({ title, delay = 0 }) {
  return (
    <Animated.Text entering={FadeInDown.delay(delay).springify()} style={styles.sectionLabel}>
      {title}
    </Animated.Text>
  );
}

export default function PatientEditScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useContext(AuthContext); // Get current user
  const isEditMode = !!params.patientId;

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [pesel, setPesel] = useState('');
  const [age, setAge] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [allergies, setAllergies] = useState('');
  const [chronicConditions, setChronicConditions] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [medicalHistory, setMedicalHistory] = useState('');
  const [currentMedications, setCurrentMedications] = useState('');

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(isEditMode);
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  useEffect(() => {
    if (isEditMode) loadPatient();
  }, [params.patientId]);

  const loadPatient = async () => {
    try {
      const p = await fetchPatientById(params.patientId);
      setFirstName(p.firstName || '');
      setLastName(p.lastName || '');
      setPesel(p.pesel || '');
      setAge(p.age ? String(p.age) : '');
      setPhone(p.phone || '');
      setEmail(p.email || '');
      setAddress(p.address || '');
      setAllergies(p.allergies || '');
      setChronicConditions(p.chronicConditions || '');
      setDiagnosis(p.diagnosis || '');
      setMedicalHistory(p.medicalHistory || '');
      setCurrentMedications(p.currentMedications || '');
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingData(false);
    }
  };

  const hasPeselError = () => pesel.length > 0 && pesel.length !== 11;
  const isFormValid = () => firstName.trim() !== '' && lastName.trim() !== '' && pesel.length === 11;

  const handleSave = async () => {
    if (!isFormValid()) return;
    setLoading(true);
    try {
      const patientData = {
        firstName, lastName, pesel, age: parseInt(age) || 0,
        phone, email, address, allergies, chronicConditions,
        diagnosis, medicalHistory, currentMedications,
      };
      if (isEditMode) {
        await updatePatient(params.patientId, patientData);
      } else {
        await addPatient(patientData);
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

  if (loadingData) {
    return (
      <View style={styles.center}>
        <ActivityIndicator animating color={C.accent} size="large" />
      </View>
    );
  }

  const inputProps = (label, value, onChange, opts = {}) => ({
    label,
    value,
    onChangeText: onChange,
    mode: 'outlined',
    style: styles.input,
    theme: INPUT_THEME,
    textColor: C.text,
    placeholderTextColor: C.dim,
    ...opts,
  });

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        <SectionLabel title="Dane osobowe" delay={0} />
        <Animated.View entering={FadeInDown.delay(40).springify()} style={styles.card}>
          <TextInput {...inputProps('Imię', firstName, setFirstName)} left={<TextInput.Icon icon="account" color={C.muted} />} />
          <TextInput {...inputProps('Nazwisko', lastName, setLastName)} left={<TextInput.Icon icon="account-details" color={C.muted} />} />
          <TextInput
            {...inputProps('PESEL', pesel, setPesel)}
            keyboardType="numeric"
            maxLength={11}
            left={<TextInput.Icon icon="card-account-details" color={C.muted} />}
            error={hasPeselError()}
          />
          <HelperText type="error" visible={hasPeselError()} style={{ color: C.error }}>
            PESEL musi mieć dokładnie 11 cyfr.
          </HelperText>
          <TextInput {...inputProps('Wiek', age, setAge)} keyboardType="numeric" />
        </Animated.View>

        <SectionLabel title="Kontakt" delay={100} />
        <Animated.View entering={FadeInDown.delay(140).springify()} style={styles.card}>
          <TextInput {...inputProps('Telefon', phone, setPhone)} keyboardType="phone-pad" left={<TextInput.Icon icon="phone" color={C.muted} />} />
          <TextInput {...inputProps('E-mail', email, setEmail)} keyboardType="email-address" left={<TextInput.Icon icon="email" color={C.muted} />} />
          <TextInput {...inputProps('Adres zamieszkania', address, setAddress)} left={<TextInput.Icon icon="map-marker" color={C.muted} />} />
        </Animated.View>

        <SectionLabel title="Historia medyczna" delay={200} />
        <Animated.View entering={FadeInDown.delay(240).springify()} style={styles.card}>
          <TextInput {...inputProps('Rozpoznanie główne', diagnosis, setDiagnosis)} left={<TextInput.Icon icon="stethoscope" color={C.muted} />} />
          <TextInput {...inputProps('Alergie', allergies, setAllergies)} multiline numberOfLines={3} left={<TextInput.Icon icon="allergy" color={C.muted} />} />
          <TextInput {...inputProps('Choroby przewlekłe', chronicConditions, setChronicConditions)} multiline numberOfLines={3} left={<TextInput.Icon icon="medical-bag" color={C.muted} />} />
          <TextInput {...inputProps('Historia medyczna', medicalHistory, setMedicalHistory)} multiline numberOfLines={3} />
          <TextInput {...inputProps('Aktualne leki', currentMedications, setCurrentMedications)} multiline numberOfLines={3} left={<TextInput.Icon icon="pill" color={C.muted} />} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(320).springify()} style={styles.saveWrap}>
          {loading ? (
            <ActivityIndicator animating color={C.accent} size="large" />
          ) : (
            <Pressable
              onPress={handleSave}
              disabled={!isFormValid()}
              style={({ pressed }) => [styles.saveBtn, !isFormValid() && styles.saveBtnDisabled, pressed && { opacity: 0.8 }]}
            >
              <Text style={[styles.saveBtnText, !isFormValid() && { color: C.dim }]}>
                {isEditMode ? 'Zapisz zmiany' : 'Dodaj pacjenta'}
              </Text>
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
        <Text style={{ color: C.accent }}>{isEditMode ? 'Zmiany zapisane!' : 'Pacjent dodany!'}</Text>
      </Snackbar>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 14, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
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
  card: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.border,
    gap: 2,
  },
  input: { marginBottom: 2, backgroundColor: C.surface },
  saveWrap: { marginTop: 4, alignItems: 'center' },
  saveBtn: {
    width: '100%',
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnDisabled: { backgroundColor: C.border },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
