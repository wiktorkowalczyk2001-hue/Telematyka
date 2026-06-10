import React from 'react';
import { Stack, useLocalSearchParams } from 'expo-router';
import PatientEditScreen from '../src/screens/PatientEditScreen';

export default function PatientEditRoute() {
  const params = useLocalSearchParams();
  const isEdit = !!params.patientId;

  return (
    <>
      <Stack.Screen options={{ title: isEdit ? 'Edytuj pacjenta' : 'Nowy pacjent' }} />
      <PatientEditScreen />
    </>
  );
}
