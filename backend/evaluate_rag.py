import asyncio
import os
import pandas as pd
from datasets import Dataset
from ragas import evaluate
from ragas.metrics import (
    context_precision,
    context_recall,
    faithfulness,
    answer_relevancy,
)
from app.services.rag_engine import RAGEngine
from app.core.config import settings
from openai import AsyncOpenAI
from ragas.llms import llm_factory
from ragas.embeddings import embedding_factory

# Configure OpenAI for Ragas
# Ragas uses OpenAI by default, but we need to ensure it uses our settings
os.environ["OPENAI_API_KEY"] = settings.OPENAI_API_KEY
if settings.OPENAI_API_BASE:
    os.environ["OPENAI_API_BASE"] = settings.OPENAI_API_BASE

# Monkeypatch OpenAI Client to handle n>1
client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY, base_url=settings.OPENAI_API_BASE)

original_create = client.chat.completions.create


async def custom_create(*args, **kwargs):
    n = kwargs.get("n", 1)
    if n > 1:
        # print(f"Intercepted n={n} in client.chat.completions.create")
        kwargs["n"] = 1
        choices = []
        last_response = None
        for i in range(n):
            response = await original_create(*args, **kwargs)
            last_response = response
            # Adjust index for each choice to be unique if needed, but usually Ragas just iterates
            for choice in response.choices:
                choice.index = i  # Update index to match sequential order
                choices.append(choice)

        if last_response:
            last_response.choices = choices
            return last_response

    return await original_create(*args, **kwargs)


# Bind the custom method
client.chat.completions.create = custom_create

# Define Test Data based on "1_知识库项目分析报告.md"
# We need: question, ground_truth (optional but good for context_recall)
TEST_DATA = [
    {
        "question": "本项目的前端核心框架是什么？",
        "ground_truth": "本项目前端核心框架采用 React 18 + Vite。",
    },
    {
        "question": "RAG 系统的数据流向是怎样的？",
        "ground_truth": "数据流向分为文档处理流和智能问答流。文档处理流包括上传、解析、切块和双路索引生成。智能问答流包括混合检索（Hybrid Search）、联网搜索兜底（Web Search Fallback）和答案生成。",
    },
    {
        "question": "后端使用了哪个向量数据库？",
        "ground_truth": "后端使用了 ChromaDB 作为本地持久化向量数据库。",
    },
    {
        "question": "如何实现流式响应？",
        "ground_truth": "系统使用 SSE (Server-Sent Events) 实现流式响应，提供实时打字机效果。",
    },
    {
        "question": "混合检索的具体策略是什么？",
        "ground_truth": "混合检索结合了向量检索 (Vector Search) 和 BM25 关键词检索，并使用 EnsembleRetriever 对结果进行加权融合 (Reciprocal Rank Fusion) 来提取 Top-K 相关文档。",
    },
]


async def run_evaluation():
    print("Initializing RAG Engine...")
    rag_engine = RAGEngine()

    questions = []
    answers = []
    contexts = []
    ground_truths = []

    print(f"Starting evaluation on {len(TEST_DATA)} test cases...")

    for item in TEST_DATA:
        question = item["question"]
        print(f"\nProcessing Question: {question}")

        # Run RAG Pipeline
        # We need to access the retrieval steps to get contexts,
        # but RAGEngine.aget_answer returns the final result and source documents.
        # Ragas expects contexts to be a list of strings.

        response = await rag_engine.aget_answer(question)
        answer = response["result"]
        source_docs = response["source_documents"]

        # Extract context content
        context_list = [doc.page_content for doc in source_docs]

        questions.append(question)
        answers.append(answer)
        contexts.append(context_list)
        ground_truths.append(item["ground_truth"])

        print(f"Generated Answer: {answer[:100]}...")
        print(f"Retrieved {len(context_list)} documents.")

    # Construct Dataset
    data = {
        "question": questions,
        "answer": answers,
        "contexts": contexts,
        "ground_truth": ground_truths,
    }

    dataset = Dataset.from_dict(data)

    print("\nRunning Ragas Evaluation...")
    # Using the metrics
    # Note: context_recall requires ground_truth

    # We need to manually pass llm and embeddings to evaluate if using non-standard OpenAI endpoints
    # Ragas v0.1+ supports passing llm/embeddings wrapper

    # Create LangChain LLM/Embeddings wrappers
    eval_llm = llm_factory(model=settings.LLM_MODEL_NAME, client=client)

    # We need an embedding model for Ragas.
    # Since VectorStoreService uses OpenAIEmbeddings (or similar), we should use that.
    # Let's check VectorStoreService to be sure, but standard OpenAIEmbeddings is likely.
    # Assuming standard OpenAI embeddings for evaluation metrics that need it.
    eval_embeddings = embedding_factory(model="text-embedding-3-small", client=client)

    results = evaluate(
        dataset=dataset,
        metrics=[
            context_precision,
            context_recall,
            faithfulness,
            answer_relevancy,
        ],
        llm=eval_llm,
        embeddings=eval_embeddings,
    )

    print("\n========== Evaluation Results ==========")
    print(results)

    # Convert to pandas for better display
    df = results.to_pandas()
    print("\nDetailed Results:")
    if not df.empty and "question" in df.columns:
        cols = [
            c
            for c in [
                "question",
                "context_precision",
                "context_recall",
                "faithfulness",
                "answer_relevancy",
            ]
            if c in df.columns
        ]
        print(df[cols])
    else:
        print(df)

    # Save to CSV
    output_file = "rag_evaluation_results.csv"
    df.to_csv(output_file, index=False)
    print(f"\nResults saved to {output_file}")


if __name__ == "__main__":
    asyncio.run(run_evaluation())
