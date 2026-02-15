from langchain_openai import ChatOpenAI
from langchain_community.llms import FakeListLLM
from langchain.chains import RetrievalQA
from langchain_core.documents import Document
from app.services.vector_store import VectorStoreService
from app.services.rerank import RerankService
from app.core.config import settings
import asyncio


class RAGEngine:
    def __init__(self):
        self.vector_store_service = VectorStoreService()
        self.rerank_service = RerankService()
        # Initialize LLM
        if settings.USE_MOCK_RAG:
            self.llm = FakeListLLM(responses=["这是一个模拟的回答。"])
        elif not settings.is_api_key_valid():
            self.llm = FakeListLLM(
                responses=[
                    "【配置错误】\n检测到 API Key 未配置或无效。\n\n请打开 backend/.env 文件，将 OPENAI_API_KEY 替换为您真实的 API Key。\n如果您还没有 Key，请访问 https://cloud.siliconflow.cn/ 免费申请。"
                ]
            )
        else:
            self.llm = ChatOpenAI(
                model_name=settings.LLM_MODEL_NAME,
                temperature=0,
                openai_api_key=settings.OPENAI_API_KEY,
                openai_api_base=settings.OPENAI_API_BASE,
                timeout=60,
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
                    Document(
                        page_content=f"模拟检索片段：关于 '{query}' 的相关文档内容...",
                        metadata={"source": "demo_doc.pdf", "page": 1},
                    ),
                    Document(
                        page_content="系统配置：当前为演示模式 (Mock Mode)...",
                        metadata={"source": "config.txt", "page": 0},
                    ),
                ],
            }

        retriever = self.vector_store_service.get_retriever(search_type="hybrid", k=4)

        qa_chain = RetrievalQA.from_chain_type(
            llm=self.llm,
            chain_type="stuff",
            retriever=retriever,
            return_source_documents=True,
        )

        result = qa_chain.invoke({"query": query})
        return result

    async def aget_answer(self, query: str) -> dict:
        """Get answer from RAG pipeline (Asynchronous)."""
        if settings.USE_MOCK_RAG:
            # Simulate network delay
            await asyncio.sleep(1)
            return self.get_answer(query)

        # Rerank Logic
        retriever = self.vector_store_service.get_retriever(search_type="hybrid", k=15)
        docs = await retriever.aget_relevant_documents(query)
        docs = self.rerank_service.rerank(query, docs, top_k=4)

        is_web_search = False
        if not docs:
            print(
                f"No documents found in vector store for '{query}'. Falling back to Web Search..."
            )
            try:
                from app.services.web_search import WebSearchService

                docs = await WebSearchService.asearch(query)
                if docs:
                    is_web_search = True
            except Exception as e:
                print(f"Web search failed: {e}")

        if not docs:
            # Fallback to General Knowledge with Disclaimer
            print(
                f"No documents found. Falling back to General Knowledge for '{query}'..."
            )
            from langchain_core.prompts import PromptTemplate

            disclaimer_prompt = """用户问题：{question}
未检索到专属知识库内容，请基于通用知识回答，并在回答开头和结尾分别添加以下免责声明：
开头：【免责声明：本回答基于通用知识，非专属知识库内容，仅供参考】
结尾：【建议你查阅官方文档或联系相关人员获取准确信息】"""

            PROMPT = PromptTemplate(
                template=disclaimer_prompt, input_variables=["question"]
            )

            # Use LLM directly
            chain = PROMPT | self.llm
            result_content = await chain.ainvoke({"question": query})

            result_text = (
                result_content.content
                if hasattr(result_content, "content")
                else str(result_content)
            )

            return {"result": result_text, "source_documents": []}

        from langchain.chains.question_answering import load_qa_chain
        from langchain_core.prompts import PromptTemplate

        template = """你是一个专业的知识库助手。请根据以下提供的参考文档内容回答用户的问题。如果文档中没有相关信息，请诚实地说明无法回答，不要编造信息。
        
参考文档：
{context}

用户问题：{question}

回答："""

        if is_web_search:
            template = """你是一个智能助手。由于本地知识库缺乏相关信息，以下内容来自网络搜索结果。请根据这些搜索结果回答用户的问题。回答要条理清晰，使用 Markdown 格式，并适当引用来源。

参考搜索结果：
{context}

用户问题：{question}

回答："""

        PROMPT = PromptTemplate(
            template=template, input_variables=["context", "question"]
        )

        chain = load_qa_chain(self.llm, chain_type="stuff", prompt=PROMPT)
        result = await chain.ainvoke({"input_documents": docs, "question": query})

        result_text = result["output_text"]

        # Post-Verification Fallback: If LLM says it can't answer, try Web Search
        refusal_keywords = [
            "无法回答",
            "没有相关信息",
            "并未包含",
            "不包含",
            "无法提供",
        ]
        is_refusal = any(k in result_text for k in refusal_keywords)

        if is_refusal and not is_web_search:
            print(
                f"LLM indicated insufficient context ('{result_text[:50]}...'). Fallback to Web Search..."
            )
            try:
                from app.services.web_search import WebSearchService

                web_docs = await WebSearchService.asearch(query)

                if web_docs:
                    print(
                        f"Web search found {len(web_docs)} results. Re-generating answer..."
                    )

                    # Update Prompt for Web Search
                    web_template = """你是一个智能助手。由于本地知识库缺乏相关信息，以下内容来自网络搜索结果。请根据这些搜索结果回答用户的问题。回答要条理清晰，使用 Markdown 格式，并适当引用来源。

参考搜索结果：
{context}

用户问题：{question}

回答："""
                    WEB_PROMPT = PromptTemplate(
                        template=web_template, input_variables=["context", "question"]
                    )

                    chain = load_qa_chain(
                        self.llm, chain_type="stuff", prompt=WEB_PROMPT
                    )
                    result = await chain.ainvoke(
                        {"input_documents": web_docs, "question": query}
                    )

                    return {
                        "result": result["output_text"],
                        "source_documents": web_docs,
                    }
            except Exception as e:
                print(f"Web search fallback failed: {e}")

        return {"result": result_text, "source_documents": docs}

    async def astream_answer_generator(self, query: str, chat_history: list = None):
        """Generator for streaming answer."""
        if chat_history is None:
            chat_history = []

        if settings.USE_MOCK_RAG:
            # Simulate streaming in Mock mode
            result = self.get_answer(query)
            full_answer = result["result"]
            sources = result["source_documents"]

            # Stream characters
            for i in range(0, len(full_answer), 2):  # Stream 2 chars at a time
                chunk = full_answer[i : i + 2]
                yield {"answer": chunk}
                await asyncio.sleep(0.05)

            # Send sources at the end
            yield {"sources": [doc.page_content for doc in sources]}
            return

        # Real RAG Streaming
        import time
        from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

        start_time = time.time()
        print(f"[{start_time}] Starting RAG pipeline for query: {query}")

        # 1. Query Rewriting (if history exists)
        search_query = query
        if chat_history:
            yield {"status": "正在理解上下文..."}
            print(f"[{time.time()}] rewriting query based on history...")
            rewrite_prompt = "请根据以下对话历史，将用户的最新问题改写为一个独立的、语义完整的搜索查询。不要回答问题，只需输出改写后的查询。如果无需改写，直接输出原问题。\n\n对话历史：\n"
            for msg in chat_history[-6:]:  # Limit history context
                role = "用户" if msg.get("role") == "user" else "助手"
                content = msg.get("content", "")
                rewrite_prompt += f"{role}: {content}\n"

            rewrite_prompt += f"用户最新问题: {query}\n\n独立查询:"

            try:
                rewrite_msg = [HumanMessage(content=rewrite_prompt)]
                rewrite_response = await self.llm.ainvoke(rewrite_msg)
                search_query = rewrite_response.content.strip()
                print(f"[{time.time()}] Query rewritten: '{query}' -> '{search_query}'")
            except Exception as e:
                print(f"Query rewriting failed: {e}. Using original query.")

        # 2. Retrieval using search_query
        # Use higher k for reranking (e.g. 15)
        initial_k = 15
        retriever = self.vector_store_service.get_retriever(
            search_type="hybrid", k=initial_k
        )

        try:
            yield {"status": "正在检索相关文档..."}
            print(f"[{time.time()}] Starting retrieval for '{search_query}'...")
            docs = await retriever.aget_relevant_documents(search_query)
            print(
                f"[{time.time()}] Retrieval complete. Found {len(docs)} docs. Time taken: {time.time() - start_time:.2f}s"
            )

            # RERANK STEP
            if docs:
                yield {"status": "正在筛选最佳结果..."}
                print(f"[{time.time()}] Reranking {len(docs)} documents...")
                docs = self.rerank_service.rerank(search_query, docs, top_k=4)
                print(f"[{time.time()}] Reranking complete. Kept {len(docs)} docs.")

        except Exception as e:
            print(f"[{time.time()}] Retrieval failed: {e}")
            yield {"error": f"Retrieval failed: {str(e)}"}
            return

        # Web Search Fallback Logic
        is_web_search = False
        if not docs:
            print(
                f"[{time.time()}] No documents found in vector store. Falling back to Web Search..."
            )
            try:
                from app.services.web_search import WebSearchService

                yield {"status": "正在联网搜索最新信息..."}
                docs = await WebSearchService.asearch(search_query)
                if docs:
                    is_web_search = True
                    print(f"[{time.time()}] Web search found {len(docs)} results.")
            except Exception as e:
                print(f"Web search failed: {e}")

        if not docs:
            # Fallback to General Knowledge with Disclaimer (Streaming)
            print(
                f"[{time.time()}] No documents found. Falling back to General Knowledge..."
            )

            disclaimer_prompt = f"""用户问题：{query}
未检索到专属知识库内容，请基于通用知识回答，并在回答开头和结尾分别添加以下免责声明：
开头：【免责声明：本回答基于通用知识，非专属知识库内容，仅供参考】
结尾：【建议你查阅官方文档或联系相关人员获取准确信息】"""

            # Use history for General Knowledge fallback too
            messages = []
            if chat_history:
                # Add condensed history for context
                for msg in chat_history[-4:]:
                    if msg.get("role") == "user":
                        messages.append(HumanMessage(content=msg.get("content")))
                    elif msg.get("role") == "assistant":
                        messages.append(AIMessage(content=msg.get("content")))

            messages.append(HumanMessage(content=disclaimer_prompt))

            async for chunk in self.llm.astream(messages):
                if chunk.content:
                    yield {"answer": chunk.content}

            yield {"sources": []}
            return

        context = "\n\n".join([doc.page_content for doc in docs])

        # Manually construct prompt to control streaming

        system_prompt = "你是一个专业的知识库助手。请根据以下提供的参考文档内容回答用户的问题。如果文档中没有相关信息，请诚实地说明无法回答，不要编造信息。回答要条理清晰，使用 Markdown 格式。"
        if is_web_search:
            system_prompt = "你是一个智能助手。由于本地知识库缺乏相关信息，以下内容来自网络搜索结果。请根据这些搜索结果回答用户的问题。回答要条理清晰，使用 Markdown 格式，并适当引用来源。"

        user_prompt = f"参考文档：\n{context}\n\n用户问题：{query}"

        messages = [SystemMessage(content=system_prompt)]

        # Add history to final generation prompt
        if chat_history:
            for msg in chat_history[-4:]:  # Keep last 2 turns
                if msg.get("role") == "user":
                    messages.append(HumanMessage(content=msg.get("content")))
                elif msg.get("role") == "assistant":
                    messages.append(AIMessage(content=msg.get("content")))

        messages.append(HumanMessage(content=user_prompt))

        # Stream from LLM
        yield {"status": "正在生成回答..."}
        print(f"[{time.time()}] Starting LLM generation...")
        llm_start_time = time.time()
        first_token_received = False
        full_response = ""

        async for chunk in self.llm.astream(messages):
            if not first_token_received:
                first_token_received = True
                print(
                    f"[{time.time()}] First token received. Time to first token: {time.time() - llm_start_time:.2f}s"
                )

            if chunk.content:
                full_response += chunk.content
                yield {"answer": chunk.content}

        print(
            f"[{time.time()}] LLM generation complete. Total time: {time.time() - start_time:.2f}s"
        )

        # Secondary Fallback: Check for Refusal in Streaming Response
        refusal_keywords = [
            "无法回答",
            "没有相关信息",
            "并未包含",
            "不包含",
            "无法提供",
            "抱歉",
            "sorry",
        ]
        is_refusal = any(k in full_response for k in refusal_keywords)

        if is_refusal and not is_web_search:
            print(
                f"[{time.time()}] LLM indicated refusal in stream. Triggering Web Search Fallback..."
            )
            try:
                from app.services.web_search import WebSearchService

                web_docs = await WebSearchService.asearch(query)

                if web_docs:
                    print(
                        f"[{time.time()}] Web search found {len(web_docs)} results. Re-generating answer..."
                    )
                    docs = web_docs  # Update docs for sources

                    web_template = "你是一个智能助手。由于本地知识库缺乏相关信息，以下内容来自网络搜索结果。请根据这些搜索结果回答用户的问题。回答要条理清晰，使用 Markdown 格式，并适当引用来源。"
                    web_context = "\n\n".join([doc.page_content for doc in web_docs])
                    web_user_prompt = (
                        f"参考搜索结果：\n{web_context}\n\n用户问题：{query}"
                    )

                    web_messages = [
                        SystemMessage(content=web_template),
                        HumanMessage(content=web_user_prompt),
                    ]

                    async for chunk in self.llm.astream(web_messages):
                        if chunk.content:
                            yield {"answer": chunk.content}

            except Exception as e:
                print(f"Web search fallback failed during streaming: {e}")

        # Send sources at the end
        sources_list = []
        for doc in docs:
            if doc.metadata.get("type") == "web_search":
                # For Web Search, provide Title and URL
                sources_list.append(
                    {
                        "type": "web",
                        "title": doc.metadata.get("title", "无标题"),
                        "url": doc.metadata.get("source", "无链接"),
                        "content": doc.page_content,
                        "metadata": doc.metadata,
                    }
                )
            else:
                # For local documents, provide content snippet and metadata
                sources_list.append(
                    {
                        "type": "file",
                        "content": doc.page_content,
                        "metadata": doc.metadata,
                        "title": doc.metadata.get("filename", "未知文档"),
                    }
                )

        yield {"sources": sources_list}
