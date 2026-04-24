import { useEffect, useRef, useState } from 'react';

export function CcComposer({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void | Promise<void>;
  disabled?: boolean;
}) {
  const [val, setVal] = useState('');
  const ref = useRef<HTMLTextAreaElement | null>(null);

  // Auto-grow up to 200px. Matches the design prototype's composer behavior.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, [val]);

  const submit = () => {
    const trimmed = val.trim();
    if (!trimmed || disabled) return;
    setVal('');
    onSend(trimmed);
  };

  return (
    <div className="cc-composer">
      <div className="cc-composer__inner">
        <div className="cc-composer__box">
          <textarea
            ref={ref}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Message Clude · memories update in the background"
            rows={1}
            disabled={disabled}
          />
          <button
            type="button"
            className="cc-composer__send"
            disabled={!val.trim() || disabled}
            onClick={submit}
          >
            Send ↗
          </button>
        </div>
        <div className="cc-composer__foot">
          <div className="cc-composer__footleft">
            <span>◈ memory · on</span>
          </div>
          <div className="cc-composer__footright">
            <span className="cc-composer__foothint">⏎ send</span>
          </div>
        </div>
      </div>
    </div>
  );
}
