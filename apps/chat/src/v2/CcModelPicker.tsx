import { useState } from 'react';
import { MEMORY_COLORS, type V2Model } from './types';

/**
 * Model picker — dropdown variant only for v1 of the v2 surface. Consumes
 * the real `/api/chat/models` catalog (passed in as `models`), so every
 * option is a model the server actually accepts on /api/chat/messages.
 */
export function CcModelPicker({
  models,
  value,
  onChange,
}: {
  models: V2Model[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = models.find((m) => m.id === value) || models[0];
  if (!current) return null;

  return (
    <div className="cc-mpick cc-mpick--dropdown">
      <button
        type="button"
        className="cc-mpick__trigger"
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className="cc-mpick__optdot"
          style={{ background: current.free ? MEMORY_COLORS.semantic : 'var(--brand)' }}
        />
        <span>{current.name}</span>
        <span className="cc-mpick__chev">▾</span>
      </button>
      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
            onClick={() => setOpen(false)}
          />
          <div className="cc-mpick__menu">
            {models.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`cc-mpick__opt ${m.id === value ? 'is-active' : ''}`}
                onClick={() => {
                  onChange(m.id);
                  setOpen(false);
                }}
              >
                <span
                  className="cc-mpick__optdot"
                  style={{
                    background:
                      m.id === value
                        ? 'var(--brand)'
                        : m.free
                        ? MEMORY_COLORS.semantic
                        : 'var(--fg-4)',
                  }}
                />
                <span>
                  <div className="cc-mpick__optname">{m.name}</div>
                  <div className="cc-mpick__optsub">{m.sub}</div>
                </span>
                <span className={`cc-mpick__opttag ${m.free ? 'is-oss' : ''}`}>{m.tag}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
