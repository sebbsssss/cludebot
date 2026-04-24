import { useState } from 'react';
import { MEMORY_COLORS } from './types';
import { V2_MODELS } from './data';

/**
 * Model picker — dropdown variant only for v1 of the v2 surface.
 * The design explores segmented + ⌘K-palette variants; we'll add those if
 * we promote the route out of staging.
 */
export function CcModelPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = V2_MODELS.find((m) => m.id === value) || V2_MODELS[0];

  return (
    <div className="cc-mpick cc-mpick--dropdown">
      <button
        type="button"
        className="cc-mpick__trigger"
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className="cc-mpick__optdot"
          style={{ background: current.oss ? MEMORY_COLORS.semantic : 'var(--brand)' }}
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
            {V2_MODELS.map((m) => (
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
                        : m.oss
                        ? MEMORY_COLORS.semantic
                        : 'var(--fg-4)',
                  }}
                />
                <span>
                  <div className="cc-mpick__optname">{m.name}</div>
                  <div className="cc-mpick__optsub">{m.sub}</div>
                </span>
                <span className={`cc-mpick__opttag ${m.oss ? 'is-oss' : ''}`}>{m.tag}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
