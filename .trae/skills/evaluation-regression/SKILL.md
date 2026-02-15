---
name: "evaluation-regression"
description: "提供本仓库 RAG 评测与回归方法。遇到需要对比检索/重排/Prompt 改动效果或防止质量回退时调用。"
---

# RAG 评测与回归（本项目专用）

目标：让每次改动（切分/Embedding/混合检索/重排/Prompt/联网兜底）都有可量化对比，避免“感觉变好了”或“上线后才发现变差”。

## 本仓库已有入口

- 离线评测脚本：`backend/evaluate_rag.py`
  - 内置一组测试问题（含 ground_truth）
  - 适合做参数对比、策略回归与结果落盘
- 最小管线自检：
  - `python backend/tests/test_rag.py`（真实链路）
  - `python backend/tests/test_rag_mock.py`（Mock 链路，避免真实 API）

## 评测设计（推荐最小闭环）

1. 固定“数据集版本”
   - 明确当前知识库内容（哪些文件、是否重建过向量库）
2. 固定“问题集”
   - 覆盖：事实问答、流程问答、需要引用定位的问题、容易幻觉的问题
3. 固定“输出约束”
   - 是否必须引用、是否允许联网、回答长度与结构
4. 输出“可对比结果”
   - 每次运行记录：Embedding 模型名、LLM 模型名、检索 k、重排 top_k、是否启用 Web Search 等关键参数

## 指标建议（按易实现优先）

- 可用性：
  - 是否报错/超时
  - 是否返回空答案
- 证据一致性（grounding）：
  - 引用覆盖率：回答中的关键断言是否能在 source_documents 中找到依据
  - 引用稳定性：同问题多次运行引用来源波动是否过大
- 内容质量（可人工评分）：
  - 正确性、完整性、表达清晰度

## 常见对比实验模板

### A. 混合检索权重/TopK 对比

- 改动点：`backend/app/services/vector_store.py`（EnsembleRetriever weights、k）
- 关注：召回是否更相关、噪声是否增加、首包延迟是否变大

### B. 重排开关/候选规模对比

- 改动点：`backend/app/services/rag_engine.py`（初始 k、`RerankService` 的 top_k）
- 关注：答非所问是否减少、引用是否更集中

### C. Prompt 与拒答策略对比

- 改动点：`backend/app/services/rag_engine.py`（QA 模板、Web Search 模板、拒答关键词）
- 关注：幻觉是否下降、拒答是否过度、格式是否稳定

## 输出与兼容性约束（默认）

- 不在评测输出里打印任何 Key、Token
- 评测脚本的结果需可复现：同一配置重复运行差异应可解释（例如随机性、外部搜索变化）
