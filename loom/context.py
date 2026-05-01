import logging

log = logging.getLogger("loom.images")


def _strip_data_uri(b64: str) -> str:
    if "," in b64:
        return b64.split(",", 1)[1]
    return b64


def build_messages(
    system_prompt: str,
    chat_data: dict,
    current_id: str,
    max_recent: int = 40,
) -> list[dict]:
    """Walk the chat tree back from current_id, apply sliding window."""
    messages_tree = chat_data.get("messages", {})

    chain = []
    msg_id = current_id
    while msg_id:
        msg = messages_tree.get(msg_id)
        if not msg:
            break
        entry = {"role": msg["role"], "content": msg["content"]}
        if msg.get("images"):
            entry["images"] = [_strip_data_uri(img) for img in msg["images"]]
        chain.append(entry)
        msg_id = msg.get("parentId")
    chain.reverse()

    if len(chain) > max_recent:
        chain = chain[-max_recent:]

    return [{"role": "system", "content": system_prompt}, *chain]
