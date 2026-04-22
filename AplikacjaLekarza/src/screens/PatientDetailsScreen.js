import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  Surface,
  Text,
  Title,
  Paragraph,
  Divider,
  Button,
} from 'react-native-paper';
import { getPatientById } from '../services/mockDatabase';

/**
 * PatientDetailsScreen Component
 * Displays detailed medical information for a selected patient
 */
const PatientDetailsScreen = ({ route }) => {
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch patient data based on route parameter
    const patientId = route.params?.patientId;
    if (patientId) {
      const patientData = getPatientById(patientId);
      setPatient(patientData);
    }
    setLoading(false);
  }, [route.params?.patientId]);

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

  if (loading || !patient) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading patient data...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Patient Header Section */}
      <Surface style={styles.headerSurface} elevation={1}>
        <View style={styles.headerContent}>
          <Title style={styles.patientNameHeader}>
            {patient.firstName} {patient.lastName}
          </Title>
          <View style={styles.ageRow}>
            <Text style={styles.ageLabel}>Age:</Text>
            <Text style={styles.ageValue}>{patient.age} years</Text>
          </View>
        </View>
      </Surface>

      {/* Primary Diagnosis Section */}
      <Surface style={styles.section} elevation={1}>
        <View style={styles.sectionHeader}>
          <Title style={styles.sectionTitle}>Primary Diagnosis</Title>
        </View>
        <Divider style={styles.divider} />
        <View style={styles.sectionContent}>
          <Text style={styles.diagnosisText}>{patient.diagnosis}</Text>
        </View>
      </Surface>

      {/* Last Visit Section */}
      <Surface style={styles.section} elevation={1}>
        <View style={styles.sectionHeader}>
          <Title style={styles.sectionTitle}>Last Visit</Title>
        </View>
        <Divider style={styles.divider} />
        <View style={styles.sectionContent}>
          <Text style={styles.dateText}>
            {formatDate(patient.lastVisitDate)}
          </Text>
        </View>
      </Surface>

      {/* Medical History Section */}
      <Surface style={styles.section} elevation={1}>
        <View style={styles.sectionHeader}>
          <Title style={styles.sectionTitle}>Medical History</Title>
        </View>
        <Divider style={styles.divider} />
        <View style={styles.sectionContent}>
          <Paragraph style={styles.bodyText}>
            {patient.medicalHistory}
          </Paragraph>
        </View>
      </Surface>

      {/* Current Medications Section */}
      <Surface style={styles.section} elevation={1}>
        <View style={styles.sectionHeader}>
          <Title style={styles.sectionTitle}>Current Medications</Title>
        </View>
        <Divider style={styles.divider} />
        <View style={styles.sectionContent}>
          <Paragraph style={styles.bodyText}>
            {patient.currentMedications}
          </Paragraph>
        </View>
      </Surface>

      {/* Clinical Notes Section */}
      <Surface style={styles.section} elevation={1}>
        <View style={styles.sectionHeader}>
          <Title style={styles.sectionTitle}>Clinical Notes</Title>
        </View>
        <Divider style={styles.divider} />
        <View style={styles.sectionContent}>
          <Paragraph style={styles.notesText}>{patient.notes}</Paragraph>
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
          labelStyle={styles.deleteButtonLabel}
        >
          Delete Patient
        </Button>
      </View>

      {/* Spacing for scrollable area */}
      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 24,
  },
  loadingText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 24,
    color: '#666',
  },
  /* Header Section */
  headerSurface: {
    borderRadius: 8,
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#E3F2FD',
  },
  headerContent: {
    gap: 12,
  },
  patientNameHeader: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1565C0',
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
    color: '#555',
  },
  ageValue: {
    fontSize: 14,
    color: '#333',
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
    color: '#1565C0',
  },
  divider: {
    marginTop: 8,
  },
  sectionContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  /* Text Styles */
  diagnosisText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#D32F2F',
    lineHeight: 24,
  },
  dateText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  bodyText: {
    fontSize: 14,
    color: '#444',
    lineHeight: 22,
  },
  notesText: {
    fontSize: 14,
    color: '#555',
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
    borderColor: '#D32F2F',
  },
  deleteButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#D32F2F',
  },
  /* Spacing */
  bottomSpacer: {
    height: 24,
  },
});

export default PatientDetailsScreen;
