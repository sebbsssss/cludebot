import { useState } from 'react';
import { useAuthContext } from '../hooks/AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE || '';
const CORTEX_HOST = 'https://clude.io';

type IDE = 'claude-code' | 'claude-desktop' | 'cursor';

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

function getConfigPath(ide: IDE): string {
  switch (ide) {
    case 'claude-code': return '.mcp.json (project root)';
    case 'claude-desktop': return '~/Library/Application Support/Claude/claude_desktop_config.json';
    case 'cursor': return '~/.cursor/mcp.json';
  }
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

export function Setup() {
  const { authMode } = useAuthContext();
  const [agentName, setAgentName] = useState('');
  const [registering, setRegistering] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [selectedIde, setSelectedIde] = useState<IDE>('claude-code');
  const [activeTab, setActiveTab] = useState<'mcp' | 'sdk' | 'cli'>('mcp');

  // If user is in cortex mode, pre-fill their existing key
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

  const ides: { id: IDE; name: string; desc: string }[] = [
    { id: 'claude-code', name: 'Claude Code', desc: 'CLI / VS Code' },
    { id: 'claude-desktop', name: 'Claude Desktop', desc: 'macOS / Windows' },
    { id: 'cursor', name: 'Cursor', desc: 'AI IDE' },
  ];

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

  const cliCode = `npm install -g clude-bot
clude-bot setup`;

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
                border: '1px solid var(--border)', marginBottom: 8,
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
              <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>
                Save this key — it won't be shown again.
              </div>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.7 }}>
                Create a cloud-hosted memory cortex. No database, no infrastructure — works instantly.
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
            Connect to Your Agent
          </span>
        </div>

        {/* Integration tabs */}
        <div style={{
          display: 'flex', borderBottom: '1px solid var(--border)',
        }}>
          {(['mcp', 'sdk', 'cli'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: 1,
                textTransform: 'uppercase', padding: '12px 20px',
                background: activeTab === tab ? 'var(--bg-warm)' : 'transparent',
                color: activeTab === tab ? 'var(--text)' : 'var(--text-faint)',
                border: 'none', borderBottom: activeTab === tab ? '2px solid var(--text)' : '2px solid transparent',
                cursor: 'pointer', fontWeight: activeTab === tab ? 700 : 400,
              }}
            >
              {tab === 'mcp' ? 'MCP (IDE)' : tab === 'sdk' ? 'SDK' : 'CLI'}
            </button>
          ))}
        </div>

        <div style={{ padding: 20 }}>
          {/* MCP Tab */}
          {activeTab === 'mcp' && (
            <div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.7 }}>
                Add memory tools to Claude Code, Claude Desktop, or Cursor. Copy the config below into your IDE's MCP configuration file.
              </p>

              {/* IDE selector */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {ides.map(ide => (
                  <button
                    key={ide.id}
                    onClick={() => setSelectedIde(ide.id)}
                    style={{
                      fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: 1,
                      padding: '10px 16px', textAlign: 'center',
                      background: selectedIde === ide.id ? 'var(--text)' : 'transparent',
                      color: selectedIde === ide.id ? 'var(--bg)' : 'var(--text-muted)',
                      border: `1px solid ${selectedIde === ide.id ? 'var(--text)' : 'var(--border-strong)'}`,
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{ide.name}</div>
                    <div style={{ fontSize: 9, opacity: 0.7, marginTop: 2 }}>{ide.desc}</div>
                  </button>
                ))}
              </div>

              <div style={{ fontSize: 10, color: 'var(--text-faint)', marginBottom: 8 }}>
                Paste into: <strong style={{ color: 'var(--text-muted)' }}>{getConfigPath(selectedIde)}</strong>
              </div>

              <div style={{ border: '1px solid var(--border)', marginBottom: 12 }}>
                <div style={{
                  padding: '8px 14px', borderBottom: '1px solid var(--border)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-faint)' }}>
                    mcp config
                  </span>
                  <CopyBtn text={getMcpConfig(activeKey)} label="Copy" />
                </div>
                <pre style={{
                  padding: 14, fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 1.6,
                  background: 'var(--bg-warm)', overflow: 'auto', maxHeight: 200,
                  margin: 0, whiteSpace: 'pre',
                }}>
                  {getMcpConfig(activeKey)}
                </pre>
              </div>

              <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>
                Restart your IDE after adding the config. Your agent will have 4 tools: <strong>recall</strong>, <strong>store</strong>, <strong>stats</strong>, <strong>clinamen</strong>.
              </div>
            </div>
          )}

          {/* SDK Tab */}
          {activeTab === 'sdk' && (
            <div>
              <div style={{
                display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16,
              }}>
                <code style={{
                  fontSize: 12, padding: '10px 14px', background: 'var(--bg-warm)',
                  border: '1px solid var(--border)', flex: 1,
                }}>
                  npm install clude-bot
                </code>
                <CopyBtn text="npm install clude-bot" />
              </div>

              <div style={{ border: '1px solid var(--border)', marginBottom: 12 }}>
                <div style={{
                  padding: '8px 14px', borderBottom: '1px solid var(--border)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-faint)' }}>
                    typescript
                  </span>
                  <CopyBtn text={sdkCode} label="Copy" />
                </div>
                <pre style={{
                  padding: 14, fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 1.6,
                  background: 'var(--bg-warm)', overflow: 'auto', maxHeight: 300,
                  margin: 0, whiteSpace: 'pre',
                }}>
                  {sdkCode}
                </pre>
              </div>
            </div>
          )}

          {/* CLI Tab */}
          {activeTab === 'cli' && (
            <div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.7 }}>
                The CLI handles everything — registration, MCP installation, and config generation.
              </p>
              <div style={{ border: '1px solid var(--border)', marginBottom: 12 }}>
                <div style={{
                  padding: '8px 14px', borderBottom: '1px solid var(--border)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-faint)' }}>
                    terminal
                  </span>
                  <CopyBtn text={cliCode} label="Copy" />
                </div>
                <pre style={{
                  padding: 14, fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 1.6,
                  background: 'var(--bg-warm)', overflow: 'auto',
                  margin: 0, whiteSpace: 'pre',
                }}>
                  {cliCode}
                </pre>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>
                The setup wizard will guide you through registration, MCP configuration, and optional self-hosted setup.
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
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16,
          }}>
            {[
              { title: 'recall_memories', desc: 'Search memories with hybrid scoring — vector, keyword, tags, importance' },
              { title: 'store_memory', desc: 'Persist memories with type, importance, tags, and automatic embedding' },
              { title: 'get_memory_stats', desc: 'Memory statistics — counts by type, decay averages, top tags' },
              { title: 'find_clinamen', desc: 'Anomaly retrieval — surface unexpected connections for lateral thinking' },
            ].map(tool => (
              <div key={tool.title} style={{
                padding: '14px 16px', border: '1px solid var(--border)',
              }}>
                <code style={{
                  fontSize: 11, fontWeight: 600, color: 'var(--text)',
                  display: 'block', marginBottom: 6,
                }}>
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
