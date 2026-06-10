import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { useAuth } from '@/src/context/AuthContext';

interface PendingDoctor {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  specialization: string;
  pwz_number: string;
  nip: string;
  clinic_name: string;
  created_at: string;
  status: string;
}

export default function AdminScreen() {
  const { user } = useAuth();
  const [pendingDoctors, setPendingDoctors] = useState<PendingDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Check if user is admin (you can add admin flag to users table later)
  const isAdmin = true; // For now, assume all logged-in users can see this

  useEffect(() => {
    fetchPendingDoctors();
  }, []);

  const fetchPendingDoctors = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://192.168.0.31:3001/users?status=eq.pending&order=created_at.asc');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setPendingDoctors(data);
    } catch (error) {
      console.error('Error fetching doctors:', error);
      Alert.alert('Błąd', 'Nie udało się pobrać listy lekarz');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleApprove = async (doctorId: string, doctorEmail: string) => {
    try {
      setProcessingId(doctorId);
      const response = await fetch(`http://192.168.0.31:3001/admin/approve-doctor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: doctorId, approved: true }),
      });

      if (!response.ok) throw new Error('Failed to approve');

      Alert.alert('Sukces', `Lekarz ${doctorEmail} został zatwierdzony`);
      fetchPendingDoctors();
    } catch (error) {
      console.error('Error approving doctor:', error);
      Alert.alert('Błąd', 'Nie udało się zatwierdzić lekarza');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (doctorId: string, doctorEmail: string) => {
    Alert.alert(
      'Odrzucić rejestrację?',
      `Czy na pewno chcesz odrzucić rejestrację lekarza ${doctorEmail}?`,
      [
        { text: 'Anuluj', onPress: () => {}, style: 'cancel' },
        {
          text: 'Odrzuć',
          onPress: async () => {
            try {
              setProcessingId(doctorId);
              const response = await fetch(`http://192.168.0.31:3001/admin/approve-doctor`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: doctorId, approved: false }),
              });

              if (!response.ok) throw new Error('Failed to reject');

              Alert.alert('Sukces', `Rejestracja lekarza ${doctorEmail} została odrzucona`);
              fetchPendingDoctors();
            } catch (error) {
              console.error('Error rejecting doctor:', error);
              Alert.alert('Błąd', 'Nie udało się odrzucić rejestracji');
            } finally {
              setProcessingId(null);
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPendingDoctors();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#2196f3" />
          <Text style={styles.loadingText}>Ładowanie oczekujących lekarzy...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>👨‍⚕️ Zarządzanie lekarzami</Text>
        <Text style={styles.subtitle}>Weryfikacja nowych rejestracji</Text>
      </View>

      {/* Status bar */}
      <View style={styles.statusBar}>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>Oczekujących:</Text>
          <Text style={styles.statusValue}>{pendingDoctors.length}</Text>
        </View>
      </View>

      {/* Doctors list */}
      {pendingDoctors.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>✓</Text>
          <Text style={styles.emptyTitle}>Brak oczekujących rejestracji</Text>
          <Text style={styles.emptyText}>Wszyscy lekarze zostali zweryfikowani</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.listContainer}
          refreshControl={{
            refreshing,
            onRefresh,
          }}
          scrollEventThrottle={16}
        >
          {pendingDoctors.map((doctor) => (
            <View key={doctor.id} style={styles.doctorCard}>
              {/* Doctor info */}
              <View style={styles.doctorHeader}>
                <View>
                  <Text style={styles.doctorName}>
                    dr. {doctor.first_name} {doctor.last_name}
                  </Text>
                  <Text style={styles.doctorEmail}>{doctor.email}</Text>
                </View>
                <View style={styles.registrationBadge}>
                  <Text style={styles.registrationDate}>
                    {new Date(doctor.created_at).toLocaleDateString('pl-PL')}
                  </Text>
                </View>
              </View>

              {/* Doctor details */}
              <View style={styles.detailsSection}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Specjalizacja:</Text>
                  <Text style={styles.detailValue}>{doctor.specialization}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Przychodnia:</Text>
                  <Text style={styles.detailValue}>{doctor.clinic_name}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>PWZ:</Text>
                  <Text style={styles.detailValue}>{doctor.pwz_number}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>NIP:</Text>
                  <Text style={styles.detailValue}>{doctor.nip}</Text>
                </View>
              </View>

              {/* Action buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.button, styles.rejectButton]}
                  onPress={() => handleReject(doctor.id, doctor.email)}
                  disabled={processingId === doctor.id}
                >
                  {processingId === doctor.id ? (
                    <ActivityIndicator size="small" color="#f44336" />
                  ) : (
                    <Text style={styles.rejectButtonText}>❌ Odrzuć</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.approveButton]}
                  onPress={() => handleApprove(doctor.id, doctor.email)}
                  disabled={processingId === doctor.id}
                >
                  {processingId === doctor.id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.approveButtonText}>✓ Zatwierdź</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  header: {
    backgroundColor: '#2196f3',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  statusBar: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    flexDirection: 'row',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  statusValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ff9800',
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
  doctorCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  doctorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  doctorName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  doctorEmail: {
    fontSize: 13,
    color: '#999',
  },
  registrationBadge: {
    backgroundColor: '#fff3cd',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  registrationDate: {
    fontSize: 12,
    color: '#ff9800',
    fontWeight: '600',
  },
  detailsSection: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 12,
    color: '#333',
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveButton: {
    backgroundColor: '#4caf50',
  },
  approveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  rejectButton: {
    backgroundColor: '#ffebee',
    borderWidth: 1,
    borderColor: '#f44336',
  },
  rejectButtonText: {
    color: '#f44336',
    fontSize: 14,
    fontWeight: '600',
  },
});
