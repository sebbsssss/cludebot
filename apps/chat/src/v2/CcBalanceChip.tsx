/**
 * Topbar balance chip — shows the current USDC balance and opens the top-up
 * modal on click. Uses the same mono+chip aesthetic as `CcSavingsChip`.
 *
 * `walletReady` gates the click: email-only users sign in before Privy has
 * finished provisioning their embedded Solana wallet. Letting them click
 * during that window opens a modal that immediately errors with "No Solana
 * wallet connected." The chip stays visible but inert until the wallet is up.
 */
export function CcBalanceChip({
  balance,
  onTopUp,
  walletReady,
}: {
  balance: number | null;
  onTopUp: () => void;
  walletReady: boolean;
}) {
  const isLow = balance !== null && balance < 0.5;
  const isEmpty = balance !== null && balance <= 0;
  const disabled = !walletReady;

  const display =
    balance == null
      ? '—'
      : balance >= 100
      ? `$${Math.round(balance).toLocaleString()}`
      : `$${balance.toFixed(2)}`;

  const titleText = disabled
    ? 'Wallet provisioning… top-up will enable in a moment'
    : isEmpty
    ? 'No balance — top up to use Pro models'
    : 'Top up balance';

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onTopUp}
      title={titleText}
      className="cc-savedchip"
      style={{
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        background: isEmpty && !disabled ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
        border: '1px solid var(--line-strong)',
        borderColor: disabled
          ? 'var(--line-strong)'
          : isEmpty
          ? 'var(--clude-danger)'
          : isLow
          ? 'var(--clude-warn)'
          : 'var(--line-strong)',
        color: disabled
          ? 'var(--fg-3)'
          : isEmpty
          ? 'var(--clude-danger)'
          : 'var(--fg-1)',
      }}
    >
      <span
        className="cc-savedchip__val"
        style={{
          color: disabled
            ? 'var(--fg-3)'
            : isEmpty
            ? 'var(--clude-danger)'
            : 'var(--fg-1)',
        }}
      >
        {display}
      </span>
      <span className="cc-savedchip__lbl">
        {disabled ? 'wallet…' : isEmpty ? 'top up' : 'balance · USDC'}
      </span>
    </button>
  );
}
