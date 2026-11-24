import json
from unittest.mock import Mock

import httpx
from openai import AsyncOpenAI
import pytest

from app.services import rag_engine


@pytest.mark.asyncio
@pytest.mark.parametrize("enable_thinking", [None, False])
async def test_chat_stream_sends_explicit_thinking_mode(monkeypatch, enable_thinking):
    monkeypatch.setattr(rag_engine.settings, "OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(rag_engine.settings, "OPENAI_API_BASE", "https://api.siliconflow.cn/v1")
    monkeypatch.setattr(rag_engine.settings, "LLM_MODEL_NAME", "THUDM/GLM-Z1-9B-0414")
    monkeypatch.setattr(rag_engine.settings, "LLM_ENABLE_THINKING", enable_thinking)
    monkeypatch.setattr(rag_engine.settings, "USE_MOCK_RAG", False)
    monkeypatch.setattr(rag_engine, "VectorStoreService", Mock())

    def handle(request):
        payload = json.loads(request.content)
        assert payload["model"] == "THUDM/GLM-Z1-9B-0414"
        if enable_thinking is None:
            assert "enable_thinking" not in payload
        else:
            assert payload["enable_thinking"] is False
        return httpx.Response(
            200,
            headers={"Content-Type": "text/event-stream"},
            text='data: {"choices":[{"index":0,"delta":{"role":"assistant","content":"正常回答"}}]}\n\ndata: [DONE]\n\n',
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as http_client:
        client = AsyncOpenAI(
            api_key="test-key", base_url="https://api.siliconflow.cn/v1", http_client=http_client
        )
        engine = rag_engine.RAGEngine()
        engine.llm.async_client = client.chat.completions
        answer = "".join([chunk.content async for chunk in engine.llm.astream("你好")])
        assert answer == "正常回答"
