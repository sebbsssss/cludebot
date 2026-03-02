import { useCallback, useEffect, useMemo } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { api } from '../lib/api';

interface AuthState {
  authenticated: boolean;
  ready: boolean;
  walletAddress: string | null;
  userId: string | null;
  email: string | null;
  login: () => void;
  logout: () => void;
}

export function useAuth(): AuthState {
  const { ready, authenticated, login, logout, user, getAccessToken } = usePrivy();
  const { wallets } = useWallets();

  // Extract wallet address from connected wallets (prefer Solana)
  const walletAddress = useMemo(() => {
    if (!wallets || wallets.length === 0) return null;
    // Prefer Solana wallet
    const solanaWallet = wallets.find(w => w.walletClientType === 'solana' || w.chainType === 'solana');
    if (solanaWallet) return solanaWallet.address;
    // Fall back to first wallet
    return wallets[0]?.address || null;
  }, [wallets]);

  const email = useMemo(() => {
    return user?.email?.address || null;
  }, [user]);

  // Set Privy access token on the API client when authenticated
  useEffect(() => {
    if (authenticated) {
      getAccessToken().then(token => {
        if (token) api.setToken(token);
      });
    }
  }, [authenticated, getAccessToken]);

  const handleLogin = useCallback(() => {
    login();
  }, [login]);

  const handleLogout = useCallback(() => {
    api.setToken('');
    logout();
  }, [logout]);

  return {
    authenticated,
    ready,
    walletAddress,
    userId: user?.id || null,
    email,
    login: handleLogin,
    logout: handleLogout,
  };
}
