import tomllib
from dataclasses import dataclass, field, fields
from pathlib import Path


@dataclass
class Config:
    llm_base_url: str = "http://127.0.0.1:11434"
    model: str = "qwen3:8b"
    temperature: float = 0.7
    max_tokens: int = 2048
    llm_timeout: float = 120.0
    top_p: float = 0.9
    min_p: float = 0.05
    rep_penalty: float = 1.1
    thinking: bool = False
    num_ctx: int = 32768

    max_recent_messages: int = 40
    max_tool_rounds: int = 5

    host: str = "0.0.0.0"
    port: int = 3000

    persona_dir: str = "persona"
    active_preset_id: str = ""
    database_url: str = "sqlite+aiosqlite:///data/loom.db"

    allowed_read_dirs: list[str] = field(default_factory=list)
    web_search_engine: str = "duckduckgo"
    web_search_result_count: int = 5


_TOML_MAP = {
    ("model", "base_url"): "llm_base_url",
    ("model", "name"): "model",
    ("model", "temperature"): "temperature",
    ("model", "max_tokens"): "max_tokens",
    ("model", "timeout"): "llm_timeout",
    ("model", "top_p"): "top_p",
    ("model", "min_p"): "min_p",
    ("model", "rep_penalty"): "rep_penalty",
    ("model", "thinking"): "thinking",
    ("model", "num_ctx"): "num_ctx",
    ("context", "max_recent_messages"): "max_recent_messages",
    ("server", "host"): "host",
    ("server", "port"): "port",
    ("persona", "dir"): "persona_dir",
    ("persona", "active_preset"): "active_preset_id",
    ("database", "url"): "database_url",
    ("tools", "allowed_read_dirs"): "allowed_read_dirs",
    ("tools", "web_search_engine"): "web_search_engine",
    ("tools", "web_search_result_count"): "web_search_result_count",
    ("tools", "max_tool_rounds"): "max_tool_rounds",
}

_API_FIELDS = {
    "base_url": "llm_base_url",
    "model": "model",
    "temperature": "temperature",
    "max_tokens": "max_tokens",
    "timeout": "llm_timeout",
    "top_p": "top_p",
    "min_p": "min_p",
    "rep_penalty": "rep_penalty",
    "thinking": "thinking",
    "num_ctx": "num_ctx",
    "max_recent_messages": "max_recent_messages",
    "max_tool_rounds": "max_tool_rounds",
    "allowed_read_dirs": "allowed_read_dirs",
    "web_search_result_count": "web_search_result_count",
}


def load_config(path: str = "config.toml") -> Config:
    p = Path(path)
    if not p.exists():
        return Config()
    with open(p, "rb") as f:
        data = tomllib.load(f)
    kwargs = {}
    for (section, key), field_name in _TOML_MAP.items():
        if section in data and key in data[section]:
            kwargs[field_name] = data[section][key]
    return Config(**kwargs)


def config_to_api(cfg: Config) -> dict:
    return {api_key: getattr(cfg, attr) for api_key, attr in _API_FIELDS.items()}


def _toml_val(v) -> str:
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, str):
        return f'"{v}"'
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, list):
        items = ", ".join(_toml_val(i) for i in v)
        return f"[{items}]"
    return f'"{v}"'


def save_config(cfg: Config, path: str = "config.toml") -> None:
    reverse: dict[str, list[tuple[str, str]]] = {}
    for (section, key), attr in _TOML_MAP.items():
        reverse.setdefault(section, []).append((key, attr))

    lines: list[str] = []
    for section, pairs in reverse.items():
        lines.append(f"[{section}]")
        for key, attr in pairs:
            val = getattr(cfg, attr)
            default = next(
                (f.default for f in fields(cfg) if f.name == attr),
                None,
            )
            if val == default and attr not in (
                "llm_base_url", "model", "temperature", "max_tokens",
                "max_recent_messages", "host", "port",
            ):
                continue
            lines.append(f"{key} = {_toml_val(val)}")
        lines.append("")

    Path(path).write_text("\n".join(lines))
