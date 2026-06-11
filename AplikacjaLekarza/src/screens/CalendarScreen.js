import React, { useState, useCallback, useRef, useContext } from 'react';
import { StyleSheet, View, FlatList, ScrollView, Alert, Text, Pressable, Platform, PanResponder } from 'react-native';
import { ActivityIndicator, Modal, Portal, TextInput, Button, List } from 'react-native-paper';
import { Calendar, LocaleConfig } from 'react-native-calendars';

function buildDayMark(date, count, selectedDate, today, C) {
  const isSelected = date === selectedDate;
  const isToday = date === today;
  if (isSelected) return { customStyles: {
    container: { backgroundColor: C.accent, borderRadius: 10 },
    text: { color: '#fff', fontWeight: '700', fontSize: 15 },
  }};
  if (count >= 4) return { customStyles: {
    container: { backgroundColor: '#087C6A', borderRadius: 10 },
    text: { color: '#fff', fontWeight: '700' },
  }};
  if (count === 3) return { customStyles: {
    container: { backgroundColor: C.accent, borderRadius: 10, opacity: 0.85 },
    text: { color: '#fff', fontWeight: '600' },
  }};
  if (count === 2) return { customStyles: {
    container: { backgroundColor: '#38C4B8', borderRadius: 10 },
    text: { color: '#fff', fontWeight: '600' },
  }};
  if (count === 1) return { customStyles: {
    container: { backgroundColor: C.accentDim, borderRadius: 10 },
    text: { color: C.accent, fontWeight: '600' },
  }};
  if (isToday) return { customStyles: {
    container: { borderRadius: 10, borderWidth: 2, borderColor: C.accent },
    text: { color: C.accent, fontWeight: '700' },
  }};
  return { customStyles: { container: {}, text: {} } };
}
import { useRouter, useFocusEffect } from 'expo-router';
import Animated, {
  FadeInDown, FadeIn, ZoomIn,
  useSharedValue, useAnimatedStyle, withSpring, interpolate,
} from 'react-native-reanimated';
import { fetchVisitsByDate, fetchMarkedDates, addVisit, deleteVisit } from '../services/visitService';
import { fetchAllPatients } from '../services/patientService';
import { scheduleVisitReminder, cancelVisitReminder } from '../services/notificationService';
import { useAIContext } from '../context/AIContext';
import { AuthContext } from '../context/AuthContext';
import ScreenHeader from '../components/ScreenHeader';
import { useColors } from '../context/ThemeContext';

LocaleConfig.locales['pl'] = {
  monthNames: ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'],
  monthNamesShort: ['Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paź','Lis','Gru'],
  dayNames: ['Niedziela','Poniedziałek','Wtorek','Środa','Czwartek','Piątek','Sobota'],
  dayNamesShort: ['Nd','Pn','Wt','Śr','Cz','Pt','Sb'],
  today: 'Dzisiaj'
};
LocaleConfig.defaultLocale = 'pl';

const DAY_NAMES = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];

function formatDateDisplay(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAY_NAMES[date.getDay()]} ${d}.${String(m).padStart(2, '0')}.${y}`;
}

function getNextDates(from, count = 90) {
  const [y, m, d] = from.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  });
}

export default function CalendarScreen() {
  const C = useColors();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const router = useRouter();
  const { user } = useContext(AuthContext); // Get current user
  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();

  const [selectedDate, setSelectedDate] = useState(today);
  const [appointments, setAppointments] = useState([]);
  const [visitCounts, setVisitCounts] = useState({});
  const [loadingList, setLoadingList] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [debugInfo, setDebugInfo] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [newTime, setNewTime] = useState('');
  const [newReason, setNewReason] = useState('');
  const [savingVisit, setSavingVisit] = useState(false);
  const [patientPickerVisible, setPatientPickerVisible] = useState(false);
  const [timeModalVisible, setTimeModalVisible] = useState(false);
  const [pickerHour, setPickerHour] = useState(8);
  const [pickerMinute, setPickerMinute] = useState(0);
  const [newDate, setNewDate] = useState('');
  const [dateModalVisible, setDateModalVisible] = useState(false);

  const { setAIContext } = useAIContext();

  const calendarMarks = React.useMemo(() => {
    const marks = {};
    Object.entries(visitCounts).forEach(([date, count]) => {
      marks[date] = buildDayMark(date, count, selectedDate, today, C);
    });
    if (!marks[selectedDate]) marks[selectedDate] = buildDayMark(selectedDate, 0, selectedDate, today, C);
    if (!marks[today]) marks[today] = buildDayMark(today, 0, today, today, C);
    return marks;
  }, [visitCounts, selectedDate, C]);

  const calendarTheme = React.useMemo(() => ({
    calendarBackground: 'transparent',
    backgroundColor: 'transparent',
    dayTextColor: C.text,
    textDisabledColor: C.muted,
    textSectionTitleColor: C.muted,
    monthTextColor: C.text,
    arrowColor: C.accent,
    todayTextColor: '#fff',
    todayBackgroundColor: C.accent,
    selectedDayBackgroundColor: C.accent,
    selectedDayTextColor: '#fff',
    dotColor: C.accent,
    selectedDotColor: '#fff',
    textDayFontSize: 13,
    textMonthFontSize: 15,
    textMonthFontWeight: '700',
    textDayHeaderFontSize: 11,
    textDayHeaderFontWeight: '600',
  }), [C]);

  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        loadMarkedDates();
        loadAppointments(selectedDate);
        setAIContext({ screen: 'calendar', screenLabel: 'Kalendarz wizyt', selectedDate });
      }
    }, [user?.id])
  );

  const loadMarkedDates = async () => {
    try {
      if (!user?.id) return;
      const counts = await fetchMarkedDates(user.id); // Pass doctorId
      setVisitCounts(counts);
    } catch (e) {
      console.error(e);
    }
  };

  const loadAppointments = async (date) => {
    setLoadingList(true);
    setErrorMsg('');
    setDebugInfo(`Fetching for ${date}...`);
    try {
      if (!user?.id) {
        setAppointments([]);
        setDebugInfo('No user ID.');
        return;
      }
      const data = await fetchVisitsByDate(date, user.id); // Pass doctorId
      setDebugInfo(`Success. Date: ${date}. Fetched length: ${data ? data.length : 'undefined'}`);
      setAppointments(data);
    } catch (e) {
      console.error('loadAppointments error:', e);
      setErrorMsg(e.message || String(e));
      setDebugInfo(`Error for ${date}`);
      setAppointments([]);
    } finally {
      setLoadingList(false);
    }
  };

  const moveDay = useCallback((delta) => {
    setSelectedDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta);
      const next = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      loadAppointments(next);
      return next;
    });
  }, [user?.id]);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderRelease: (_, g) => {
      if (g.dx < -40) moveDay(1);
      else if (g.dx > 40) moveDay(-1);
    },
  })).current;

  const handleDayPress = (day) => {
    setSelectedDate(day.dateString);
    loadAppointments(day.dateString);
  };

  const handleStartVisit = (appt) => {
    router.push({
      pathname: '/visit-form',
      params: {
        visitId: appt.id,
        patientId: appt.patientId,
        patientName: appt.patientName,
        patientAge: appt.patientAge,
        patientPesel: appt.patientPesel,
        subjective: appt.soapSubjective || '',
        objective: appt.soapObjective || '',
        assessment: appt.soapAssessment || '',
        plan: appt.soapPlan || '',
      },
    });
  };

  const [visitToDelete, setVisitToDelete] = useState(null);

  const handleDeleteVisit = (appt) => {
    setVisitToDelete(appt);
  };

  const confirmDeleteVisit = async () => {
    if (!visitToDelete || !user?.id) return;
    try {
      setDebugInfo(`Confirming delete for: ${visitToDelete.id}`);
      await deleteVisit(visitToDelete.id, user.id);
      setDebugInfo(`Deleted ${visitToDelete.id}. Loading apps...`);
      loadAppointments(selectedDate);
      loadMarkedDates();
    } catch (e) {
      console.error(e);
      setDebugInfo(`Delete error: ${e.message}`);
      Alert.alert('Błąd', 'Nie udało się usunąć wizyty: ' + String(e.message || e));
    } finally {
      setVisitToDelete(null);
    }
  };

  const openAddModal = async () => {
    try {
      if (!user?.id) return;
      const data = await fetchAllPatients(user.id); // Pass doctorId
      setPatients(data);
    } catch (e) {
      Alert.alert('Błąd', 'Nie można załadować pacjentów.');
      return;
    }
    setSelectedPatient(null);
    setNewDate(selectedDate);
    setNewTime('08:00');
    setPickerHour(8);
    setPickerMinute(0);
    setNewReason('');
    setModalVisible(true);
  };

  const handleSaveVisit = async () => {
    if (!selectedPatient || !newDate || !newTime || !user?.id) {
      Alert.alert('Błąd', 'Wybierz pacjenta, datę i godzinę.');
      return;
    }
    if (newDate === selectedDate) {
      const conflict = appointments.find((a) => a.visitTime === newTime);
      if (conflict) {
        Alert.alert('Konflikt godzinowy', `O ${newTime} masz już wizytę z ${conflict.patientName}. Wybierz inną godzinę.`);
        return;
      }
    }
    setSavingVisit(true);
    try {
      const newVisit = await addVisit({
        patientId: selectedPatient.id,
        visitDate: newDate,
        visitTime: newTime,
        reason: newReason || 'Brak wpisu',
      }, user.id);
      if (newVisit?.id && newTime) {
        scheduleVisitReminder({
          visitId: newVisit.id,
          patientName: `${selectedPatient.firstName} ${selectedPatient.lastName}`,
          visitDate: newDate,
          visitTime: newTime,
          reason: newReason,
        });
      }
      setModalVisible(false);
      setSelectedDate(newDate);
      loadAppointments(newDate);
      loadMarkedDates();
    } catch (e) {
      Alert.alert('Błąd', 'Nie udało się zapisać wizyty.');
    } finally {
      setSavingVisit(false);
    }
  };

  const isToday = selectedDate === today;

  const ApptCard = ({ item, index }) => (
    <View style={styles.apptCard}>
      <View style={styles.apptTop}>
        <Text style={styles.apptTime} numberOfLines={1}>
          {item.visitTime} – <Text style={styles.apptName}>{item.patientName}</Text>
        </Text>
        <View style={styles.apptTopRight}>
          <Text style={styles.apptAge}>Wiek: {item.patientAge}</Text>
          <Pressable
            onPress={() => handleDeleteVisit(item)}
            style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.6 }]}
            hitSlop={8}
          >
            <Text style={styles.deleteBtnText}>✕</Text>
          </Pressable>
        </View>
      </View>
      {!!item.reason && <Text style={styles.apptReason}>{item.reason}</Text>}
      <View style={styles.apptBottom}>
        <Pressable
          onPress={() => handleStartVisit(item)}
          style={({ pressed }) => [
            styles.startBtn, 
            !isToday && { backgroundColor: C.dim }, 
            pressed && { opacity: 0.75 }
          ]}
        >
          <Text style={styles.startBtnText}>
            {isToday ? 'Rozpocznij wizytę' : 'Zobacz / Edytuj wizytę'}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  const renderAppointment = ({ item, index }) => (
    <ApptCard item={item} index={index} />
  );

  return (
    <View style={styles.container}>
      <ScreenHeader title="Kalendarz" />
      <Animated.View
        entering={FadeInDown.delay(60).springify().damping(18)}
        style={styles.calendarCard}
      >
        <Calendar
          key={C.bg}
          current={selectedDate}
          onDayPress={handleDayPress}
          markedDates={calendarMarks}
          markingType="custom"
          theme={calendarTheme}
          style={styles.calendar}
        />
      </Animated.View>

      <View style={styles.listContainer} {...panResponder.panHandlers}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>
            Wizyty ({selectedDate})
          </Text>
          <Pressable onPress={openAddModal} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ Dodaj</Text>
          </Pressable>
        </View>

        <Text style={{ fontSize: 10, color: 'red', textAlign: 'center', marginBottom: 5 }}>
          DEBUG: {debugInfo}
        </Text>

        {loadingList ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator animating color={C.accent} />
          </View>
        ) : appointments.length > 0 ? (
          <FlatList
            data={appointments}
            keyExtractor={(item) => item.id}
            renderItem={renderAppointment}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        ) : (
            <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.emptyWrap}>
              <Animated.View entering={ZoomIn.delay(200).springify()} style={styles.emptyIconWrap}>
                <Text style={styles.emptyIconText}>📅</Text>
              </Animated.View>
              <Text style={styles.emptyTitle}>Brak wizyt</Text>
              <Text style={styles.emptyText}>
                {errorMsg ? `Błąd pobierania: ${errorMsg}` : isToday ? 'Brak wizyt na dziś — naciśnij + Dodaj' : `Brak wizyt na ${selectedDate}`}
              </Text>
              <Text style={{ marginTop: 10, fontSize: 10, color: 'red', textAlign: 'center' }}>
                DEBUG: {debugInfo}
              </Text>
            </Animated.View>
        )}
      </View>

      <Portal>
        <Modal visible={modalVisible} onDismiss={() => setModalVisible(false)} contentContainerStyle={styles.modal}>
          <Text style={styles.modalTitle}>Dodaj wizytę</Text>
          <Pressable
            onPress={() => setPatientPickerVisible(true)}
            style={styles.patientPicker}
          >
            <Text style={[styles.patientPickerText, !selectedPatient && { color: C.dim }]}>
              {selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName}` : 'Wybierz pacjenta...'}
            </Text>
          </Pressable>
          {Platform.OS === 'web' ? (
            <View style={styles.webTimeWrap}>
              <Text style={styles.webTimeLabel}>Data</Text>
              {/* @ts-ignore */}
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                style={{
                  backgroundColor: '#0B1220',
                  color: '#E8F0F7',
                  border: '1px solid #1C2B40',
                  borderRadius: 8,
                  padding: '12px 14px',
                  fontSize: 15,
                  fontWeight: '600',
                  width: '100%',
                  outline: 'none',
                  cursor: 'pointer',
                  colorScheme: 'dark',
                  boxSizing: 'border-box',
                  marginTop: 4,
                }}
              />
            </View>
          ) : (
            <Pressable onPress={() => setDateModalVisible(true)} style={styles.patientPicker}>
              <Text style={[styles.patientPickerText, !newDate && { color: C.dim }]}>
                {newDate ? formatDateDisplay(newDate) : 'Wybierz datę...'}
              </Text>
            </Pressable>
          )}
          {Platform.OS === 'web' ? (
            <View style={styles.webTimeWrap}>
              <Text style={styles.webTimeLabel}>Godzina</Text>
              {/* @ts-ignore — web-only input element */}
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                style={{
                  backgroundColor: '#0B1220',
                  color: '#E8F0F7',
                  border: '1px solid #1C2B40',
                  borderRadius: 8,
                  padding: '12px 14px',
                  fontSize: 15,
                  fontWeight: '600',
                  width: '100%',
                  outline: 'none',
                  cursor: 'pointer',
                  colorScheme: 'dark',
                  boxSizing: 'border-box',
                  marginTop: 4,
                }}
              />
            </View>
          ) : (
            <Pressable onPress={() => setTimeModalVisible(true)} style={styles.patientPicker}>
              <Text style={[styles.patientPickerText, !newTime && { color: C.dim }]}>
                {newTime || 'Wybierz godzinę...'}
              </Text>
            </Pressable>
          )}
          <TextInput
            label="Powód wizyty"
            value={newReason}
            onChangeText={setNewReason}
            mode="outlined"
            style={styles.modalInput}
            theme={{ colors: { primary: C.accent, background: C.surface, onSurfaceVariant: C.muted, outline: C.border } }}
            textColor={C.text}
          />
          <Pressable
            onPress={handleSaveVisit}
            style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }]}
            disabled={savingVisit}
          >
            <Text style={styles.saveBtnText}>{savingVisit ? 'Zapisywanie...' : 'Zapisz wizytę'}</Text>
          </Pressable>
        </Modal>

        <Modal visible={patientPickerVisible} onDismiss={() => setPatientPickerVisible(false)} contentContainerStyle={styles.modal}>
          <Text style={styles.modalTitle}>Wybierz pacjenta</Text>
          <FlatList
            data={patients}
            keyExtractor={(item) => item.id}
            style={{ maxHeight: 380 }}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [styles.pickerRow, pressed && { opacity: 0.7 }]}
                onPress={() => { setSelectedPatient(item); setPatientPickerVisible(false); }}
              >
                <Text style={styles.pickerName}>{item.firstName} {item.lastName}</Text>
                <Text style={styles.pickerSub}>PESEL: {item.pesel || '—'}</Text>
              </Pressable>
            )}
          />
        </Modal>

        <Modal visible={timeModalVisible} onDismiss={() => setTimeModalVisible(false)} contentContainerStyle={styles.modal}>
          <Text style={styles.modalTitle}>Wybierz godzinę</Text>
          <View style={styles.timeColumns}>
            <View style={{ flex: 1 }}>
              <Text style={styles.timeColLabel}>Godz.</Text>
              <ScrollView style={styles.timeScroll} showsVerticalScrollIndicator={false}>
                {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                  <Pressable
                    key={h}
                    onPress={() => setPickerHour(h)}
                    style={[styles.timeItem, pickerHour === h && styles.timeItemSelected]}
                  >
                    <Text style={[styles.timeItemText, pickerHour === h && styles.timeItemTextSel]}>
                      {String(h).padStart(2, '0')}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            <Text style={styles.timeColon}>:</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.timeColLabel}>Min.</Text>
              <ScrollView style={styles.timeScroll} showsVerticalScrollIndicator={false}>
                {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                  <Pressable
                    key={m}
                    onPress={() => setPickerMinute(m)}
                    style={[styles.timeItem, pickerMinute === m && styles.timeItemSelected]}
                  >
                    <Text style={[styles.timeItemText, pickerMinute === m && styles.timeItemTextSel]}>
                      {String(m).padStart(2, '0')}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
          <Pressable
            onPress={() => {
              setNewTime(`${String(pickerHour).padStart(2, '0')}:${String(pickerMinute).padStart(2, '0')}`);
              setTimeModalVisible(false);
            }}
            style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.saveBtnText}>Potwierdź</Text>
          </Pressable>
        </Modal>

        <Modal visible={dateModalVisible} onDismiss={() => setDateModalVisible(false)} contentContainerStyle={styles.modal}>
          <Text style={styles.modalTitle}>Wybierz datę</Text>
          <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
            {getNextDates(today, 90).map((d) => (
              <Pressable
                key={d}
                onPress={() => { setNewDate(d); setDateModalVisible(false); }}
                style={[styles.pickerRow, newDate === d && { borderLeftWidth: 3, borderLeftColor: C.accent }]}
              >
                <Text style={[styles.pickerName, newDate === d && { color: C.accent }]}>
                  {formatDateDisplay(d)}
                </Text>
                <Text style={styles.pickerSub}>{d}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Modal>

        <Modal visible={!!visitToDelete} onDismiss={() => setVisitToDelete(null)} contentContainerStyle={styles.modal}>
          <Text style={styles.modalTitle}>Usuń wizytę</Text>
          <Text style={{ color: C.text, marginBottom: 20 }}>
            Czy na pewno chcesz usunąć wizytę pacjenta {visitToDelete?.patientName} (Godzina: {visitToDelete?.visitTime})?
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={() => setVisitToDelete(null)}
              style={({ pressed }) => [{ flex: 1, padding: 12, borderRadius: 10, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center' }, pressed && { opacity: 0.7 }]}
            >
              <Text style={{ color: C.text, fontWeight: '600' }}>Anuluj</Text>
            </Pressable>
            <Pressable
              onPress={confirmDeleteVisit}
              style={({ pressed }) => [{ flex: 1, padding: 12, borderRadius: 10, backgroundColor: C.errorBg, borderWidth: 1, borderColor: C.error, alignItems: 'center' }, pressed && { opacity: 0.7 }]}
            >
              <Text style={{ color: C.error, fontWeight: '700' }}>Usuń</Text>
            </Pressable>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

function makeStyles(C) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  calendarCard: {
    margin: 12,
    marginBottom: 4,
    borderRadius: 18,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderTopWidth: 2,
    borderTopColor: C.accent,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 8,
    overflow: 'hidden',
  },
  calendar: { borderRadius: 18 },
  listContainer: { flex: 1, paddingHorizontal: 14 },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  listTitle: { fontSize: 17, fontWeight: '700', color: C.text },
  listCount: { fontSize: 11, color: C.dim, marginTop: 2 },
  addBtn: {
    backgroundColor: C.surface,
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: C.border,
  },
  addBtnText: { fontSize: 13, color: C.accent, fontWeight: '600' },
  listContent: { paddingBottom: 20 },
  apptCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: C.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  apptTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  apptTopRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  apptTime: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
    flex: 1,
    flexShrink: 1,
  },
  apptName: { fontSize: 14, fontWeight: '700', color: C.text },
  apptAge: { fontSize: 12, color: C.muted },
  apptReason: { fontSize: 12, color: C.muted, fontStyle: 'italic', marginBottom: 10 },
  apptBottom: { alignItems: 'flex-end' },
  startBtn: {
    backgroundColor: C.accent,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 9,
    alignSelf: 'flex-end',
  },
  startBtnDisabled: { backgroundColor: C.border },
  startBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  startBtnTextDisabled: { color: C.dim },
  deleteBtn: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: C.errorBg,
    borderWidth: 1,
    borderColor: C.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { fontSize: 10, color: C.error, fontWeight: '700' },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 20, gap: 8 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  emptyIconText: { fontSize: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.muted },
  emptyText: { fontSize: 13, color: C.dim, textAlign: 'center', paddingHorizontal: 32 },
  modal: {
    backgroundColor: C.surface,
    margin: 18,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 16 },
  modalInput: { marginBottom: 10, backgroundColor: C.surface },
  patientPicker: {
    backgroundColor: C.bg,
    borderRadius: 10,
    padding: 13,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  patientPickerText: { fontSize: 14, color: C.text },
  saveBtn: {
    backgroundColor: C.accent,
    borderRadius: 12,
    padding: 13,
    alignItems: 'center',
    marginTop: 6,
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  pickerRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  pickerName: { fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 2 },
  pickerSub: { fontSize: 11, color: C.muted },
  webTimeWrap: { marginBottom: 10 },
  webTimeLabel: { fontSize: 12, color: C.muted, marginBottom: 4, fontWeight: '600' },
  timeColumns: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 16 },
  timeColLabel: { fontSize: 11, color: C.muted, fontWeight: '600', textAlign: 'center', marginBottom: 6, textTransform: 'uppercase' },
  timeScroll: { height: 200, borderWidth: 1, borderColor: C.border, borderRadius: 10, backgroundColor: C.bg },
  timeItem: { paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center' },
  timeItemSelected: { backgroundColor: C.accent, borderRadius: 8, marginHorizontal: 4 },
  timeItemText: { fontSize: 16, fontWeight: '600', color: C.muted },
  timeItemTextSel: { color: '#fff' },
  timeColon: { fontSize: 24, fontWeight: '700', color: C.text, alignSelf: 'center', marginTop: 28 },
}); }
