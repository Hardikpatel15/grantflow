from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker
from backend.config import settings

# Engine configuration: Supports Azure PostgreSQL Flexible Server or local SQLite
db_url = settings.DATABASE_URL

if db_url.startswith("sqlite"):
    engine = create_engine(
        db_url, 
        connect_args={"check_same_thread": False}
    )
    # Enable SQLite Foreign Keys
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
else:
    engine = create_engine(
        db_url,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """FastAPI Dependency for database session management with auto-cleanup."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
