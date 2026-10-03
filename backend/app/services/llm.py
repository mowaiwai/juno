"""LLM 客户端适配层。

统一走 OpenAI 兼容的 /chat/completions 协议（通义 DashScope、DeepSeek 均原生支持），
应用代码只依赖 LLMClient 的 chat()；提供 provider 入口，测试可整体替换为假客户端。
"""
from typing import Callable, NamedTuple, Protocol

import httpx

from app.config import settings


class LLMResult(NamedTuple):
    content: str
    prompt_tokens: int
    completion_tokens: int


class LLMClient(Protocol):
    def chat(self, messages: list[dict]) -> LLMResult:
        ...


class OpenAICompatibleClient:
    """OpenAI 兼容 Chat Completions 直连客户端。"""

    def __init__(self, *, base_url: str, api_key: str, model: str):
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._model = model

    def chat(self, messages: list[dict]) -> LLMResult:
        url = f"{self._base_url}/chat/completions"
        response = httpx.post(
            url,
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": self._model,
                "messages": messages,
                "temperature": 0.3,
            },
            timeout=settings.llm_timeout_seconds,
        )
        response.raise_for_status()
        data = response.json()
        content = data["choices"][0]["message"]["content"]
        usage = data.get("usage", {})
        return LLMResult(
            content=content,
            prompt_tokens=int(usage.get("prompt_tokens", 0)),
            completion_tokens=int(usage.get("completion_tokens", 0)),
        )


def _default_provider(*, base_url: str, api_key: str, model: str) -> LLMClient:
    return OpenAICompatibleClient(
        base_url=base_url, api_key=api_key, model=model
    )


_client_provider: Callable[..., LLMClient] = _default_provider


def get_client(*, base_url: str, api_key: str, model: str) -> LLMClient:
    return _client_provider(base_url=base_url, api_key=api_key, model=model)


def set_client_provider(provider: Callable[..., LLMClient]) -> None:
    """替换客户端构造器（测试注入假客户端）。"""
    global _client_provider
    _client_provider = provider
