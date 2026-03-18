import { useState } from 'react';
import { useAuthContext } from '../hooks/AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE || '';
const CORTEX_HOST = 'https://clude.io';

function getMcpConfig(apiKey: string): string {
  return JSON.stringify({
    mcpServers: {
      'clude-memory': {
        command: 'npx',
        args: ['clude-bot', 'mcp-serve'],
        env: {
          CORTEX_API_KEY: apiKey,
          CORTEX_HOST_URL: CORTEX_HOST,
        },
      },
    },
  }, null, 2);
}

function CopyBtn({ text, label }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); }
        catch {
          const t = document.createElement('textarea');
          t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
          document.body.appendChild(t); t.select(); document.execCommand('copy');
          document.body.removeChild(t);
        }
        setOk(true);
        setTimeout(() => setOk(false), 2000);
      }}
      style={{
        fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: 1,
        textTransform: 'uppercase', padding: '6px 14px',
        background: ok ? '#10b981' : 'var(--text)', color: 'var(--bg)',
        border: 'none', cursor: 'pointer', transition: 'background 0.2s',
      }}
    >
      {ok ? 'Copied!' : label || 'Copy'}
    </button>
  );
}

function CodeBlock({ label, code, copyText }: { label: string; code: string; copyText?: string }) {
  return (
    <div style={{ border: '1px solid var(--border)', marginBottom: 12 }}>
      <div style={{
        padding: '8px 14px', borderBottom: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-faint)' }}>
          {label}
        </span>
        <CopyBtn text={copyText || code} label="Copy" />
      </div>
      <pre style={{
        padding: 14, fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 1.6,
        background: 'var(--bg-warm)', overflow: 'auto', maxHeight: 280,
        margin: 0, whiteSpace: 'pre',
      }}>
        {code}
      </pre>
    </div>
  );
}

function InlineCode({ code }: { code: string }) {
  return (
    <div style={{
      display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12,
    }}>
      <code style={{
        fontSize: 12, padding: '10px 14px', background: 'var(--bg-warm)',
        border: '1px solid var(--border)', flex: 1, display: 'block',
      }}>
        {code}
      </code>
      <CopyBtn text={code} />
    </div>
  );
}

export function Setup() {
  const { authMode } = useAuthContext();
  const [agentName, setAgentName] = useState('');
  const [registering, setRegistering] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [activeTab, setActiveTab] = useState<'terminal' | 'config' | 'sdk' | 'openclaw'>('terminal');

  const existingKey = authMode === 'cortex' ? (localStorage.getItem('cortex_api_key') || '') : '';
  const activeKey = apiKey || existingKey;

  async function handleRegister() {
    const name = agentName.trim();
    if (!name || name.length < 2) { setError('Agent name must be at least 2 characters'); return; }
    setError('');
    setRegistering(true);
    try {
      const endpoint = API_BASE || CORTEX_HOST;
      const res = await fetch(`${endpoint}/api/cortex/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Registration failed'); setRegistering(false); return; }
      if (!data.apiKey) { setError('Unexpected response'); setRegistering(false); return; }
      setApiKey(data.apiKey);
    } catch { setError('Network error'); }
    finally { setRegistering(false); }
  }

  const installCmd = `CORTEX_API_KEY=${activeKey || 'clk_...'} npx clude-bot mcp-install`;
  const setupCmd = `npm install -g clude-bot\nclude-bot setup`;

  const sdkCode = `import { Cortex } from 'clude-bot';

const brain = new Cortex({
  hosted: { apiKey: '${activeKey || 'clk_...'}' },
});
await brain.init();

// Store a memory
await brain.store({
  type: 'episodic',
  content: 'User asked about pricing.',
  summary: 'Pricing question',
  source: 'my-agent',
});

// Recall memories
const memories = await brain.recall({
  query: 'pricing',
  limit: 5,
});`;

  return (
    <div>
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 12 }}>
          Get Started
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5, marginBottom: 8 }}>
          Setup
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
          Give your agent persistent memory in under a minute.
        </p>
      </div>

      {/* Step 1: Get API Key */}
      <div style={{ border: '1px solid var(--border)', marginBottom: 24 }}>
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 22, height: 22, borderRadius: '50%',
              background: activeKey ? '#10b981' : 'var(--text)',
              color: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700,
            }}>
              {activeKey ? '\u2713' : '1'}
            </span>
            <span style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--text-faint)', fontWeight: 600 }}>
              {activeKey ? 'API Key Ready' : 'Create Your Agent'}
            </span>
          </div>
          {activeKey && (
            <span style={{ fontSize: 10, color: '#10b981', fontWeight: 600 }}>Complete</span>
          )}
        </div>
        <div style={{ padding: 20 }}>
          {activeKey ? (
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', background: 'var(--bg-warm)',
                border: '1px solid var(--border)', marginBottom: 12,
              }}>
                <code style={{ fontSize: 12, flex: 1, wordBreak: 'break-all' }}>
                  {showKey ? activeKey : `${'*'.repeat(16)}${activeKey.slice(-6)}`}
                </code>
                <button onClick={() => setShowKey(!showKey)} style={{
                  fontFamily: 'var(--mono)', fontSize: 9, background: 'none',
                  border: 'none', color: 'var(--text-faint)', cursor: 'pointer',
                }}>{showKey ? 'Hide' : 'Show'}</button>
                <CopyBtn text={activeKey} />
              </div>
              <div style={{
                fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.8,
                padding: '12px 14px', background: 'rgba(34, 68, 255, 0.04)',
                border: '1px solid rgba(34, 68, 255, 0.1)',
              }}>
                Save this key — you'll need it to install Clude in your agent, CLI, or OpenClaw skill.
              </div>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.7 }}>
                Create a cloud-hosted memory cortex. No database needed — works instantly.
              </p>
              <div style={{ display: 'flex', gap: 8, maxWidth: 400 }}>
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
                  placeholder="Agent name"
                  autoFocus
                  style={{
                    fontFamily: 'var(--mono)', fontSize: 12, padding: '10px 12px',
                    border: '1px solid var(--border-strong)', background: 'transparent',
                    flex: 1, outline: 'none',
                  }}
                />
                <button
                  onClick={handleRegister}
                  disabled={registering || agentName.trim().length < 2}
                  style={{
                    fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: 2,
                    textTransform: 'uppercase', padding: '10px 20px',
                    background: agentName.trim().length >= 2 ? 'var(--text)' : 'var(--border-strong)',
                    color: agentName.trim().length >= 2 ? 'var(--bg)' : 'var(--text-faint)',
                    border: 'none', cursor: agentName.trim().length >= 2 ? 'pointer' : 'not-allowed',
                  }}
                >
                  {registering ? '...' : 'Create'}
                </button>
              </div>
              {error && (
                <div style={{ fontSize: 11, color: '#ef4444', marginTop: 8 }}>{error}</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Step 2: Install */}
      <div style={{ border: '1px solid var(--border)', marginBottom: 24 }}>
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{
            width: 22, height: 22, borderRadius: '50%',
            background: 'var(--text)', color: 'var(--bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700,
          }}>2</span>
          <span style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--text-faint)', fontWeight: 600 }}>
            Install
          </span>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {([
            { id: 'terminal' as const, label: 'Terminal' },
            { id: 'config' as const, label: 'Config File' },
            { id: 'sdk' as const, label: 'SDK' },
            { id: 'openclaw' as const, label: 'OpenClaw' },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: 1,
                textTransform: 'uppercase', padding: '12px 20px',
                background: activeTab === tab.id ? 'var(--bg-warm)' : 'transparent',
                color: activeTab === tab.id ? 'var(--text)' : 'var(--text-faint)',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--text)' : '2px solid transparent',
                cursor: 'pointer', fontWeight: activeTab === tab.id ? 700 : 400,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ padding: 20 }}>
          {/* Terminal — one-liner for Claude Code / any MCP agent */}
          {activeTab === 'terminal' && (
            <div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.7 }}>
                Run this in your terminal to auto-install Clude into Claude Code, Claude Desktop, or Cursor.
                The installer detects your IDE and configures everything.
              </p>

              <div style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8, fontWeight: 600 }}>
                One-click install (auto-detects IDE)
              </div>
              <InlineCode code={installCmd} />

              <div style={{
                fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-faint)',
                marginBottom: 8, marginTop: 20, fontWeight: 600,
              }}>
                Or use the guided setup
              </div>
              <CodeBlock label="terminal" code={setupCmd} />

              <div style={{ fontSize: 10, color: 'var(--text-faint)', lineHeight: 1.7 }}>
                The setup wizard walks you through registration, IDE selection, and configuration.
                Restart your IDE after installation.
              </div>
            </div>
          )}

          {/* Config File — for advanced users (Claude Desktop, Cursor) */}
          {activeTab === 'config' && (
            <div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.7 }}>
                For manual setup, paste this JSON into your IDE's MCP configuration file.
              </p>

              <div style={{
                display: 'grid', gap: 12, marginBottom: 16,
                fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.8,
              }}>
                <div style={{ padding: '10px 14px', background: 'var(--bg-warm)', border: '1px solid var(--border)' }}>
                  <strong>Claude Desktop</strong>: ~/Library/Application Support/Claude/claude_desktop_config.json
                </div>
                <div style={{ padding: '10px 14px', background: 'var(--bg-warm)', border: '1px solid var(--border)' }}>
                  <strong>Cursor</strong>: ~/.cursor/mcp.json
                </div>
                <div style={{ padding: '10px 14px', background: 'var(--bg-warm)', border: '1px solid var(--border)' }}>
                  <strong>Claude Code</strong>: .mcp.json in your project root
                </div>
              </div>

              <CodeBlock label="mcp config (json)" code={getMcpConfig(activeKey)} />

              <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>
                Restart your IDE after adding the config.
              </div>
            </div>
          )}

          {/* SDK */}
          {activeTab === 'sdk' && (
            <div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.7 }}>
                Use the SDK to add memory directly to your Node.js/TypeScript agent.
              </p>
              <InlineCode code="npm install clude-bot" />
              <CodeBlock label="typescript" code={sdkCode} />
            </div>
          )}

          {/* OpenClaw */}
          {activeTab === 'openclaw' && (
            <div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.7 }}>
                Add Clude as a skill to your OpenClaw agent. The skill gives your agent persistent memory across conversations.
              </p>

              <div style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8, fontWeight: 600 }}>
                1. Install the skill
              </div>
              <InlineCode code="npx clude-bot mcp-serve" />

              <div style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8, marginTop: 16, fontWeight: 600 }}>
                2. Set your API key as an environment variable
              </div>
              <InlineCode code={`CORTEX_API_KEY=${activeKey || 'clk_...'}`} />

              <div style={{
                fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.8,
                padding: '14px 16px', background: 'var(--bg-warm)', border: '1px solid var(--border)',
                marginTop: 16,
              }}>
                The skill exposes 4 tools to your agent: <code>recall_memories</code>, <code>store_memory</code>, <code>get_memory_stats</code>, and <code>find_clinamen</code>.
                Your agent can store and recall memories across sessions using these tools automatically.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* What you get */}
      <div style={{ border: '1px solid var(--border)' }}>
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--text-faint)', fontWeight: 600,
        }}>
          What Your Agent Gets
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[
              { title: 'recall_memories', desc: 'Search with hybrid scoring — vector, keyword, tags, importance' },
              { title: 'store_memory', desc: 'Persist memories with type, importance, and automatic embedding' },
              { title: 'get_memory_stats', desc: 'Counts by type, decay averages, top tags and concepts' },
              { title: 'find_clinamen', desc: 'Surface unexpected connections for lateral thinking' },
            ].map(tool => (
              <div key={tool.title} style={{ padding: '14px 16px', border: '1px solid var(--border)' }}>
                <code style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  {tool.title}
                </code>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  {tool.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
