import { useState } from 'react';
import { MoneyAction, Panel, type PanelProps } from './shared';
import TradingBasket from './TradingBasket';

export default function Exchange(props: PanelProps) {
  const [house, setHouse] = useState('oro');
  const available = props.run.state.available_actions;
  return <Panel {...props} title="Harbor Exchange">
    <p>Settle every obligation before buying Passage.</p>
    {available.includes('exchange_visit') ? <TradingBasket props={props} kind="exchange_visit" choices={[
      { id: 'oro', label: 'Oro & Daughters' }, { id: 'leviathan', label: 'Leviathan Line' },
      { id: 'deepcoral', label: 'Deepcoral Salvage' }, { id: 'tide_index', label: 'Tide Index' },
    ]}/> : <>
    {available.some(x => x === 'buy_shares' || x === 'sell_shares') && <label>Shipping house
      <select value={house} onChange={e => setHouse(e.target.value)}>
        <option value="oro">Oro &amp; Daughters</option><option value="leviathan">Leviathan Line</option>
        <option value="deepcoral">Deepcoral Salvage</option><option value="tide_index">Tide Index</option>
      </select></label>}
    <MoneyAction props={props} kind="buy_shares" label="Buy shares" target={house} quantity/>
    <MoneyAction props={props} kind="sell_shares" label="Sell shares" target={house} quantity/>
    </>}
    {available.includes('buy_passage') && <button disabled={props.busy}
      onClick={() => void props.onAction({ kind: 'buy_passage' })}>Buy Passage</button>}
    {props.run.state.passage && <p>Your Passage is secured.</p>}
    {props.run.state.development && <p className="note">Trading and Passage unlock when the P1 engine supplies their rules.</p>}
  </Panel>;
}
