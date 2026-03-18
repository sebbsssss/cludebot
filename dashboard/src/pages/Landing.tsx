import { useState } from 'react';
import { useAuthContext } from '../hooks/AuthContext';
import { CloudSetup } from '../components/CloudSetup';

export function Landing() {
  const { login, loginWithApiKey } = useAuthContext();
  const [apiKey, setApiKey] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [showCloudSetup, setShowCloudSetup] = useState(false);

  async function handleApiKeyLogin() {
    if (!apiKey.trim()) return;
    setError('');
    setConnecting(true);
    const valid = await loginWithApiKey(apiKey.trim(), endpoint.trim() || undefined);
    if (!valid) {
      setError('Invalid API key or endpoint unreachable');
    }
    setConnecting(false);
  }

  if (showCloudSetup) {
    return <CloudSetup onBack={() => setShowCloudSetup(false)} />;
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px',
    }}>
      <div style={{ maxWidth: 480, textAlign: 'center' }}>
        <div style={{
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: 5,
          textTransform: 'uppercase' as const,
          marginBottom: 32,
        }}>
          CLUDE
        </div>

        <h1 style={{
          fontSize: 'clamp(28px, 4vw, 40px)',
          fontWeight: 800,
          lineHeight: 1.1,
          letterSpacing: -1,
          marginBottom: 20,
        }}>
          See what your<br />
          agent <span style={{
            background: 'linear-gradient(135deg, #2244ff, #5566ff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>remembers.</span>
        </h1>

        <p style={{
          fontSize: 14,
          color: 'var(--text-muted)',
          lineHeight: 1.8,
          marginBottom: 40,
          maxWidth: 380,
          margin: '0 auto 40px',
        }}>
          Sign in to explore your agent's memory.
          Visualize, search, export, and share knowledge
          across agents.
        </p>

        {/* Primary CTA — One-click cloud setup */}
        <button
          onClick={() => setShowCloudSetup(true)}
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 11,
            letterSpacing: 2,
            textTransform: 'uppercase' as const,
            padding: '14px 32px',
            background: 'var(--text)',
            color: 'var(--bg)',
            border: '2px solid var(--text)',
            cursor: 'pointer',
            transition: 'all 0.25s',
            width: '100%',
            maxWidth: 320,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--text)';
            e.currentTarget.style.color = 'var(--bg)';
          }}
        >
          Get Started Free
        </button>
        <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 8, maxWidth: 320, margin: '8px auto 0' }}>
          Create an agent in 10 seconds. No credit card, no infra.
        </div>

        {/* Divider */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          margin: '32px auto',
          maxWidth: 320,
        }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border-strong)' }} />
          <span style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--text-faint)' }}>or sign in</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border-strong)' }} />
        </div>

        {/* Existing auth options */}
        <div style={{
          display: 'flex',
          gap: 12,
          maxWidth: 320,
          margin: '0 auto 24px',
        }}>
          <button
            onClick={login}
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 10,
              letterSpacing: 1,
              textTransform: 'uppercase' as const,
              padding: '12px 16px',
              background: 'transparent',
              color: 'var(--text)',
              border: '1px solid var(--border-strong)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              flex: 1,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--text)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-strong)';
            }}
          >
            Wallet
          </button>
          <div style={{ flex: 2 }}>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="clk_... (API key)"
              onKeyDown={(e) => e.key === 'Enter' && handleApiKeyLogin()}
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 11,
                padding: '12px 12px',
                border: '1px solid var(--border-strong)',
                background: 'transparent',
                width: '100%',
                outline: 'none',
              }}
            />
          </div>
          <button
            onClick={handleApiKeyLogin}
            disabled={!apiKey.trim() || connecting}
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 10,
              letterSpacing: 1,
              textTransform: 'uppercase',
              padding: '12px 14px',
              background: apiKey.trim() ? 'var(--text)' : 'var(--border-strong)',
              color: apiKey.trim() ? 'var(--bg)' : 'var(--text-faint)',
              border: 'none',
              cursor: apiKey.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            {connecting ? '...' : 'Go'}
          </button>
        </div>

        {/* Endpoint (collapsed) */}
        <details style={{ maxWidth: 320, margin: '0 auto', textAlign: 'left' }}>
          <summary style={{
            fontSize: 10,
            letterSpacing: 1,
            textTransform: 'uppercase',
            color: 'var(--text-faint)',
            cursor: 'pointer',
            marginBottom: 8,
          }}>
            Custom endpoint
          </summary>
          <input
            type="text"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="https://clude.io (default)"
            onKeyDown={(e) => e.key === 'Enter' && handleApiKeyLogin()}
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 11,
              padding: '8px 12px',
              border: '1px solid var(--border-strong)',
              background: 'transparent',
              width: '100%',
              outline: 'none',
            }}
          />
        </details>

        {error && (
          <div style={{ fontSize: 11, color: '#ef4444', marginTop: 12, maxWidth: 320, margin: '12px auto 0' }}>
            {error}
          </div>
        )}

        <div style={{
          marginTop: 48,
          display: 'flex',
          justifyContent: 'center',
          gap: 32,
          fontSize: 10,
          letterSpacing: 2,
          textTransform: 'uppercase' as const,
          color: 'var(--text-faint)',
        }}>
          <span>Memory Timeline</span>
          <span>Entity Graph</span>
          <span>Brain View</span>
          <span>Memory Packs</span>
        </div>
      </div>
    </div>
  );
}
