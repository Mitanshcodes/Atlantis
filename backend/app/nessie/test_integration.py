"""P2 tests live beside the integration; backend/tests remains P1-owned."""
import json
from uuid import uuid4
import httpx
import pytest
from fastapi.testclient import TestClient
from app.main import create_app
from app.models import MoneyEffect
from app.settings import Settings
from app.storage import Store
from app.nessie.client import NessieClient, coins, minor_units

class Remote:
    def __init__(self):
        self.records = {}
        self.collections = {}
        self.posts = []
        self.timeout_after_write = False
        self.fail_reads = False
        self.mutate_balances = True

    def handle(self, request):
        path = request.url.path
        if request.method == 'GET':
            if self.fail_reads:
                return httpx.Response(503)
            if path in self.records:
                return httpx.Response(200, json=self.records[path])
            return httpx.Response(200, json=self.collections.get(path, []))
        body = json.loads(request.content)
        self.posts.append((path, body))
        ident = uuid4().hex[:24]
        kind = path.split('/')[-1]
        prefix = {'purchases': 'purchase', 'withdrawals': 'withdrawal'}.get(kind, kind)
        record = dict(body, _id=ident)
        if kind in ('deposits', 'purchases', 'withdrawals', 'transfers'):
            record['status'] = 'completed'
            source = self.records['/accounts/' + path.split('/')[2]]
            if self.mutate_balances:
                source['balance'] += body['amount'] * (1 if kind == 'deposits' else -1)
            if kind == 'transfers' and self.mutate_balances:
                self.records['/accounts/' + body['payee_id']]['balance'] += body['amount']
        self.records['/' + prefix + '/' + ident] = record
        self.collections.setdefault(path, []).append(record)
        if self.timeout_after_write:
            self.timeout_after_write = False
            raise httpx.ReadTimeout('response lost', request=request)
        return httpx.Response(201, json={'objectCreated': record})

@pytest.fixture(autouse=True)
def development_engine(monkeypatch):
    """These tests exercise the fixed development economy, not the P1 engine."""
    monkeypatch.setenv('ATLANTIS_ENGINE', 'development')


def setup(tmp_path, remote=None, live=False, verified=True):
    settings = Settings(db=str(tmp_path / 'test.sqlite3'), live=live, api_key='test-key',
                        loans_verified=verified, bills_verified=verified)
    remote = remote or Remote()
    client = NessieClient(settings, httpx.MockTransport(remote.handle))
    app = create_app(settings, client=client, background=False)
    return TestClient(app), app, remote

def run(client, class_id='first_of_their_line'):
    response = client.post('/api/runs', json={'class_id': class_id, 'seed': 42})
    assert response.status_code == 201
    return response.json()

def action(client, game, kind, **kwargs):
    return client.post('/api/runs/' + game['run_id'] + '/actions', json={
        'action_id': kwargs.pop('action_id', uuid4().hex), 'expected_version': game['state']['version'],
        'kind': kind, **kwargs})

def drain(app, count=20):
    for _ in range(count):
        app.state.sync.tick()

def test_idempotency_and_restart(tmp_path):
    client, app, _ = setup(tmp_path)
    game = run(client)
    first = action(client, game, 'work', action_id='same')
    assert first.status_code == 200
    assert action(client, game, 'work', action_id='same').json() == first.json()
    assert action(client, game, 'buy_kelp', quantity=1, action_id='same').status_code == 409
    assert action(client, game, 'work').status_code == 409
    client2, app2, _ = setup(tmp_path)
    resumed = client2.get('/api/runs/' + game['run_id']).json()
    assert resumed['state']['purse'] == 45000
    assert len([e for e in app2.state.store.ledger(game['run_id']) if e['id'] == 'same:0']) == 1

def test_slice_remote_balances_and_receipts(tmp_path):
    client, app, remote = setup(tmp_path, live=True)
    game = run(client)
    for kind, args in [('work', {}), ('buy_kelp', {'quantity': 5}), ('save', {'amount': 10000}), ('withdraw', {'amount': 2500})]:
        response = action(client, game, kind, **args)
        assert response.status_code == 200
        game = response.json()
    drain(app)
    ledger = client.get('/api/runs/' + game['run_id'] + '/ledger').json()
    assert all(e['status'] == 'confirmed' for e in ledger['entries']), [
        (e['id'], e['status'], e['error']) for e in ledger['entries'] if e['status'] != 'confirmed']
    assert all(b['matches'] for b in ledger['balances'].values())
    assert game['state']['purse'] == 35500
    assert game['state']['vault'] == 7500
    assert len(remote.posts) == len(ledger['entries'])

def test_timeout_reconciles_without_second_post(tmp_path):
    remote = Remote()
    client, app, _ = setup(tmp_path, remote, live=True)
    game = run(client, 'newcomer')
    remote.timeout_after_write = True
    app.state.sync.tick()
    assert app.state.store.ledger(game['run_id'])[0]['status'] == 'needs_review'
    with app.state.store.connect() as db:
        db.execute('UPDATE effects SET retry_at=0')
    app.state.sync.tick()
    assert app.state.store.ledger(game['run_id'])[0]['status'] == 'confirmed'
    assert len(remote.posts) == 1

def test_restart_sending_never_reposts_missing_result(tmp_path):
    client, app, remote = setup(tmp_path, live=True)
    game = run(client)
    with app.state.store.connect() as db:
        db.execute("UPDATE effects SET status='sending' WHERE seq=1")
    _, restarted, _ = setup(tmp_path, remote, live=True)
    restarted.state.sync.tick()
    assert restarted.state.store.ledger(game['run_id'])[0]['status'] == 'needs_review'
    assert remote.posts == []

@pytest.mark.parametrize('class_id,purse,vault,debt', [
    ('newcomer', 90000, None, 0), ('first_of_their_line', 40000, 0, 60000),
    ('caretaker', 70000, 0, 0), ('tidewalker', 50000, None, 0)])
def test_class_seeding(tmp_path, class_id, purse, vault, debt):
    client, app, _ = setup(tmp_path)
    game = run(client, class_id)
    assert (game['state']['purse'], game['state']['vault'], game['state']['debt']) == (purse, vault, debt)
    accounts = [e['body']['destination'] for e in app.state.store.ledger(game['run_id']) if e['body']['kind'] == 'account']
    assert accounts == (['purse'] if vault is None else ['purse', 'vault'])
    if vault is None:
        assert action(client, game, 'save', amount=100).status_code == 422

def test_rejection_is_atomic(tmp_path):
    client, app, _ = setup(tmp_path)
    game = run(client)
    before = app.state.store.ledger(game['run_id'])
    assert action(client, game, 'save', amount=999999).status_code == 422
    assert action(client, game, 'save', amount=-100).status_code == 422
    assert action(client, game, 'save', amount=1.5).status_code == 422
    assert action(client, game, 'buy_passage').status_code == 422
    assert client.get('/api/runs/' + game['run_id']).json()['state'] == game['state']
    assert app.state.store.ledger(game['run_id']) == before

def test_unverified_loan_never_posts_or_double_funds(tmp_path):
    client, app, remote = setup(tmp_path, live=True, verified=False)
    game = run(client)
    drain(app)
    assert not any(path.endswith('/loans') for path, _ in remote.posts)
    assert app.state.store.ledger(game['run_id'])[-1]['status'] == 'pending'
    purse = app.state.store.resource(game['run_id'], 'purse')
    assert remote.records['/accounts/' + purse]['balance'] == 400

def test_transfer_expands_to_supported_nessie_records(tmp_path):
    client, app, remote = setup(tmp_path, live=True)
    game = run(client, 'caretaker')
    response = action(client, game, 'save', amount=10000, action_id='reserve')
    assert response.status_code == 200
    drain(app)
    entries = [e for e in app.state.store.ledger(game['run_id']) if e['id'].startswith('reserve:0')]
    assert [(e['id'], e['body']['kind'], e['status']) for e in entries] == [
        ('reserve:0:out', 'withdrawal', 'confirmed'),
        ('reserve:0:in', 'deposit', 'confirmed'),
    ]
    assert not any(path.endswith('/transfers') for path, _ in remote.posts)

def test_record_only_mode_reconstructs_remote_balance(tmp_path):
    remote = Remote()
    remote.mutate_balances = False
    settings = Settings(db=str(tmp_path / 'test.sqlite3'), live=True, api_key='test-key',
                        loans_verified=True, bills_verified=False, transaction_records_only=True)
    app = create_app(settings, client=NessieClient(settings, httpx.MockTransport(remote.handle)), background=False)
    client = TestClient(app)
    game = run(client, 'caretaker')
    for kind, args in [('work', {}), ('buy_kelp', {'quantity': 5}), ('save', {'amount': 10000})]:
        response = action(client, game, kind, **args)
        assert response.status_code == 200
        game = response.json()
    drain(app)
    ledger = client.get('/api/runs/' + game['run_id'] + '/ledger').json()
    assert ledger['balances']['purse']['matches'] is True
    assert ledger['balances']['vault']['matches'] is True

def test_bill_gate_is_independent_from_verified_loans(tmp_path):
    remote = Remote()
    settings = Settings(db=str(tmp_path / 'test.sqlite3'), live=True, api_key='test-key',
                        loans_verified=True, bills_verified=False)
    app = create_app(settings, client=NessieClient(settings, httpx.MockTransport(remote.handle)), background=False)
    client = TestClient(app)
    game = run(client)
    drain(app)
    assert any(path.endswith('/loans') for path, _ in remote.posts)
    bill = MoneyEffect(effect_id='bill:0', kind='bill', source='purse', destination='tithe',
                       amount=4000, reason='Council tithe', payload={'status': 'pending', 'payee': 'Council'})
    with app.state.store.connect() as db:
        Store.effects(db, game['run_id'], [bill])
    app.state.sync.tick()
    row = app.state.store.ledger(game['run_id'])[-1]
    assert row['status'] == 'pending'
    assert 'cannot yet be read back' in row['error']
    assert not any(path.endswith('/bills') for path, _ in remote.posts)

def test_shared_merchants_reused(tmp_path):
    client, app, remote = setup(tmp_path, live=True)
    run(client, 'newcomer')
    run(client, 'caretaker')
    drain(app)
    assert sum(path == '/merchants' for path, _ in remote.posts) == 5

def test_money_conversion():
    assert coins(12345) == 123.45
    assert minor_units('123.45') == 12345

def test_environment_change_requires_new_database(tmp_path):
    setup(tmp_path, live=True)
    with pytest.raises(RuntimeError, match='separate database'):
        create_app(Settings(db=str(tmp_path / 'test.sqlite3'), live=True, api_key='different'), background=False)
