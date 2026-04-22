import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Searchbar, Card, Text, Avatar, useTheme, ActivityIndicator, FAB } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { fetchAllPatients, searchPatients } from '../services/patientService';
import { useFocusEffect } from '@react-navigation/native';

export default function PatientListScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const theme = useTheme();
  const router = useRouter();

  const loadPatients = async () => {
    try {
      setLoading(true);
      const data = await fetchAllPatients();
      setPatients(data);
    } catch (error) {
      console.error('Failed to load patients', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadPatients();
    }, [])
  );

  const handleSearch = async (query) => {
    setSearchQuery(query);
    try {
      if (query.trim() === '') {
        const data = await fetchAllPatients();
        setPatients(data);
      } else {
        const data = await searchPatients(query);
        setPatients(data);
      }
    } catch (error) {
      console.error('Search failed', error);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPatients();
  }, []);

  const getInitials = (firstName, lastName) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };

  const renderPatientItem = ({ item }) => (
    <Card 
      style={styles.card} 
      onPress={() => router.push(`/patients/${item.id}`)}
    >
      <Card.Title
        title={`${item.firstName} ${item.lastName}`}
        subtitle={`Wiek: ${item.age} | Diagnoza: ${item.diagnosis || 'Brak'}`}
        left={(props) => (
          <Avatar.Text 
            {...props} 
            label={getInitials(item.firstName, item.lastName)} 
            style={{ backgroundColor: theme.colors.primary }}
          />
        )}
      />
    </Card>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Searchbar
        placeholder="Szukaj pacjenta (imię lub nazwisko)..."
        onChangeText={handleSearch}
        value={searchQuery}
        style={styles.searchbar}
      />

      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : patients.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text variant="bodyLarge">Nie znaleziono pacjentów.</Text>
        </View>
      ) : (
        <FlatList
          data={patients}
          keyExtractor={(item) => item.id}
          renderItem={renderPatientItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
      
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color="white"
        onPress={() => router.push('/patient-edit')}
        label="Nowy Pacjent"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchbar: {
    margin: 16,
    elevation: 2,
    backgroundColor: '#fff',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  card: {
    marginBottom: 12,
    backgroundColor: '#fff',
    elevation: 2,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
});
