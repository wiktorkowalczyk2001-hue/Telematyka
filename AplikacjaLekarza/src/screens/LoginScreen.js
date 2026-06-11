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

  const [email, setEmail] = useState('lekarz@telemed.pl');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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

    setErrorMsg('');
    try {
      setLoading(true);
      const result = await signIn(email, password);
      if (result.status === 'pending') {
        setErrorMsg('Konto czeka na potwierdzenie przez administratora.');
      }
    } catch (error) {
      setErrorMsg(error.message || 'Błąd logowania. Sprawdź dane i połączenie.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!regEmail || !regPassword || !regFirstName || !regLastName) {
      Alert.alert('Błąd', 'Imię, nazwisko, email i hasło są wymagane.');
      return;
    }
    if (regPassword.length < 6) {
      Alert.alert('Błąd', 'Hasło musi mieć min. 6 znaków.');
      return;
    }

    try {
      setLoading(true);
      const API_URL = Platform.OS === 'web' ? '/api' : 'http://192.168.0.31:3001';
      const response = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({
          email: regEmail,
          password_hash: regPassword, // plain text MVP — hash in production
          first_name: regFirstName,
          last_name: regLastName,
          specialization: regSpecialization || null,
          pwz_number: regPWZ || null,
          nip: regNIP || null,
          clinic_name: regClinic || null,
          status: 'pending',
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || `Błąd ${response.status}`);
      }

      Alert.alert('Sukces', 'Rejestracja przesłana! Konto czeka na potwierdzenie przez administratora.');
      setShowRegistration(false);
      setRegEmail(''); setRegPassword(''); setRegFirstName(''); setRegLastName('');
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

          {!!errorMsg && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

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
    backgroundColor: C.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.accent,
  },
  logoIcon: { fontSize: 32, color: C.accent },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: C.text,
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
    color: C.text,
    marginBottom: 12,
    fontSize: 14,
  },
  btn: {
    width: '100%',
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: 15, fontWeight: '700', color: '#fff', letterSpacing: 0.2 },
  linkText: { fontSize: 13, color: C.accent, textAlign: 'center', marginTop: 12 },
  version: { fontSize: 11, color: C.muted, letterSpacing: 0.5, marginTop: 32 },
  errorBox: {
    backgroundColor: '#4A1B0C',
    borderWidth: 1,
    borderColor: '#E87060',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  errorText: { fontSize: 13, color: '#E87060', textAlign: 'center' },
}); }
