import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useBanking } from '../store';
import type { ClassId } from '../types';
import Bank from '../ui/panels/Bank';
import Market from '../ui/panels/Market';
import Exchange from '../ui/panels/Exchange';
import Ledger from '../ui/panels/Ledger';
import { coin } from '../ui/panels/shared';
import './workshop.css';

function Workshop() {
  const bank = useBanking();
  const [classId, setClassId] = useState<ClassId>('first_of_their_line');
  const [panel, setPanel] = useState('bank');
  const locked = bank.busy || !!bank.pending;
  const props = bank.run ? { open: true, run: bank.run, busy: locked, onClose: () => setPanel(''), onAction: bank.act } : null;
  return <main>
    <header className="masthead"><div><p className="eyebrow">ATLANTIS / PERSON 2</p><h1>The Banking Workshop</h1>
      <p>Follow the coin. Every movement leaves a record.</p></div><span className="seal">◈</span></header>
    <div className="workshop-banner">Integration workshop · {bank.run?.state.development === false ? 'P1 engine connected' : 'Development adapter · fixed test economy'}</div>
    <section className="journey"><label>Choose your starting place<select value={classId} onChange={e => setClassId(e.target.value as ClassId)}>
      <option value="first_of_their_line">First of Their Line</option><option value="newcomer">Newcomer</option>
      <option value="caretaker">Caretaker</option><option value="tidewalker">Tidewalker</option></select></label>
      <button disabled={locked} onClick={() => void bank.create(classId)}>{bank.run ? 'Start a new journey' : 'Begin journey'}</button>
      {bank.run && <small>Your current journey is saved automatically.</small>}
    </section>
    {bank.error && <p className="error" role="alert">{bank.error}</p>}
    {bank.pending && <div className="workshop-banner" role="status">An action is awaiting a response. <button disabled={bank.busy} onClick={() => void bank.retry()}>Retry saved action</button></div>}
    {bank.run && props ? <>
      <section className="run-summary"><div><span>Purse</span><strong>{coin(bank.run.state.purse)}</strong></div>
        <div><span>Vault</span><strong>{bank.run.state.vault === null ? 'Unavailable' : coin(bank.run.state.vault)}</strong></div>
        <div><span>{bank.run.state.season}</span><strong>{bank.run.state.tides} tides</strong></div>
        <div><span>Kelp stored</span><strong>{bank.run.state.kelp}</strong></div></section>
      <nav aria-label="Money locations">{['bank', 'market', 'exchange', 'ledger'].map(name =>
        <button key={name} className={panel === name ? 'selected' : 'quiet'} aria-pressed={panel === name} onClick={() => setPanel(name)}>{name}</button>)}
        {bank.run.state.available_actions.includes('work') && <button disabled={locked || bank.run.state.tides < 1}
          onClick={() => void bank.act({ kind: 'work' })}>Work a shift</button>}</nav>
      <div aria-live="polite" className="activity">{bank.busy ? 'Recording your action…' : bank.run.events.join(' · ')}</div>
      <Bank {...props} open={panel === 'bank'}/><Market {...props} open={panel === 'market'}/>
      <Exchange {...props} open={panel === 'exchange'}/><Ledger open={panel === 'ledger'} onClose={props.onClose} ledger={bank.ledger}/>
      <footer>Journey <code>{bank.run.run_id}</code> · State {bank.run.state.version}</footer>
    </> : <section className="empty"><h2>A year begins with a single coin.</h2><p>Open a journey, earn a wage, stock your cellar, and build a reserve.</p></section>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<Workshop/>);
