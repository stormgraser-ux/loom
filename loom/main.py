import argparse
import asyncio
import json
import os
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select

from loom.config import config_to_api, load_config, save_config, _API_FIELDS
from loom.db import SystemPromptPreset, get_session_factory, init_db
from loom.llm import LLMClient
from loom.persona import clear_cache as clear_persona_cache
from loom.routers import chat, conversations, memories


@asynccontextmanager
async def lifespan(app: FastAPI):
    cfg = app.state.config
    app.state.llm = LLMClient(
        base_url=cfg.llm_base_url,
        model=cfg.model,
        timeout=cfg.llm_timeout,
    )
    await init_db(cfg.database_url)
    app.state.session_factory = get_session_factory()
    yield
    await app.state.llm.close()


def create_app(config_path: str = "config.toml") -> FastAPI:
    cfg = load_config(config_path)

    app = FastAPI(title="Loom", version="0.1.0", lifespan=lifespan)
    app.state.config = cfg
    app.state.config_path = config_path

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/config", tags=["config"])
    async def get_config():
        return config_to_api(app.state.config)

    @app.patch("/api/config", tags=["config"])
    async def patch_config(request: Request):
        body = await request.json()
        cfg = app.state.config
        changed = False
        llm_changed = False

        for api_key, attr in _API_FIELDS.items():
            if api_key in body:
                old = getattr(cfg, attr)
                val = body[api_key]
                if type(old) is float:
                    val = float(val)
                elif type(old) is int:
                    val = int(val)
                if val != old:
                    setattr(cfg, attr, val)
                    changed = True
                    if attr in ("llm_base_url", "model", "llm_timeout"):
                        llm_changed = True

        if llm_changed:
            await app.state.llm.reconfigure(
                cfg.llm_base_url, cfg.model, cfg.llm_timeout
            )

        if changed:
            save_config(cfg, app.state.config_path)
            clear_persona_cache()

        return config_to_api(cfg)

    @app.get("/api/models", tags=["models"])
    async def list_models():
        cfg = app.state.config
        base = cfg.llm_base_url.rstrip("/")
        ollama_base = base.removesuffix("/v1")

        def _format_size(n):
            if n >= 1e9:
                return f"{n / 1e9:.1f} GB"
            if n >= 1e6:
                return f"{n / 1e6:.0f} MB"
            return str(n)

        def _filter_ollama(raw_models: list[dict]) -> list[dict]:
            valid = []
            for m in raw_models:
                details = m.get("details", {})
                families = details.get("families") or []
                quant = details.get("quantization_level", "")
                if "clip" in families:
                    continue
                if quant == "unknown":
                    continue
                valid.append(m)

            SIZE_THRESHOLD = 100_000
            clusters: list[list[dict]] = []
            for m in sorted(valid, key=lambda x: x.get("size", 0)):
                placed = False
                for cl in clusters:
                    if abs(m["size"] - cl[0]["size"]) < SIZE_THRESHOLD:
                        cl.append(m)
                        placed = True
                        break
                if not placed:
                    clusters.append([m])

            keep = set()
            for cl in clusters:
                if len(cl) == 1:
                    keep.add(cl[0]["name"])
                    continue
                registry = [m for m in cl if "/" in m["name"]]
                if registry:
                    base = min(registry, key=lambda x: x["size"])
                else:
                    base = min(cl, key=lambda x: x["size"])
                keep.add(base["name"])

            return [m for m in valid if m["name"] in keep]

        THINKING_FAMILIES = {
            "qwen3", "qwen35", "qwen35moe", "qwen3moe",
            "deepseek", "deepseek2",
        }

        def _can_think(family: str) -> bool:
            return family.lower() in THINKING_FAMILIES

        async with httpx.AsyncClient(timeout=10) as client:
            try:
                r = await client.get(f"{ollama_base}/api/tags")
                r.raise_for_status()
                data = r.json()
                filtered = _filter_ollama(data.get("models", []))
                return [
                    {
                        "id": m["name"],
                        "name": m["name"],
                        "size": _format_size(m.get("size", 0)),
                        "size_bytes": m.get("size", 0),
                        "params": m.get("details", {}).get("parameter_size", ""),
                        "quant": m.get("details", {}).get("quantization_level", ""),
                        "family": m.get("details", {}).get("family", ""),
                        "thinks": _can_think(m.get("details", {}).get("family", "")),
                        "modified": m.get("modified_at", ""),
                    }
                    for m in filtered
                ]
            except Exception:
                pass

            try:
                r = await client.get(f"{base}/models")
                r.raise_for_status()
                data = r.json()
                return [
                    {"id": m["id"], "name": m["id"], "size": "", "size_bytes": 0,
                     "params": "", "quant": "", "family": "", "thinks": False,
                     "modified": ""}
                    for m in data.get("data", [])
                ]
            except Exception:
                return []

    @app.post("/api/models/pull", tags=["models"])
    async def pull_model(request: Request):
        body = await request.json()
        name = body.get("name", "").strip()
        if not name:
            return {"error": "Model name required"}

        cfg = app.state.config
        ollama_base = cfg.llm_base_url.rstrip("/").removesuffix("/v1")

        async def generate():
            try:
                async with httpx.AsyncClient(
                    timeout=httpx.Timeout(30, read=None)
                ) as client:
                    async with client.stream(
                        "POST", f"{ollama_base}/api/pull",
                        json={"name": name, "stream": True},
                    ) as resp:
                        if resp.status_code != 200:
                            yield f"data: {json.dumps({'status': 'error', 'error': f'Ollama returned {resp.status_code}'})}\n\n"
                            return
                        async for line in resp.aiter_lines():
                            if line.strip():
                                yield f"data: {line}\n\n"
            except Exception as exc:
                yield f"data: {json.dumps({'status': 'error', 'error': str(exc)})}\n\n"

        return StreamingResponse(generate(), media_type="text/event-stream")

    @app.post("/api/models/create", tags=["models"])
    async def create_model_from_gguf(request: Request):
        body = await request.json()
        name = body.get("name", "").strip()
        path = body.get("path", "").strip()
        if not name or not path:
            return {"error": "Both name and path are required"}

        cfg = app.state.config
        ollama_base = cfg.llm_base_url.rstrip("/").removesuffix("/v1")

        async def generate():
            try:
                async with httpx.AsyncClient(
                    timeout=httpx.Timeout(30, read=None)
                ) as client:
                    async with client.stream(
                        "POST", f"{ollama_base}/api/create",
                        json={"name": name, "modelfile": f"FROM {path}", "stream": True},
                    ) as resp:
                        if resp.status_code != 200:
                            yield f"data: {json.dumps({'status': 'error', 'error': f'Ollama returned {resp.status_code}'})}\n\n"
                            return
                        async for line in resp.aiter_lines():
                            if line.strip():
                                yield f"data: {line}\n\n"
            except Exception as exc:
                yield f"data: {json.dumps({'status': 'error', 'error': str(exc)})}\n\n"

        return StreamingResponse(generate(), media_type="text/event-stream")

    @app.get("/api/hardware", tags=["hardware"])
    async def detect_hardware():
        vram_gb = None
        gpu_name = None
        ram_gb = None

        try:
            mem = os.sysconf("SC_PHYS_PAGES") * os.sysconf("SC_PAGE_SIZE")
            ram_gb = round(mem / (1024 ** 3))
        except Exception:
            pass

        try:
            proc = await asyncio.create_subprocess_exec(
                "nvidia-smi",
                "--query-gpu=memory.total,name",
                "--format=csv,noheader,nounits",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=5)
            if proc.returncode == 0:
                line = stdout.decode().strip().split("\n")[0]
                parts = [p.strip() for p in line.split(",")]
                vram_gb = round(int(parts[0]) / 1024)
                gpu_name = parts[1] if len(parts) > 1 else None
        except Exception:
            pass

        return {"vram_gb": vram_gb, "gpu": gpu_name, "ram_gb": ram_gb}

    @app.get("/api/ps", tags=["hardware"])
    async def ollama_ps():
        cfg = app.state.config
        ollama_base = cfg.llm_base_url.rstrip("/").removesuffix("/v1")
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get(f"{ollama_base}/api/ps")
                r.raise_for_status()
                data = r.json()
                models = data.get("models", [])
                total_vram = sum(m.get("size_vram", 0) for m in models)
                return {
                    "vram_bytes": total_vram,
                    "vram_gb": round(total_vram / (1024 ** 3), 1) if total_vram else None,
                    "models": [
                        {
                            "name": m.get("name", ""),
                            "size_vram": m.get("size_vram", 0),
                        }
                        for m in models
                    ],
                }
        except Exception:
            return {"vram_bytes": None, "vram_gb": None, "models": []}

    @app.get("/api/vram-check", tags=["hardware"])
    async def vram_check(model: str):
        cfg = app.state.config
        ollama_base = cfg.llm_base_url.rstrip("/").removesuffix("/v1")

        total_vram_bytes = None
        try:
            proc = await asyncio.create_subprocess_exec(
                "nvidia-smi",
                "--query-gpu=memory.total",
                "--format=csv,noheader,nounits",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=5)
            if proc.returncode == 0:
                total_vram_bytes = int(stdout.decode().strip().split("\n")[0]) * 1024 * 1024
        except Exception:
            pass

        used_vram_bytes = 0
        loaded_models = []
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get(f"{ollama_base}/api/ps")
                r.raise_for_status()
                data = r.json()
                for m in data.get("models", []):
                    sv = m.get("size_vram", 0)
                    used_vram_bytes += sv
                    loaded_models.append({"name": m.get("name", ""), "size_vram": sv})
        except Exception:
            pass

        needed_bytes = 0
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get(f"{ollama_base}/api/tags")
                r.raise_for_status()
                for m in r.json().get("models", []):
                    if m.get("name") == model:
                        needed_bytes = m.get("size", 0)
                        break
        except Exception:
            pass

        already_loaded = any(lm["name"] == model for lm in loaded_models)

        if total_vram_bytes and not already_loaded:
            fits = (used_vram_bytes + needed_bytes) <= total_vram_bytes
        else:
            fits = True

        def _gb(b):
            return round(b / (1024 ** 3), 1) if b else None

        return {
            "fits": fits,
            "already_loaded": already_loaded,
            "total_gb": _gb(total_vram_bytes),
            "used_gb": _gb(used_vram_bytes),
            "needed_gb": _gb(needed_bytes),
            "loaded_models": loaded_models,
        }

    @app.post("/api/models/unload", tags=["models"])
    async def unload_model(request: Request):
        body = await request.json()
        name = body.get("name", "").strip()
        if not name:
            return {"error": "Model name required"}

        cfg = app.state.config
        ollama_base = cfg.llm_base_url.rstrip("/").removesuffix("/v1")

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.post(
                    f"{ollama_base}/api/generate",
                    json={"model": name, "keep_alive": 0},
                )
                r.raise_for_status()
                return {"ok": True, "model": name}
        except Exception as exc:
            return {"error": str(exc)}

    @app.get("/api/system-prompt", tags=["config"])
    async def get_system_prompt():
        cfg = app.state.config
        d = Path(cfg.persona_dir)
        local = d / "default.local.md"
        default = d / "default.md"
        preset_id = cfg.active_preset_id
        if local.exists():
            return {"content": local.read_text(), "source": str(local), "active_preset_id": preset_id}
        if default.exists():
            return {"content": default.read_text(), "source": str(default), "active_preset_id": preset_id}
        return {"content": "", "source": str(default), "active_preset_id": preset_id}

    @app.put("/api/system-prompt", tags=["config"])
    async def save_system_prompt(request: Request):
        body = await request.json()
        content = body.get("content", "")
        d = Path(app.state.config.persona_dir)
        d.mkdir(parents=True, exist_ok=True)
        target = d / "default.md"
        target.write_text(content)
        clear_persona_cache()

        cfg = app.state.config
        if cfg.active_preset_id:
            async with app.state.session_factory() as session:
                preset = await session.get(SystemPromptPreset, cfg.active_preset_id)
                if preset:
                    preset.content = content
                    preset.updated_at = int(time.time())
                    await session.commit()

        return {"ok": True, "source": str(target)}

    # ---- Presets ----

    @app.get("/api/presets", tags=["presets"])
    async def list_presets():
        async with app.state.session_factory() as session:
            result = await session.execute(
                select(SystemPromptPreset).order_by(SystemPromptPreset.name)
            )
            presets = result.scalars().all()
            return [
                {
                    "id": p.id,
                    "name": p.name,
                    "content": p.content,
                    "created_at": p.created_at,
                    "updated_at": p.updated_at,
                }
                for p in presets
            ]

    @app.post("/api/presets/activate", tags=["presets"])
    async def activate_preset(request: Request):
        body = await request.json()
        preset_id = body.get("id")
        cfg = app.state.config

        if not preset_id:
            cfg.active_preset_id = ""
            save_config(cfg, app.state.config_path)
            return {"ok": True, "active_preset_id": ""}

        async with app.state.session_factory() as session:
            preset = await session.get(SystemPromptPreset, preset_id)
            if not preset:
                return {"error": "Preset not found"}

            d = Path(cfg.persona_dir)
            d.mkdir(parents=True, exist_ok=True)
            (d / "default.md").write_text(preset.content)
            clear_persona_cache()

            cfg.active_preset_id = preset_id
            save_config(cfg, app.state.config_path)

            return {"ok": True, "active_preset_id": preset_id, "content": preset.content}

    @app.post("/api/presets", tags=["presets"])
    async def create_preset(request: Request):
        body = await request.json()
        name = body.get("name", "").strip()
        content = body.get("content", "")
        if not name:
            return {"error": "Name required"}

        now = int(time.time())
        preset = SystemPromptPreset(
            id=str(uuid.uuid4()),
            name=name,
            content=content,
            created_at=now,
            updated_at=now,
        )
        async with app.state.session_factory() as session:
            session.add(preset)
            await session.commit()

        cfg = app.state.config
        cfg.active_preset_id = preset.id
        d = Path(cfg.persona_dir)
        d.mkdir(parents=True, exist_ok=True)
        (d / "default.md").write_text(content)
        clear_persona_cache()
        save_config(cfg, app.state.config_path)

        return {
            "id": preset.id,
            "name": preset.name,
            "content": preset.content,
            "created_at": preset.created_at,
            "updated_at": preset.updated_at,
        }

    @app.patch("/api/presets/{preset_id}", tags=["presets"])
    async def update_preset(preset_id: str, request: Request):
        body = await request.json()

        async with app.state.session_factory() as session:
            preset = await session.get(SystemPromptPreset, preset_id)
            if not preset:
                return {"error": "Preset not found"}

            if "name" in body:
                preset.name = body["name"].strip()
            if "content" in body:
                preset.content = body["content"]
            preset.updated_at = int(time.time())

            await session.commit()

            return {
                "id": preset.id,
                "name": preset.name,
                "content": preset.content,
                "created_at": preset.created_at,
                "updated_at": preset.updated_at,
            }

    @app.delete("/api/presets/{preset_id}", tags=["presets"])
    async def delete_preset(preset_id: str):
        async with app.state.session_factory() as session:
            preset = await session.get(SystemPromptPreset, preset_id)
            if not preset:
                return {"error": "Preset not found"}

            await session.delete(preset)
            await session.commit()

        cfg = app.state.config
        if cfg.active_preset_id == preset_id:
            cfg.active_preset_id = ""
            save_config(cfg, app.state.config_path)

        return {"ok": True}

    app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
    app.include_router(
        conversations.router, prefix="/api/conversations", tags=["conversations"]
    )
    app.include_router(
        memories.router, prefix="/api/memories", tags=["memories"]
    )

    static_dir = Path("static")
    if static_dir.is_dir():
        app.mount("/", StaticFiles(directory="static", html=True), name="static")

    return app


def cli():
    parser = argparse.ArgumentParser(description="Loom — local model chat wrapper")
    sub = parser.add_subparsers(dest="command")

    # default: run the server (also runs when no subcommand given)
    parser.add_argument("--config", default="config.toml", help="Config file path")
    parser.add_argument("--host", help="Override host")
    parser.add_argument("--port", type=int, help="Override port")

    p_install = sub.add_parser("install", help="Register Loom as an autostart service")
    p_install.add_argument("--config", default="config.toml", help="Config file path")

    p_uninstall = sub.add_parser("uninstall", help="Remove the autostart service")

    args = parser.parse_args()

    if args.command == "install":
        from loom.install import run_install
        run_install(config=args.config)
    elif args.command == "uninstall":
        from loom.install import run_uninstall
        run_uninstall()
    else:
        app = create_app(args.config)
        cfg = app.state.config
        uvicorn.run(app, host=args.host or cfg.host, port=args.port or cfg.port)
