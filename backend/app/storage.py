import json
import sqlite3
from contextlib import contextmanager

class Store:
    def __init__(self, path):
        self.path = str(path)
        with self.connect() as db:
            db.executescript('''
            CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY, state TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS actions(run_id TEXT, id TEXT, request TEXT, response TEXT, PRIMARY KEY(run_id,id));
            CREATE TABLE IF NOT EXISTS effects(seq INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT, id TEXT,
              body TEXT, status TEXT DEFAULT 'pending', receipt TEXT, error TEXT, attempts INTEGER DEFAULT 0,
              retry_at REAL DEFAULT 0, UNIQUE(run_id,id));
            CREATE TABLE IF NOT EXISTS resources(scope TEXT, name TEXT, remote_id TEXT, PRIMARY KEY(scope,name));
            CREATE TABLE IF NOT EXISTS cache(key TEXT PRIMARY KEY, body TEXT);
            CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT, season TEXT, text TEXT);
            ''')

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=15)
        db.row_factory = sqlite3.Row
        try:
            db.execute('BEGIN IMMEDIATE')
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    @staticmethod
    def effects(db, run_id, effects):
        for e in effects:
            db.execute('INSERT INTO effects(run_id,id,body) VALUES(?,?,?)',
                       (run_id, e.effect_id, e.model_dump_json()))

    def ledger(self, run_id):
        with self.connect() as db:
            return [dict(row) | {'body': json.loads(row['body']),
                    'receipt': json.loads(row['receipt']) if row['receipt'] else None}
                    for row in db.execute('SELECT * FROM effects WHERE run_id=? ORDER BY seq', (run_id,))]

    def resource(self, scope, name):
        with self.connect() as db:
            row = db.execute('SELECT remote_id FROM resources WHERE scope=? AND name=?', (scope, name)).fetchone()
            return row['remote_id'] if row else None

    def cached(self, key):
        with self.connect() as db:
            row = db.execute('SELECT body FROM cache WHERE key=?', (key,)).fetchone()
            return json.loads(row['body']) if row else None

    def cache(self, key, body):
        with self.connect() as db:
            db.execute('INSERT OR REPLACE INTO cache VALUES(?,?)', (key, json.dumps(body)))
