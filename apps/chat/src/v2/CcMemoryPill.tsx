export function CcMemoryPill({
  recalledCount,
  onOpen,
}: {
  recalledCount: number;
  onOpen: () => void;
}) {
  return (
    <div className="cc-mpill" role="status" aria-label="Memory state">
      <span className="cc-mpill__dot" />
      <span className="cc-mpill__lead">
        {recalledCount > 0 ? 'Continuing your thread' : 'New thread — memory ready'}
      </span>
      <span className="cc-mpill__sep">·</span>
      <span className="cc-mpill__meta">
        {recalledCount} {recalledCount === 1 ? 'memory' : 'memories'} active
      </span>
      <button type="button" className="cc-mpill__btn" onClick={onOpen}>
        Inspect ↗
      </button>
    </div>
  );
}
