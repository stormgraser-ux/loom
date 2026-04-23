from pathlib import Path

from sqlalchemy import Boolean, BigInteger, Column, JSON, String, Text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class Chat(Base):
    __tablename__ = "chat"

    id = Column(String, primary_key=True)
    title = Column(String, default="New Conversation")
    chat = Column(JSON, nullable=False)
    created_at = Column(BigInteger, nullable=False)
    updated_at = Column(BigInteger, nullable=False)
    pinned = Column(Boolean, default=False)
    archived = Column(Boolean, default=False)


class Memory(Base):
    __tablename__ = "memory"

    id = Column(String, primary_key=True)
    content = Column(Text, nullable=False)
    keywords = Column(JSON, default=list)
    created_at = Column(BigInteger, nullable=False)
    updated_at = Column(BigInteger, nullable=False)


class SystemPromptPreset(Base):
    __tablename__ = "system_prompt_preset"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(BigInteger, nullable=False)
    updated_at = Column(BigInteger, nullable=False)


_engine = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


async def init_db(database_url: str):
    global _engine, _session_factory

    if "sqlite" in database_url:
        db_path = database_url.split("///")[-1]
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)

    _engine = create_async_engine(database_url, echo=False)
    _session_factory = async_sessionmaker(_engine, expire_on_commit=False)

    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    assert _session_factory is not None, "Call init_db() first"
    return _session_factory
