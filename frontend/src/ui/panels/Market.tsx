import { MoneyAction, Panel, type PanelProps } from './shared';

export default function Market(props: PanelProps) {
  return <Panel {...props} title="Grand Market">
    <p>Your cellar holds {props.run.state.kelp} kelp. Capacity: 60.</p>
    {props.run.state.development && <p className="note">Workshop price: 4 ◈ per kelp. One purchase uses one tide.</p>}
    <MoneyAction props={props} kind="buy_kelp" label="Buy kelp" quantity/>
    <MoneyAction props={props} kind="sell_kelp" label="Sell kelp" quantity/>
    <MoneyAction props={props} kind="buy_pearls" label="Buy pearls" quantity/>
    <MoneyAction props={props} kind="sell_pearls" label="Sell pearls" quantity/>
  </Panel>;
}
