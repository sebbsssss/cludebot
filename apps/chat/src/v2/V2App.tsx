import { useEffect, useState } from 'react';
import { useAuthContext } from '../hooks/AuthContext';
import { CcAuth } from './CcAuth';
import { CcChat } from './CcChat';
import './styles/colors_and_type.css';
import './styles/chat-styles.css';
import type { V2Theme } from './types';

const THEME_KEY = 'v2_theme';

/**
 * Clude Chat v2 — top-level route.
 * Mounted at `/chat/v2`. Keeps existing Privy/Solana auth; the design's
 * magic-link screen becomes a visual layer that calls `auth.login()`.
 */
export function V2App() {
  const auth = useAuthContext();
  const [theme, setThemeState] = useState<V2Theme>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(THEME_KEY) : null;
    return saved === 'dark' ? 'dark' : 'light';
  });

  const setTheme = (t: V2Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {}
  };

  // Remove the dark-mode .dark class the existing /chat route adds to <html>,
  // so our data-theme-driven vars are the source of truth on /v2.
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.classList.contains('dark');
    html.classList.remove('dark');
    return () => {
      if (prev) html.classList.add('dark');
    };
  }, []);

  if (!auth.ready) {
    return (
      <div
        className="cc-app"
        data-theme={theme}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: 'var(--bg-1)',
          color: 'var(--fg-3)',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
        }}
      >
        CLUDE · loading
      </div>
    );
  }

  if (!auth.authenticated) {
    return <CcAuth theme={theme} />;
  }

  return <CcChat theme={theme} setTheme={setTheme} />;
}
