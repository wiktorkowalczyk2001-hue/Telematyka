import React, { useState } from 'react';
import { StyleSheet, View, FlatList, Alert } from 'react-native';
import { Text, Card, Button, useTheme, Modal, Portal, TextInput } from 'react-native-paper';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useRouter } from 'expo-router';

// Konfiguracja języka polskiego
LocaleConfig.locales['pl'] = {
  monthNames: ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'],
  monthNamesShort: ['Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paź','Lis','Gru'],
  dayNames: ['Niedziela','Poniedziałek','Wtorek','Środa','Czwartek','Piątek','Sobota'],
  dayNamesShort: ['Nd','Pn','Wt','Śr','Cz','Pt','Sb'],
  today: 'Dzisiaj'
};
LocaleConfig.defaultLocale = 'pl';

const INITIAL_MOCK_APPOINTMENTS = {
  '2026-04-20': [
    { id: '1', time: '09:00', patientId: '1', patientName: 'Jan Kowalski', age: 45, reason: 'Wizyta kontrolna', pesel: '81042012345' },
  ],
  '2026-04-15': [
    { id: '2', time: '10:30', patientId: '2', patientName: 'Maria Nowak', age: 32, reason: 'Astma oskrzelowa', pesel: '94051512345' },
  ],
  '2026-04-10': [
    { id: '3', time: '12:00', patientId: '3', patientName: 'Piotr Wiśniewski', age: 58, reason: 'Cukrzyca typu 2', pesel: '68041012345' },
  ]
};

// Dodajemy dzisiejsze wizyty
const todayStr = new Date().toISOString().split('T')[0];
if (!INITIAL_MOCK_APPOINTMENTS[todayStr]) {
  INITIAL_MOCK_APPOINTMENTS[todayStr] = [];
}
INITIAL_MOCK_APPOINTMENTS[todayStr].push(
  { id: '4', time: '08:30', patientId: '1', patientName: 'Jan Kowalski', age: 45, reason: 'Pilna wizyta', pesel: '81042012345' },
  { id: '5', time: '11:00', patientId: '2', patientName: 'Maria Nowak', age: 32, reason: 'Recepta', pesel: '94051512345' }
);

export default function CalendarScreen() {
  const theme = useTheme();
  const router = useRouter();
  
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [appointmentsData, setAppointmentsData] = useState(INITIAL_MOCK_APPOINTMENTS);
  
  // Modal state
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newApptPatient, setNewApptPatient] = useState('');
  const [newApptTime, setNewApptTime] = useState('');
  const [newApptReason, setNewApptReason] = useState('');

  const appointments = appointmentsData[selectedDate] || [];

  const handleStartVisit = (appointment) => {
    if (selectedDate !== today) {
      Alert.alert('Niedozwolone', 'Możesz rozpocząć wizytę tylko z dzisiejszego dnia.');
      return;
    }

    router.push({
      pathname: '/visit-form',
      params: { 
        patientId: appointment.patientId,
        patientName: appointment.patientName,
        patientAge: appointment.age,
        patientPesel: appointment.pesel
      }
    });
  };

  const handleAddAppointment = () => {
    if (!newApptPatient || !newApptTime) {
      Alert.alert('Błąd', 'Wypełnij pacjenta i godzinę.');
      return;
    }

    const newData = { ...appointmentsData };
    if (!newData[selectedDate]) newData[selectedDate] = [];
    
    newData[selectedDate].push({
      id: Date.now().toString(),
      time: newApptTime,
      patientId: 'new',
      patientName: newApptPatient,
      age: 0,
      pesel: '00000000000',
      reason: newApptReason || 'Brak wpisu'
    });

    // Sortowanie po czasie
    newData[selectedDate].sort((a, b) => a.time.localeCompare(b.time));
    
    setAppointmentsData(newData);
    setIsModalVisible(false);
    setNewApptPatient('');
    setNewApptTime('');
    setNewApptReason('');
  };

  const renderAppointment = ({ item }) => {
    const isToday = selectedDate === today;
    
    return (
      <Card style={styles.appointmentCard}>
        <Card.Content>
          <View style={styles.appointmentHeader}>
            <Text variant="titleMedium" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
              {item.time} - {item.patientName}
            </Text>
            <Text variant="bodySmall">Wiek: {item.age}</Text>
          </View>
          <Text variant="bodyMedium" style={styles.reasonText}>{item.reason}</Text>
        </Card.Content>
        <Card.Actions>
          <Button 
            mode={isToday ? "contained" : "outlined"} 
            onPress={() => handleStartVisit(item)}
            buttonColor={isToday ? theme.colors.primary : undefined}
            disabled={!isToday}
          >
            {isToday ? "Rozpocznij wizytę" : "Tylko dla dzisiaj"}
          </Button>
        </Card.Actions>
      </Card>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Calendar
        current={today}
        onDayPress={day => setSelectedDate(day.dateString)}
        markedDates={{
          ...Object.keys(appointmentsData).reduce((acc, date) => {
            acc[date] = { marked: true, dotColor: theme.colors.primary };
            return acc;
          }, {}),
          [selectedDate]: { selected: true, disableTouchEvent: true, selectedDotColor: 'orange', selectedColor: theme.colors.primary }
        }}
        theme={{
          selectedDayBackgroundColor: theme.colors.primary,
          todayTextColor: theme.colors.primary,
          arrowColor: theme.colors.primary,
        }}
      />
      
      <View style={styles.listContainer}>
        <View style={styles.listHeaderRow}>
          <Text variant="titleLarge" style={styles.listTitle}>
            Wizyty ({selectedDate})
          </Text>
          <Button mode="text" onPress={() => setIsModalVisible(true)}>+ Dodaj</Button>
        </View>
        
        {appointments.length > 0 ? (
          <FlatList
            data={appointments}
            keyExtractor={(item) => item.id}
            renderItem={renderAppointment}
            contentContainerStyle={styles.flatListContent}
          />
        ) : (
          <Text style={styles.emptyText}>Brak zaplanowanych wizyt na ten dzień.</Text>
        )}
      </View>

      <Portal>
        <Modal visible={isModalVisible} onDismiss={() => setIsModalVisible(false)} contentContainerStyle={styles.modalContent}>
          <Text variant="titleLarge" style={{marginBottom: 16}}>Dodaj wizytę na {selectedDate}</Text>
          <TextInput label="Pacjent (Imię i Nazwisko)" value={newApptPatient} onChangeText={setNewApptPatient} mode="outlined" style={styles.modalInput} />
          <TextInput label="Godzina (np. 14:00)" value={newApptTime} onChangeText={setNewApptTime} mode="outlined" style={styles.modalInput} />
          <TextInput label="Powód wizyty" value={newApptReason} onChangeText={setNewApptReason} mode="outlined" style={styles.modalInput} />
          <Button mode="contained" onPress={handleAddAppointment} style={{marginTop: 10}}>Zapisz wizytę</Button>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContainer: { flex: 1, padding: 16 },
  listHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  listTitle: { fontWeight: 'bold' },
  appointmentCard: { marginBottom: 12, backgroundColor: '#fff' },
  appointmentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  reasonText: { fontStyle: 'italic', color: '#555' },
  emptyText: { textAlign: 'center', marginTop: 20, color: '#888' },
  flatListContent: { paddingBottom: 20 },
  modalContent: { backgroundColor: 'white', padding: 20, margin: 20, borderRadius: 8 },
  modalInput: { marginBottom: 10, backgroundColor: 'white' }
});
