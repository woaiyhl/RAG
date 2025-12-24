from langchain_openai import ChatOpenAI
from langchain_community.llms import FakeListLLM
from langchain.chains import RetrievalQA
from langchain_core.documents import Document
from app.services.vector_store import VectorStoreService
from app.core.config import settings
import asyncio

class RAGEngine:
    def __init__(self):
        self.vector_store_service = VectorStoreService()
        if settings.USE_MOCK_RAG or not settings.is_api_key_valid():
            self.llm = FakeListLLM(responses=["这是一个模拟的回答。"])
        else:
            self.llm = ChatOpenAI(
                model_name=settings.LLM_MODEL_NAME,
                temperature=0,
                openai_api_key=settings.OPENAI_API_KEY,
                openai_api_base=settings.OPENAI_API_BASE,
                timeout=60
            )
        
    def get_answer(self, query: str) -> dict:
        """Get answer from RAG pipeline (Synchronous)."""
        if settings.USE_MOCK_RAG:
            # Simple keyword matching for better mock experience
            mock_answer = ""
            if "金额" in query or "多少钱" in query or "价格" in query:
                mock_answer = "根据文档显示，该项目的总金额预算为 500,000 元，其中首期款项占比 30%。具体明细请参考财务附录表 B。"
            elif "RAG" in query.upper() or "优势" in query:
                mock_answer = "RAG (Retrieval-Augmented Generation) 的核心优势在于能利用外部知识库增强 LLM 的准确性，有效减少幻觉，并支持私有数据的即时更新。"
            else:
                mock_answer = f"这是一个模拟回答。您询问了“{query}”，但由于当前运行在 Mock 模式且未匹配到预设关键词，我无法从文档中提取具体答案。\n\n请尝试询问“金额”或“RAG优势”来查看不同的模拟效果，或配置真实的 API Key 以启用完整功能。"

            return {
                "result": f"【模拟模式】\n\n{mock_answer}\n\n(此回答仅用于演示 UI 交互，未消耗 Token)",
                "source_documents": [
                    Document(page_content=f"模拟检索片段：关于 '{query}' 的相关文档内容...", metadata={"source": "demo_doc.pdf", "page": 1}),
                    Document(page_content="系统配置：当前为演示模式 (Mock Mode)...", metadata={"source": "config.txt", "page": 0})
                ]
            }

        retriever = self.vector_store_service.vector_db.as_retriever(
            search_type="similarity",
            search_kwargs={"k": 4}
        )
        
        qa_chain = RetrievalQA.from_chain_type(
            llm=self.llm,
            chain_type="stuff",
            retriever=retriever,
            return_source_documents=True
        )
        
        result = qa_chain.invoke({"query": query})
        return result

    async def aget_answer(self, query: str) -> dict:
        """Get answer from RAG pipeline (Asynchronous)."""
        if settings.USE_MOCK_RAG:
            # Simulate network delay
            await asyncio.sleep(1)
            return self.get_answer(query)

        retriever = self.vector_store_service.vector_db.as_retriever(
            search_type="similarity",
            search_kwargs={"k": 4}
        )
        
        qa_chain = RetrievalQA.from_chain_type(
            llm=self.llm,
            chain_type="stuff",
            retriever=retriever,
            return_source_documents=True
        )
        
        result = await qa_chain.ainvoke({"query": query})
        return result
