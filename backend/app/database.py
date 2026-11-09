from contextlib import contextmanager
from pathlib import Path
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import Session, sessionmaker
from .models import ShopSettings

BACKEND_DIR = Path(__file__).resolve().parents[1]

def upgrade_schema(engine):
    cfg = Config(str(BACKEND_DIR / 'alembic.ini'))
    cfg.set_main_option('script_location', str(BACKEND_DIR / 'migrations'))
    with engine.begin() as connection:
        cfg.attributes['connection'] = connection
        command.upgrade(cfg, 'head')

class Database:
    def __init__(self, path: Path):
        self.path = path.resolve()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.backup_dir = self.path.parent / 'backups'
        self.backup_dir.mkdir(exist_ok=True)
        self.engine = create_engine('sqlite:///' + self.path.as_posix(), connect_args={'check_same_thread': False, 'timeout': 30})
        @event.listens_for(self.engine, 'connect')
        def configure(connection, _):
            connection.create_function('lower', 1, lambda v: v.casefold() if isinstance(v,str) else v, deterministic=True)
            connection.execute('PRAGMA foreign_keys=ON')
            connection.execute('PRAGMA busy_timeout=30000')
            connection.execute('PRAGMA journal_mode=WAL')
        upgrade_schema(self.engine)
        self.sessions = sessionmaker(self.engine, expire_on_commit=False)
        with self.sessions() as session, atomic(session):
            if not session.get(ShopSettings, 1):
                session.add(ShopSettings(id=1))


@contextmanager
def atomic(session: Session):
    # Acquire SQLite's write reservation before any read-modify-write operation.
    session.execute(text('BEGIN IMMEDIATE'))
    try:
        yield
        session.commit()
    except Exception:
        session.rollback()
        raise
