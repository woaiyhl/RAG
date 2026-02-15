---
name: "api-debug-fastapi"
description: "提供本仓库 FastAPI 接口联调与排障清单。当前端请求失败、上传异常、SSE 流式中断、Docker/反代问题时调用。"
---

# FastAPI 接口联调与排障（本项目专用）

面向本仓库后端（FastAPI + Uvicorn + LangChain）常见问题的定位步骤，目标是快速回答：哪里坏了、为什么坏、怎么验证修复有效，并保证前端不白屏。

## 入口与关键文件

- 后端入口：`backend/app/main.py`
- 路由聚合：`backend/app/api/api.py`
- API 端点：`backend/app/api/endpoints/`（`rag.py`、`documents.py`、`conversations.py`）
- 配置：`backend/app/core/config.py`（`.env`、Key 校验、Chroma 路径）
- RAG 逻辑：`backend/app/services/rag_engine.py`
- 部署与反代：`docker-compose.yml`、`frontend/nginx.conf`

## 排障总流程（建议按顺序走）

1. 先确认运行形态
   - 本地开发：`uvicorn app.main:app --reload` + `npm run dev`
   - Docker：`docker compose up -d --build`
2. 确认“请求是否到达后端”
   - 如果前端走 `/api/`：优先检查 Nginx 是否把 `/api/` 转发到了 `backend:8000`
3. 如果到达后端，再确认“在后端的哪一层失败”
   - 参数校验（Pydantic）→ 业务逻辑（service）→ 外部依赖（LLM/Embedding/Chroma/网络）
4. 复现与最小化
   - 用最小请求体复现；优先复现到纯后端（绕开 UI 干扰）

## 高发问题与快速定位

### 1) 401/403/Key 相关

- 现象：回答里出现“配置错误 / API Key 未配置或无效”，或调用报错
- 定位点：
  - `backend/app/core/config.py`：`OPENAI_API_KEY` 是否为空/占位文本/包含非 ASCII
  - `backend/app/services/rag_engine.py`：无效 Key 会进入 `FakeListLLM` 的提示分支
- 验证修复：
  - 配置 `backend/.env`（参考 `.env.example`），重启后端容器或 uvicorn

### 2) 422 参数校验失败

- 现象：接口返回 422，通常是请求体字段名/类型不匹配
- 定位点：
  - 对照 `backend/app/api/endpoints/*.py` 的入参 Schema
  - 前端请求：`frontend/src/services/api.ts`
- 验证修复：
  - 确保前端 payload 与后端 schema 字段一致；新增字段尽量可选并用可选链访问

### 3) 上传文件失败（400/413/500）

- 现象：上传 PDF/大文件报错，或入库无数据
- 定位点：
  - `backend/app/api/endpoints/documents.py`：上传与保存逻辑
  - Docker 挂载：`./backend/data:/app/data` 是否可写
  - Nginx 上传大小限制（如有）：`frontend/nginx.conf`
- 验证修复：
  - 用一个小文件先验证通路，再逐步增大文件

### 4) SSE 流式输出中断/卡住

- 现象：前端“打字机效果”停住，连接被关闭
- 定位点：
  - 后端流式生成：`backend/app/services/rag_engine.py` 中 `astream_answer_generator`
  - 前端流式消费逻辑：`frontend/src/App.tsx` 或 `frontend/src/services/api.ts`
- 常见原因：
  - 生成阶段抛异常未捕获
  - 代理/反代对长连接支持不完整
- 验证修复：
  - 先在本地直连后端端口验证；再验证通过 Nginx 的 `/api/` 转发链路

### 5) Docker 下前端能开，接口全失败

- 现象：页面能访问但无法对话/上传
- 定位点：
  - `docker-compose.yml`：后端未暴露端口到宿主机是正常的，前端应通过内部网络访问 `backend:8000`
  - `frontend/nginx.conf`：是否把 `/api/` 反代到 `http://backend:8000`
- 验证修复：
  - 看容器日志：`docker compose logs -f backend`

## 快速自检脚本（本仓库已有）

- 后端最小管线（真实 Key）：`python backend/tests/test_rag.py`
- 后端最小管线（Mock，避免真实调用）：`python backend/tests/test_rag_mock.py`
- 离线评测：`python backend/evaluate_rag.py`

## 输出与兼容性约束（默认）

- 新增接口字段尽量保持可选；前端用可选链（?.）访问，避免白屏
- 不在日志/响应中输出任何 Key、Token、用户敏感内容
