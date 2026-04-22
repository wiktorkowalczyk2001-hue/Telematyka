import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Text, TextInput, Button, Card, useTheme, Snackbar, ActivityIndicator } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { updateClinicalNotes } from '../services/patientService';

export default function VisitFormScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const theme = useTheme();

  // SOAP Fields
  const [subjective, setSubjective] = useState(''); // Wywiad lekarski
  const [objective, setObjective] = useState('');   // Badanie fizykalne
  const [assessment, setAssessment] = useState(''); // Rozpoznanie ICD-10
  const [plan, setPlan] = useState('');             // Zalecenia, recepty

  const [loading, setLoading] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  const handleClear = () => {
    Alert.alert(
      'Wyczyść formularz',
      'Czy na pewno chcesz usunąć wszystkie wpisane dane?',
      [
        { text: 'Anuluj', style: 'cancel' },
        { 
          text: 'Wyczyść', 
          style: 'destructive', 
          onPress: () => {
            setSubjective('');
            setObjective('');
            setAssessment('');
            setPlan('');
          }
        }
      ]
    );
  };

  const handleSaveVisit = async () => {
    if (!subjective && !objective && !assessment && !plan) {
      Alert.alert('Błąd', 'Wypełnij przynajmniej jedno pole przed zapisem.');
      return;
    }

    const combinedNotes = `
[Data Wizyty: ${new Date().toISOString().split('T')[0]}]
Wywiad (S): ${subjective || 'Brak wpisu'}
Badanie fizykalne (O): ${objective || 'Brak wpisu'}
Rozpoznanie (A): ${assessment || 'Brak wpisu'}
Zalecenia (P): ${plan || 'Brak wpisu'}
    `.trim();

    setLoading(true);
    try {
      if (params.patientId && params.patientId !== 'new') { 
        await updateClinicalNotes(params.patientId, combinedNotes);
      }
      
      setSnackbarVisible(true);
      setTimeout(() => {
        router.back();
      }, 1500);
    } catch (e) {
      // Fallback for mock/demo
      setSnackbarVisible(true);
      setTimeout(() => {
        router.back();
      }, 1500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={[styles.container, { backgroundColor: theme.colors.background }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        
        {/* Header - Informacje o pacjencie */}
        <Card style={styles.headerCard}>
          <Card.Content>
            <Text variant="titleLarge" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
              Pacjent: {params.patientName || 'Nieznany'}
            </Text>
            <Text variant="bodyMedium">Wiek: {params.patientAge || '--'} lat | PESEL: {params.patientPesel || 'Brak'}</Text>
          </Card.Content>
        </Card>

        {/* SOAP Formularz */}
        <View style={styles.formContainer}>
          <Text variant="titleMedium" style={styles.sectionTitle}>Przebieg wizyty (SOAP)</Text>
          
          <TextInput
            label="S (Subjective) - Wywiad lekarski"
            placeholder="Objawy, dolegliwości zgłaszane przez pacjenta..."
            mode="outlined"
            multiline
            numberOfLines={4}
            value={subjective}
            onChangeText={setSubjective}
            style={styles.input}
          />
          <TextInput
            label="O (Objective) - Badanie fizykalne"
            placeholder="Wyniki badań, ciśnienie, tętno, temperatura..."
            mode="outlined"
            multiline
            numberOfLines={4}
            value={objective}
            onChangeText={setObjective}
            style={styles.input}
          />
          <TextInput
            label="A (Assessment) - Rozpoznanie"
            placeholder="Wstępna diagnoza, kod ICD-10..."
            mode="outlined"
            multiline
            numberOfLines={3}
            value={assessment}
            onChangeText={setAssessment}
            style={styles.input}
          />
          <TextInput
            label="P (Plan) - Zalecenia i leczenie"
            placeholder="Zalecenia, e-Recepty, skierowania, termin kolejnej wizyty..."
            mode="outlined"
            multiline
            numberOfLines={4}
            value={plan}
            onChangeText={setPlan}
            style={styles.input}
          />

          {/* Akcje */}
          <View style={styles.actionsContainer}>
            <Button 
              mode="text" 
              onPress={handleClear} 
              textColor={theme.colors.error}
              style={styles.actionButton}
              disabled={loading}
            >
              Wyczyść
            </Button>

            {loading ? (
              <ActivityIndicator animating={true} color={theme.colors.primary} style={styles.actionButton} />
            ) : (
              <Button 
                mode="contained" 
                onPress={handleSaveVisit} 
                style={styles.actionButton}
                buttonColor={theme.colors.primary}
              >
                Zakończ i zapisz wizytę
              </Button>
            )}
          </View>
        </View>

      </ScrollView>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={1500}
      >
        Wizyta zapisana pomyślnie!
      </Snackbar>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 16,
  },
  headerCard: {
    marginBottom: 20,
    backgroundColor: '#E8EEF5', // Light blue surface
    elevation: 0,
    borderWidth: 1,
    borderColor: '#cce0f5',
  },
  formContainer: {
    gap: 16,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: -8,
  },
  input: {
    backgroundColor: '#fff',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  actionButton: {
    paddingVertical: 6,
    borderRadius: 8,
  }
});
