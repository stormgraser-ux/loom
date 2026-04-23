from datetime import datetime
from pathlib import Path

_cache: str | None = None


def load_persona(persona_dir: str = "persona") -> str:
    global _cache
    if _cache is not None:
        return _cache

    d = Path(persona_dir)
    local = d / "default.local.md"
    default = d / "default.md"

    if local.exists():
        _cache = local.read_text()
    elif default.exists():
        _cache = default.read_text()
    else:
        _cache = "You are a helpful assistant."

    return _cache


def clear_cache():
    global _cache
    _cache = None


def build_system_prompt(
    persona_dir: str = "persona",
    memories: list[str] | None = None,
    tools_enabled: bool = True,
) -> str:
    persona = load_persona(persona_dir)

    now = datetime.now()
    time_ctx = now.strftime("%A, %B %d, %Y at %I:%M %p")

    parts = [persona, f"\n---\nCurrent time: {time_ctx}"]

    if tools_enabled:
        parts.append("\n---\nAvailable tools (include these tags in your response when needed):")
        parts.append("- [search:your query] — Search the web for current information")
        parts.append("- [read:/path/to/file] — Read a file's contents")
        parts.append("\nPlace the tag on its own line. The system will execute it and provide results for you to continue.")

    if memories:
        parts.append("\n---\nRelevant memories:")
        for m in memories:
            parts.append(f"- {m}")

    return "\n".join(parts)
