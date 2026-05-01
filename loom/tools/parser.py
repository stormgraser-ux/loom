import re

TAG_PATTERN = re.compile(r"\[(\w+):([^\]]+)\]")
XML_TAG_PATTERN = re.compile(r"\[(\w+)\](.+?)\[/\1\]", re.DOTALL)
OPEN_TAG_PATTERN = re.compile(r"\[(\w+)\]([^\[\n]+)")
KNOWN_TOOLS = {"search", "read"}


def extract_tool_calls(text: str) -> list[tuple[str, str]]:
    results: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for name, arg in TAG_PATTERN.findall(text):
        if name in KNOWN_TOOLS:
            pair = (name, arg.strip())
            if pair not in seen:
                results.append(pair)
                seen.add(pair)
    for name, arg in XML_TAG_PATTERN.findall(text):
        if name in KNOWN_TOOLS:
            pair = (name, arg.strip())
            if pair not in seen:
                results.append(pair)
                seen.add(pair)
    for name, arg in OPEN_TAG_PATTERN.findall(text):
        if name in KNOWN_TOOLS:
            pair = (name, arg.strip())
            if pair not in seen:
                results.append(pair)
                seen.add(pair)
    return results
