# Loom

Local model chat wrapper — conversational assistant with memory, not an agent. FastAPI + SQLAlchemy async + Pydantic.

## Quick Start

```bash
cp config.example.toml config.toml  # edit model endpoint
pip install -e .
loom
```

## Architecture

- **LLM:** OpenAI-compatible endpoint (Ollama, llama.cpp, vLLM)
- **Chat history:** JSON tree (parentId/childrenIds — supports branching)
- **Context:** Hard-cap sliding window, persona markdown + .local.md overrides. Images on ALL user messages (not just last)
- **Images:** Frontend compresses (1536px max, JPEG 85%) → data URIs in chat tree → context strips prefix to raw base64 for Ollama `images` field
- **Tools:** `[search:query]` + `[read:/path]` tag-based, regex-parsed from model output
- **Memory:** Harness-injected keyword match
- **Dev:** Static files are live; Python changes need `systemctl --user restart loom`

## API

- `POST /api/chat` — SSE stream
- `GET /api/conversations` — list
- `GET /api/conversations/{id}` — full tree
- `PATCH /api/conversations/{id}` — update title/pinned/archived
- `DELETE /api/conversations/{id}` — delete

## Project Layout

```
loom/
  main.py, config.py, db.py, llm.py, context.py, persona.py
  tools/ — parser.py, search.py, file_read.py
  routers/ — chat.py, conversations.py
```
