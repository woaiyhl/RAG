---
name: "vectorstore-chroma-ops"
description: "提供本仓库 ChromaDB 向量库运维与数据一致性排查清单。遇到入库后检索不到、重复片段、库损坏或需重建时调用。"
---

# Chroma 向量库运维与一致性（本项目专用）

面向本仓库的 ChromaDB（本地持久化）使用与排障流程，重点解决：为什么召回为空/不准、数据是否持久化、metadata 是否完整、BM25 缓存是否正确失效。

## 关键实现与路径

- 持久化目录：`backend/app/core/config.py` 中 `settings.CHROMA_PERSIST_DIRECTORY`（默认 `backend/data/chroma_db`）
- 向量库封装：`backend/app/services/vector_store.py`（Chroma + Embedding + BM25 + 混合检索）
- 文档入库：`backend/app/services/document_service.py`、`backend/app/api/endpoints/documents.py`
- RAG 调用：`backend/app/services/rag_engine.py`
- Docker 挂载：`docker-compose.yml`（`./backend/data:/app/data`）

## 先判断问题属于哪类

1) “没数据”：Chroma 目录为空/collection 为空/入库流程未走到 add_documents  
2) “有数据但搜不到”：Embedding 不一致、维度不一致、过滤条件过严、相似度阈值/TopK 过低  
3) “结果重复或很噪”：切分策略不合理、去重不足、metadata 缺失导致无法聚合  
4) “混合检索不稳定”：BM25 缓存未失效、BM25 建索引时取到的文档/metadata 异常

## 运维与排障清单（按优先级）

### 1) 确认数据是否真的持久化

- 本地运行：
  - 看 `backend/data/chroma_db` 是否存在且有文件
- Docker 运行：
  - 看宿主机 `backend/data` 是否有 `chroma_db` 子目录（因为容器内写到 `/app/data`）
  - 更新代码时部署脚本会排除 `backend/data/chroma_db`（避免误覆盖），确认是否符合你的预期

### 2) 确认 Embedding 是否一致

- 代码路径：`backend/app/services/vector_store.py`
  - 当 `USE_MOCK_RAG=true` 或 API Key 无效，会退化到 `FakeEmbeddings(size=1536)`
  - 真实 Embedding 使用 `OpenAIEmbeddings(model=settings.EMBEDDING_MODEL_NAME)`
- 风险点：
  - “用 A 模型入库、用 B 模型检索”会导致相似度不可用（相当于换了向量空间）
- 建议动作：
  - 改 Embedding 模型后，重建向量库（清空 `chroma_db` 重新入库）

### 3) 确认 metadata 完整且可用于后续能力

- 本项目删除逻辑依赖 `file_id`：`delete_documents_by_file_id` 会按 `where={"file_id": file_id}` 删除
- 若需要“引用溯源/定位”，metadata 建议至少包含：
  - `source`（文件名/路径）、`page`、`chunk_index` 或 `chunk_id`、`file_id`
- 发现 metadata 为 `None` 的情况：
  - `vector_store.py` 里已做兜底（`meta is None -> {}`），但这会降低可观测性与可维护性

### 4) 混合检索（BM25 + 向量）相关排查

- 代码路径：`VectorStoreService.get_retriever(search_type="hybrid")`
- 机制要点：
  - BM25 索引通过 `self.vector_db.get()` 把全部文档取出重建
  - 使用全局 `_bm25_retriever_cache` 缓存，入库/删除时会置空失效
- 高发问题：
  - 文档量大时 `get()` 很慢，导致首个查询卡顿
  - 如果你绕开 `add_documents` 直接操作底层 collection，BM25 缓存可能不会自动失效
- 建议动作：
  - 保证所有写操作都走 `VectorStoreService.add_documents/delete_documents_by_file_id`
  - 大数据量时考虑把 BM25 建索引做成后台任务或增量更新（改造时再调用 `rag-fullstack`）

## 安全重建（不丢业务逻辑、只重建数据）

适用：Embedding 模型变更、切分策略大改、历史数据脏、召回长期异常。

- 步骤：
  1. 停止服务或暂停写入
  2. 备份 `backend/data/chroma_db`
  3. 删除 `backend/data/chroma_db`
  4. 重新走“上传/入库”流程生成新向量库

## 快速验证（本仓库已有脚本）

- 真实链路（需要有效 Key）：`python backend/tests/test_rag.py`
- Mock 链路（避免真实调用）：`python backend/tests/test_rag_mock.py`
