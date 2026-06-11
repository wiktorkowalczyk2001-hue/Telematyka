import { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const getApiUrl = () =>
  Platform.OS === 'web' ? '/api' : 'http://192.168.0.31:3001';

// Map PostgREST snake_case → camelCase
function mapUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    firstName: u.first_name,
    lastName: u.last_name,
    specialization: u.specialization,
    pwzNumber: u.pwz_number,
    nip: u.nip,
    clinicName: u.clinic_name,
    status: u.status,
    createdAt: u.created_at,
    role: u.role,
  };
}

export const AuthContext = createContext({
  isAuthenticated: false,
  user: null,
  userStatus: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
  refreshUserStatus: async () => {},
});

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [userStatus, setUserStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    bootstrapAsync();
  }, []);

  const bootstrapAsync = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('user');
      const storedEmail = await AsyncStorage.getItem('userEmail');
      if (storedUser && storedEmail) {
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
        setIsAuthenticated(true);
        await refreshUserStatus(storedEmail);
      }
    } catch (e) {
      console.error('[Auth] bootstrap error:', e);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email, password) => {
    // Use server-side bcrypt verification via /auth/login
    const loginUrl = Platform.OS === 'web' ? '/auth/login' : 'http://192.168.0.31:4000/auth/login';
    const res = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Błąd logowania.');

    const raw = data.user;
    const mapped = mapUser(raw);
    setUser(mapped);
    setUserStatus(raw.status);
    setIsAuthenticated(true);
    await AsyncStorage.setItem('user', JSON.stringify(mapped));
    await AsyncStorage.setItem('userEmail', email);
    return { success: true, status: raw.status };
  };

  const signOut = async () => {
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('userEmail');
    setUser(null);
    setUserStatus(null);
    setIsAuthenticated(false);
  };

  const refreshUserStatus = async (email) => {
    try {
      const API_URL = getApiUrl();
      const res = await fetch(`${API_URL}/users?email=eq.${encodeURIComponent(email)}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) return null;
      const users = await res.json();
      if (!users.length) return null;
      const mapped = mapUser(users[0]);
      setUser(mapped);
      setUserStatus(users[0].status);
      await AsyncStorage.setItem('user', JSON.stringify(mapped));
      return users[0].status;
    } catch (e) {
      console.error('[Auth] refreshUserStatus error:', e);
      return null;
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, userStatus, loading, signIn, signOut, refreshUserStatus }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
