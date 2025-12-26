import React, { useState, useRef, useEffect } from "react";
import { uploadDocument, chatStream } from "./services/api";
import { DocumentManager } from "./components/DocumentManager";
import ReactMarkdown from "react-markdown";
import {
  Send,
  Upload,
  FileText,
  Loader2,
  Bot,
  User,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  BookOpen,
  Settings,
  Square,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ConfigProvider } from "antd";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  id: string;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "success" | "error">("idle");
  const [refreshDocsTrigger, setRefreshDocsTrigger] = useState(0);
  const [isDocManagerOpen, setIsDocManagerOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: `**文档解析成功** \n\n已成功收录文档 "${file.name}"。我现在已经学习了其中的内容，您可以随时向我提问。`,
        },
      ]);
    } catch (error) {
      console.error(error);
      setUploadStatus("error");
      setTimeout(() => setUploadStatus("idle"), 3000);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: "**上传失败** \n\n抱歉，文档处理过程中出现了问题，请稍后重试。",
        },
      ]);
    } finally {
      setIsUploading(false);
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    setInput("");
    const tempId = Date.now().toString();
    setMessages((prev) => [...prev, { id: tempId, role: "user", content: userMessage }]);
    setIsLoading(true);

    // Create a new AbortController
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Create a placeholder for the assistant's message
    const assistantMsgId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      {
        id: assistantMsgId,
        role: "assistant",
        content: "",
      },
    ]);

    await chatStream(
      userMessage,
      (data) => {
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === assistantMsgId) {
              if (data.answer) {
                return { ...msg, content: msg.content + data.answer };
              }
              if (data.sources) {
                return { ...msg, sources: data.sources };
              }
            }
            return msg;
          }),
        );
      },
      (error) => {
        if (error.name === "AbortError") {
          console.log("Request aborted");
          return;
        }
        console.error(error);
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === assistantMsgId) {
              return { ...msg, content: msg.content + "\n\n❌ 发生错误，请重试。" };
            }
            return msg;
          }),
        );
      },
      () => {
        setIsLoading(false);
        abortControllerRef.current = null;
      },
      controller.signal,
    );
  };

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#4f46e5",
        },
      }}
    >
      <div className="flex h-screen bg-gray-100 font-sans overflow-hidden">
        {/* Sidebar - Dark Modern */}
        <div className="w-80 bg-gray-900 text-white flex flex-col shadow-2xl z-10">
          <div className="p-6 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <div className="bg-primary-600 p-2 rounded-xl shadow-lg shadow-primary-900/20">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">RAG Knowledge</h1>
                <p className="text-xs text-gray-400 font-medium">智能知识库问答系统</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider pl-1">
                知识库管理
              </h3>
              <label
                className={`
                  group flex flex-col items-center justify-center w-full h-32 
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
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                  {isUploading ? (
                    <Loader2 className="w-8 h-8 text-primary-500 animate-spin mb-2" />
                  ) : uploadStatus === "success" ? (
                    <CheckCircle2 className="w-8 h-8 text-green-500 mb-2" />
                  ) : uploadStatus === "error" ? (
                    <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
                  ) : (
                    <Upload className="w-8 h-8 text-gray-500 group-hover:text-primary-400 transition-colors mb-2" />
                  )}

                  <p className="text-sm font-medium text-gray-400 group-hover:text-gray-300">
                    {isUploading
                      ? "正在解析文档..."
                      : uploadStatus === "success"
                      ? "上传成功"
                      : uploadStatus === "error"
                      ? "上传失败"
                      : "点击或拖拽上传文档"}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">支持 PDF, TXT, MD</p>
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

            <div className="space-y-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider pl-1">
                已收录文档
              </h3>
              <button
                onClick={() => setIsDocManagerOpen(true)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl hover:bg-gray-800 hover:border-primary-500/50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-800 rounded-lg group-hover:bg-primary-900/30 transition-colors">
                    <Settings className="w-4 h-4 text-gray-400 group-hover:text-primary-400" />
                  </div>
                  <span className="text-sm text-gray-300 font-medium group-hover:text-white">
                    管理文档列表
                  </span>
                </div>
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]"></div>
              </button>
            </div>
          </div>

          <div className="mt-auto p-6 border-t border-gray-800">
            <div className="flex items-center gap-3 text-gray-400 text-sm">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              系统运行正常
            </div>
          </div>
        </div>

        <DocumentManager
          open={isDocManagerOpen}
          onClose={() => setIsDocManagerOpen(false)}
          refreshTrigger={refreshDocsTrigger}
        />

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col relative bg-white">
          {/* Header (Optional, mostly for mobile but good for spacing) */}
          <div className="h-16 border-b border-gray-100 flex items-center justify-between px-8 bg-white/80 backdrop-blur-md sticky top-0 z-10">
            <h2 className="text-gray-700 font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary-500" />
              AI 问答助手
            </h2>
            <div className="text-sm text-gray-400">Based on RAG Technology</div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8 scroll-smooth">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-6 -mt-16">
                <div className="bg-gray-50 p-8 rounded-full shadow-inner">
                  <Bot className="w-20 h-20 text-gray-300" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-semibold text-gray-700">欢迎使用 RAG 知识库</h3>
                  <p className="text-gray-500 max-w-md">
                    请先在左侧上传您的技术文档，然后就可以开始向我提问了。
                  </p>
                </div>
              </div>
            )}

            <AnimatePresence>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`flex gap-5 ${
                    msg.role === "user" ? "justify-end" : "justify-start max-w-4xl"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary-500/20 text-white mt-1">
                      <Bot className="w-6 h-6" />
                    </div>
                  )}

                  <div className={`flex flex-col space-y-2 max-w-[85%]`}>
                    <div
                      className={`
                    rounded-2xl px-6 py-4 shadow-sm
                    ${
                      msg.role === "user"
                        ? "bg-gray-900 text-white rounded-br-sm"
                        : "bg-white border border-gray-100 text-gray-800 rounded-bl-sm shadow-md"
                    }
                  `}
                    >
                      {msg.role === "assistant" && !msg.content ? (
                        <div className="flex items-center gap-2 h-5">
                          <div
                            className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce"
                            style={{ animationDelay: "0ms" }}
                          />
                          <div
                            className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce"
                            style={{ animationDelay: "150ms" }}
                          />
                          <div
                            className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce"
                            style={{ animationDelay: "300ms" }}
                          />
                        </div>
                      ) : (
                        <ReactMarkdown
                          className={`prose prose-sm max-w-none ${
                            msg.role === "user" ? "prose-invert" : ""
                          }`}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      )}
                    </div>

                    {msg.sources && msg.sources.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="ml-2"
                      >
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200/60 text-sm space-y-3">
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5" /> 参考来源
                          </p>
                          <div className="grid gap-2">
                            {msg.sources.map((source, i) => (
                              <div
                                key={i}
                                className="bg-white p-3 rounded-lg border border-gray-200 text-gray-600 text-xs leading-relaxed shadow-sm"
                              >
                                {source}
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {msg.role === "user" && (
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-1 border border-white shadow-sm">
                      <User className="w-6 h-6 text-gray-500" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            <div ref={messagesEndRef} className="h-4" />
          </div>

          {/* Input Area */}
          <div className="p-6 bg-white border-t border-gray-100">
            <div className="max-w-4xl mx-auto relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="输入你的问题，例如：RAG 的核心优势是什么？"
                className="w-full pl-6 pr-32 py-4 bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all shadow-sm text-gray-700 placeholder-gray-400"
                disabled={isLoading}
              />
              <div className="absolute right-2 top-2 bottom-2">
                {isLoading ? (
                  <button
                    onClick={handleStop}
                    className="h-full px-6 bg-red-500 text-white rounded-full hover:bg-red-600 flex items-center gap-2 transition-all shadow-md hover:shadow-lg active:scale-95"
                  >
                    <span className="text-sm font-medium">停止</span>
                    <Square className="w-4 h-4 fill-current" />
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    disabled={!input.trim()}
                    className="h-full px-6 bg-gray-900 text-white rounded-full hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all shadow-md hover:shadow-lg active:scale-95"
                  >
                    <span className="text-sm font-medium">发送</span>
                    <Send className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <p className="text-center text-xs text-gray-400 mt-3">
              AI 生成内容仅供参考，请以原始文档为准
            </p>
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
}

export default App;
