import { createContext, useContext } from 'react';

export const AuthContext = createContext({
  isAuthenticated: false,
  signIn: async () => {},
  signOut: async () => {}
});

export function useAuth() {
  return useContext(AuthContext);
}
