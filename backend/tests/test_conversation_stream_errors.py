import json
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.endpoints import conversations
from app.core.database import Base
from app.schemas.conversation import ConversationCreate


@pytest.fixture
def conversation_db(monkeypatch):
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    monkeypatch.setattr(conversations, "SessionLocal", session_factory)
    with session_factory() as db:
        conversation = conversations.conversation_service.create_conversation(
            db, ConversationCreate()
        )
        yield db, conversation.id
    engine.dispose()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "chunks,exception,expected_content,has_error",
    [
        ([{"answer": "正常"}, {"answer": "回答"}], None, "正常回答", False),
        ([{"error": "Retrieval failed: billing_not_active"}], None, "尚未激活 API 计费", True),
        ([{"status": "正在检索相关文档..."}], None, "未返回回答", True),
        ([], RuntimeError("上游连接中断"), "上游连接中断", True),
        ([{"answer": "部分回答"}, {"error": "检索失败"}], None, "部分回答\n\n❌ 错误：检索失败", True),
    ],
    ids=["success", "billing-error", "empty-stream", "exception", "partial-error"],
)
async def test_stream_and_history_keep_the_same_result(
    monkeypatch, conversation_db, chunks, exception, expected_content, has_error
):
    async def stream(*args, **kwargs):
        for chunk in chunks:
            yield chunk
        if exception:
            raise exception

    monkeypatch.setattr(
        conversations, "RAGEngine",
        lambda: SimpleNamespace(astream_answer_generator=stream),
    )
    db, conversation_id = conversation_db
    response = await conversations.chat_stream(
        conversation_id, conversations.ChatRequest(query="前后端技术栈"), db
    )
    events = [json.loads(chunk.removeprefix("data: ")) async for chunk in response.body_iterator]

    assert any("error" in event for event in events) is has_error
    assert "message_id" in events[-1]
    history = conversations.read_conversation(conversation_id, db)
    user, assistant = history.messages
    assert user.content == "前后端技术栈"
    assert expected_content in assistant.content
    assert assistant.id == events[-1]["message_id"]
    assert user.id == events[-1]["user_message_id"]
    streamed_answer = "".join(event.get("answer", "") for event in events)
    errors = [event["error"] for event in events if "error" in event]
    expected_saved = streamed_answer
    for error in errors:
        expected_saved += ("\n\n" if expected_saved else "") + f"❌ 错误：{error}"
    assert assistant.content == expected_saved


@pytest.mark.asyncio
async def test_interrupted_stream_keeps_partial_answer(monkeypatch, conversation_db):
    async def stream(*args, **kwargs):
        yield {"answer": "已生成的部分内容"}
        yield {"answer": "尚未发送的内容"}

    monkeypatch.setattr(
        conversations, "RAGEngine",
        lambda: SimpleNamespace(astream_answer_generator=stream),
    )
    db, conversation_id = conversation_db
    response = await conversations.chat_stream(
        conversation_id, conversations.ChatRequest(query="前后端技术栈"), db
    )
    await response.body_iterator.__anext__()
    await response.body_iterator.aclose()
    history = conversations.read_conversation(conversation_id, db)
    assert history.messages[-1].content == "已生成的部分内容"
