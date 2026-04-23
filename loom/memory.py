import re
import time
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from loom.db import Memory


async def find_relevant_memories(
    factory: async_sessionmaker[AsyncSession],
    message: str,
    top_k: int = 5,
) -> list[str]:
    words = set(re.findall(r"\w{3,}", message.lower()))
    if not words:
        return []

    async with factory() as db:
        result = await db.execute(select(Memory))
        all_memories = result.scalars().all()

    scored = []
    for mem in all_memories:
        mem_keywords = {k.lower() for k in (mem.keywords or [])}
        overlap = len(words & mem_keywords)
        if overlap > 0:
            scored.append((overlap, mem.content))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [content for _, content in scored[:top_k]]


async def store_memory(
    factory: async_sessionmaker[AsyncSession],
    content: str,
    keywords: list[str] | None = None,
) -> str:
    from loom.routers.memories import extract_keywords

    mem_id = uuid4().hex
    now = int(time.time())
    if keywords is None:
        keywords = extract_keywords(content)
    async with factory() as db:
        mem = Memory(
            id=mem_id,
            content=content,
            keywords=keywords,
            created_at=now,
            updated_at=now,
        )
        db.add(mem)
        await db.commit()
    return mem_id
