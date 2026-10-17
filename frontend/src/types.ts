// Mirror backend/app/models.py. Money is integer hundredths of a coin.
export type ClassId = 'newcomer' | 'first_of_their_line' | 'caretaker' | 'tidewalker';
export interface Order { side: 'buy' | 'sell'; target: string; quantity: number }
export interface Action {
  action_id: string; expected_version: number; kind: string;
  amount?: number | null; quantity?: number | null; target?: string | null;
  orders?: Order[] | null;
}
export interface State {
  class_id: ClassId; seed: number; version: number; development: boolean;
  purse: number; vault: number | null; debt: number; kelp: number; tides: number;
  season: string; standing: number | null; passage: boolean;
  available_actions: string[]; details: Record<string, unknown>;
}
export interface MoneyEffect {
  effect_id: string;
  kind: 'customer' | 'account' | 'merchant' | 'deposit' | 'purchase' | 'transfer' | 'withdrawal' | 'bill' | 'loan' | 'bill_update' | 'loan_update';
  source: string | null; destination: string | null; merchant: string | null;
  amount: number; reason: string; payload: Record<string, unknown>;
}
export interface Transition { state: State; events: string[]; effects: MoneyEffect[] }
export interface Run { run_id: string; state: State; events: string[] }
export interface LedgerEntry {
  seq: number; id: string; body: MoneyEffect;
  status: 'pending' | 'sending' | 'confirmed' | 'needs_review' | 'failed';
  receipt: Record<string, unknown> | null; error: string | null; attempts: number;
}
export interface Ledger {
  entries: LedgerEntry[]; live: boolean;
  balances: Record<string, { expected: number; remote: number | null; matches: boolean | null;
    cached_remote: number | null; cached_at: number | null }>;
}
