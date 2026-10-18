import json
import threading
from contextlib import asynccontextmanager
from uuid import uuid4
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .adapter import engine
from .models import Action, RunRequest, State, Transition
from .settings import Settings
from .storage import Store
from .nessie.client import NessieClient
from .nessie.seed import initial_effects
from .nessie.sync import Sync
from .nessie.operations import expand_effects
from .ai.chronicle import chronicle
from .ai.report import note as report_note

def create_app(settings=None, client=None, engine_adapter=None, background=True):
    settings = settings or Settings.env()
    store = Store(settings.db)
    bank = client or NessieClient(settings)
    sync = Sync(store, bank, settings)
    rules = engine_adapter or engine()
    stop = threading.Event()

    def worker():
        while not stop.wait(0.25):
            sync.tick()

    @asynccontextmanager
    async def lifespan(app):
        thread = threading.Thread(target=worker, daemon=True) if background else None
        if thread:
            thread.start()
        yield
        stop.set()
        if thread:
            thread.join(timeout=30)
        bank.close()

    app = FastAPI(title='Atlantis Banking', lifespan=lifespan)
    app.add_middleware(CORSMiddleware, allow_origins=['http://localhost:5173', 'http://127.0.0.1:5173'],
                       allow_methods=['GET', 'POST'], allow_headers=['Content-Type'])
    app.state.store, app.state.sync = store, sync

    def public(state: State) -> dict:
        """The state as the browser may see it: the engine's private state stays on the server."""
        data = state.model_dump()
        data['details'] = {k: v for k, v in data['details'].items() if k not in ('engine', 'bridge')}
        return data

    def read_run(db, run_id):
        row = db.execute('SELECT state FROM runs WHERE id=?', (run_id,)).fetchone()
        if not row:
            raise HTTPException(404, 'Run not found')
        return State.model_validate_json(row['state'])

    @app.get('/api/health')
    def health():
        return {'ok': True, 'nessie_live': sync.live, 'loans_verified': settings.loans_verified,
                'bills_verified': settings.bills_verified,
                'transaction_records_only': settings.transaction_records_only}

    @app.post('/api/runs', status_code=201)
    def create_run(request: RunRequest):
        transition = Transition.model_validate(rules.new_game(request.class_id, request.seed))
        if transition.state.development != bool(getattr(rules, 'DEVELOPMENT', False)):
            raise HTTPException(500, 'Engine development flag does not match its adapter')
        run_id = str(uuid4())
        with store.connect() as db:
            db.execute('INSERT INTO runs VALUES(?,?)', (run_id, transition.state.model_dump_json()))
            Store.effects(db, run_id, expand_effects(initial_effects(transition.state) + transition.effects))
            db.executemany('INSERT INTO events(run_id,season,text) VALUES(?,?,?)',
                           [(run_id, transition.state.season, event) for event in transition.events])
        return {'run_id': run_id, 'state': public(transition.state), 'events': transition.events}

    @app.get('/api/runs/{run_id}')
    def get_run(run_id: str):
        with store.connect() as db:
            state = public(read_run(db, run_id))
            rows = db.execute('SELECT text FROM events WHERE run_id=? ORDER BY seq DESC LIMIT 12', (run_id,)).fetchall()
            # Recent news, oldest first, so a reloaded page still has something to say.
            return {'run_id': run_id, 'state': state, 'events': [row['text'] for row in reversed(rows)]}

    @app.post('/api/runs/{run_id}/actions')
    def act(run_id: str, action: Action):
        with store.connect() as db:
            state = read_run(db, run_id)
            previous = db.execute('SELECT request,response FROM actions WHERE run_id=? AND id=?',
                                  (run_id, action.action_id)).fetchone()
            if previous:
                if json.loads(previous['request']) != action.model_dump():
                    raise HTTPException(409, 'Action ID was already used for different input')
                return json.loads(previous['response'])
            if state.version != action.expected_version:
                raise HTTPException(409, 'State changed; refresh before submitting a new action')
            if state.development != bool(getattr(rules, 'DEVELOPMENT', False)):
                raise HTTPException(409, 'This run belongs to a different engine mode; start a new journey')
            try:
                transition = Transition.model_validate(rules.apply_action(state, action))
            except ValueError as exc:
                raise HTTPException(422, str(exc)) from None
            if transition.state.version != state.version + 1:
                raise HTTPException(500, 'Engine must advance state version exactly once')
            ids = [e.effect_id for e in transition.effects]
            if len(ids) != len(set(ids)) or any(not i.startswith(action.action_id + ':') for i in ids):
                raise HTTPException(500, 'Engine effect IDs must be unique and prefixed by action ID')
            response = {'run_id': run_id, 'state': public(transition.state), 'events': transition.events}
            db.execute('UPDATE runs SET state=? WHERE id=?', (transition.state.model_dump_json(), run_id))
            Store.effects(db, run_id, expand_effects(transition.effects))
            db.executemany('INSERT INTO events(run_id,season,text) VALUES(?,?,?)',
                           [(run_id, state.season, event) for event in transition.events])
            db.execute('INSERT INTO actions VALUES(?,?,?,?)',
                       (run_id, action.action_id, action.model_dump_json(), json.dumps(response)))
        return response

    @app.get('/api/runs/{run_id}/ledger')
    def ledger(run_id: str):
        with store.connect() as db:
            state = read_run(db, run_id)
        return {'entries': store.ledger(run_id), 'live': sync.live, 'balances': sync.balances(run_id, state)}

    @app.get('/api/runs/{run_id}/chronicle')
    def get_chronicle(run_id: str, season: str | None = None):
        with store.connect() as db:
            state = read_run(db, run_id)
            season = season or state.season
            if season not in ('Spring', 'Summer', 'Autumn', 'Long Dark'):
                raise HTTPException(422, 'Unknown season')
            rows = db.execute('SELECT text FROM events WHERE run_id=? AND season=? ORDER BY seq', (run_id, season)).fetchall()
        # Only server-recorded engine events go to the narrator; never browser-supplied facts.
        events = [row['text'] for row in rows]
        key = f'chronicle:{run_id}:{season}:{state.version}'
        cached = store.cached(key)
        if cached:
            return cached
        result = chronicle(season, events)
        store.cache(key, result)
        return result

    def report_of(run_id: str, season: str) -> dict:
        if not callable(getattr(rules, 'season_report', None)):
            raise HTTPException(404, 'This engine writes no season reports')
        with store.connect() as db:
            state = read_run(db, run_id)
        try:
            return rules.season_report(state, season)
        except LookupError as exc:
            raise HTTPException(404, str(exc)) from None

    @app.get('/api/runs/{run_id}/report')
    def get_report(run_id: str, season: str):
        """The season's report card: marks, tides, coin, investments, the Modern Mirror (whole coin)."""
        report = report_of(run_id, season)
        report.pop('facts', None)
        return report

    @app.get('/api/runs/{run_id}/report/note')
    def get_report_note(run_id: str, season: str):
        """Chelo's note on the report: OpenAI from the engine's facts, else a hand-written line."""
        key = f'report-note:{run_id}:{season}'
        cached = store.cached(key)
        if cached:
            return cached
        result = report_note(report_of(run_id, season))
        if result['source'] == 'openai':
            store.cache(key, result)
        return result

    return app

app = create_app()
