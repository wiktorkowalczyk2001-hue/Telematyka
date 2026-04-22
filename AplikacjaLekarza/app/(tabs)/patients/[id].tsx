import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  Surface,
  Text,
  Title,
  Paragraph,
  Divider,
  Button,
  useTheme,
  ActivityIndicator,
} from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { fetchPatientById } from '@/src/services/patientService';

/**
 * PatientDetailsScreen Component
 * Displays detailed medical information for a selected patient
 */
export default function PatientDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const theme = useTheme();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadPatientDetails();
  }, [id]);

  /**
   * Load patient details from Supabase
   */
  const loadPatientDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      if (id) {
        const patientData = await fetchPatientById(id);
        setPatient(patientData);
      }
    } catch (err) {
      console.error('Error loading patient details:', err);
      setError(err.message || 'Failed to load patient details');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Format date to Polish locale
   */
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pl-PL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  /**
   * Handle edit patient action
   */
  const handleEditPatient = () => {
    alert('Edit Patient functionality will be implemented');
  };

  /**
   * Handle delete patient action
   */
  const handleDeletePatient = () => {
    alert('Delete Patient functionality will be implemented');
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContainer}>
          <ActivityIndicator animating={true} size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.onSurface, marginTop: 12 }]}>
            Loading patient data...
          </Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContainer}>
          <Text style={[styles.errorText, { color: theme.colors.error }]}>Error</Text>
          <Paragraph style={[styles.errorMessage, { color: theme.colors.onSurface }]}>
            {error}
          </Paragraph>
          <Button mode="contained" onPress={loadPatientDetails} style={styles.retryButton}>
            Try Again
          </Button>
        </View>
      </View>
    );
  }

  if (!patient) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContainer}>
          <Text style={[styles.errorText, { color: theme.colors.onSurface }]}>Patient not found</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Patient Header Section */}
      <Surface
        style={[styles.headerSurface, { backgroundColor: theme.colors.primary }]}
        elevation={1}
      >
        <View style={styles.headerContent}>
          <Title style={[styles.patientNameHeader, { color: '#FFFFFF' }]}>
            {patient.firstName} {patient.lastName}
          </Title>
          <View style={styles.ageRow}>
            <Text style={[styles.ageLabel, { color: '#FFFFFF' }]}>Age:</Text>
            <Text style={[styles.ageValue, { color: '#FFFFFF' }]}>{patient.age} years</Text>
          </View>
        </View>
      </Surface>

      {/* Primary Diagnosis Section */}
      <Surface
        style={[styles.section, { backgroundColor: theme.colors.surface }]}
        elevation={1}
      >
        <View style={styles.sectionHeader}>
          <Title style={[styles.sectionTitle, { color: theme.colors.primary }]}>
            Primary Diagnosis
          </Title>
        </View>
        <Divider style={{ backgroundColor: theme.colors.surfaceVariant }} />
        <View style={styles.sectionContent}>
          <Text style={[styles.diagnosisText, { color: theme.colors.error }]}>
            {patient.diagnosis}
          </Text>
        </View>
      </Surface>

      {/* Last Visit Section */}
      <Surface
        style={[styles.section, { backgroundColor: theme.colors.surface }]}
        elevation={1}
      >
        <View style={styles.sectionHeader}>
          <Title style={[styles.sectionTitle, { color: theme.colors.primary }]}>
            Last Visit
          </Title>
        </View>
        <Divider style={{ backgroundColor: theme.colors.surfaceVariant }} />
        <View style={styles.sectionContent}>
          <Text style={[styles.dateText, { color: theme.colors.onSurface }]}>
            {formatDate(patient.lastVisitDate)}
          </Text>
        </View>
      </Surface>

      {/* Medical History Section */}
      <Surface
        style={[styles.section, { backgroundColor: theme.colors.surface }]}
        elevation={1}
      >
        <View style={styles.sectionHeader}>
          <Title style={[styles.sectionTitle, { color: theme.colors.primary }]}>
            Medical History
          </Title>
        </View>
        <Divider style={{ backgroundColor: theme.colors.surfaceVariant }} />
        <View style={styles.sectionContent}>
          <Paragraph style={[styles.bodyText, { color: theme.colors.onSurface }]}>
            {patient.medicalHistory}
          </Paragraph>
        </View>
      </Surface>

      {/* Current Medications Section */}
      <Surface
        style={[styles.section, { backgroundColor: theme.colors.surface }]}
        elevation={1}
      >
        <View style={styles.sectionHeader}>
          <Title style={[styles.sectionTitle, { color: theme.colors.primary }]}>
            Current Medications
          </Title>
        </View>
        <Divider style={{ backgroundColor: theme.colors.surfaceVariant }} />
        <View style={styles.sectionContent}>
          <Paragraph style={[styles.bodyText, { color: theme.colors.onSurface }]}>
            {patient.currentMedications}
          </Paragraph>
        </View>
      </Surface>

      {/* Clinical Notes Section */}
      <Surface
        style={[styles.section, { backgroundColor: theme.colors.surface }]}
        elevation={1}
      >
        <View style={styles.sectionHeader}>
          <Title style={[styles.sectionTitle, { color: theme.colors.primary }]}>
            Clinical Notes
          </Title>
        </View>
        <Divider style={{ backgroundColor: theme.colors.surfaceVariant }} />
        <View style={styles.sectionContent}>
          <Paragraph style={[styles.notesText, { color: theme.colors.onSurface }]}>
            {patient.notes}
          </Paragraph>
        </View>
      </Surface>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <Button
          mode="contained"
          onPress={handleEditPatient}
          style={styles.editButton}
          labelStyle={styles.buttonLabel}
        >
          Edit Patient
        </Button>
        <Button
          mode="outlined"
          onPress={handleDeletePatient}
          style={styles.deleteButton}
          labelStyle={[styles.deleteButtonLabel, { color: theme.colors.error }]}
        >
          Delete Patient
        </Button>
      </View>

      {/* Spacing for scrollable area */}
      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 24,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    marginTop: 8,
  },
  /* Header Section */
  headerSurface: {
    borderRadius: 8,
    marginBottom: 16,
    padding: 16,
  },
  headerContent: {
    gap: 12,
  },
  patientNameHeader: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  ageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ageLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  ageValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  /* Section Styles */
  section: {
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  sectionContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  /* Text Styles */
  diagnosisText: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
  },
  dateText: {
    fontSize: 15,
    fontWeight: '500',
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 22,
  },
  notesText: {
    fontSize: 14,
    lineHeight: 24,
    fontStyle: 'italic',
  },
  /* Action Buttons */
  actionContainer: {
    gap: 10,
    marginTop: 16,
  },
  editButton: {
    borderRadius: 8,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    borderRadius: 8,
  },
  deleteButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  /* Spacing */
  bottomSpacer: {
    height: 24,
  },
});
