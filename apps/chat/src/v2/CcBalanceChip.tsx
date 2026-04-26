/**
 * Topbar balance chip — shows the current USDC balance and opens the top-up
 * modal on click. Uses the same mono+chip aesthetic as `CcSavingsChip`.
 */
export function CcBalanceChip({
  balance,
  onTopUp,
}: {
  balance: number | null;
  onTopUp: () => void;
}) {
  const isLow = balance !== null && balance < 0.5;
  const isEmpty = balance !== null && balance <= 0;

  const display =
    balance == null
      ? '—'
      : balance >= 100
      ? `$${Math.round(balance).toLocaleString()}`
      : `$${balance.toFixed(2)}`;

  return (
    <button
      type="button"
      onClick={onTopUp}
      title={isEmpty ? 'No balance — top up to use Pro models' : 'Top up balance'}
      className="cc-savedchip"
      style={{
        cursor: 'pointer',
        background: isEmpty ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
        border: '1px solid var(--line-strong)',
        borderColor: isEmpty
          ? 'var(--clude-danger)'
          : isLow
          ? 'var(--clude-warn)'
          : 'var(--line-strong)',
        color: isEmpty ? 'var(--clude-danger)' : 'var(--fg-1)',
      }}
    >
      <span
        className="cc-savedchip__val"
        style={{ color: isEmpty ? 'var(--clude-danger)' : 'var(--fg-1)' }}
      >
        {display}
      </span>
      <span className="cc-savedchip__lbl">
        {isEmpty ? 'top up' : 'balance · USDC'}
      </span>
    </button>
  );
}
