from types import SimpleNamespace
from unittest.mock import Mock, patch

import pytest

from app.services import vector_store


@pytest.fixture
def siliconflow_service(monkeypatch):
    monkeypatch.setattr(vector_store.settings, "OPENAI_API_BASE", "https://api.siliconflow.cn/v1")
    monkeypatch.setattr(vector_store.settings, "OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(vector_store.settings, "EMBEDDING_MODEL_NAME", "BAAI/bge-m3")
    monkeypatch.setattr(vector_store.settings, "USE_MOCK_RAG", False)
    monkeypatch.setattr(vector_store, "Chroma", Mock())
    return vector_store.VectorStoreService()


def test_siliconflow_embeddings_send_raw_text(siliconflow_service):
    create = Mock(return_value={"data": [{"embedding": [0.1] * 1024}]})
    siliconflow_service.embeddings.client = SimpleNamespace(create=create)
    with patch("tiktoken.encoding_for_model", side_effect=AssertionError("Unexpected tokenizer")):
        result = siliconflow_service.embeddings.embed_query("前后端技术栈")
    assert len(result) == 1024
    assert create.call_args.kwargs["input"] == ["前后端技术栈"]


@pytest.mark.asyncio
async def test_siliconflow_async_embeddings_send_raw_text(siliconflow_service):
    payloads = []

    async def create(**payload):
        payloads.append(payload)
        return {"data": [{"embedding": [0.1] * 1024}]}

    siliconflow_service.embeddings.async_client = SimpleNamespace(create=create)
    with patch("tiktoken.encoding_for_model", side_effect=AssertionError("Unexpected tokenizer")):
        result = await siliconflow_service.embeddings.aembed_query("前后端技术栈")
    assert len(result) == 1024
    assert payloads[0]["input"] == ["前后端技术栈"]


def test_openai_keeps_token_length_check(monkeypatch):
    monkeypatch.setattr(vector_store.settings, "OPENAI_API_BASE", "https://api.openai.com/v1")
    monkeypatch.setattr(vector_store.settings, "OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(vector_store.settings, "USE_MOCK_RAG", False)
    monkeypatch.setattr(vector_store, "Chroma", Mock())
    service = vector_store.VectorStoreService()
    assert service.embeddings.check_embedding_ctx_length is True
