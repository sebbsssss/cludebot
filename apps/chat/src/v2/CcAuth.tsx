import { useState } from 'react';
import { useAuthContext } from '../hooks/AuthContext';
import { CcWordmark } from './atoms';

/**
 * Logged-out screen.
 *
 * The design shows an email magic-link form; in this app Privy owns the
 * actual magic-link/wallet flow, so the form's submit just opens the
 * Privy modal via `useAuthContext().login()`. Email input is kept for
 * visual continuity but not sent anywhere.
 */
export function CcAuth({ theme }: { theme: 'light' | 'dark' }) {
  const { login } = useAuthContext();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    // Privy's modal handles the actual auth. Visual delay is just UX polish —
    // we don't mock success; Privy either resolves or the user closes the modal.
    try {
      login();
    } finally {
      setTimeout(() => setSubmitting(false), 600);
    }
  };

  return (
    <div className="cc-app" data-theme={theme}>
      <div className="cc-auth">
        <section className="cc-auth__hero">
          <div className="cc-auth__top">
            <CcWordmark badge="Chat" />
            <span className="cc-auth__tag">
              <span className="cc-auth__tag__dot" />◎ Memory online · v2
            </span>
          </div>

          <div className="cc-auth__lede">
            <div className="cc-auth__eyebrow">◈ Cognitive memory for chat</div>
            <h1 className="cc-auth__h1">
              Chat that <span className="cc-auth__h1-em">remembers</span> — not just stores.
            </h1>
            <p>
              Every model on your terms. Every conversation on your memory. Typed,
              decay‑aware, portable across agents — and{' '}
              <strong style={{ color: 'var(--fg-1)', fontWeight: 600 }}>
                1.96% hallucination
              </strong>{' '}
              on HaluMem vs. 15.2% next best.
            </p>
          </div>

          <div className="cc-auth__stats">
            <div className="cc-auth__stat">
              <div className="cc-auth__stat__v cc-auth__stat__v--brand">1.96%</div>
              <div className="cc-auth__stat__k">halu · halumem</div>
            </div>
            <div className="cc-auth__stat">
              <div className="cc-auth__stat__v cc-auth__stat__v--good">−78%</div>
              <div className="cc-auth__stat__k">tok vs frontier</div>
            </div>
            <div className="cc-auth__stat">
              <div className="cc-auth__stat__v">8</div>
              <div className="cc-auth__stat__k">models · swap live</div>
            </div>
          </div>
        </section>

        <section className="cc-auth__form">
          <div className="cc-auth__formhead">
            <span className="cc-auth__privy">
              ◉ auth by <strong>PRIVY</strong>
            </span>
            <div className="cc-auth__switch">
              <button
                type="button"
                className={`cc-auth__switchbtn ${mode === 'login' ? 'is-active' : ''}`}
                onClick={() => setMode('login')}
              >
                Sign in
              </button>
              <button
                type="button"
                className={`cc-auth__switchbtn ${mode === 'register' ? 'is-active' : ''}`}
                onClick={() => setMode('register')}
              >
                Create account
              </button>
            </div>
          </div>

          <div className="cc-auth__card">
            <div>
              <h2 className="cc-auth__title">
                {mode === 'login' ? 'Welcome back.' : 'Start your memory.'}
              </h2>
              <p className="cc-auth__desc">
                {mode === 'login'
                  ? 'Sign in with a magic link or wallet. Your memories are waiting — typed, decayed, and ready to recall.'
                  : 'One email is all we need. Your memory starts fresh — yours, portable, never shared.'}
              </p>
            </div>

            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div className="cc-auth__field">
                <label className="cc-auth__label">Email</label>
                <input
                  className="cc-auth__input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@domain.dev"
                  autoFocus
                />
              </div>
              <button
                className="cc-auth__primary"
                type="submit"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <span className="cc-spinner" /> opening Privy…
                  </>
                ) : (
                  <>
                    {mode === 'login' ? 'Continue with Privy' : 'Create account'}{' '}
                    <span className="cc-arrow">→</span>
                  </>
                )}
              </button>
              <div className="cc-auth__divider">or</div>
              <button
                type="button"
                className="cc-auth__primary"
                style={{
                  background: 'transparent',
                  color: 'var(--fg-1)',
                  borderColor: 'var(--line-strong)',
                }}
                onClick={() => login()}
              >
                Sign in with wallet <span className="cc-arrow">→</span>
              </button>
            </form>

            <div className="cc-auth__legal">
              By continuing you agree to the <a href="/">Terms</a> and{' '}
              <a href="/">Privacy Policy</a>. Memory is local‑first and portable — export
              anytime.
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--fg-3)',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              marginTop: 32,
            }}
          >
            <span>◇ v2 · benchmarks ↗</span>
            <span>◎ clude.io</span>
          </div>
        </section>
      </div>
    </div>
  );
}
