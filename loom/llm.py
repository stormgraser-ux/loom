import json
from collections.abc import AsyncGenerator

import httpx


class LLMClient:
    def __init__(self, base_url: str, model: str, timeout: float = 120.0):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.client = httpx.AsyncClient(timeout=timeout)

    async def reconfigure(self, base_url: str, model: str, timeout: float):
        await self.client.aclose()
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.client = httpx.AsyncClient(timeout=timeout)

    def _chat_url(self) -> str:
        base = self.base_url
        if base.endswith("/v1"):
            base = base[:-3]
        return f"{base}/api/chat"

    async def _do_stream(
        self, payload: dict
    ) -> AsyncGenerator[tuple[str, str], None]:
        async with self.client.stream(
            "POST", self._chat_url(), json=payload,
        ) as response:
            if response.status_code != 200:
                body = await response.aread()
                try:
                    err = json.loads(body)
                    msg = err.get("error", "") if isinstance(err.get("error"), str) else err.get("error", {}).get("message", "")
                except Exception:
                    msg = ""
                if "unable to load model" in msg:
                    raise RuntimeError(
                        f"Ollama couldn't load \"{payload['model']}\" — the model file "
                        f"may be corrupt or incomplete. Try: ollama rm \"{payload['model']}\" "
                        f"then re-pull it."
                    )
                raise RuntimeError(
                    msg or f"Model endpoint returned {response.status_code}"
                )
            async for line in response.aiter_lines():
                if not line.strip():
                    continue
                chunk = json.loads(line)
                msg = chunk.get("message", {})
                if thinking_text := msg.get("thinking"):
                    yield ("thinking", thinking_text)
                if content := msg.get("content"):
                    yield ("content", content)
                if chunk.get("done"):
                    break

    async def stream_chat(
        self,
        messages: list[dict],
        temperature: float = 0.7,
        max_tokens: int = 2048,
        top_p: float | None = None,
        min_p: float | None = None,
        rep_penalty: float | None = None,
        thinking: bool = False,
        model: str | None = None,
        num_ctx: int | None = None,
    ) -> AsyncGenerator[tuple[str, str], None]:
        """Yield (type, text) tuples: type is 'content' or 'thinking'."""
        opts: dict = {
            "temperature": temperature,
            "num_predict": max_tokens,
        }
        if top_p is not None:
            opts["top_p"] = top_p
        if min_p is not None:
            opts["min_p"] = min_p
        if rep_penalty is not None:
            opts["repeat_penalty"] = rep_penalty
        if num_ctx is not None:
            opts["num_ctx"] = num_ctx

        payload: dict = {
            "model": model or self.model,
            "messages": messages,
            "stream": True,
            "options": opts,
        }
        if thinking:
            payload["think"] = True

        try:
            async for chunk in self._do_stream(payload):
                yield chunk
        except RuntimeError as e:
            if "does not support thinking" in str(e) and thinking:
                payload.pop("think", None)
                async for chunk in self._do_stream(payload):
                    yield chunk
            else:
                raise

    async def close(self):
        await self.client.aclose()
