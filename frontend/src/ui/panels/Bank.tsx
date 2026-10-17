import { coin, MoneyAction, Panel, type PanelProps } from './shared';

export default function Bank(props: PanelProps) {
  const { state } = props.run;
  return <Panel {...props} title="The Bank">
    <p>Keep spending coin in your Purse. Store your reserve in the Vault.</p>
    <dl className="balances"><div><dt>Purse</dt><dd>{coin(state.purse)}</dd></div>
      <div><dt>Vault</dt><dd>{state.vault === null ? 'Not yet open' : coin(state.vault)}</dd></div>
      <div><dt>Outstanding obligations</dt><dd>{coin(state.debt)}</dd></div>
      <div><dt>Standing</dt><dd>{state.standing ?? 'Unrated'}</dd></div></dl>
    <MoneyAction props={props} kind="save" label="Move Purse coin into the Vault"/>
    <MoneyAction props={props} kind="withdraw" label="Return Vault coin to the Purse"/>
    <MoneyAction props={props} kind="repay_guild" label="Repay the guild" target="guild_loan"/>
    <MoneyAction props={props} kind="repay_credit" label="Repay Leviathan Credit" target="credit"/>
    <MoneyAction props={props} kind="repay_black_reef" label="Repay the Black Reef" target="black_reef"/>
    <MoneyAction props={props} kind="pay_tithe" label="Pay the Council tithe"/>
    <MoneyAction props={props} kind="pay_care" label="Pay the care bill"/>
    <MoneyAction props={props} kind="pay_circle" label="Contribute to the circle"/>
    <MoneyAction props={props} kind="borrow_black_reef" label="Request a Black Reef advance"/>
    {state.available_actions.includes('open_secured_card') && <button disabled={props.busy}
      onClick={() => void props.onAction({ kind: 'open_secured_card' })}>Open a secured Leviathan card</button>}
    {state.development && <p className="note">This workshop supports transfers. Debt settlement and card rules await the game engine.</p>}
  </Panel>;
}
