from ddgs import DDGS


def web_search(query: str, max_results: int = 5) -> str:
    try:
        results = list(DDGS().text(query, max_results=max_results))
    except Exception as e:
        return f"Search error: {e}"

    if not results:
        return "No results found."

    lines = []
    for i, r in enumerate(results, 1):
        lines.append(f"{i}. {r['title']}")
        lines.append(f"   {r['href']}")
        lines.append(f"   {r['body']}")
        lines.append("")
    return "\n".join(lines)
