# RAG 智能知识库项目报告

## 1. 技术架构 (Technical Architecture)

本项目采用前后端分离架构，构建了一个基于 **混合检索 (Hybrid Search)** 和 **联网搜索增强** 的智能 RAG (Retrieval-Augmented Generation) 问答系统。

### 1.1 前端技术栈 (Frontend)

- **核心框架**: React 18 + Vite
- **开发语言**: TypeScript
- **状态管理**: Zustand
- **UI 组件库**: Ant Design (主要组件), Lucide React (图标)
- **样式方案**: Tailwind CSS (原子化 CSS), Framer Motion (动画交互)
- **网络请求**: Axios
- **Markdown 渲染**: React Markdown + Remark Gfm (支持表格、代码块等)
- **其他特性**:
  - **语音识别**: Web Speech API (Speech-to-Text)
  - **流式响应**: SSE (Server-Sent Events) 实时打字机效果
  - **引用高亮**: 自定义组件支持关键词高亮显示

### 1.2 后端技术栈 (Backend)

- **核心框架**: FastAPI (高性能异步 Python Web 框架)
- **WSGI 服务器**: Uvicorn
- **数据库**:
  - **关系型数据库**: SQLite (存储会话历史、文档元数据)
  - **ORM**: SQLAlchemy
- **AI & RAG 核心**:
  - **LangChain**: LLM 应用开发编排
  - **向量数据库**: ChromaDB (本地持久化存储)
  - **混合检索**: `BM25` (关键词检索, 结合 `jieba` 中文分词) + `Vector Search` (语义检索)
  - **联网搜索**: `DuckDuckGo Search` (用于本地知识库缺失时的兜底)
  - **LLM**: OpenAI 接口规范 (支持 GPT-3.5/4 或兼容模型)
- **文档处理**:
  - **PyPDF**: PDF 解析
  - **Tiktoken**: Token 计算与文本切分
- **异步处理**: 全面采用 `async/await` 提升并发性能

### 1.3 数据流向与检索策略

1.  **文档处理流**:
    - 用户上传 PDF/TXT/MD -> 后端解析文本 -> 文本切块 (Chunking) -> **双路索引** (同时生成向量索引和 BM25 倒排索引)。
2.  **智能问答流 (RAG Pipeline)**:
    - **第 1 步: 混合检索 (Hybrid Search)**
      - 同时发起向量检索 (Semantic Search) 和 BM25 关键词检索。
      - 使用 `EnsembleRetriever` 对结果进行加权融合 (Reciprocal Rank Fusion)，提取 Top-K 相关文档。
    - **第 2 步: 联网搜索兜底 (Web Search Fallback)**
      - 如果本地检索无结果，或 LLM 判断无法回答，系统自动调用 DuckDuckGo 进行联网搜索。
    - **第 3 步: 答案生成**
      - 组装 Prompt (问题 + 上下文/搜索结果) -> 调用 LLM -> 流式返回答案给前端。

---

## 2. 后端接口文档 (Backend Interfaces)

API 路径统一前缀为 `/api/v1`，主要分为 RAG 核心、会话管理、文档管理三个模块。

### 2.1 RAG 核心 (RAG Core)

| 方法   | 路径               | 描述                                                             |
| :----- | :----------------- | :--------------------------------------------------------------- |
| `POST` | `/rag/upload`      | **文档上传**。支持多格式文件，自动完成解析、切分、向量化和存储。 |
| `POST` | `/rag/chat`        | **普通问答**。非流式接口，返回完整答案及引用来源。               |
| `POST` | `/rag/chat/stream` | **流式问答**。SSE 格式流式返回答案 (仅用于非会话模式)。          |

### 2.2 会话管理 (Conversations)

支持多轮对话和上下文记忆。

| 方法     | 路径                                    | 描述                                                         |
| :------- | :-------------------------------------- | :----------------------------------------------------------- |
| `GET`    | `/conversations/`                       | **获取会话列表**。支持分页。                                 |
| `POST`   | `/conversations/`                       | **创建新会话**。                                             |
| `GET`    | `/conversations/{id}`                   | **获取会话详情**。包含完整的历史消息记录。                   |
| `DELETE` | `/conversations/{id}`                   | **删除会话**。                                               |
| `POST`   | `/conversations/{id}/chat`              | **会话内聊天**。支持上下文记忆，流式返回答案并自动保存历史。 |
| `DELETE` | `/conversations/{id}/messages/{msg_id}` | **删除单条消息**。                                           |

### 2.3 文档管理 (Documents)

| 方法     | 路径                      | 描述                                                     |
| :------- | :------------------------ | :------------------------------------------------------- |
| `GET`    | `/documents/`             | **获取文档列表**。包含上传时间、状态、文件大小等元数据。 |
| `GET`    | `/documents/{id}/preview` | **预览文档**。返回文件流 (PDF/Text)。                    |
| `DELETE` | `/documents/{id}`         | **删除文档**。级联删除数据库记录、本地文件和向量库索引。 |

---

## 3. 产品功能 (Product Features)

### 3.1 智能问答 (Smart Q&A)

- **混合检索增强**: 结合语义理解和精确关键词匹配，显著提升回答准确率。
- **联网搜索兜底**: 当本地知识库无法回答时，自动联网搜索最新信息，减少“幻觉”和“不知道”。
- **流式响应**: 实时打字机效果，极速反馈。
- **引用溯源**:
  - 答案下方展示引用来源卡片。
  - 支持 **引用高亮**：点击引用可展开详情，并自动高亮与问题相关的关键词。
  - 明确标识来源类型（“本地文档”或“Web 搜索”）。
- **多模态输入**: 支持语音输入 (ASR)，自动转换为文字。

### 3.2 知识库管理

- **多格式支持**: 支持 PDF, TXT, MD 等格式。
- **可视化管理**: 实时查看文档处理状态 (Processing/Processed/Error)。
- **文档预览**: 内置文档预览器，无需下载即可查看原始内容。
- **智能清理**: 删除文档时自动清理对应的向量数据，保持知识库纯净。

### 3.3 会话历史

- **持久化存储**: 所有聊天记录存入 SQLite 数据库。
- **侧边栏导航**: 快速切换历史会话，支持新建和删除会话。
- **上下文记忆**: 机器人能理解多轮对话中的上下文关系。

---

## 4. 数据库设计 (Database Design)

系统使用 SQLite，核心表结构如下：

### 4.1 Conversations (会话表)

| 字段名       | 类型          | 描述     |
| :----------- | :------------ | :------- |
| `id`         | String (UUID) | 主键     |
| `title`      | String        | 会话标题 |
| `created_at` | DateTime      | 创建时间 |
| `updated_at` | DateTime      | 更新时间 |

### 4.2 Messages (消息表)

| 字段名            | 类型        | 描述                                                     |
| :---------------- | :---------- | :------------------------------------------------------- |
| `id`              | Integer     | 主键                                                     |
| `conversation_id` | String      | 外键，关联会话                                           |
| `role`            | String      | `user` 或 `assistant`                                    |
| `content`         | Text        | 消息内容                                                 |
| `sources`         | Text (JSON) | 存储 RAG 检索到的参考源 (包含 content, source, score 等) |
| `created_at`      | DateTime    | 发送时间                                                 |

### 4.3 Documents (文档表)

| 字段名        | 类型     | 描述                               |
| :------------ | :------- | :--------------------------------- |
| `id`          | Integer  | 主键                               |
| `filename`    | String   | 文件名                             |
| `file_size`   | Integer  | 文件大小                           |
| `status`      | String   | `processing`, `processed`, `error` |
| `upload_time` | DateTime | 上传时间                           |

---

## 5. 项目目录结构 (Project Structure)

```text
RAG/
├── backend/                        # 后端项目 (Python/FastAPI)
│   ├── app/
│   │   ├── api/
│   │   │   └── endpoints/          # API 路由模块 (chat, docs, rag)
│   │   ├── core/                   # 核心配置 (Config, DB)
│   │   ├── models/                 # SQLAlchemy 数据模型
│   │   ├── schemas/                # Pydantic 数据验证模型
│   │   └── services/               # 核心业务逻辑
│   │       ├── rag_engine.py       # RAG 核心引擎 (包含 Fallback 逻辑)
│   │       ├── vector_store.py     # 向量库管理 (Chroma + BM25)
│   │       ├── web_search.py       # 联网搜索服务 (DuckDuckGo)
│   │       └── ...
│   ├── data/                       # 数据存储 (SQLite, Uploads)
│   ├── tests/                      # 测试用例
│   ├── main.py                     # 应用入口
│   └── requirements.txt            # Python 依赖
├── frontend/                       # 前端项目 (React/Vite)
│   ├── src/
│   │   ├── components/             # UI 组件
│   │   │   ├── ReferenceSidebar.tsx # 引用展示与高亮组件
│   │   │   └── ...
│   │   ├── store/                  # 状态管理 (Zustand)
│   │   ├── services/               # API 请求封装
│   │   └── ...
│   └── package.json
└── PROJECT_REPORT.md               # 项目报告
```

---

## 6. 部署指南 (Deployment Guide)

### 6.1 后端启动

1.  进入后端目录: `cd backend`
2.  创建虚拟环境: `python -m venv venv && source venv/bin/activate`
3.  安装依赖: `pip install -r requirements.txt`
4.  配置环境变量:
    - 复制 `.env.example` 为 `.env`
    - 配置 `OPENAI_API_KEY` (必填)
    - 可选配置代理 `HTTP_PROXY` (如需联网搜索)
5.  启动服务: `uvicorn app.main:app --reload` (http://localhost:8000)

### 6.2 前端启动

1.  进入前端目录: `cd frontend`
2.  安装依赖: `npm install`
3.  启动开发服务器: `npm run dev` (http://localhost:5173)

---

## 7. 未来规划 (Future Roadmap)

- **多模型切换**: 支持在界面上动态切换不同的 LLM 模型 (如 Claude, Gemini, Llama)。
- **知识图谱 (Knowledge Graph)**: 引入知识图谱增强文档间的关联分析。
- **权限管理**: 增加用户登录与多租户数据隔离。
- **更多数据源**: 支持 Notion, URL 爬虫等数据导入。
