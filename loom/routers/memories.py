import re
import time
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import desc, select

from loom.db import Memory

router = APIRouter()


def extract_keywords(text: str, min_length: int = 3) -> list[str]:
    words = re.findall(r"\w+", text.lower())
    stop = {
        "the", "and", "for", "are", "but", "not", "you", "all", "can", "had",
        "her", "was", "one", "our", "out", "has", "have", "been", "from",
        "they", "will", "with", "this", "that", "what", "when", "where",
        "which", "their", "there", "about", "would", "make", "like", "just",
        "into", "than", "them", "then", "also", "after", "before", "could",
        "does", "each", "some", "more", "very", "only",
    }
    seen = set()
    keywords = []
    for w in words:
        if len(w) >= min_length and w not in stop and w not in seen:
            seen.add(w)
            keywords.append(w)
    return keywords


class MemoryCreate(BaseModel):
    content: str
    keywords: list[str] | None = None


class MemoryUpdate(BaseModel):
    content: str | None = None
    keywords: list[str] | None = None


def _serialize(mem: Memory) -> dict:
    return {
        "id": mem.id,
        "content": mem.content,
        "keywords": mem.keywords or [],
        "created_at": mem.created_at,
        "updated_at": mem.updated_at,
    }


@router.get("")
async def list_memories(request: Request):
    factory = request.app.state.session_factory
    async with factory() as db:
        result = await db.execute(
            select(Memory).order_by(desc(Memory.updated_at))
        )
        return [_serialize(m) for m in result.scalars().all()]


@router.get("/{memory_id}")
async def get_memory(memory_id: str, request: Request):
    factory = request.app.state.session_factory
    async with factory() as db:
        mem = await db.get(Memory, memory_id)
        if not mem:
            raise HTTPException(404)
        return _serialize(mem)


@router.post("", status_code=201)
async def create_memory(body: MemoryCreate, request: Request):
    factory = request.app.state.session_factory
    now = int(time.time())
    mem_id = uuid4().hex
    keywords = body.keywords if body.keywords is not None else extract_keywords(body.content)
    async with factory() as db:
        mem = Memory(
            id=mem_id,
            content=body.content,
            keywords=keywords,
            created_at=now,
            updated_at=now,
        )
        db.add(mem)
        await db.commit()
        return _serialize(mem)


@router.patch("/{memory_id}")
async def update_memory(memory_id: str, body: MemoryUpdate, request: Request):
    factory = request.app.state.session_factory
    async with factory() as db:
        mem = await db.get(Memory, memory_id)
        if not mem:
            raise HTTPException(404)
        if body.content is not None:
            mem.content = body.content
            if body.keywords is None:
                mem.keywords = extract_keywords(body.content)
        if body.keywords is not None:
            mem.keywords = body.keywords
        mem.updated_at = int(time.time())
        await db.commit()
        return _serialize(mem)


@router.delete("/{memory_id}")
async def delete_memory(memory_id: str, request: Request):
    factory = request.app.state.session_factory
    async with factory() as db:
        mem = await db.get(Memory, memory_id)
        if not mem:
            raise HTTPException(404)
        await db.delete(mem)
        await db.commit()
        return {"ok": True}
