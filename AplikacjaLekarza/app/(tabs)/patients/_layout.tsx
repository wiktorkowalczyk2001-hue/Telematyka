import { Stack } from 'expo-router';

export default function PatientsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: 'Szczegóły Pacjenta' }} />
    </Stack>
  );
}
