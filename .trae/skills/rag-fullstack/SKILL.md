---
name: "rag-fullstack"
description: "为本仓库的 RAG（检索增强生成）全栈开发提供固定流程与检查清单。遇到检索/重排/嵌入/向量库/后端 FastAPI 接口/前端聊天联调与排障时调用。"
---

# RAG 全栈（本项目专用）

面向本仓库（FastAPI + LangChain + ChromaDB + React/Vite）的 RAG 开发与排障流程。目标是把需求快速落到：文档入库 → 检索（向量/关键词/混合）→ 重排 → 生成 → 引用溯源 → 评测/监控，并保证前后端联调稳定。

## 适用场景（触发条件）

- 需要新增/调整 RAG 流程：切分、Embedding、向量库、召回策略、重排策略、引用来源
- 需要排查回答质量问题：召回为空、命中不准、重复/幻觉（hallucination，模型编造）、引用缺失
- 需要改动后端接口或前端交互：流式/非流式输出、对话历史、文档管理、引用侧边栏
- 需要做评测：离线评测、对比不同参数/策略、生成可复现报告

## 项目关键位置（先看这些）

- 后端入口与路由：`backend/app/main.py`、`backend/app/api/api.py`、`backend/app/api/endpoints/`
- RAG 核心：`backend/app/services/rag_engine.py`
- 向量库与检索：`backend/app/services/vector_store.py`
- 重排：`backend/app/services/rerank.py`
- 文档入库：`backend/app/api/endpoints/documents.py`、`backend/app/services/document_service.py`
- 对话：`backend/app/api/endpoints/conversations.py`、`backend/app/services/conversation_service.py`
- 联网搜索：`backend/app/services/web_search.py`
- 前端 API：`frontend/src/services/api.ts`
- 前端状态：`frontend/src/store/useChatStore.ts`
- 前端主界面：`frontend/src/App.tsx`、`frontend/src/components/`
- 测试：`backend/tests/test_rag.py`、`backend/tests/test_rag_mock.py`

## 标准工作流（从需求到可验收）

1. 明确“质量目标”
   - 期望输出格式（是否需要引用、是否需要 Markdown、是否需要分点/表格）
   - 召回与引用约束（必须引用、引用数量上限、引用片段长度）
2. 定位影响面
   - 入库：切分规则、metadata（元数据）、向量维度/模型
   - 检索：topK、过滤条件、混合检索权重、阈值
   - 重排：模型/规则、候选集规模、截断策略
   - 生成：提示词（prompt）、上下文拼接、对话记忆、拒答策略
3. 最小改动实现 + 可回滚
   - 把可调参数集中到配置（避免散落魔法值）
4. 验证
   - 先跑现有测试，再加覆盖本次改动的测试用例
   - 前端通过真实接口走一遍：上传 → 入库 → 提问 → 引用显示

## RAG 质量排查清单（按优先级）

### 1) 召回是否正常

- 文档是否成功入库（数量、切分片段数、metadata 是否齐全）
- 查询是否被正确预处理（中文分词/停用词、是否过度清洗）
- 检索结果是否为空，空的原因是过滤条件还是向量相似度过低

### 2) 命中是否相关

- 调整 topK 与候选集规模（重排前候选一般要足够大）
- 检查切分粒度：过大导致噪声，过小导致信息缺失
- 检查是否需要混合检索（BM25 + 向量）来覆盖关键词场景

### 3) 生成是否“贴着证据说话”

- 上下文是否按引用片段拼接，且总 token（分词长度）不超限
- 提示词是否明确要求“仅基于引用回答，无法覆盖就拒答”
- 引用是否能映射回源文档（文件名、页码、chunk id）

## 常见改造模板

### A. 引入/调整混合检索

- 召回层：向量召回 + BM25 召回
- 合并层：去重（按 chunk id / 文档 + 片段起止）与打分归一化
- 重排层：对合并后的候选做二次排序

### B. 增强引用溯源

- 入库时保证 metadata 至少包含：`source`（文件名/路径）、`page`、`chunk_index` 或 `chunk_id`
- 返回给前端的引用结构稳定：来源、片段内容、定位信息（页码/段落）

### C. 增加评测与对比实验

- 固定数据集与查询集，输出：命中率/引用覆盖率/人工评分字段
- 每次实验把关键参数写入结果（便于回溯）

## 输出要求（默认约束）

- 后端接口返回结构保持向后兼容；新增字段尽量可选（前端用可选链安全访问）
- 不记录或打印任何密钥、Token、用户敏感内容
- 失败要“可诊断”：统一错误结构，前端不白屏

## 示例任务（如何使用本 Skill）

- “把检索从纯向量改成 BM25+向量混合，并保留引用侧边栏可点击定位”
- “回答经常引用错文档，检查 metadata 流转并修复引用映射”
- “某些问题召回为空，给出可复现的最小用例并修复过滤/分词逻辑”
