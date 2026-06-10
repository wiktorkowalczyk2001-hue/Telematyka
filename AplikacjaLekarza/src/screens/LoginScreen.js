import React, { useState } from 'react';
import { StyleSheet, View, Text, Pressable, TextInput, ActivityIndicator, Alert } from 'react-native';
import Animated, { FadeInDown, FadeIn, ZoomIn } from 'react-native-reanimated';
import { useAuth } from '../context/AuthContext';
import { useColors } from '../context/ThemeContext';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const router = useRouter();
  const C = useColors();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const [email, setEmail] = useState('dr.kowalski@example.com');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);

  // Registration fields
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regSpecialization, setRegSpecialization] = useState('');
  const [regPWZ, setRegPWZ] = useState('');
  const [regNIP, setRegNIP] = useState('');
  const [regClinic, setRegClinic] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Błąd', 'Podaj email i hasło');
      return;
    }

    try {
      setLoading(true);
      const result = await signIn(email, password);
      
      if (result.status === 'pending') {
        Alert.alert('Oczekiwanie', 'Twoje konto czeka na potwierdzenie przez administratora');
        // Navigation will be handled by _layout.tsx
      } else if (result.status === 'approved') {
        // Navigation will be handled by _layout.tsx
      } else if (result.status === 'rejected') {
        Alert.alert('Błąd', 'Twoje konto zostało odrzucone. Skontaktuj się z administratorem.');
      }
    } catch (error) {
      Alert.alert('Błąd logowania', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!regEmail || !regPassword || !regFirstName || !regLastName) {
      Alert.alert('Błąd', 'Wypełnij wszystkie pola');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('http://192.168.0.31:3001/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: regEmail,
          password: regPassword,
          firstName: regFirstName,
          lastName: regLastName,
          specialization: regSpecialization,
          pwzNumber: regPWZ,
          nip: regNIP,
          clinicName: regClinic,
        }),
      });

      if (!response.ok) throw new Error('Rejestracja nie powiodła się');

      Alert.alert(
        'Sukces',
        'Rejestracja przesłana! Twoje konto czeka na potwierdzenie przez administratora.'
      );
      setShowRegistration(false);
      setRegEmail('');
      setRegPassword('');
    } catch (error) {
      Alert.alert('Błąd rejestracji', error.message);
    } finally {
      setLoading(false);
    }
  };

  if (showRegistration) {
    return (
      <View style={styles.container}>
        <Animated.View entering={FadeIn.duration(600)} style={styles.bg} />
        
        <View style={styles.content}>
          <Text style={styles.title}>Rejestracja Lekarza</Text>
          
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={C.muted}
              value={regEmail}
              onChangeText={setRegEmail}
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="Hasło"
              placeholderTextColor={C.muted}
              value={regPassword}
              onChangeText={setRegPassword}
              secureTextEntry
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="Imię"
              placeholderTextColor={C.muted}
              value={regFirstName}
              onChangeText={setRegFirstName}
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="Nazwisko"
              placeholderTextColor={C.muted}
              value={regLastName}
              onChangeText={setRegLastName}
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="Specjalizacja"
              placeholderTextColor={C.muted}
              value={regSpecialization}
              onChangeText={setRegSpecialization}
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="PWZ (np. PWZ/00001/2023)"
              placeholderTextColor={C.muted}
              value={regPWZ}
              onChangeText={setRegPWZ}
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="NIP (10 cyfr)"
              placeholderTextColor={C.muted}
              value={regNIP}
              onChangeText={setRegNIP}
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="Przychodnia"
              placeholderTextColor={C.muted}
              value={regClinic}
              onChangeText={setRegClinic}
              editable={!loading}
            />

            <Pressable
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Zarejestruj</Text>
              )}
            </Pressable>

            <Pressable onPress={() => setShowRegistration(false)} disabled={loading}>
              <Text style={styles.linkText}>Powrót do logowania</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeIn.duration(600)} style={styles.bg} />

      <View style={styles.content}>
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.logoWrap}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoIcon}>✚</Text>
          </View>
        </Animated.View>

        <Animated.Text entering={FadeInDown.delay(200).springify()} style={styles.title}>
          Telemed
        </Animated.Text>

        <Animated.Text entering={FadeInDown.delay(280).springify()} style={styles.subtitle}>
          Panel Lekarza
        </Animated.Text>

        <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.card}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={C.muted}
            value={email}
            onChangeText={setEmail}
            editable={!loading}
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="Hasło"
            placeholderTextColor={C.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
          />

          <Pressable
            onPress={handleLogin}
            style={[styles.btn, loading && styles.btnDisabled]}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Zaloguj</Text>
            )}
          </Pressable>

          <Pressable onPress={() => setShowRegistration(true)} disabled={loading}>
            <Text style={styles.linkText}>Nie masz konta? Zarejestruj się</Text>
          </Pressable>
        </Animated.View>

        <Animated.Text entering={FadeIn.delay(700)} style={styles.version}>
          v1.0 · Obsidian Clinic
        </Animated.Text>
      </View>
    </View>
  );
}

function makeStyles(C) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.bg,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  logoWrap: { marginBottom: 20 },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: '#0F6E56',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#0ABFA3',
  },
  logoIcon: { fontSize: 32, color: '#0ABFA3' },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#E8F0F7',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: C.muted,
    marginBottom: 48,
    letterSpacing: 0.3,
  },
  card: {
    width: '100%',
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: C.border,
  },
  form: {
    width: '100%',
  },
  input: {
    width: '100%',
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 12,
    color: '#E8F0F7',
    marginBottom: 12,
    fontSize: 14,
  },
  btn: {
    width: '100%',
    backgroundColor: '#0ABFA3',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: 15, fontWeight: '700', color: '#fff', letterSpacing: 0.2 },
  linkText: { fontSize: 13, color: '#0ABFA3', textAlign: 'center', marginTop: 12 },
  version: { fontSize: 11, color: '#1C2B40', letterSpacing: 0.5, marginTop: 32 },
}); }
