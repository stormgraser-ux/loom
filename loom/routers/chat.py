import json
import logging
import time
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from loom.context import build_messages
from loom.memory import find_relevant_memories
from loom.persona import build_system_prompt
from loom.tools import run_tool_calls
from loom.tools.parser import extract_tool_calls

log = logging.getLogger("loom.images")
router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None
    model: str | None = None
    images: list[str] | None = None


class RegenerateRequest(BaseModel):
    conversation_id: str
    message_id: str
    model: str | None = None


@router.post("")
async def chat_endpoint(request: Request, body: ChatRequest):
    config = request.app.state.config
    llm = request.app.state.llm
    factory = request.app.state.session_factory

    from loom.db import Chat

    now = int(time.time())
    user_msg_id = uuid4().hex
    conv_id = body.conversation_id

    async with factory() as db:
        if conv_id:
            conv = await db.get(Chat, conv_id)
            if not conv:
                raise HTTPException(404, "Conversation not found")
            chat_data = dict(conv.chat)
        else:
            conv_id = uuid4().hex
            chat_data = {"messages": {}, "currentId": None}
            title = body.message[:80].strip() or "New Conversation"
            conv = Chat(
                id=conv_id,
                title=title,
                chat=chat_data,
                created_at=now,
                updated_at=now,
            )
            db.add(conv)

        parent_id = chat_data.get("currentId")
        user_msg = {
            "id": user_msg_id,
            "parentId": parent_id,
            "childrenIds": [],
            "role": "user",
            "content": body.message,
            "timestamp": now,
        }
        if body.images:
            user_msg["images"] = body.images
            sizes = [len(img) for img in body.images]
            log.info("[IMG:recv] %d image(s), sizes=%s bytes",
                     len(body.images), sizes)
        chat_data["messages"][user_msg_id] = user_msg
        if parent_id and parent_id in chat_data["messages"]:
            chat_data["messages"][parent_id]["childrenIds"].append(user_msg_id)
        chat_data["currentId"] = user_msg_id

        conv.chat = chat_data
        conv.updated_at = now
        await db.commit()

        stored = chat_data["messages"][user_msg_id].get("images")
        log.info("[IMG:stored] after first commit: %s",
                 f"{len(stored)} image(s)" if stored else "no images")

    memories = await find_relevant_memories(factory, body.message)

    system_prompt = build_system_prompt(
        config.persona_dir,
        memories=memories or None,
    )
    current_messages = build_messages(
        system_prompt, chat_data, user_msg_id, config.max_recent_messages
    )

    img_diag = None
    if body.images:
        llm_imgs = [m for m in current_messages if m.get("images")]
        img_diag = {
            "received": len(body.images),
            "sizes_kb": [round(len(img) / 1024) for img in body.images],
            "in_llm_context": sum(len(m["images"]) for m in llm_imgs),
        }
        log.info("[IMG:llm] images in LLM payload: %d",
                 img_diag["in_llm_context"])

    async def stream():
        all_content: list[str] = []
        effective_model = body.model or config.model

        yield f"data: {json.dumps({'type': 'start', 'conversation_id': conv_id})}\n\n"
        if img_diag:
            yield f"data: {json.dumps({'type': 'image_diag', **img_diag})}\n\n"

        for round_num in range(config.max_tool_rounds + 1):
            round_content: list[str] = []

            try:
                async for msg_type, text in llm.stream_chat(
                    current_messages, config.temperature, config.max_tokens,
                    top_p=config.top_p, min_p=config.min_p,
                    rep_penalty=config.rep_penalty,
                    thinking=config.thinking,
                    model=body.model,
                    num_ctx=config.num_ctx,
                ):
                    if msg_type == "content":
                        round_content.append(text)
                        yield f"data: {json.dumps({'type': 'token', 'content': text})}\n\n"
                    elif msg_type == "thinking":
                        yield f"data: {json.dumps({'type': 'thinking', 'content': text})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
                return

            content = "".join(round_content)

            if not content.strip() and config.thinking:
                round_content = []
                try:
                    async for msg_type, text in llm.stream_chat(
                        current_messages, config.temperature, config.max_tokens,
                        top_p=config.top_p, min_p=config.min_p,
                        rep_penalty=config.rep_penalty,
                        thinking=False,
                        model=body.model,
                        num_ctx=config.num_ctx,
                    ):
                        if msg_type == "content":
                            round_content.append(text)
                            yield f"data: {json.dumps({'type': 'token', 'content': text})}\n\n"
                except Exception as e:
                    yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
                    return
                content = "".join(round_content)

            all_content.append(content)

            tool_calls = extract_tool_calls(content)
            if not tool_calls or round_num == config.max_tool_rounds:
                break

            yield f"data: {json.dumps({'type': 'tool_start', 'calls': [{'name': n, 'argument': a} for n, a in tool_calls]})}\n\n"

            results = await run_tool_calls(
                tool_calls,
                allowed_read_dirs=config.allowed_read_dirs,
                search_result_count=config.web_search_result_count,
            )

            for name, arg, result in results:
                yield f"data: {json.dumps({'type': 'tool_result', 'name': name, 'argument': arg, 'result': result})}\n\n"

            current_messages.append({"role": "assistant", "content": content})

            result_parts = []
            for name, arg, result in results:
                result_parts.append(f"[Result for {name}:{arg}]\n{result}")
            current_messages.append({
                "role": "user",
                "content": "\n\n".join(result_parts)
                + "\n\nContinue your response using these results.",
            })

        final_content = "\n".join(all_content)
        asst_msg_id = uuid4().hex
        asst_now = int(time.time())

        chat_data["messages"][asst_msg_id] = {
            "id": asst_msg_id,
            "parentId": user_msg_id,
            "childrenIds": [],
            "role": "assistant",
            "content": final_content,
            "model": effective_model,
            "timestamp": asst_now,
        }
        chat_data["messages"][user_msg_id]["childrenIds"].append(asst_msg_id)
        chat_data["currentId"] = asst_msg_id

        pre_save_imgs = chat_data["messages"][user_msg_id].get("images")
        if pre_save_imgs:
            log.info("[IMG:pre-save] user msg still has %d image(s)",
                     len(pre_save_imgs))
        elif img_diag:
            log.warning("[IMG:pre-save] IMAGES GONE from chat_data before save!")

        async with factory() as db:
            conv = await db.get(Chat, conv_id)
            conv.chat = chat_data
            conv.updated_at = asst_now
            await db.commit()

        if img_diag:
            async with factory() as db:
                conv = await db.get(Chat, conv_id)
                db_imgs = (conv.chat.get("messages", {})
                           .get(user_msg_id, {}).get("images"))
                img_diag["persisted"] = len(db_imgs) if db_imgs else 0
                log.info("[IMG:verify] read-back from DB: %s",
                         f"{len(db_imgs)} image(s)" if db_imgs
                         else "NONE — IMAGES LOST")

        yield f"data: {json.dumps({'type': 'done', 'conversation_id': conv_id, 'message_id': asst_msg_id, 'model': effective_model})}\n\n"

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/regenerate")
async def regenerate_endpoint(request: Request, body: RegenerateRequest):
    config = request.app.state.config
    llm = request.app.state.llm
    factory = request.app.state.session_factory

    from loom.db import Chat

    async with factory() as db:
        conv = await db.get(Chat, body.conversation_id)
        if not conv:
            raise HTTPException(404, "Conversation not found")
        chat_data = dict(conv.chat)

    messages = chat_data.get("messages", {})
    target = messages.get(body.message_id)
    if not target or target["role"] != "assistant":
        raise HTTPException(400, "Target must be an assistant message")

    user_msg_id = target.get("parentId")
    if not user_msg_id or user_msg_id not in messages:
        raise HTTPException(400, "Parent user message not found")

    user_content = messages[user_msg_id]["content"]
    memories = await find_relevant_memories(factory, user_content)
    system_prompt = build_system_prompt(
        config.persona_dir, memories=memories or None
    )
    current_messages = build_messages(
        system_prompt, chat_data, user_msg_id, config.max_recent_messages
    )

    conv_id = body.conversation_id

    async def stream():
        all_content: list[str] = []
        effective_model = body.model or config.model

        yield f"data: {json.dumps({'type': 'start', 'conversation_id': conv_id})}\n\n"

        for round_num in range(config.max_tool_rounds + 1):
            round_content: list[str] = []
            try:
                async for msg_type, text in llm.stream_chat(
                    current_messages, config.temperature, config.max_tokens,
                    top_p=config.top_p, min_p=config.min_p,
                    rep_penalty=config.rep_penalty,
                    thinking=config.thinking,
                    model=body.model,
                    num_ctx=config.num_ctx,
                ):
                    if msg_type == "content":
                        round_content.append(text)
                        yield f"data: {json.dumps({'type': 'token', 'content': text})}\n\n"
                    elif msg_type == "thinking":
                        yield f"data: {json.dumps({'type': 'thinking', 'content': text})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
                return

            content = "".join(round_content)

            if not content.strip() and config.thinking:
                round_content = []
                try:
                    async for msg_type, text in llm.stream_chat(
                        current_messages, config.temperature, config.max_tokens,
                        top_p=config.top_p, min_p=config.min_p,
                        rep_penalty=config.rep_penalty,
                        thinking=False,
                        model=body.model,
                        num_ctx=config.num_ctx,
                    ):
                        if msg_type == "content":
                            round_content.append(text)
                            yield f"data: {json.dumps({'type': 'token', 'content': text})}\n\n"
                except Exception as e:
                    yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
                    return
                content = "".join(round_content)

            all_content.append(content)

            tool_calls = extract_tool_calls(content)
            if not tool_calls or round_num == config.max_tool_rounds:
                break

            yield f"data: {json.dumps({'type': 'tool_start', 'calls': [{'name': n, 'argument': a} for n, a in tool_calls]})}\n\n"
            results = await run_tool_calls(
                tool_calls,
                allowed_read_dirs=config.allowed_read_dirs,
                search_result_count=config.web_search_result_count,
            )
            for name, arg, result in results:
                yield f"data: {json.dumps({'type': 'tool_result', 'name': name, 'argument': arg, 'result': result})}\n\n"

            current_messages.append({"role": "assistant", "content": content})
            result_parts = []
            for name, arg, result in results:
                result_parts.append(f"[Result for {name}:{arg}]\n{result}")
            current_messages.append({
                "role": "user",
                "content": "\n\n".join(result_parts)
                + "\n\nContinue your response using these results.",
            })

        final_content = "\n".join(all_content)
        asst_msg_id = uuid4().hex
        asst_now = int(time.time())

        chat_data["messages"][asst_msg_id] = {
            "id": asst_msg_id,
            "parentId": user_msg_id,
            "childrenIds": [],
            "role": "assistant",
            "content": final_content,
            "model": effective_model,
            "timestamp": asst_now,
        }
        chat_data["messages"][user_msg_id]["childrenIds"].append(asst_msg_id)
        chat_data["currentId"] = asst_msg_id

        async with factory() as db:
            conv = await db.get(Chat, conv_id)
            conv.chat = chat_data
            conv.updated_at = asst_now
            await db.commit()

        yield f"data: {json.dumps({'type': 'done', 'conversation_id': conv_id, 'message_id': asst_msg_id, 'model': effective_model})}\n\n"

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
