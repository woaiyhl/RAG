# RAG 智能知识库项目报告

## 1. 技术架构 (Technical Architecture)

本项目采用前后端分离架构，构建了一个基于 RAG (Retrieval-Augmented Generation) 技术的智能知识库问答系统。

### 1.1 前端技术栈 (Frontend)

- **核心框架**: React 18 + Vite
- **开发语言**: TypeScript
- **UI 组件库**: Ant Design (主要组件), Lucide React (图标)
- **样式方案**: Tailwind CSS (原子化 CSS), Framer Motion (动画交互)
- **网络请求**: Axios
- **Markdown 渲染**: React Markdown
- **其他特性**:
  - 语音识别 (Speech-to-Text) 支持
  - SSE (Server-Sent Events) 流式响应处理

### 1.2 后端技术栈 (Backend)

- **核心框架**: FastAPI (高性能 Python Web 框架)
- **WSGI 服务器**: Uvicorn
- **数据库**:
  - 关系型数据库: SQLite (存储会话历史、文档元数据)
  - ORM: SQLAlchemy
- **AI & RAG 核心**:
  - **LangChain**: LLM 应用开发框架
  - **ChromaDB**: 向量数据库 (本地存储向量索引)
  - **PyPDF**: PDF 文档解析
  - **OpenAI API**: 提供 LLM 推理能力
- **数据处理**:
  - Python-multipart (文件上传)
  - Tiktoken (Token 计算)

### 1.3 数据流向

1. **文档上传**: 用户上传 PDF/TXT/MD -> 后端解析文本 -> 文本切块 (Chunking) -> 调用 Embedding 模型生成向量 -> 存入 ChromaDB。
2. **问答交互**: 用户提问 -> 生成问题向量 -> 在 ChromaDB 中检索相关文档块 -> 组装 Prompt (问题 + 上下文) -> 调用 LLM -> 流式返回答案给前端。

---

## 2. 后端接口文档 (Backend Interfaces)

后端 API 主要分为三个模块：RAG 核心功能、会话管理、文档管理。

### 2.1 RAG 核心 (RAG Core)

| 方法   | 路径                      | 描述                                                 |
| :----- | :------------------------ | :--------------------------------------------------- |
| `POST` | `/api/v1/rag/upload`      | **文档上传**。接收文件，进行解析、切块并存入向量库。 |
| `POST` | `/api/v1/rag/chat`        | **普通问答**。非流式接口，返回完整答案及引用来源。   |
| `POST` | `/api/v1/rag/chat/stream` | **流式问答**。SSE 格式流式返回答案。                 |

### 2.2 会话管理 (Conversations)

| 方法     | 路径                              | 描述                                       |
| :------- | :-------------------------------- | :----------------------------------------- |
| `GET`    | `/api/v1/conversations/`          | **获取会话列表**。支持分页。               |
| `POST`   | `/api/v1/conversations/`          | **创建新会话**。                           |
| `GET`    | `/api/v1/conversations/{id}`      | **获取会话详情**。包含历史消息记录。       |
| `DELETE` | `/api/v1/conversations/{id}`      | **删除会话**。                             |
| `POST`   | `/api/v1/conversations/{id}/chat` | **会话内聊天**。支持上下文记忆，流式返回。 |

### 2.3 文档管理 (Documents)

| 方法     | 路径                             | 描述                                                     |
| :------- | :------------------------------- | :------------------------------------------------------- |
| `GET`    | `/api/v1/documents/`             | **获取文档列表**。包含上传时间、状态、文件大小等信息。   |
| `GET`    | `/api/v1/documents/{id}/preview` | **预览文档**。返回文件流 (PDF/Text)。                    |
| `DELETE` | `/api/v1/documents/{id}`         | **删除文档**。同时删除数据库记录、本地文件和向量库索引。 |

---

## 3. 产品功能 (Product Features)

### 3.1 智能问答 (Smart Q&A)

- **上下文理解**: 系统支持多轮对话，能够记住之前的聊天内容。
- **流式响应**: 类似 ChatGPT 的打字机效果，实时反馈生成内容。
- **来源引用**: 每次回答都会标注参考了哪些文档片段，保证回答的可信度。
- **语音输入**: 支持点击麦克风进行语音输入，自动转换为文字 (ASR)。

### 3.2 知识库管理 (Knowledge Base Management)

- **多格式支持**: 支持 PDF 和 TXT 格式文档上传。
- **文档列表**: 查看已上传文档的状态（处理中/已完成/失败）、大小和上传时间。
- **文档预览**: 支持在浏览器中直接预览已上传的 PDF 或。文本
- **文档删除**: 支持删除文档，并自动清理相关的向量数据，保持知识库整洁。

### 3.3 会话历史 (Conversation History)

- **侧边栏导航**: 快速切换不同的历史会话。
- **新会话创建**: 随时开启新的话题，互不干扰。
- **历史记录持久化**: 刷新页面后依然保留之前的聊天记录。

### 3.4 用户体验 (UX)

- **响应式设计**: 适配不同屏幕尺寸，侧边栏可折叠。
- **交互反馈**: 上传、删除、加载均有明确的状态提示 (Toast/Loading)。
- **Markdown 渲染**: 支持代码块、列表、加粗等富文本格式显示。

---

## 4. 测试用例 (Test Cases)

以下为核心功能的建议测试用例：

### 4.1 文档上传与处理

| ID     | 测试场景       | 前置条件       | 操作步骤                                         | 预期结果                                                                        |
| :----- | :------------- | :------------- | :----------------------------------------------- | :------------------------------------------------------------------------------ |
| TC-001 | 上传有效 PDF   | 后端服务正常   | 1. 点击上传按钮<br>2. 选择一个正常的 PDF 文件    | 1. 提示上传成功<br>2. 文档列表中出现该文件<br>3. 状态最终变为"已处理"           |
| TC-002 | 上传非支持格式 | -              | 1. 点击上传按钮<br>2. 选择一个 .exe 或 .jpg 文件 | 1. 前端拦截或后端报错提示格式不支持                                             |
| TC-003 | 文档删除       | 存在已上传文档 | 1. 在文档管理列表中点击"删除"<br>2. 确认删除     | 1. 提示删除成功<br>2. 列表不再显示该文档<br>3. 相关的向量检索不再返回该文档内容 |

### 4.2 问答功能

| ID     | 测试场景     | 前置条件                 | 操作步骤                                     | 预期结果                                                 |
| :----- | :----------- | :----------------------- | :------------------------------------------- | :------------------------------------------------------- |
| TC-004 | 知识库问答   | 已上传包含特定知识的文档 | 1. 输入关于文档内容的问题<br>2. 点击发送     | 1. 回答准确包含文档中的信息<br>2. 消息下方显示"来源"引用 |
| TC-005 | 历史记忆测试 | 已进行一轮对话           | 1. 发送"我刚才问了什么？"或指代性问题        | 1. 机器人能正确理解上下文并回答                          |
| TC-006 | 流式响应中断 | -                        | 1. 发送问题<br>2. 在生成过程中点击"停止"按钮 | 1. 生成立即停止<br>2. 已生成的内容保留在界面上           |

### 4.3 界面交互

| ID     | 测试场景   | 前置条件       | 操作步骤                                          | 预期结果                                         |
| :----- | :--------- | :------------- | :------------------------------------------------ | :----------------------------------------------- |
| TC-007 | 侧边栏折叠 | -              | 1. 点击侧边栏折叠按钮                             | 1. 侧边栏收起，聊天区域变宽<br>2. 再次点击可展开 |
| TC-008 | 语音输入   | 浏览器支持录音 | 1. 点击麦克风图标<br>2. 说话<br>3. 再次点击麦克风 | 1. 说话内容准确转换为文字填充到输入框            |

---

## 5. 数据库设计 (Database Design)

系统使用 SQLite 作为关系型数据库，主要包含以下三张表：

### 5.1 Conversations (会话表)

存储用户的对话会话信息。
| 字段名 | 类型 | 描述 |
| :--- | :--- | :--- |
| `id` | String (UUID) | 主键，会话唯一标识 |
| `title` | String | 会话标题（默认为 "New Chat"） |
| `created_at` | DateTime | 创建时间 |
| `updated_at` | DateTime | 最后更新时间 |

### 5.2 Messages (消息表)

存储会话中的具体消息记录。
| 字段名 | 类型 | 描述 |
| :--- | :--- | :--- |
| `id` | Integer | 主键，自增 |
| `conversation_id` | String | 外键，关联 Conversations 表 |
| `role` | String | 消息发送者角色 (`user` 或 `assistant`) |
| `content` | Text | 消息内容 |
| `sources` | Text | JSON 字符串，存储 RAG 检索到的参考源 |
| `created_at` | DateTime | 发送时间 |

### 5.3 Documents (文档表)

存储已上传文档的元数据。
| 字段名 | 类型 | 描述 |
| :--- | :--- | :--- |
| `id` | Integer | 主键，自增 |
| `filename` | String | 原始文件名 |
| `file_size` | Integer | 文件大小 (Bytes) |
| `status` | String | 处理状态 (`processing`, `processed`, `error`) |
| `upload_time` | DateTime | 上传时间 |

---

## 6. 项目目录结构 (Project Structure)

```text
RAG/
├── backend/                 # 后端项目 (Python/FastAPI)
│   ├── app/
│   │   ├── api/             # API 路由定义
│   │   ├── core/            # 核心配置 (DB, Config)
│   │   ├── models/          # SQLAlchemy 数据模型
│   │   ├── schemas/         # Pydantic 数据验证模型
│   │   └── services/        # 业务逻辑 (RAG, VectorStore, Chat)
│   ├── data/                # 数据存储 (SQLite, Uploads)
│   ├── main.py              # 应用入口
│   └── requirements.txt     # Python 依赖
├── frontend/                # 前端项目 (React/Vite)
│   ├── src/
│   │   ├── components/      # UI 组件 (Sidebar, DocumentManager)
│   │   ├── hooks/           # 自定义 Hooks (useSpeechRecognition)
│   │   └── services/        # API 请求封装
│   └── package.json         # Node 依赖
└── PROJECT_REPORT.md        # 项目报告
```

---

## 7. 部署指南 (Deployment Guide)

### 7.1 后端启动

1. 进入后端目录: `cd backend`
2. 创建并激活虚拟环境: `python -m venv venv && source venv/bin/activate`
3. 安装依赖: `pip install -r requirements.txt`
4. 配置环境变量: 复制 `.env.example` 为 `.env` 并填入 `OPENAI_API_KEY`。
5. 启动服务: `uvicorn app.main:app --reload` (默认运行在 http://localhost:8000)

### 7.2 前端启动

1. 进入前端目录: `cd frontend`
2. 安装依赖: `npm install`
3. 启动开发服务器: `npm run dev` (默认运行在 http://localhost:5173)

---

## 8. 未来规划 (Future Roadmap)

为了进一步提升系统的可用性和扩展性，后续计划包括：

- **混合检索优化**: 引入 BM25 关键词检索与向量检索相结合，提高检索准确率。
- **多模型支持**: 增加对 Ollama, HuggingFace 本地模型的支持，降低使用成本。
- **用户权限系统**: 增加登录注册功能，实现多用户数据隔离。
- **文件解析增强**: 支持 Word, Excel, Markdown 等更多格式的文档解析。
- **Web 搜索增强**: 在知识库无法回答时，自动回退到搜索引擎获取最新信息。
