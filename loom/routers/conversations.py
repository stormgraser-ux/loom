import time
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import desc, or_, select

from loom.db import Chat

router = APIRouter()


class ConversationUpdate(BaseModel):
    title: str | None = None
    pinned: bool | None = None
    archived: bool | None = None


class ForkRequest(BaseModel):
    message_id: str


@router.get("/search")
async def search_conversations(
    request: Request,
    q: str = Query(..., min_length=1),
):
    factory = request.app.state.session_factory
    async with factory() as db:
        result = await db.execute(
            select(Chat).order_by(desc(Chat.updated_at)).limit(200)
        )
        chats = result.scalars().all()

    query_lower = q.lower()
    matches = []
    for c in chats:
        if query_lower in (c.title or "").lower():
            matches.append(c)
            continue
        msgs = (c.chat or {}).get("messages", {})
        for msg in msgs.values():
            if query_lower in (msg.get("content") or "").lower():
                matches.append(c)
                break

    return [
        {
            "id": c.id,
            "title": c.title,
            "updated_at": c.updated_at,
            "pinned": c.pinned,
        }
        for c in matches[:50]
    ]


@router.get("")
async def list_conversations(request: Request):
    factory = request.app.state.session_factory
    async with factory() as db:
        result = await db.execute(
            select(Chat)
            .where(Chat.archived == False)  # noqa: E712
            .order_by(desc(Chat.updated_at))
            .limit(50)
        )
        chats = result.scalars().all()
        return [
            {
                "id": c.id,
                "title": c.title,
                "updated_at": c.updated_at,
                "pinned": c.pinned,
            }
            for c in chats
        ]


@router.get("/{conversation_id}")
async def get_conversation(conversation_id: str, request: Request):
    factory = request.app.state.session_factory
    async with factory() as db:
        chat = await db.get(Chat, conversation_id)
        if not chat:
            raise HTTPException(404)
        return {
            "id": chat.id,
            "title": chat.title,
            "chat": chat.chat,
            "created_at": chat.created_at,
            "updated_at": chat.updated_at,
            "pinned": chat.pinned,
            "archived": chat.archived,
        }


@router.patch("/{conversation_id}")
async def update_conversation(
    conversation_id: str, body: ConversationUpdate, request: Request
):
    factory = request.app.state.session_factory
    async with factory() as db:
        chat = await db.get(Chat, conversation_id)
        if not chat:
            raise HTTPException(404)
        if body.title is not None:
            chat.title = body.title
        if body.pinned is not None:
            chat.pinned = body.pinned
        if body.archived is not None:
            chat.archived = body.archived
        chat.updated_at = int(time.time())
        await db.commit()
        return {"id": chat.id, "title": chat.title}


@router.delete("/{conversation_id}")
async def delete_conversation(conversation_id: str, request: Request):
    factory = request.app.state.session_factory
    async with factory() as db:
        chat = await db.get(Chat, conversation_id)
        if not chat:
            raise HTTPException(404)
        await db.delete(chat)
        await db.commit()
        return {"ok": True}


@router.post("/{conversation_id}/fork", status_code=201)
async def fork_conversation(
    conversation_id: str, body: ForkRequest, request: Request
):
    factory = request.app.state.session_factory
    async with factory() as db:
        source = await db.get(Chat, conversation_id)
        if not source:
            raise HTTPException(404, "Source conversation not found")

        src_messages = (source.chat or {}).get("messages", {})
        if body.message_id not in src_messages:
            raise HTTPException(404, "Message not found in conversation")

        chain_ids = []
        msg_id = body.message_id
        while msg_id:
            msg = src_messages.get(msg_id)
            if not msg:
                break
            chain_ids.append(msg_id)
            msg_id = msg.get("parentId")
        chain_ids.reverse()

        new_messages = {}
        for mid in chain_ids:
            orig = src_messages[mid]
            new_messages[mid] = {
                "id": mid,
                "parentId": orig.get("parentId"),
                "childrenIds": [],
                "role": orig["role"],
                "content": orig["content"],
                "timestamp": orig.get("timestamp", 0),
            }
        for mid in chain_ids:
            parent_id = new_messages[mid].get("parentId")
            if parent_id and parent_id in new_messages:
                new_messages[parent_id]["childrenIds"].append(mid)

        now = int(time.time())
        fork_id = uuid4().hex
        fork_title = f"Fork of {source.title or 'conversation'}"
        fork_chat = {"messages": new_messages, "currentId": body.message_id}

        fork = Chat(
            id=fork_id,
            title=fork_title,
            chat=fork_chat,
            created_at=now,
            updated_at=now,
        )
        db.add(fork)
        await db.commit()

        return {
            "id": fork_id,
            "title": fork_title,
            "forked_from": conversation_id,
            "message_count": len(chain_ids),
        }
