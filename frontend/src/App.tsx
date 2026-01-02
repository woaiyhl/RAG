import React, { useState, useRef } from "react";
import { uploadDocument, createConversation } from "./services/api";
import { Sidebar } from "./components/Sidebar";
import {
  Upload,
  Loader2,
  Bot,
  CheckCircle2,
  AlertCircle,
  Settings,
  ChevronDown,
  PanelLeftClose,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ConfigProvider, message } from "antd";
import { useChatStore } from "./store/useChatStore";
import { BrowserRouter, Routes, Route, useNavigate, Outlet } from "react-router-dom";
import { ChatPage } from "./pages/ChatPage";
import { DocumentPage } from "./pages/DocumentPage";

function Layout() {
  const navigate = useNavigate();
  const { activeId, setActiveId, addMessage, initConversation } = useChatStore();

  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "success" | "error">("idle");
  const [refreshDocsTrigger, setRefreshDocsTrigger] = useState(0);
  const [refreshSidebarTrigger, setRefreshSidebarTrigger] = useState(0);
  const [isKnowledgeBaseOpen, setIsKnowledgeBaseOpen] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const skipFetchRef = useRef(false);

  const handleNewConversation = () => {
    setActiveId(null);
    navigate("/");
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;

    setIsUploading(true);
    setUploadStatus("idle");
    try {
      const file = e.target.files[0];
      await uploadDocument(file);
      setUploadStatus("success");
      setRefreshDocsTrigger((prev) => prev + 1);
      setTimeout(() => setUploadStatus("idle"), 3000);

      // Add success message to chat
      let targetConversationId = activeId;
      if (!targetConversationId) {
        const newConv = await createConversation();
        targetConversationId = newConv.id;
        initConversation(targetConversationId);
        setActiveId(targetConversationId);
        skipFetchRef.current = true;
        setRefreshSidebarTrigger((prev) => prev + 1);
      }

      const successMsgId = Date.now().toString();
      addMessage(targetConversationId, {
        id: successMsgId,
        uid: successMsgId,
        role: "assistant",
        content: `### 文档解析成功\n\n已成功收录文档 "${file.name}"。我现在已经学习了其中的内容，您可以随时向我提问。`,
      });

      // Navigate to chat if not already there, to show the message
      navigate("/");
    } catch (error) {
      console.error(error);
      setUploadStatus("error");
      setTimeout(() => setUploadStatus("idle"), 3000);
      message.error("文档上传失败");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans overflow-hidden">
      {/* Sidebar - Dark Modern */}
      <motion.div
        initial={{ width: 320 }}
        animate={{ width: isSidebarOpen ? 320 : 0 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="bg-gray-900 text-white flex flex-col shadow-2xl z-10 overflow-hidden relative"
      >
        <div className="w-80 h-full flex flex-col">
          <div className="p-6 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary-600 p-2 rounded-xl shadow-lg shadow-primary-900/20">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">RAG Knowledge</h1>
                <p className="text-xs text-gray-400 font-medium">智能知识库问答系统</p>
              </div>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="text-gray-500 hover:text-white transition-colors p-1 rounded-md hover:bg-gray-800"
              title="收起侧边栏"
            >
              <PanelLeftClose className="w-5 h-5" />
            </button>
          </div>

          <Sidebar
            currentConversationId={activeId}
            onSelectConversation={(id) => {
              setActiveId(id);
              navigate("/");
            }}
            onNewConversation={handleNewConversation}
            refreshTrigger={refreshSidebarTrigger}
          />

          <div className="border-t border-gray-800 bg-gray-900/50 flex-shrink-0">
            <button
              onClick={() => setIsKnowledgeBaseOpen(!isKnowledgeBaseOpen)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-800/50 transition-colors group"
            >
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider group-hover:text-gray-400 transition-colors">
                知识库管理
              </h3>
              <ChevronDown
                className={`w-4 h-4 text-gray-500 transition-transform duration-300 ease-in-out ${
                  isKnowledgeBaseOpen ? "transform rotate-180" : ""
                }`}
              />
            </button>

            <AnimatePresence initial={false}>
              {isKnowledgeBaseOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-4">
                    <div className="space-y-2">
                      <label
                        className={`
                        group flex flex-col items-center justify-center w-full h-20 
                        border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200
                        ${
                          uploadStatus === "error"
                            ? "border-red-500/50 bg-red-500/10"
                            : uploadStatus === "success"
                            ? "border-green-500/50 bg-green-500/10"
                            : "border-gray-700 hover:border-primary-500 hover:bg-gray-800/50"
                        }
                      `}
                      >
                        <div className="flex items-center gap-2">
                          {isUploading ? (
                            <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
                          ) : uploadStatus === "success" ? (
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                          ) : uploadStatus === "error" ? (
                            <AlertCircle className="w-5 h-5 text-red-500" />
                          ) : (
                            <Upload className="w-5 h-5 text-gray-500 group-hover:text-primary-400 transition-colors" />
                          )}

                          <span className="text-xs text-gray-400 group-hover:text-gray-300 font-medium">
                            {isUploading
                              ? "正在解析..."
                              : uploadStatus === "success"
                              ? "上传成功"
                              : uploadStatus === "error"
                              ? "上传失败"
                              : "上传文档 (PDF/TXT/MD)"}
                          </span>
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          onChange={handleUpload}
                          accept=".pdf,.txt,.md"
                          disabled={isUploading}
                        />
                      </label>
                    </div>

                    <button
                      onClick={() => navigate("/documents")}
                      className="w-full flex items-center gap-3 px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg hover:bg-gray-800 hover:border-primary-500/50 transition-all group"
                    >
                      <Settings className="w-4 h-4 text-gray-400 group-hover:text-primary-400" />
                      <span className="text-xs text-gray-300 font-medium group-hover:text-white">
                        管理文档列表
                      </span>
                    </button>

                    <div className="flex items-center gap-2 text-gray-500 text-xs pt-2 border-t border-gray-800">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                      系统运行正常
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Main Content Area */}
      <Outlet context={{ isSidebarOpen, setIsSidebarOpen, refreshDocsTrigger }} />
    </div>
  );
}

function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#4f46e5",
        },
      }}
    >
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<ChatPage />} />
            <Route path="/documents" element={<DocumentPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
