import asyncio

from loom.tools.file_read import file_read
from loom.tools.parser import extract_tool_calls
from loom.tools.search import web_search

__all__ = ["extract_tool_calls", "execute_tool", "run_tool_calls"]


async def execute_tool(
    name: str,
    argument: str,
    allowed_read_dirs: list[str] | None = None,
    search_result_count: int = 5,
) -> str:
    if name == "search":
        return await asyncio.to_thread(web_search, argument.strip(), search_result_count)
    elif name == "read":
        return await asyncio.to_thread(file_read, argument.strip(), allowed_read_dirs or [])
    return f"Unknown tool: {name}"


async def run_tool_calls(
    tool_calls: list[tuple[str, str]],
    allowed_read_dirs: list[str] | None = None,
    search_result_count: int = 5,
) -> list[tuple[str, str, str]]:
    results = []
    for name, arg in tool_calls:
        result = await execute_tool(name, arg, allowed_read_dirs, search_result_count)
        results.append((name, arg, result))
    return results
