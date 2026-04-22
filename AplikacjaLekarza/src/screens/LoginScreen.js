import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, Button, Card, useTheme } from 'react-native-paper';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const theme = useTheme();
  const { signIn } = useAuth();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <IconSymbol name="cross.fill" size={60} color={theme.colors.primary} />
          <Text variant="headlineMedium" style={[styles.title, { color: theme.colors.primary }]}>
            Telematyka
          </Text>
          <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
            Panel Lekarza
          </Text>
        </View>

        <Card style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <Text variant="bodyLarge" style={styles.instruction}>
              Wybierz konto, aby rozpocząć pracę:
            </Text>
            
            <Button 
              mode="contained" 
              onPress={() => signIn()} 
              style={styles.button}
              contentStyle={styles.buttonContent}
              icon="doctor"
            >
              Zaloguj jako Lekarz
            </Button>
          </Card.Content>
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontWeight: 'bold',
    marginTop: 10,
  },
  card: {
    elevation: 4,
  },
  cardContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  instruction: {
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    width: '100%',
    borderRadius: 8,
  },
  buttonContent: {
    paddingVertical: 10,
  }
});
