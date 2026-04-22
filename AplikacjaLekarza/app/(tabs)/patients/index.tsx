import React, { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { FAB, Card, Text, Title, Paragraph, Chip, useTheme, ActivityIndicator, IconButton } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { fetchAllPatients } from '@/src/services/patientService';

/**
 * PatientListScreen Component
 * Displays a list of patients with ability to view details or add new patient
 */
export default function PatientListScreen() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();
  const theme = useTheme();

  // Load patients on mount and when screen is focused
  useEffect(() => {
    loadPatients();
  }, []);

  /**
   * Load patients from Supabase
   */
  const loadPatients = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAllPatients();
      setPatients(data);
    } catch (err) {
      console.error('Error loading patients:', err);
      setError(err.message || 'Failed to load patients');
      setPatients([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle patient card press - navigate to details screen
   */
  const handlePatientPress = (patient) => {
    router.push(`/patients/${patient.id}`);
  };

  /**
   * Handle FAB press - navigate to add new patient screen
   */
  const handleAddPatient = () => {
    // TODO: Implement add patient screen
    alert('Add Patient functionality will be implemented');
  };

  /**
   * Render individual patient card
   */
  const renderPatientCard = ({ item }) => {
    const formatDate = (dateString) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('pl-PL');
    };

    return (
      <Card
        style={[styles.card, { backgroundColor: theme.colors.surface }]}
        onPress={() => handlePatientPress(item)}
      >
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.patientInfo}>
              <Title style={[styles.patientName, { color: theme.colors.primary }]}>
                {item.firstName} {item.lastName}
              </Title>
              <Paragraph style={[styles.secondaryText, { color: theme.colors.onSurface }]}>
                {item.age} years old
              </Paragraph>
            </View>
            <Chip
              style={[styles.diagnosisChip, { backgroundColor: theme.colors.surfaceVariant }]}
              textStyle={{ fontSize: 12 }}
              label={item.diagnosis}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.surfaceVariant }]} />

          <View style={styles.cardDetails}>
            <View style={styles.detailRow}>
              <Text style={[styles.label, { color: theme.colors.primary }]}>Diagnosis:</Text>
              <Text style={[styles.value, { color: theme.colors.onSurface }]}>{item.diagnosis}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.label, { color: theme.colors.primary }]}>Last Visit:</Text>
              <Text style={[styles.value, { color: theme.colors.onSurface }]}>
                {formatDate(item.lastVisitDate)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.label, { color: theme.colors.primary }]}>Notes:</Text>
              <Paragraph
                numberOfLines={2}
                style={[styles.notesPreview, { color: theme.colors.onSurface }]}
              >
                {item.notes}
              </Paragraph>
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  /**
   * Render loading state
   */
  const renderLoadingState = () => (
    <View style={styles.centerContainer}>
      <ActivityIndicator animating={true} size="large" color={theme.colors.primary} />
      <Text style={[styles.loadingText, { color: theme.colors.onSurface, marginTop: 12 }]}>
        Loading patients...
      </Text>
    </View>
  );

  /**
   * Render error state
   */
  const renderErrorState = () => (
    <View style={styles.centerContainer}>
      <Text style={[styles.errorText, { color: theme.colors.error }]}>Error</Text>
      <Paragraph style={[styles.errorMessage, { color: theme.colors.onSurface }]}>
        {error}
      </Paragraph>
      <IconButton
        icon="reload"
        onPress={loadPatients}
        size={32}
      />
    </View>
  );

  /**
   * Render empty list state
   */
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyText, { color: theme.colors.onSurface }]}>No patients found</Text>
      <Paragraph style={[styles.emptySubtext, { color: theme.colors.onSurface }]}>
        Tap the + button to add a new patient
      </Paragraph>
    </View>
  );

  if (loading && patients.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {renderLoadingState()}
      </View>
    );
  }

  if (error && patients.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {renderErrorState()}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={patients}
        keyExtractor={(item) => item.id}
        renderItem={renderPatientCard}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        scrollEnabled={true}
        refreshing={loading}
        onEndReachedThreshold={0.1}
      />
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={handleAddPatient}
        label="Add Patient"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexGrow: 1,
  },
  card: {
    marginBottom: 12,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  patientInfo: {
    flex: 1,
    marginRight: 12,
  },
  patientName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  secondaryText: {
    fontSize: 13,
  },
  diagnosisChip: {
  },
  divider: {
    height: 1,
    marginBottom: 12,
  },
  cardDetails: {
    gap: 8,
  },
  detailRow: {
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  value: {
    fontSize: 13,
  },
  notesPreview: {
    fontSize: 12,
    lineHeight: 18,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
});
