---
name: "frontend-integration-react-vite"
description: "提供本仓库 React/Vite 前端与后端联调清单。遇到请求失败、流式渲染卡顿、引用侧边栏异常或状态错乱时调用。"
---

# 前端联调（React/Vite + Zustand）（本项目专用）

目标：前端对话/上传/引用展示链路稳定，接口字段变更不白屏，流式输出体验顺滑。

## 项目关键位置

- 主界面与交互：`frontend/src/App.tsx`
- API 封装：`frontend/src/services/api.ts`（axios）
- 状态管理：`frontend/src/store/useChatStore.ts`（Zustand）
- 组件：`frontend/src/components/`（`ReferenceSidebar.tsx`、`DocumentManager.tsx`、`DocumentPreview.tsx`）
- 样式：`frontend/src/index.css`（Tailwind）
- 路由：`react-router-dom`（如有页面路由）

## 联调总流程

1. 先确认接口基址与反代链路
   - 开发环境：通常是前端直连后端（或 Vite 代理）
   - Docker/生产：通过 Nginx 把 `/api/` 反代到 `backend:8000`
2. 再确认“前端请求形态”和“后端接口形态”一致
   - 请求方法、路径、headers、请求体字段名/类型
3. 最后处理 UI 体验与边界
   - 断网/超时/空数据/后端报错时不白屏，有明确提示

## 高发问题与处理方式

### 1) 前端能打开但无法对话/上传

- 优先检查：
  - `frontend/src/services/api.ts` 的 baseURL 是否与部署形态一致
  - Docker 下是否通过 `/api/` 走 Nginx 反代（而不是直接写死 `localhost:8000`）
- 验证：
  - 打开浏览器 Network（网络）面板，看请求是否命中正确地址、是否返回 2xx

### 2) 接口字段变更导致渲染报错/白屏

- 修复原则：
  - 所有来自接口的数据，组件层面用可选链（?.）与默认值兜底
  - 数组渲染前先判空（`Array.isArray(x)`）
  - 避免深层嵌套三元，优先提前 return 或拆分渲染段

### 3) SSE/流式输出卡顿或停住

- 优先确认：
  - 后端是否真在持续推送（日志 + Network 里 response 是否持续增长）
  - 前端是否把“增量 chunk”正确追加到同一条消息，而不是频繁创建新消息
- 优化建议：
  - 流式渲染时合并 state 更新频率（减少每字符 setState）
  - 保证结束时能收到 sources 并更新引用侧边栏

### 4) 引用侧边栏不显示/显示错位

- 核对数据契约（contract）：
  - 后端返回字段名是否稳定（例如 `source_documents` / `sources`）
  - 每条引用是否包含 `source`、`page` 等 metadata（用于展示/定位）
- 修复建议：
  - 前端对引用结构做适配层（在 store 或 api 层做归一化）

## 前端自检命令（本仓库已有）

- 开发：`npm run dev`
- 构建：`npm run build`
- Lint：`npm run lint`

## 输出与兼容性约束（默认）

- 优先使用 Tailwind CSS 完成样式需求，避免无必要自定义样式
- 对所有可空数据做安全访问，任何后端异常都不应导致白屏
