from pathlib import Path

MAX_CHARS = 10_000


def file_read(path: str, allowed_dirs: list[str]) -> str:
    try:
        p = Path(path).resolve()
    except Exception:
        return f"Invalid path: {path}"

    if allowed_dirs:
        allowed = [Path(d).resolve() for d in allowed_dirs]
        if not any(p == a or p.is_relative_to(a) for a in allowed):
            dirs = ", ".join(allowed_dirs)
            return f"Access denied: {path} is outside allowed directories ({dirs})"

    if not p.exists():
        return f"File not found: {path}"
    if not p.is_file():
        return f"Not a file: {path}"

    try:
        content = p.read_text()
        if len(content) > MAX_CHARS:
            content = content[:MAX_CHARS] + f"\n\n... (truncated, {len(content)} total characters)"
        return content
    except Exception as e:
        return f"Error reading file: {e}"
