"""Applies to every backend test (tests/ and app/nessie/). Runs before any app import.

Tests must never touch live Nessie, OpenAI or the real database, whatever is in backend/.env.
Environment variables set here win over .env, because python-dotenv doesn't override them.
"""

import os
import tempfile

os.environ["NESSIE_LIVE"] = "false"
os.environ["ATLANTIS_DB"] = os.path.join(tempfile.mkdtemp(prefix="atlantis-test-"), "test.sqlite3")
os.environ["OPENAI_API_KEY"] = ""  # the report note falls back to its hand-written line
