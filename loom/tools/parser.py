import re

TAG_PATTERN = re.compile(r"\[(\w+):([^\]]+)\]")
KNOWN_TOOLS = {"search", "read"}


def extract_tool_calls(text: str) -> list[tuple[str, str]]:
    matches = TAG_PATTERN.findall(text)
    return [(name, arg) for name, arg in matches if name in KNOWN_TOOLS]
