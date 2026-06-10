import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';

export default function PendingApprovalScreen() {
  const router = useRouter();
  const { signOut, user } = useAuth();

  const handleLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>⏳ Konto oczekuje na potwierdzenie</Text>
      </View>

      {/* Icon */}
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>🔒</Text>
      </View>

      {/* Main message */}
      <View style={styles.messageBox}>
        <Text style={styles.messageTitle}>Witaj, dr. {user?.lastName}!</Text>
        <Text style={styles.messageText}>
          Twoja rejestracja w systemie Telemed została pomyślnie przyjęta.
        </Text>
        <Text style={styles.messageText}>
          Twoje konto czeka na potwierdzenie przez administratora systemu.
        </Text>
      </View>

      {/* Info section */}
      <View style={styles.infoSection}>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>📧 Email:</Text>
          <Text style={styles.infoValue}>{user?.email}</Text>
        </View>

        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>👤 Imię i nazwisko:</Text>
          <Text style={styles.infoValue}>{user?.firstName} {user?.lastName}</Text>
        </View>

        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>🏥 Specjalizacja:</Text>
          <Text style={styles.infoValue}>{user?.specialization}</Text>
        </View>

        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>🏢 Przychodnia:</Text>
          <Text style={styles.infoValue}>{user?.clinicName}</Text>
        </View>

        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>📋 Status:</Text>
          <Text style={[styles.infoValue, styles.pendingStatus]}>⏳ Oczekuje na potwierdzenie</Text>
        </View>
      </View>

      {/* Timeline */}
      <View style={styles.timelineSection}>
        <Text style={styles.timelineTitle}>Co się stanie dalej?</Text>
        
        <View style={styles.timelineItem}>
          <View style={styles.timelineDot}>
            <Text style={styles.checkmark}>✓</Text>
          </View>
          <View style={styles.timelineContent}>
            <Text style={styles.timelineStepTitle}>1. Oczekiwanie na weryfikację</Text>
            <Text style={styles.timelineStepText}>
              Administrator sprawdza Twoje dane (PWZ, NIP, przychodnia)
            </Text>
          </View>
        </View>

        <View style={styles.timelineConnector} />

        <View style={styles.timelineItem}>
          <View style={styles.timelineDot}>
            <Text style={styles.clock}>⏱</Text>
          </View>
          <View style={styles.timelineContent}>
            <Text style={styles.timelineStepTitle}>2. Potwierdzenie</Text>
            <Text style={styles.timelineStepText}>
              Po zatwierdzeniu otrzymasz dostęp do pełnej funkcjonalności
            </Text>
          </View>
        </View>

        <View style={styles.timelineConnector} />

        <View style={styles.timelineItem}>
          <View style={styles.timelineDot}>
            <Text style={styles.unlock}>🔓</Text>
          </View>
          <View style={styles.timelineContent}>
            <Text style={styles.timelineStepTitle}>3. Pełny dostęp</Text>
            <Text style={styles.timelineStepText}>
              Przeglądaj pacjentów, twórz wizyty i dokumentuj zabiegi
            </Text>
          </View>
        </View>
      </View>

      {/* Info box */}
      <View style={styles.infoBox}>
        <Text style={styles.infoBoxTitle}>ℹ️ Informacja</Text>
        <Text style={styles.infoBoxText}>
          Weryfikacja zwykle trwa od 1 do 24 godzin. Otrzymasz notyfikację po zatwierdzeniu konta.
        </Text>
        <Text style={styles.infoBoxText}>
          W razie pytań, skontaktuj się z działem wsparcia: support@telemed.pl
        </Text>
      </View>

      {/* Logout button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Wyloguj się</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  icon: {
    fontSize: 64,
  },
  messageBox: {
    backgroundColor: '#fff3cd',
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
    padding: 15,
    borderRadius: 8,
    marginBottom: 30,
  },
  messageTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  messageText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  infoSection: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 30,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  infoValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '600',
  },
  pendingStatus: {
    color: '#ff9800',
  },
  timelineSection: {
    marginBottom: 30,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  timelineDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e8f5e9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
    marginTop: 2,
  },
  checkmark: {
    fontSize: 20,
  },
  clock: {
    fontSize: 18,
  },
  unlock: {
    fontSize: 18,
  },
  timelineConnector: {
    position: 'absolute',
    left: 20,
    top: 40,
    width: 2,
    height: 30,
    backgroundColor: '#e0e0e0',
    zIndex: -1,
  },
  timelineContent: {
    flex: 1,
  },
  timelineStepTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  timelineStepText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  infoBox: {
    backgroundColor: '#e3f2fd',
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  infoBoxTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976d2',
    marginBottom: 8,
  },
  infoBoxText: {
    fontSize: 13,
    color: '#0d47a1',
    lineHeight: 18,
    marginBottom: 8,
  },
  logoutButton: {
    backgroundColor: '#757575',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
