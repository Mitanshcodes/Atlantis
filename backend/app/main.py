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

    def read_run(db, run_id):
        row = db.execute('SELECT state FROM runs WHERE id=?', (run_id,)).fetchone()
        if not row:
            raise HTTPException(404, 'Run not found')
        return State.model_validate_json(row['state'])

    @app.get('/api/health')
    def health():
        return {'ok': True, 'nessie_live': sync.live, 'obligations_verified': settings.obligations_verified}

    @app.post('/api/runs', status_code=201)
    def create_run(request: RunRequest):
        transition = Transition.model_validate(rules.new_game(request.class_id, request.seed))
        run_id = str(uuid4())
        with store.connect() as db:
            db.execute('INSERT INTO runs VALUES(?,?)', (run_id, transition.state.model_dump_json()))
            Store.effects(db, run_id, initial_effects(transition.state) + transition.effects)
        return {'run_id': run_id, 'state': transition.state, 'events': transition.events}

    @app.get('/api/runs/{run_id}')
    def get_run(run_id: str):
        with store.connect() as db:
            return {'run_id': run_id, 'state': read_run(db, run_id), 'events': []}

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
            try:
                transition = Transition.model_validate(rules.apply_action(state, action))
            except ValueError as exc:
                raise HTTPException(422, str(exc)) from None
            if transition.state.version != state.version + 1:
                raise HTTPException(500, 'Engine must advance state version exactly once')
            ids = [e.effect_id for e in transition.effects]
            if len(ids) != len(set(ids)) or any(not i.startswith(action.action_id + ':') for i in ids):
                raise HTTPException(500, 'Engine effect IDs must be unique and prefixed by action ID')
            response = {'run_id': run_id, 'state': transition.state.model_dump(), 'events': transition.events}
            db.execute('UPDATE runs SET state=? WHERE id=?', (transition.state.model_dump_json(), run_id))
            Store.effects(db, run_id, transition.effects)
            db.execute('INSERT INTO actions VALUES(?,?,?,?)',
                       (run_id, action.action_id, action.model_dump_json(), json.dumps(response)))
        return response

    @app.get('/api/runs/{run_id}/ledger')
    def ledger(run_id: str):
        with store.connect() as db:
            state = read_run(db, run_id)
        return {'entries': store.ledger(run_id), 'live': sync.live, 'balances': sync.balances(run_id, state)}

    return app

app = create_app()
