import { createContext, useContext } from 'react';

interface AuthState {
  authenticated: boolean;
  ready: boolean;
  walletAddress: string | null;
  userId: string | null;
  email: string | null;
  login: () => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthState>({
  authenticated: false,
  ready: false,
  walletAddress: null,
  userId: null,
  email: null,
  login: () => {},
  logout: () => {},
});

export function useAuthContext() {
  return useContext(AuthContext);
}
