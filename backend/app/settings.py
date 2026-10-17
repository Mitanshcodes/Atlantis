import os
from dataclasses import dataclass
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / '.env')

@dataclass(frozen=True)
class Settings:
    db: str = 'atlantis.sqlite3'
    base_url: str = 'https://prod-api.nessieisreal.com'
    api_key: str = ''
    live: bool = False
    obligations_verified: bool = False

    @classmethod
    def env(cls):
        return cls(db=os.getenv('ATLANTIS_DB', 'atlantis.sqlite3'),
                   base_url=os.getenv('NESSIE_BASE_URL', cls.base_url).rstrip('/'),
                   api_key=os.getenv('NESSIE_API_KEY', ''),
                   live=os.getenv('NESSIE_LIVE', '').lower() == 'true',
                   obligations_verified=os.getenv('NESSIE_OBLIGATIONS_VERIFIED', '').lower() == 'true')
