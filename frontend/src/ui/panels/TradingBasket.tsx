import { useState } from 'react';
import type { Order } from '../../types';
import type { PanelProps } from './shared';

export default function TradingBasket({ props, kind, choices }: {
  props: PanelProps; kind: 'market_visit' | 'exchange_visit'; choices: { id: string; label: string }[];
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [target, setTarget] = useState(choices[0].id);
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [quantity, setQuantity] = useState('1');
  const count = Number(quantity);
  const valid = /^\d+$/.test(quantity) && Number.isSafeInteger(count) && count > 0;
  return <div>
    <p>Group your orders into one visit. The engine validates and applies the entire visit together.</p>
    <form className="journey" onSubmit={e => {
      e.preventDefault();
      if (valid && orders.length < 50) setOrders([...orders, { side, target, quantity: count }]);
    }}>
      <label>Good or house<select value={target} onChange={e => setTarget(e.target.value)}>
        {choices.map(choice => <option key={choice.id} value={choice.id}>{choice.label}</option>)}
      </select></label>
      <label>Order type<select value={side} onChange={e => setSide(e.target.value as 'buy' | 'sell')}>
        <option value="buy">Buy</option><option value="sell">Sell</option>
      </select></label>
      <label>Units<input inputMode="numeric" value={quantity} onChange={e => setQuantity(e.target.value)}/></label>
      <button disabled={props.busy || !valid || orders.length >= 50}>Add order</button>
    </form>
    <ol>{orders.map((order, index) => <li key={index}>
      {order.side} {order.quantity} × {choices.find(choice => choice.id === order.target)?.label}
      {' '}<button className="quiet" disabled={props.busy} onClick={() => setOrders(orders.filter((_, i) => i !== index))}>Remove order {index + 1}</button>
    </li>)}</ol>
    <button disabled={props.busy || !orders.length} onClick={() => void props.onAction({ kind, orders })}>Submit visit</button>
    <p className="note">Review your inventory and Ledger after submission. Clear filled orders before another visit.</p>
    <button className="quiet" disabled={props.busy || !orders.length} onClick={() => setOrders([])}>Clear orders</button>
  </div>;
}
