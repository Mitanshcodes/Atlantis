"""Durable single-process worker. Uncertain POSTs are never blindly replayed."""
import hashlib
import json
import threading
import time
from ..models import MoneyEffect
from .client import RemoteError, minor_units
from .operations import operation

def entity(body):
    if isinstance(body, dict):
        return body.get('objectCreated', body.get('data', body))
    return body

class Sync:
    def __init__(self, store, client, settings):
        self.store, self.client, self.settings = store, client, settings
        self.lock = threading.Lock()
        if settings.live:
            fingerprint = hashlib.sha256((settings.base_url + settings.api_key).encode()).hexdigest()
            old = store.cached('environment')
            if old and old != fingerprint:
                raise RuntimeError('Use a separate database when changing the Nessie host or key')
            store.cache('environment', fingerprint)
        with store.connect() as db:
            db.execute("UPDATE effects SET status='needs_review', error='Interrupted during delivery; reconcile before retry' WHERE status='sending'")

    @property
    def live(self):
        return self.settings.live and bool(self.settings.api_key)

    def update(self, seq, status, error=None, receipt=None, delay=0):
        with self.store.connect() as db:
            db.execute('UPDATE effects SET status=?,error=?,receipt=COALESCE(?,receipt),retry_at=? WHERE seq=?',
                       (status, error, json.dumps(receipt) if receipt is not None else None, time.time() + delay, seq))

    def confirm(self, row, op, record):
        record = entity(record)
        if not isinstance(record, dict) or not record.get('_id'):
            raise RemoteError('Nessie receipt has no resource ID', ambiguous=True)
        receipt = {'remote_id': record['_id'], 'path': op.read_prefix + '/' + record['_id'], 'record': record}
        if record.get(op.marker_field) != op.marker:
            raise RemoteError('Receipt correlation does not match this effect', ambiguous=True)
        if record.get('status') in ('cancelled', 'failed', 'rejected'):
            self.update(row['seq'], 'failed', 'Remote transaction was rejected', receipt)
            return
        kind = json.loads(row['body'])['kind']
        if kind in ('deposit', 'purchase', 'transfer', 'withdrawal') and record.get('status') != 'completed':
            self.update(row['seq'], 'pending', 'Nessie settlement pending', receipt, delay=5)
            return
        with self.store.connect() as db:
            if op.resource_name:
                db.execute('INSERT OR REPLACE INTO resources VALUES(?,?,?)',
                           (op.resource_scope, op.resource_name, record['_id']))
            db.execute("UPDATE effects SET status='confirmed', receipt=?,error=NULL WHERE seq=?",
                       (json.dumps(receipt), row['seq']))

    def reconcile(self, row, op):
        receipt = json.loads(row['receipt']) if row['receipt'] else None
        if receipt and receipt.get('remote_id'):
            record = self.client.get(op.read_prefix + '/' + receipt['remote_id'])
            self.confirm(row, op, record)
            return
        records = entity(self.client.get(op.collection))
        if not isinstance(records, list):
            raise RemoteError('Nessie lookup did not return a complete record list', ambiguous=True)
        matches = [r for r in records if r.get(op.marker_field) == op.marker]
        if len(matches) == 1:
            self.confirm(row, op, self.client.get(op.read_prefix + '/' + matches[0]['_id']))
        else:
            self.update(row['seq'], 'needs_review', f'Reconciliation found {len(matches)} matching records; no write retried', delay=30)

    def tick(self):
        if not self.live or not self.lock.acquire(blocking=False):
            return
        try:
            with self.store.connect() as db:
                rows = db.execute("""SELECT e.* FROM effects e WHERE e.status!='confirmed'
                    AND e.seq=(SELECT MIN(p.seq) FROM effects p WHERE p.run_id=e.run_id AND p.status!='confirmed')
                    ORDER BY e.seq""").fetchall()
            for row in rows:
                if row['status'] == 'failed' or row['retry_at'] > time.time():
                    continue
                e = MoneyEffect.model_validate_json(row['body'])
                if e.kind in ('loan', 'bill') and not self.settings.obligations_verified:
                    self.update(row['seq'], 'pending', 'Bill/loan balance behavior needs live capability verification', delay=30)
                    continue
                attempted = False
                try:
                    op = operation(self.store, row['run_id'], e)
                    existing = self.store.resource(op.resource_scope, op.resource_name) if op.resource_name else None
                    if existing:
                        self.confirm(row, op, self.client.get(op.read_prefix + '/' + existing))
                    elif row['status'] == 'needs_review' or row['receipt']:
                        self.reconcile(row, op)
                    else:
                        with self.store.connect() as db:
                            db.execute("UPDATE effects SET status='sending',attempts=attempts+1 WHERE seq=?", (row['seq'],))
                        attempted = True
                        created = entity(self.client.post(op.path, op.body))
                        if not isinstance(created, dict) or not created.get('_id'):
                            raise RemoteError('Create response omitted its resource ID', ambiguous=True)
                        # Persist the ID before the follow-up GET. A failed GET must never repeat the POST.
                        self.update(row['seq'], 'pending', receipt={'remote_id': created['_id']})
                        record = self.client.get(op.read_prefix + '/' + created['_id'])
                        self.confirm(row, op, record)
                except ValueError as exc:
                    self.update(row['seq'], 'failed', str(exc))
                except RemoteError as exc:
                    with self.store.connect() as db:
                        latest = db.execute('SELECT receipt FROM effects WHERE seq=?', (row['seq'],)).fetchone()
                    uncertain = exc.ambiguous or bool(latest['receipt']) or row['status'] == 'needs_review'
                    status = 'needs_review' if uncertain else ('pending' if exc.retryable else 'failed')
                    self.update(row['seq'], status, str(exc), delay=min(60, 2 ** min(row['attempts'] + 1, 6)))
                except Exception:
                    self.update(row['seq'], 'needs_review' if attempted else 'failed', 'Unexpected delivery error; inspect locally', delay=30)
        finally:
            self.lock.release()

    def balances(self, run_id, state):
        result = {}
        entries = self.store.ledger(run_id)
        settled = all(e['status'] == 'confirmed' for e in entries)
        for name in ('purse', 'vault'):
            expected = getattr(state, name)
            if expected is None:
                continue
            remote_id = self.store.resource(run_id, name)
            remote = None
            if self.live and settled and remote_id:
                try:
                    record = entity(self.client.get('/accounts/' + remote_id))
                    remote = minor_units(record['balance'])
                    self.store.cache(f'balance:{run_id}:{name}', {'remote': remote, 'at': time.time()})
                except (RemoteError, KeyError, ValueError, TypeError):
                    pass
            result[name] = {'expected': expected, 'remote': remote,
                            'matches': remote == expected if remote is not None else None}
        return result
