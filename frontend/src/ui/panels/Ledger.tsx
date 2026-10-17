import type { Ledger as LedgerData } from '../../types';
import { coin, Panel } from './shared';

export default function Ledger({ open, onClose, ledger }: { open: boolean; onClose: () => void; ledger: LedgerData | null }) {
  return <Panel open={open} onClose={onClose} title="The Ledger">
    {!ledger ? <p>Loading your records…</p> : <>
      <p className="note">{ledger.live ? 'Connected to Nessie. Pending entries have not yet been confirmed.' : 'Local workshop mode. Entries are saved for later sync; no remote transactions have been claimed.'}</p>
      <div className="balance-checks">{Object.entries(ledger.balances).map(([name, value]) => <p key={name}>
        <strong>{name === 'purse' ? 'Purse' : 'Vault'}:</strong> {coin(value.expected)} locally · {value.remote === null ? 'remote verification pending' : `${coin(value.remote)} remotely · ${value.matches ? 'matched' : 'difference needs review'}`}
        {value.cached_remote !== null && <small> · Last seen {coin(value.cached_remote)}{value.cached_at ? ` at ${new Date(value.cached_at * 1000).toLocaleTimeString()}` : ''} (cached)</small>}
      </p>)}</div>
      <ol className="receipt-list">{ledger.entries.map(entry => <li key={entry.seq}>
        <div className="receipt-heading"><strong>{entry.body.reason.replaceAll('_', ' ')}</strong>
          <span className={`status status-${entry.status}`}>{entry.status.replaceAll('_', ' ')}</span></div>
        <p>{entry.body.amount > 0 ? coin(entry.body.amount) : 'Resource setup'}</p>
        {entry.error && <p className="note">{entry.error}</p>}
        <details><summary>Inspect Nessie evidence</summary>
          <p>Effect: <code>{entry.id}</code> · Write attempts: {entry.attempts}</p>
          <pre>{JSON.stringify(entry.receipt ?? { message: 'No confirmed remote receipt yet' }, null, 2)}</pre>
        </details>
      </li>)}</ol>
    </>}
  </Panel>;
}
