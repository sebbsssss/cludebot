import { useCallback, useRef, useState } from 'react';
import { api } from '../lib/api';
import { CcWordmark } from './atoms';
import { V2_INTERESTS } from './data';
import type { V2Theme } from './types';

/**
 * First-run onboarding — sits between CcAuth (verified) and CcChat.
 *
 * Shapes the agent's memory before the first message so context isn't built
 * from scratch. Two modes share the same screen:
 *
 *   • For me — pick interest pills + optional free-text "about me." Each pill
 *     becomes a semantic memory. Mirrors Stanford-style episodic seeding for
 *     personal use.
 *   • For my team — paste a policy or upload .md/.txt/.json files. Paragraphs
 *     become procedural memories tagged with the policy name. This is the
 *     compliance hook: ingest existing manuals/SOPs so the agent inherits
 *     guardrails from day zero, audit trail follows.
 *
 * "Just start chatting" is positioned not as a skip but as a third valid
 * choice — Clude learns organically from messages. Functionally it sets the
 * onboarded flag with zero seeded memories.
 */

type Mode = 'me' | 'team';

interface UploadedFile {
  name: string;
  size: number;
  content: string;
}

interface Memory {
  content: string;
  summary: string;
  type: 'semantic' | 'procedural';
  importance: number;
  tags: string[];
}

export function CcOnboarding({
  theme,
  onComplete,
}: {
  theme: V2Theme;
  onComplete: () => void;
}) {
  const [mode, setMode] = useState<Mode>('me');

  // Personal mode state
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [aboutMe, setAboutMe] = useState('');

  // Compliance mode state
  const [policyName, setPolicyName] = useState('');
  const [pasted, setPasted] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Personal mode helpers ──────────────────────────────────────
  const togglePill = (pill: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(pill)) next.delete(pill);
      else next.add(pill);
      return next;
    });
  };

  // ── Compliance mode helpers ────────────────────────────────────
  const acceptedTypes = ['text/plain', 'text/markdown', 'application/json'];
  const acceptedExt = /\.(md|markdown|txt|json)$/i;

  const readFile = (file: File): Promise<UploadedFile> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          name: file.name,
          size: file.size,
          content: typeof reader.result === 'string' ? reader.result : '',
        });
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });

  const handleFiles = useCallback(async (incoming: FileList | File[]) => {
    const list = Array.from(incoming);
    const valid = list.filter(
      (f) => acceptedTypes.includes(f.type) || acceptedExt.test(f.name),
    );
    if (valid.length === 0) {
      setError('Only .md, .txt, or .json files supported.');
      return;
    }
    setError(null);
    try {
      const read = await Promise.all(valid.map(readFile));
      setFiles((prev) => [...prev, ...read]);
    } catch (err: any) {
      setError(err?.message || 'Failed to read file.');
    }
  }, []);

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── Memory pack assembly ──────────────────────────────────────
  // Splits text into paragraph-sized chunks. Markdown-aware: prefers H1/H2
  // section breaks when present; falls back to blank-line paragraphs.
  const chunkPolicyText = (raw: string): string[] => {
    const text = raw.trim();
    if (!text) return [];
    const headingSplit = text.split(/\n(?=#{1,3}\s)/g);
    if (headingSplit.length > 1) {
      return headingSplit.map((s) => s.trim()).filter((s) => s.length > 0);
    }
    return text.split(/\n{2,}/g).map((p) => p.trim()).filter((p) => p.length >= 30);
  };

  const buildPersonalPack = (): Memory[] => {
    const memories: Memory[] = [];
    for (const pill of picked) {
      memories.push({
        content: `User is interested in ${pill}.`,
        summary: `Interest: ${pill}`,
        type: 'semantic',
        importance: 0.7,
        tags: ['onboarding', 'interest'],
      });
    }
    const trimmed = aboutMe.trim();
    if (trimmed.length > 0) {
      memories.push({
        content: `About the user: ${trimmed}`,
        summary: 'User self-description',
        type: 'semantic',
        importance: 0.85,
        tags: ['onboarding', 'self-description'],
      });
    }
    return memories;
  };

  const buildTeamPack = (): Memory[] => {
    const memories: Memory[] = [];
    const policyTag = `policy:${slugify(policyName || 'untitled')}`;
    const allText = [
      pasted,
      ...files.map((f) => `# ${f.name}\n\n${f.content}`),
    ]
      .filter((s) => s.trim().length > 0)
      .join('\n\n');
    const chunks = chunkPolicyText(allText);
    chunks.forEach((chunk, i) => {
      memories.push({
        content: chunk,
        summary: `${policyName || 'Team policy'} · section ${i + 1}`,
        type: 'procedural',
        importance: 0.9,
        tags: ['onboarding', 'policy', 'compliance', policyTag],
      });
    });
    return memories;
  };

  const seedAndContinue = useCallback(
    async (memories: Memory[]) => {
      setSubmitting(true);
      setError(null);
      try {
        if (memories.length > 0) {
          await api.importMemoryPack({
            id: `onboarding-${Date.now()}`,
            name: mode === 'me' ? 'Personal onboarding' : 'Team policy',
            memories,
          });
        }
        try {
          localStorage.setItem('v2_onboarded', 'true');
        } catch {
          /* ignore */
        }
        onComplete();
      } catch (err: any) {
        setError(err?.message || 'Could not save memories. Try again.');
        setSubmitting(false);
      }
    },
    [mode, onComplete],
  );

  const handleContinue = () => {
    const memories = mode === 'me' ? buildPersonalPack() : buildTeamPack();
    seedAndContinue(memories);
  };

  const handleJustChat = () => {
    seedAndContinue([]);
  };

  const personalReady = picked.size > 0 || aboutMe.trim().length > 0;
  const teamReady =
    (pasted.trim().length > 30 || files.length > 0) && policyName.trim().length > 0;
  const continueDisabled =
    submitting || (mode === 'me' ? !personalReady : !teamReady);

  return (
    <div className="cc-app" data-theme={theme}>
      <div className="cc-onb">
        <header className="cc-onb__head">
          <CcWordmark badge="Chat" />
          <span className="cc-onb__step">◇ Step 2 of 2 · seed memory</span>
        </header>

        <section className="cc-onb__hero">
          <div className="cc-onb__eyebrow">◈ Shape your agent</div>
          <h1 className="cc-onb__h1">
            Tell Clude what to <span className="cc-onb__h1-em">remember</span>.
          </h1>
          <p className="cc-onb__lede">
            Memory works best when it has something to start with. Drop in a
            policy, pick a few interests — or skip ahead and let your agent
            learn as you chat.
          </p>
        </section>

        <div className="cc-onb__tabs" role="tablist">
          <button
            role="tab"
            aria-selected={mode === 'me'}
            type="button"
            className={`cc-onb__tab ${mode === 'me' ? 'is-active' : ''}`}
            onClick={() => setMode('me')}
          >
            For me
          </button>
          <button
            role="tab"
            aria-selected={mode === 'team'}
            type="button"
            className={`cc-onb__tab ${mode === 'team' ? 'is-active' : ''}`}
            onClick={() => setMode('team')}
          >
            For my team
          </button>
        </div>

        <section className="cc-onb__panel">
          {mode === 'me' ? (
            <>
              <div className="cc-onb__field">
                <label className="cc-onb__label">Pick a few topics</label>
                <p className="cc-onb__hint">
                  Each pill becomes a semantic memory. Pick what's relevant —
                  your agent will recall this on related queries.
                </p>
                <div className="cc-onb__pills">
                  {V2_INTERESTS.map((pill) => (
                    <button
                      key={pill}
                      type="button"
                      className={`cc-onb__pill ${
                        picked.has(pill) ? 'is-active' : ''
                      }`}
                      onClick={() => togglePill(pill)}
                    >
                      {pill}
                    </button>
                  ))}
                </div>
              </div>
              <div className="cc-onb__field">
                <label className="cc-onb__label" htmlFor="cc-about">
                  Anything else? (optional)
                </label>
                <p className="cc-onb__hint">
                  Role, current focus, what you're building — one or two
                  sentences is enough.
                </p>
                <textarea
                  id="cc-about"
                  className="cc-onb__textarea"
                  rows={3}
                  value={aboutMe}
                  onChange={(e) => setAboutMe(e.target.value)}
                  placeholder="e.g. I'm a robotics engineer focused on Rust + ROS 2; experimenting with AI agents for telemetry."
                />
              </div>
            </>
          ) : (
            <>
              <div className="cc-onb__field">
                <label className="cc-onb__label" htmlFor="cc-policy">
                  Policy or document name
                </label>
                <input
                  id="cc-policy"
                  className="cc-onb__input"
                  type="text"
                  value={policyName}
                  onChange={(e) => setPolicyName(e.target.value)}
                  placeholder="e.g. Code of Conduct · v3 · Apr 2026"
                  required
                />
              </div>

              <div className="cc-onb__field">
                <label className="cc-onb__label">Upload files</label>
                <p className="cc-onb__hint">
                  .md, .txt, or .json memory packs. We chunk each file by
                  section and store as procedural memory.
                </p>
                <div
                  className={`cc-onb__drop ${dragOver ? 'is-over' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    if (e.dataTransfer.files?.length) {
                      handleFiles(e.dataTransfer.files);
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="cc-onb__drop__inner">
                    <span className="cc-onb__drop__icon">◇</span>
                    <span>
                      Drop files or <strong>browse</strong>
                    </span>
                    <span className="cc-onb__drop__sub">.md · .txt · .json</span>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".md,.markdown,.txt,.json,text/markdown,text/plain,application/json"
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files?.length) handleFiles(e.target.files);
                      // Allow re-uploading the same file
                      e.target.value = '';
                    }}
                  />
                </div>

                {files.length > 0 && (
                  <ul className="cc-onb__files">
                    {files.map((f, i) => (
                      <li key={`${f.name}-${i}`}>
                        <span className="cc-onb__file__name">{f.name}</span>
                        <span className="cc-onb__file__size">
                          {(f.size / 1024).toFixed(1)} KB
                        </span>
                        <button
                          type="button"
                          className="cc-onb__file__rm"
                          onClick={() => removeFile(i)}
                          aria-label="Remove file"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="cc-onb__field">
                <label className="cc-onb__label" htmlFor="cc-paste">
                  Or paste policy text
                </label>
                <p className="cc-onb__hint">
                  Markdown headings (#, ##) split sections. Otherwise we split
                  on paragraphs.
                </p>
                <textarea
                  id="cc-paste"
                  className="cc-onb__textarea cc-onb__textarea--lg"
                  rows={8}
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  placeholder="# Section 1&#10;The agent must never...&#10;&#10;# Section 2&#10;Escalate when..."
                />
              </div>
            </>
          )}
        </section>

        {error && <div className="cc-onb__error">{error}</div>}

        <footer className="cc-onb__foot">
          <button
            type="button"
            className="cc-onb__primary"
            onClick={handleContinue}
            disabled={continueDisabled}
          >
            {submitting ? (
              <>
                <span className="cc-spinner" /> Seeding memory…
              </>
            ) : (
              <>
                Seed memory & enter Chat <span className="cc-arrow">→</span>
              </>
            )}
          </button>
          <button
            type="button"
            className="cc-onb__alt"
            onClick={handleJustChat}
            disabled={submitting}
          >
            Or — just start chatting · I'll learn as we go
          </button>
        </footer>
      </div>
    </div>
  );
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'untitled';
}
