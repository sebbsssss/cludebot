import { useState } from 'react';
import { api } from '../../lib/api';
import {
  type Fragment,
  type FragmentStatus,
  type Topic,
} from './wiki-data';
import { prettySource, relativeTime, type ContradictionPair, type GraphMemoryNode } from './use-wiki-data';

type FilterId = 'all' | FragmentStatus;

interface InboxTabProps {
  fragments: Fragment[];
  topics: Topic[];
  contradictions: ContradictionPair[];
}

export function InboxTab({ fragments, topics, contradictions }: InboxTabProps) {
  // Build a map: memoryId → the *other* memory it disagrees with.
  // A memory could appear in multiple pairs; we store the strongest.
  const counterparts = new Map<number, GraphMemoryNode>();
  for (const pair of contradictions) {
    const existingA = counterparts.get(pair.a.id);
    if (!existingA) counterparts.set(pair.a.id, pair.b);
    const existingB = counterparts.get(pair.b.id);
    if (!existingB) counterparts.set(pair.b.id, pair.a);
  }
  const initialId = fragments[0]?.id ?? '';
  const [selectedId, setSelectedId] = useState<string>(initialId);
  const [filter, setFilter] = useState<FilterId>('all');

  const filtered = fragments.filter((f) => filter === 'all' || f.status === filter);
  const current = fragments.find((f) => f.id === selectedId) ?? fragments[0];

  const counts: Record<FilterId, number> = {
    all: fragments.length,
    pending: fragments.filter((f) => f.status === 'pending').length,
    synthesized: fragments.filter((f) => f.status === 'synthesized').length,
    conflict: fragments.filter((f) => f.status === 'conflict').length,
    archived: fragments.filter((f) => f.status === 'archived').length,
  };

  const filterButtons: { id: FilterId; label: string }[] = [
    { id: 'all', label: `All (${counts.all})` },
    { id: 'pending', label: `Pending (${counts.pending})` },
    { id: 'synthesized', label: `Synthesized (${counts.synthesized})` },
    { id: 'conflict', label: `Conflicts (${counts.conflict})` },
    { id: 'archived', label: `Archived (${counts.archived})` },
  ];

  return (
    <div>
      <div className="wk-inbox__filters">
        {filterButtons.map((f) => (
          <button
            key={f.id}
            className={`wk-mini-btn ${filter === f.id ? 'wk-mini-btn--primary' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
        <div className="wk-inbox__filters-meta">
          <span className="wk-inbox__live-dot" />
          Stream live · @Cludebot · research-agent · Seb
        </div>
      </div>

      <div className="wk-inbox">
        <div className="wk-inbox__list">
          {filtered.length === 0 ? (
            <div className="wk-empty">No fragments match this filter.</div>
          ) : (
            filtered.map((f) => (
              <FragmentRow
                key={f.id}
                fragment={f}
                topics={topics}
                active={selectedId === f.id}
                onClick={() => setSelectedId(f.id)}
              />
            ))
          )}
        </div>

        {current && (
          <SynthPanel
            key={current.id}
            fragment={current}
            topics={topics}
            counterpart={current.memoryId != null ? counterparts.get(current.memoryId) ?? null : null}
          />
        )}
      </div>
    </div>
  );
}

function FragmentRow({ fragment, topics, active, onClick }: { fragment: Fragment; topics: Topic[]; active: boolean; onClick: () => void }) {
  const statusClass = `wk-status-${fragment.status}`;
  const actorIcon = fragment.actor === 'agent' ? '◈' : '✎';
  const topic = fragment.topic ? topics.find((t) => t.id === fragment.topic) : null;

  return (
    <div className={`wk-fragment ${active ? 'is-selected' : ''}`} onClick={onClick}>
      <span className={`wk-fragment__actor ${fragment.actor === 'agent' ? 'is-agent' : ''}`}>{actorIcon}</span>
      <div>
        <div className="wk-fragment__body">{fragment.raw}</div>
        <div className="wk-fragment__meta">
          <span className="wk-fragment__meta-source">{fragment.source}</span>
          <span className="wk-fragment__meta-sep">·</span>
          <span>{fragment.time}</span>
          <span className="wk-fragment__meta-sep">·</span>
          <span>conf {fragment.confidence.toFixed(2)}</span>
          {topic && (
            <>
              <span className="wk-fragment__meta-sep">·</span>
              <span>→ {topic.name}</span>
            </>
          )}
        </div>
      </div>
      <span className={`wk-fragment__status ${statusClass}`}>{fragment.status}</span>
    </div>
  );
}

function SynthPanel({ fragment, topics, counterpart }: {
  fragment: Fragment;
  topics: Topic[];
  counterpart: GraphMemoryNode | null;
}) {
  const topic = fragment.topic ? topics.find((t) => t.id === fragment.topic) : null;
  // Component is keyed on fragment.id by parent — initial state is correct per fragment.
  const [draft, setDraft] = useState<string>(fragment.reframed ?? '');
  const [thinking, setThinking] = useState(false);
  const [resolutionState, setResolutionState] = useState<'idle' | 'pending' | 'resolved' | 'error'>('idle');
  const [resolutionError, setResolutionError] = useState<string | null>(null);

  const generate = () => {
    setThinking(true);
    setTimeout(() => {
      const head = fragment.raw.charAt(0).toUpperCase() + fragment.raw.slice(1);
      setDraft(`Reframed from ${fragment.source}: ${head} (Clude would synthesize this into a topic-relevant claim with citations and confidence.)`);
      setThinking(false);
    }, 900);
  };

  return (
    <div className="wk-synth">
      <div className="wk-synth__head">
        <div className="wk-eyebrow" style={{ margin: 0 }}>Synthesis · {fragment.id}</div>
        <span className="wk-synth__authored">
          {fragment.actor === 'agent' ? 'AGENT-AUTHORED' : 'USER-AUTHORED'}
        </span>
      </div>
      <div className="wk-synth__body">
        {counterpart && (
          <div className="wk-conflict">
            <div className="wk-conflict__head">
              <span>⚠</span>
              <span>Disagrees with another memory</span>
            </div>
            <div className="wk-conflict__body">
              {(counterpart.summary || counterpart.content || '').slice(0, 240)}
            </div>
            <div className="wk-conflict__meta">
              {prettySource(counterpart.source)} · {relativeTime(counterpart.createdAt)}
            </div>
            {resolutionState === 'resolved' ? (
              <div className="wk-conflict__resolved">✓ Resolution stored. Decay accelerated on the loser.</div>
            ) : (
              <div className="wk-conflict__actions">
                <button
                  className="wk-mini-btn wk-mini-btn--brand"
                  disabled={resolutionState === 'pending' || fragment.memoryId == null}
                  onClick={async () => {
                    if (fragment.memoryId == null) return;
                    setResolutionState('pending');
                    setResolutionError(null);
                    try {
                      const fragTime = fragment.memoryCreatedAt
                        ? new Date(fragment.memoryCreatedAt).getTime()
                        : Date.now();
                      const counterTime = new Date(counterpart.createdAt).getTime();
                      // Adopt this fragment: choose 'adopt-newer' if it's the newer one,
                      // otherwise 'adopt-older'. Server orders the pair internally.
                      const choice = fragTime >= counterTime ? 'adopt-newer' : 'adopt-older';
                      await api.resolveContradiction({
                        memoryAId: fragment.memoryId,
                        memoryBId: counterpart.id,
                        choice,
                      });
                      setResolutionState('resolved');
                    } catch (err) {
                      setResolutionError(err instanceof Error ? err.message : 'Failed');
                      setResolutionState('error');
                    }
                  }}
                >
                  ✓ Adopt this view
                </button>
                <button
                  className="wk-mini-btn"
                  disabled={resolutionState === 'pending' || fragment.memoryId == null}
                  onClick={async () => {
                    if (fragment.memoryId == null) return;
                    setResolutionState('pending');
                    setResolutionError(null);
                    try {
                      const fragTime = fragment.memoryCreatedAt
                        ? new Date(fragment.memoryCreatedAt).getTime()
                        : Date.now();
                      const counterTime = new Date(counterpart.createdAt).getTime();
                      // Adopt the counterpart: opposite of the fragment.
                      const choice = counterTime >= fragTime ? 'adopt-newer' : 'adopt-older';
                      await api.resolveContradiction({
                        memoryAId: fragment.memoryId,
                        memoryBId: counterpart.id,
                        choice,
                      });
                      setResolutionState('resolved');
                    } catch (err) {
                      setResolutionError(err instanceof Error ? err.message : 'Failed');
                      setResolutionState('error');
                    }
                  }}
                >
                  Adopt other
                </button>
                <button
                  className="wk-mini-btn"
                  disabled={resolutionState === 'pending' || fragment.memoryId == null}
                  onClick={async () => {
                    if (fragment.memoryId == null) return;
                    setResolutionState('pending');
                    setResolutionError(null);
                    try {
                      await api.resolveContradiction({
                        memoryAId: fragment.memoryId,
                        memoryBId: counterpart.id,
                        choice: 'keep-both',
                      });
                      setResolutionState('resolved');
                    } catch (err) {
                      setResolutionError(err instanceof Error ? err.message : 'Failed');
                      setResolutionState('error');
                    }
                  }}
                >
                  Keep both
                </button>
              </div>
            )}
            {resolutionState === 'error' && resolutionError && (
              <div className="wk-conflict__error">Could not resolve: {resolutionError}</div>
            )}
            {resolutionState === 'pending' && (
              <div className="wk-conflict__pending">Storing resolution…</div>
            )}
          </div>
        )}
        <div className="wk-synth__source">{fragment.raw}</div>
        <div className="wk-synth__arrow">↓</div>
        {draft ? (
          <div
            className="wk-synth__output"
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => setDraft(e.currentTarget.textContent || '')}
          >
            {draft}
          </div>
        ) : (
          <div className="wk-synth__empty">
            {thinking ? '◇ thinking…' : 'Not yet synthesized.'}
            <div style={{ marginTop: 10 }}>
              <button className="wk-mini-btn wk-mini-btn--brand" onClick={generate} disabled={thinking}>
                {thinking ? 'Reframing…' : '✦ Reframe with Clude'}
              </button>
            </div>
          </div>
        )}
        {topic && (
          <div className="wk-synth__route">
            <span className="wk-synth__route-label">Route to</span>
            <div className="wk-synth__route-target">
              <span className="wk-cdot" style={{ background: topic.color, width: 8, height: 8, borderRadius: '50%' }} />
              <span>{topic.name}</span>
              <span className="wk-synth__route-target__count">{topic.count} sources</span>
            </div>
          </div>
        )}
        {!topic && draft && (
          <div className="wk-synth__route">
            <span className="wk-synth__route-label">Suggested topic</span>
            <div className="wk-synth__route-target is-suggestion">
              <span className="wk-cdot" style={{ background: 'var(--text-faint)', width: 8, height: 8, borderRadius: '50%' }} />
              <span>+ Create new topic</span>
            </div>
          </div>
        )}
      </div>
      <div className="wk-synth__actions">
        {draft && <button className="wk-mini-btn wk-mini-btn--brand">✓ Publish</button>}
        <button className="wk-mini-btn">Skip</button>
        <button className="wk-mini-btn">Archive</button>
      </div>
    </div>
  );
}
