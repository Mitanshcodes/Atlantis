"""Convert engine effects into inspectable Nessie requests. No economic rules."""
import hashlib
from dataclasses import dataclass
from datetime import datetime, timezone
from .client import coins

ADDRESS = {'street_number': '1', 'street_name': 'Harbor Way', 'city': 'Atlantis', 'state': 'VA', 'zip': '23219'}

@dataclass
class Operation:
    path: str
    body: dict
    collection: str
    read_prefix: str
    marker_field: str
    marker: str
    resource_scope: str | None = None
    resource_name: str | None = None
    method: str = 'POST'
    remote_id: str | None = None

def operation(store, run_id, effect):
    e = effect
    scope = 'world' if e.kind == 'merchant' else run_id
    marker = 'atl-' + hashlib.sha256(f'{scope}:{e.destination if e.kind == "merchant" else e.effect_id}'.encode()).hexdigest()[:24]
    def account(name):
        result = store.resource(run_id, name)
        if not result:
            raise ValueError(f'Missing resource dependency: {name}')
        return result
    amount = coins(e.amount)
    if e.kind in ('account', 'deposit', 'loan', 'loan_update'):
        # Current official schema declares these as integers. Never round away coin.
        if e.amount % 100:
            raise ValueError('This Nessie endpoint documents whole coins only; verify fractional support before enabling this effect')
        amount = e.amount // 100
    if e.kind in ('bill_update', 'loan_update'):
        remote_id = account(e.source)
        prefix = '/bills' if e.kind == 'bill_update' else '/loans'
        allowed = ('status', 'payee', 'payment_date', 'recurring_date') if e.kind == 'bill_update' else ('type', 'status', 'credit_score', 'monthly_payment')
        body = {key: value for key, value in e.payload.items() if key in allowed}
        field = 'nickname' if e.kind == 'bill_update' else 'description'
        body[field] = marker
        body['payment_amount' if e.kind == 'bill_update' else 'amount'] = amount
        return Operation(prefix + '/' + remote_id, body, prefix + '/' + remote_id, prefix, field, marker,
                         method='PUT', remote_id=remote_id)
    if e.kind == 'customer':
        body = {'first_name': 'Atlantis', 'last_name': marker, 'address': ADDRESS}
        return Operation('/customers', body, '/customers', '/customers', 'last_name', marker, run_id, e.destination)
    if e.kind == 'account':
        customer = account(e.source or 'customer')
        path = f'/customers/{customer}/accounts'
        return Operation(path, {'type': e.payload.get('type', 'Checking'), 'nickname': marker,
             'rewards': 0, 'balance': amount}, path, '/accounts', 'nickname', marker, run_id, e.destination)
    if e.kind == 'merchant':
        return Operation('/merchants', {'name': marker}, '/merchants', '/merchants', 'name', marker, 'world', e.destination)
    source = account(e.destination if e.kind == 'deposit' else e.source)
    plural = {'deposit': 'deposits', 'purchase': 'purchases', 'transfer': 'transfers',
              'withdrawal': 'withdrawals', 'bill': 'bills', 'loan': 'loans'}[e.kind]
    path = f'/accounts/{source}/{plural}'
    prefix = {'purchase': '/purchase', 'withdrawal': '/withdrawal'}.get(e.kind, '/' + plural)
    body = {'medium': 'balance', 'transaction_date': datetime.now(timezone.utc).date().isoformat(),
            'amount': amount, 'description': marker}
    field = 'description'
    if e.kind == 'deposit':
        body['status'] = 'completed'
    elif e.kind == 'purchase':
        merchant = store.resource('world', e.merchant)
        if not merchant:
            raise ValueError(f'Missing merchant dependency: {e.merchant}')
        body['merchant_id'] = merchant
        body['purchase_date'] = body.pop('transaction_date')
    elif e.kind == 'transfer':
        body['payee_id'] = account(e.destination)
    elif e.kind == 'bill':
        body = {key: value for key, value in e.payload.items() if key in ('status', 'payee', 'payment_date', 'recurring_date')}
        body.update(status=body.get('status', 'pending'), payee=body.get('payee', e.reason),
                    payment_amount=amount, nickname=marker)
        field = 'nickname'
    elif e.kind == 'loan':
        body = {key: value for key, value in e.payload.items() if key in ('type', 'status', 'credit_score', 'monthly_payment')}
        if not all(k in body for k in ('type', 'status', 'credit_score', 'monthly_payment')):
            raise ValueError('Loan effect requires type, status, credit_score and monthly_payment')
        body.update(amount=amount, description=marker)
    return Operation(path, body, path, prefix, field, marker,
                     run_id if e.destination and e.kind in ('loan', 'bill') else None,
                     e.destination if e.kind in ('loan', 'bill') else None)
