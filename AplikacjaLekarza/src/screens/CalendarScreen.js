import React, { useState, useCallback, useRef, useContext } from 'react';
import { StyleSheet, View, FlatList, Alert, Text, Pressable, Platform, PanResponder } from 'react-native';
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

  const [modalVisible, setModalVisible] = useState(false);
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [newTime, setNewTime] = useState('');
  const [newReason, setNewReason] = useState('');
  const [savingVisit, setSavingVisit] = useState(false);
  const [patientPickerVisible, setPatientPickerVisible] = useState(false);

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
    try {
      if (!user?.id) {
        setAppointments([]);
        return;
      }
      const data = await fetchVisitsByDate(date, user.id); // Pass doctorId
      setAppointments(data);
    } catch (e) {
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
    if (selectedDate !== today) {
      Alert.alert('Niedozwolone', 'Możesz rozpocząć wizytę tylko z dzisiejszego dnia.');
      return;
    }
    router.push({
      pathname: '/visit-form',
      params: {
        visitId: appt.id,
        patientId: appt.patientId,
        patientName: appt.patientName,
        patientAge: appt.patientAge,
        patientPesel: appt.patientPesel,
      },
    });
  };

  const handleDeleteVisit = (appt) => {
    Alert.alert(
      'Usuń wizytę',
      `Usunąć wizytę ${appt.visitTime} – ${appt.patientName}?`,
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Usuń',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!user?.id) return;
              await deleteVisit(appt.id, user.id); // Pass doctorId
              loadAppointments(selectedDate);
              loadMarkedDates();
            } catch (e) {
              Alert.alert('Błąd', 'Nie udało się usunąć wizyty.');
            }
          },
        },
      ]
    );
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
    setNewTime('');
    setNewReason('');
    setModalVisible(true);
  };

  const handleSaveVisit = async () => {
    if (!selectedPatient || !newTime || !user?.id) {
      Alert.alert('Błąd', 'Wybierz pacjenta i podaj godzinę.');
      return;
    }
    const conflict = appointments.find((a) => a.visitTime === newTime);
    if (conflict) {
      Alert.alert('Konflikt godzinowy', `O ${newTime} masz już wizytę z ${conflict.patientName}. Wybierz inną godzinę.`);
      return;
    }
    setSavingVisit(true);
    try {
      const newVisit = await addVisit({
        patientId: selectedPatient.id,
        visitDate: selectedDate,
        visitTime: newTime,
        reason: newReason || 'Brak wpisu',
      }, user.id); // Pass doctorId
      if (newVisit?.id && newTime) {
        scheduleVisitReminder({
          visitId: newVisit.id,
          patientName: `${selectedPatient.firstName} ${selectedPatient.lastName}`,
          visitDate: selectedDate,
          visitTime: newTime,
          reason: newReason,
        });
      }
      setModalVisible(false);
      loadAppointments(selectedDate);
      loadMarkedDates();
    } catch (e) {
      Alert.alert('Błąd', 'Nie udało się zapisać wizyty.');
    } finally {
      setSavingVisit(false);
    }
  };

  const isToday = selectedDate === today;

  const ApptCard = ({ item, index }) => {
    const p = useSharedValue(0);
    const anim = useAnimatedStyle(() => ({
      transform: [{ scale: interpolate(p.value, [0, 1], [1, 0.97]) }],
    }));
    return (
      <Animated.View entering={FadeInDown.delay(index * 60).springify().damping(16).stiffness(120)}>
        <Pressable
          onPressIn={() => { p.value = withSpring(1, { damping: 14 }); }}
          onPressOut={() => { p.value = withSpring(0, { damping: 14 }); }}
        >
          <Animated.View style={[styles.apptCard, anim]}>
            <View style={styles.apptTop}>
              <Text style={styles.apptTime}>{item.visitTime} – <Text style={styles.apptName}>{item.patientName}</Text></Text>
              <View style={styles.apptTopRight}>
                <Text style={styles.apptAge}>Wiek: {item.patientAge}</Text>
                <Pressable onPress={() => handleDeleteVisit(item)} style={styles.deleteBtn}>
                  <Text style={styles.deleteBtnText}>✕</Text>
                </Pressable>
              </View>
            </View>
            {!!item.reason && <Text style={styles.apptReason}>{item.reason}</Text>}
            <View style={styles.apptBottom}>
              <Pressable
                onPress={() => handleStartVisit(item)}
                style={({ pressed }) => [styles.startBtn, !isToday && styles.startBtnDisabled, pressed && { opacity: 0.75 }]}
                disabled={!isToday}
              >
                <Text style={[styles.startBtnText, !isToday && styles.startBtnTextDisabled]}>
                  {isToday ? 'Rozpocznij wizytę' : 'Nie dzisiaj'}
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </Pressable>
      </Animated.View>
    );
  };

  const renderAppointment = ({ item, index }) => (
    <ApptCard item={item} index={index} />
  );

  return (
    <View style={styles.container}>
      <ScreenHeader title="Kalendarz" />
      <Animated.View
        entering={FadeInDown.delay(60).springify().damping(18)}
        style={styles.calendarCard}
        {...panResponder.panHandlers}
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

      <View style={styles.listContainer}>
        <View style={styles.listHeader}>
          <View>
            <Text style={styles.listTitle}>
              {isToday ? 'Dzisiaj' : selectedDate}
            </Text>
            {appointments.length > 0 && (
              <Text style={styles.listCount}>{appointments.length} wizyt{appointments.length === 1 ? 'a' : 'y'}</Text>
            )}
          </View>
          <Pressable onPress={openAddModal} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ Dodaj</Text>
          </Pressable>
        </View>

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
              {isToday ? 'Brak wizyt na dziś — naciśnij + Dodaj' : `Brak wizyt na ${selectedDate}`}
            </Text>
          </Animated.View>
        )}
      </View>

      <Portal>
        <Modal visible={modalVisible} onDismiss={() => setModalVisible(false)} contentContainerStyle={styles.modal}>
          <Text style={styles.modalTitle}>Dodaj wizytę · {selectedDate}</Text>
          <Pressable
            onPress={() => setPatientPickerVisible(true)}
            style={styles.patientPicker}
          >
            <Text style={[styles.patientPickerText, !selectedPatient && { color: C.dim }]}>
              {selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName}` : 'Wybierz pacjenta...'}
            </Text>
          </Pressable>
          <TextInput
            label="Godzina (np. 14:00)"
            value={newTime}
            onChangeText={setNewTime}
            mode="outlined"
            style={styles.modalInput}
            theme={{ colors: { primary: C.accent, background: C.surface, onSurfaceVariant: C.muted, outline: C.border } }}
            textColor={C.text}
          />
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
}); }
