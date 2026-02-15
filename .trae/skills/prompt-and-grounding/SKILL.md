---
name: "prompt-and-grounding"
description: "提供本仓库 Prompt 调参与基于证据回答（grounding）约束清单。遇到幻觉、答非所问、引用不稳定或格式漂移时调用。"
---

# Prompt 调优与证据约束（本项目专用）

目标：让回答“贴着证据说话”，在证据不足时明确拒答，且输出结构稳定（便于前端渲染与引用展示）。

## 关键实现位置

- 主生成逻辑：`backend/app/services/rag_engine.py`
  - `get_answer`：同步 `RetrievalQA`（当前默认 hybrid k=4）
  - `aget_answer`：异步（含重排、联网兜底、拒答后再联网）
  - `astream_answer_generator`：流式（含 query rewrite）
- 重排：`backend/app/services/rerank.py`
- 检索：`backend/app/services/vector_store.py`
- 前端渲染：`frontend/src/App.tsx`（Markdown、引用侧边栏等）

## 判断问题类型（先选策略）

1) “幻觉/编造”（hallucination）：回答超出引用内容  
2) “答非所问”：检索命中不相关 / query rewrite 误改写  
3) “格式漂移”：回答有时分点有时不分点、引用格式不一致  
4) “引用不稳定”：同一问题引用来源变动大 / 引用缺失

## Grounding（基于证据回答）约束模板

适用：只允许基于本地知识库内容回答，证据不足必须拒答。

- 关键约束要素（推荐同时具备）：
  - 明确禁止编造：文档中没有就说明“无法从文档回答”
  - 明确输出结构：先给结论，再列要点，再列引用
  - 明确引用规则：每个要点后附对应来源（文件名/页码）
  - 明确长度：避免把全部上下文复述导致 token 浪费

## Web Search（联网兜底）约束模板

适用：本地召回为空或模型拒答时，允许基于网络搜索回答，但必须加免责声明与来源。

- 本项目已有逻辑：
  - `aget_answer` 在 docs 为空时会尝试 `WebSearchService.asearch`
  - 生成 prompt 会切换到“参考搜索结果”的模板，并提示引用来源
- 建议固定：
  - 输出开头明确标注“来自网络搜索结果”
  - 把每条来源链接/标题保留给前端展示（若后端已携带 metadata）

## 调参与排障步骤（建议顺序）

1. 先锁定召回与候选规模
   - `aget_answer` 当前：先 hybrid k=15，再重排 top_k=4
   - 若“答非所问”，优先调整 k 与重排策略，而不是先改 prompt
2. 再调整提示词
   - 确保 prompt 里同时包含：拒答规则 + 输出结构 + 引用规则
3. 最后处理对话记忆与 query rewrite
   - `astream_answer_generator` 会基于历史改写搜索查询
   - 若出现“越聊越偏”，检查改写 prompt 是否过度自由

## 质量自检（本仓库直接可跑）

- `python backend/tests/test_rag.py`
  - 真实链路，验证：入库 → 检索 → 生成 → source_documents 是否合理
- `python backend/tests/test_rag_mock.py`
  - Mock 链路，验证：在无有效 Key 时依然不崩溃且输出结构稳定
- `python backend/evaluate_rag.py`
  - 离线评测，用固定问题集做对比（适合调参数后回归）

## 输出与兼容性约束（默认）

- 不在回答中输出任何 Key、Token
- 新增字段保持可选；前端用可选链（?.）访问，避免白屏
- 避免三元嵌套过深与过度分支；优先写清晰可维护的流程
