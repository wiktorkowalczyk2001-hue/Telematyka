import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermissions() {
  if (Platform.OS === 'web') return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleVisitReminder({ visitId, patientName, visitDate, visitTime, reason }) {
  if (Platform.OS === 'web') return null;

  const [year, month, day] = visitDate.split('-').map(Number);
  const [hour, minute] = visitTime.split(':').map(Number);

  const visitDateTime = new Date(year, month - 1, day, hour, minute, 0);
  const reminderTime = new Date(visitDateTime.getTime() - 15 * 60 * 1000);

  if (reminderTime <= new Date()) return null;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: `Wizyta za 15 minut`,
      body: `${patientName} · ${visitTime} · ${reason || 'Brak opisu'}`,
      data: { visitId },
      sound: true,
    },
    trigger: { date: reminderTime },
  });

  return id;
}

export async function cancelVisitReminder(notificationId) {
  if (!notificationId || Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

export async function cancelAllVisitReminders() {
  if (Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}
