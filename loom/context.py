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
        chain.append({"role": msg["role"], "content": msg["content"]})
        msg_id = msg.get("parentId")
    chain.reverse()

    if len(chain) > max_recent:
        chain = chain[-max_recent:]

    return [{"role": "system", "content": system_prompt}, *chain]
