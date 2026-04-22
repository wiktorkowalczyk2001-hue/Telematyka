import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PatientListScreen from '../screens/PatientListScreen';
import PatientDetailsScreen from '../screens/PatientDetailsScreen';

const Stack = createNativeStackNavigator();

/**
 * AppNavigator Component
 * Sets up the native stack navigation for the application
 */
const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: true,
          headerShadowVisible: false,
          cardStyle: { backgroundColor: '#fff' },
        }}
      >
        <Stack.Screen
          name="PatientList"
          component={PatientListScreen}
          options={{
            title: 'Patients',
            headerTitleStyle: {
              fontSize: 20,
              fontWeight: '600',
            },
          }}
        />
        <Stack.Screen
          name="PatientDetails"
          component={PatientDetailsScreen}
          options={({ route }) => ({
            title: `${route.params?.firstName} ${route.params?.lastName}`,
            headerTitleStyle: {
              fontSize: 18,
              fontWeight: '600',
            },
          })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
