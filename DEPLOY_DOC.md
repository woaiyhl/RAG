# RAG 知识库项目部署文档与原理详解

本文档详细记录了本项目自动化部署到阿里云服务器的流程、技术原理及操作指南。

## 1. 系统架构概览

本项目采用经典的 **前后端分离 + 容器化** 架构：

- **前端 (Frontend)**: React + Vite，负责用户界面交互。
- **后端 (Backend)**: Python FastAPI，处理业务逻辑、RAG 检索流程。
- **网关 (Gateway)**: Nginx，作为统一入口，负责静态资源服务和 API 反向代理。
- **向量数据库**: ChromaDB (嵌入在后端容器中，文件存储)。

### 部署架构图

```mermaid
graph TD
    User[用户浏览器] -->|HTTP 请求| Nginx[Nginx 容器 (前端+网关)]

    subgraph "Docker 容器网络 (rag-network)"
        Nginx -->|/api/*| Backend[Backend 容器 (FastAPI)]
        Nginx -->|/*| Static[静态资源 (React Build)]
        Backend -->|读写| ChromaDB[(ChromaDB 数据卷)]
        Backend -->|读写| SQLite[(SQLite 数据卷)]
    end

    Backend -->|API 调用| LLM[大模型 API (DeepSeek/OpenAI)]
```

## 2. 核心技术原理

### 2.1 容器化 (Docker)

我们使用 Docker 将应用及其依赖打包在一起。

- **原理**: 就像集装箱一样，无论在你的 Mac 上还是在阿里云 Linux 上，容器内的环境（Python 版本、库依赖、Node 环境）都是完全一致的。这解决了“在我电脑上能跑，在服务器上跑不起来”的经典问题。
- **Dockerfile**: 定义了如何构建这个“集装箱”。例如 `backend/Dockerfile` 中我们配置了使用阿里云 PyPI 镜像源，就是为了加速依赖包的下载。

### 2.2 服务编排 (Docker Compose)

项目包含前端和后端两个服务，`docker-compose.yml` 充当“指挥官”的角色。

- **原理**: 它定义了服务之间的关系。例如，它创建了一个内部网络 `rag-network`，让 Nginx 可以通过 `http://backend:8000` 这个域名直接访问后端，而不需要知道后端的真实 IP。
- **数据持久化**: 配置了 `volumes` 将容器内的 `/app/data` 映射到宿主机的 `./backend/data`。这样即使删除了容器，你的知识库数据也不会丢失。

### 2.3 增量同步 (Rsync)

部署脚本中使用 `rsync` 命令上传代码。

- **原理**: 不同于 FTP 每次全量上传，`rsync` 会对比文件差异，只上传修改过的部分。这使得后续的代码更新部署非常快，通常只需要几秒钟。

### 2.4 反向代理 (Nginx)

前端容器中运行着 Nginx。

- **原理**:
  1.  **静态服务**: 当用户访问网页时，Nginx 直接返回 React 编译后的 HTML/JS/CSS 文件。
  2.  **反向代理**: 当用户发起 `/api/` 开头的请求时，Nginx 会像“二传手”一样，把请求转发给后端的 8000 端口。
  3.  **解决跨域**: 浏览器有同源策略限制。通过 Nginx 统一转发，前端和后端在浏览器看来都是同一个域名（端口），完美解决了跨域问题。

## 3. 自动化部署流程详解

只需运行 `./deploy_to_remote.sh`，脚本会自动完成以下工作：

### 第一步：环境初始化

1.  **SSH 连接**: 脚本通过 SSH 登录远程服务器。
2.  **安装 Docker**: 检测并安装 Docker 引擎。
3.  **配置加速器**: 针对国内网络环境，自动配置了阿里云和 DaoCloud 的 Docker 镜像加速源，确保拉取镜像不超时。

### 第二步：代码同步

1.  **排除干扰**: 使用 `rsync` 同步时，自动排除 `node_modules`、`.git`、本地数据库文件等，保持生产环境干净。
2.  **保护数据**: 脚本特意排除了 `backend/data` 目录的覆盖，防止误操作清空线上知识库。

### 第三步：服务启动

1.  **环境配置**: 自动检测本地 `backend/.env` 并上传到服务器。
2.  **构建与启动**: 在服务器上执行 `docker compose up -d --build`。
    - `--build`: 强制重新构建镜像（确保代码更新生效）。
    - `-d`: 后台运行，关闭终端服务不中断。

## 4. 常用运维命令

登录服务器：

```bash
ssh root@47.96.23.187
cd /root/rag-project
```

### 查看日志

- **查看全部日志**: `docker compose logs -f`
- **只看后端报错**: `docker compose logs -f backend`
- **只看前端访问**: `docker compose logs -f frontend`

### 服务管理

- **重启服务**: `docker compose restart`
- **停止服务**: `docker compose down`
- **更新代码后手动部署**: `./deploy.sh` (在服务器目录下执行)

### 数据备份

知识库数据存储在服务器的 `/root/rag-project/backend/data` 目录下。建议定期备份此目录。

```bash
# 备份示例
tar -czvf data_backup_$(date +%Y%m%d).tar.gz backend/data
```

## 5. 故障排查指南

| 现象                       | 可能原因                 | 解决方法                                                                    |
| :------------------------- | :----------------------- | :-------------------------------------------------------------------------- |
| **部署时 Docker 安装失败** | 网络波动或镜像源失效     | 脚本已内置重试和回退机制，重新运行部署脚本通常可解决。                      |
| **网页能打开但无法对话**   | 后端 API 报错或 Key 无效 | 检查后端日志 `docker compose logs backend`。确认 `.env` 中的 API Key 正确。 |
| **上传文件失败**           | 权限问题或文件过大       | 检查 `backend/data` 目录权限。Docker 容器默认以 root 运行，通常无权限问题。 |
| **构建速度极慢**           | 镜像源连接慢             | 检查 `Dockerfile` 中是否启用了阿里云/淘宝镜像源配置。                       |

---

_文档生成时间: 2026-01-02_
