import { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://192.168.0.31:3001';

export const AuthContext = createContext({
  isAuthenticated: false,
  user: null,
  userStatus: null, // 'pending', 'approved', 'rejected'
  signIn: async () => {},
  signOut: async () => {},
  refreshUserStatus: async () => {},
});

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [userStatus, setUserStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  // Try to restore auth state on app launch
  useEffect(() => {
    bootstrapAsync();
  }, []);

  const bootstrapAsync = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('user');
      const storedEmail = await AsyncStorage.getItem('userEmail');

      if (storedUser && storedEmail) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setIsAuthenticated(true);
        
        // Check current status in DB
        await refreshUserStatus(storedEmail);
      }
    } catch (error) {
      console.error('Error bootstrapping auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email, password) => {
    try {
      // Query users table to find user
      const response = await fetch(`${API_URL}/users?email=eq.${encodeURIComponent(email)}`, {
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error('Invalid credentials');

      const users = await response.json();
      if (users.length === 0) throw new Error('User not found');

      const userData = users[0];

      // In production, verify password with bcrypt on backend
      // For MVP, just check email exists
      if (userData.status === 'rejected') {
        throw new Error('Account rejected. Please contact support.');
      }

      setUser(userData);
      setUserStatus(userData.status);
      setIsAuthenticated(true);

      // Store in AsyncStorage
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      await AsyncStorage.setItem('userEmail', email);

      return { success: true, status: userData.status };
    } catch (error) {
      setIsAuthenticated(false);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('userEmail');
      setUser(null);
      setUserStatus(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const refreshUserStatus = async (email) => {
    try {
      const response = await fetch(`${API_URL}/users?email=eq.${encodeURIComponent(email)}`, {
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const users = await response.json();
        if (users.length > 0) {
          const userData = users[0];
          setUser(userData);
          setUserStatus(userData.status);
          
          // Update stored user
          await AsyncStorage.setItem('user', JSON.stringify(userData));
          
          return userData.status;
        }
      }
    } catch (error) {
      console.error('Error refreshing user status:', error);
    }
    return null;
  };

  const value = {
    isAuthenticated,
    user,
    userStatus,
    loading,
    signIn,
    signOut,
    refreshUserStatus,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
