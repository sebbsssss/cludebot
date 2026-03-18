import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useSolanaWallets } from '@privy-io/react-auth/solana';
import { api } from '../lib/api';
import type { AuthState, AuthMode } from './AuthContext';

export function useAuth(): AuthState {
  const { ready, authenticated: privyAuth, login, logout, user, getAccessToken } = usePrivy();
  const { wallets: solanaWallets } = useSolanaWallets();
  const [cortexAuth, setCortexAuth] = useState(false);
  const [cortexReady, setCortexReady] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>(null);
  const [tokenReady, setTokenReady] = useState(false);

  // Ref to prevent emitRefresh from firing more than once per auth session
  const hasRefreshed = useRef(false);
  // Ref to hold getAccessToken so the effect doesn't re-fire on every render
  const getAccessTokenRef = useRef(getAccessToken);
  getAccessTokenRef.current = getAccessToken;

  // Extract Solana wallet address from useSolanaWallets (not useWallets which returns EVM)
  const walletAddress = useMemo(() => {
    if (!solanaWallets || solanaWallets.length === 0) return null;
    console.log('[useAuth] solana wallets:', solanaWallets.map(w => ({
      address: w.address?.slice(0, 8) + '...',
      type: (w as any).walletClientType || (w as any).type,
    })));
    return solanaWallets[0]?.address || null;
  }, [solanaWallets]);

  const email = useMemo(() => {
    return user?.email?.address || null;
  }, [user]);

  // On mount: check localStorage for saved cortex API key
  useEffect(() => {
    const savedKey = localStorage.getItem('cortex_api_key');
    const savedEndpoint = localStorage.getItem('cortex_endpoint');
    if (savedKey) {
      api.setToken(savedKey);
      if (savedEndpoint) api.setAgentEndpoint(savedEndpoint);
      api.setMode('cortex');
      api.validateApiKey().then(valid => {
        if (valid) {
          setCortexAuth(true);
          setAuthMode('cortex');
          setTokenReady(true);
          if (!hasRefreshed.current) {
            hasRefreshed.current = true;
            api.emitRefresh();
          }
        } else {
          localStorage.removeItem('cortex_api_key');
          localStorage.removeItem('cortex_endpoint');
          api.setMode('legacy');
        }
        setCortexReady(true);
      });
    } else {
      setCortexReady(true);
    }
  }, []);

  // Privy auth: set token, but DON'T refresh until wallet is available
  useEffect(() => {
    if (privyAuth && !cortexAuth && !tokenReady) {
      setAuthMode('privy');
      api.setMode('legacy');
      getAccessTokenRef.current().then(token => {
        if (token) {
          api.setToken(token);
          api.setWalletAddress(walletAddress);
          setTokenReady(true);
          // Only refresh if wallet is already available; otherwise wait for wallet effect
          if (walletAddress && !hasRefreshed.current) {
            hasRefreshed.current = true;
            api.emitRefresh();
          }
        }
      });
    }
  }, [privyAuth, cortexAuth, tokenReady, walletAddress]);

  // Update wallet on API when it changes (Privy wallets load async)
  // This is the primary refresh trigger — fires once wallet address is resolved
  useEffect(() => {
    if (authMode === 'privy' && walletAddress) {
      api.setWalletAddress(walletAddress);
      // Always re-fetch when wallet becomes available (even if hasRefreshed was set)
      if (tokenReady) {
        hasRefreshed.current = true;
        api.emitRefresh();
      }
    }
  }, [walletAddress, authMode, tokenReady]);

  const loginWithApiKey = useCallback(async (apiKey: string, endpoint?: string): Promise<boolean> => {
    // Clear any existing Privy wallet state when switching to cortex
    api.setWalletAddress(null);
    api.setToken(apiKey);
    if (endpoint) api.setAgentEndpoint(endpoint);
    api.setMode('cortex');
    const valid = await api.validateApiKey();
    if (valid) {
      localStorage.setItem('cortex_api_key', apiKey);
      if (endpoint) localStorage.setItem('cortex_endpoint', endpoint);
      setCortexAuth(true);
      setAuthMode('cortex');
      setTokenReady(true);
      hasRefreshed.current = false;
      // Disconnect Privy if it was active
      if (privyAuth) {
        try { logout(); } catch {}
      }
      hasRefreshed.current = true;
      api.emitRefresh();
    } else {
      api.setMode('legacy');
    }
    return valid;
  }, [privyAuth, logout]);

  const handleLogin = useCallback(() => {
    login();
  }, [login]);

  const handleLogout = useCallback(() => {
    // Clear ALL state regardless of mode
    setTokenReady(false);
    hasRefreshed.current = false;
    setCortexAuth(false);
    setAuthMode(null);
    api.setWalletAddress(null);
    api.setToken('');
    api.setMode('legacy');
    api.setAgentEndpoint(import.meta.env.VITE_API_BASE || '');
    localStorage.removeItem('cortex_api_key');
    localStorage.removeItem('cortex_endpoint');
    // Logout Privy session if active
    if (privyAuth) {
      logout();
    }
    api.emitRefresh();
  }, [privyAuth, logout]);

  const isAuthenticated = privyAuth || cortexAuth;

  return {
    authenticated: isAuthenticated,
    // Ready when: (1) not authenticated and Privy+cortex init done, or (2) authenticated and token is set
    ready: isAuthenticated ? (tokenReady && cortexReady) : (ready && cortexReady),
    walletAddress,
    userId: user?.id || null,
    email,
    authMode,
    login: handleLogin,
    logout: handleLogout,
    loginWithApiKey,
  };
}
