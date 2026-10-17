"""Opt-in live capability probe: python -m app.nessie.probe --write.

Creates isolated synthetic resources and keeps their IDs for inspection. Does not
delete data or enable application flags. Every invocation uses a new probe ID.
"""
import argparse
import json
from dataclasses import replace
from pathlib import Path
from uuid import uuid4
from ..models import MoneyEffect, State
from ..settings import Settings
from ..storage import Store
from .client import NessieClient
from .sync import Sync, entity

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write', action='store_true', help='Create synthetic Nessie resources and transactions')
    parser.add_argument('--obligations', action='store_true', help='Also inspect bill and loan balance effects')
    args = parser.parse_args()
    settings = Settings.env()
    if not args.write:
        parser.error('Pass --write to explicitly enable isolated remote writes')
    if not settings.api_key:
        parser.error('Set NESSIE_API_KEY in backend/.env; do not paste it into chat')
    run_id = 'probe-' + uuid4().hex
    directory = Path('.nessie-probe') / run_id
    directory.mkdir(parents=True)
    settings = replace(settings, db=str(directory / 'probe.sqlite3'), live=True, obligations_verified=args.obligations)
    client = NessieClient(settings)
    store = Store(settings.db)
    sync = Sync(store, client, settings)
    state = State(class_id='first_of_their_line', seed=42, purse=20000, vault=0)
    with store.connect() as db:
        db.execute('INSERT INTO runs VALUES(?,?)', (run_id, state.model_dump_json()))
    report = {'probe_id': run_id, 'host': settings.base_url, 'steps': [], 'completed': False}
    def balances():
        result = {}
        for name in ('purse', 'vault', 'credit'):
            ident = store.resource(run_id, name)
            if ident:
                result[name] = entity(client.get('/accounts/' + ident)).get('balance')
        return result
    def effect(name, kind, **kwargs):
        return MoneyEffect(effect_id=name, kind=kind, reason='Capability probe: ' + name, **kwargs)
    effects = [
        effect('customer', 'customer', destination='customer'),
        effect('purse', 'account', destination='purse', amount=20000, payload={'type': 'Checking'}),
        effect('vault', 'account', destination='vault', payload={'type': 'Savings'}),
        effect('credit', 'account', destination='credit', payload={'type': 'Credit Card'}),
        effect('merchant', 'merchant', destination='probe_market'),
        effect('wage', 'deposit', destination='purse', amount=1000),
        effect('kelp', 'purchase', source='purse', merchant='probe_market', amount=200),
        effect('reserve', 'transfer', source='purse', destination='vault', amount=500),
        effect('loss', 'withdrawal', source='purse', amount=100),
        effect('credit_purchase', 'purchase', source='credit', merchant='probe_market', amount=100),
    ]
    if args.obligations:
        effects += [
            effect('bill', 'bill', source='purse', destination='probe_bill', amount=100,
                   payload={'status': 'pending', 'payee': 'Atlantis probe'}),
            effect('loan', 'loan', source='purse', destination='probe_loan', amount=1000,
                   payload={'type': 'personal', 'status': 'approved', 'credit_score': 600, 'monthly_payment': 1}),
        ]
    try:
        for e in effects:
            step = {'effect': e.effect_id, 'before': balances()}
            report['steps'].append(step)
            with store.connect() as db:
                Store.effects(db, run_id, [e])
            # Save intent before dispatch, including for interrupted invocations.
            (directory / 'report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
            sync.tick()
            row = store.ledger(run_id)[-1]
            step.update(after=balances(), status=row['status'], receipt=row['receipt'], error=row['error'])
            if row['status'] != 'confirmed':
                report['stopped_reason'] = 'Inspect this step before any further writes; no automatic replay'
                break
        else:
            report['completed'] = True
    except Exception as exc:
        # Never serialize HTTP exception strings, which may contain the key URL.
        report['stopped_reason'] = type(exc).__name__ + ': inspect saved receipts locally'
    finally:
        (directory / 'report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
        client.close()
    print(f'Capability report: {directory / "report.json"}')
    print('Complete' if report['completed'] else 'Incomplete: review report before enabling live gameplay')
    return 0 if report['completed'] else 1

if __name__ == '__main__':
    raise SystemExit(main())
