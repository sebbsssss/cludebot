import { useAuthContext } from '../hooks/AuthContext';

export function Landing() {
  const { login } = useAuthContext();

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

        <button
          onClick={login}
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
          Sign In
        </button>

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
