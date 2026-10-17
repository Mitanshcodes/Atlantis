import { useId, useState, type ReactNode } from 'react';
import type { Run } from '../../types';
import type { ActionInput } from '../../store';

export interface PanelProps {
  open: boolean; onClose: () => void; run: Run;
  busy: boolean; onAction: (input: ActionInput) => Promise<void>;
}
export const coin = (minor: number) => `${(minor / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })} ◈`;
export function Panel({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const id = useId();
  return open ? <section className="money-panel" aria-labelledby={id}><header><h2 id={id}>{title}</h2>
    <button className="quiet" onClick={onClose} aria-label={`Close ${title}`}>Close</button></header>{children}</section> : null;
}
export function MoneyAction({ kind, label, props, target, quantity = false }: {
  kind: string; label: string; props: PanelProps; target?: string; quantity?: boolean;
}) {
  const [value, setValue] = useState('');
  const id = useId();
  if (!props.run.state.available_actions.includes(kind)) return null;
  const valid = quantity ? /^\d+$/.test(value) : /^\d+(\.\d{1,2})?$/.test(value);
  const amount = quantity ? Number(value) : Math.round(Number(value) * 100);
  return <form className="money-action" onSubmit={e => {
    e.preventDefault();
    if (valid && Number.isSafeInteger(amount) && amount > 0) void props.onAction({ kind, target, ...(quantity ? { quantity: amount } : { amount }) });
  }}><label htmlFor={id}>{label}</label><div className="input-row"><input id={id} inputMode={quantity ? 'numeric' : 'decimal'}
    value={value} onChange={e => setValue(e.target.value)} placeholder={quantity ? 'Units' : 'Coin'} disabled={props.busy}/>
    <button disabled={props.busy || !valid || !Number.isSafeInteger(amount) || amount <= 0}>Confirm</button></div></form>;
}
