import React, { useState, useRef, useEffect } from "react";
import {
  uploadDocument,
  createConversation,
  getConversation,
  chatStreamWithConversation,
  deleteMessage,
} from "./services/api";
import { DocumentManager } from "./components/DocumentManager";
import { Sidebar } from "./components/Sidebar";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send,
  Upload,
  Loader2,
  Bot,
  User,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  BookOpen,
  Settings,
  Square,
  Mic,
  MicOff,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  Copy,
  RotateCw,
  Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ConfigProvider, Tooltip, message } from "antd";
import { useChatStore } from "./store/useChatStore";
import { useSpeechRecognition } from "./hooks/useSpeechRecognition";
import { ReferenceSidebar } from "./components/ReferenceSidebar";
import { VoiceWave } from "./components/VoiceWave";

// interface Message removed as it is imported from store

function App() {
  const {
    activeId,
    setActiveId,
    conversations,
    initConversation,
    setMessages: setStoreMessages,
    addMessage,
    updateMessage,
    setLoading: setStoreLoading,
    setAbortController,
    deleteMessageFromStore,
    abortRequest,
  } = useChatStore();

  const currentConversation = activeId ? conversations[activeId] : null;
  const messages = currentConversation?.messages || [];
  const isLoading = currentConversation?.isLoading || false;

  const [input, setInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "success" | "error">("idle");
  const [refreshDocsTrigger, setRefreshDocsTrigger] = useState(0);
  const [isDocManagerOpen, setIsDocManagerOpen] = useState(false);
  // currentConversationId replaced by activeId from store
  const [refreshSidebarTrigger, setRefreshSidebarTrigger] = useState(0);
  const [isKnowledgeBaseOpen, setIsKnowledgeBaseOpen] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Reference Sidebar State
  const [isRefSidebarOpen, setIsRefSidebarOpen] = useState(false);
  const [activeReferences, setActiveReferences] = useState<string[]>([]);
  const [activeQuery, setActiveQuery] = useState<string>("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  // abortControllerRef removed, managed by store
  const skipFetchRef = useRef(false);

  // Load conversation history
  useEffect(() => {
    if (activeId) {
      if (conversations[activeId]?.isLoading) {
        // If loading, do not overwrite messages, just ensure it's initialized
        return;
      }

      if (skipFetchRef.current) {
        skipFetchRef.current = false;
        return;
      }

      // Init if not exists (though fetch will set it)
      initConversation(activeId);

      // We don't set global loading here to avoid flickering or blocking UI
      // just fetch and update
      getConversation(activeId)
        .then((data) => {
          const formattedMessages = data.messages.map((msg) => ({
            id: msg.id.toString(),
            uid: msg.id.toString(), // Use DB ID as UID for historical messages
            role: msg.role,
            content: msg.content,
            sources: msg.sources ? JSON.parse(msg.sources) : undefined,
          }));
          setStoreMessages(activeId, formattedMessages);
        })
        .catch((err) => {
          console.error(err);
        });
    } else {
      // activeId is null (New Chat), nothing to load
    }
  }, [activeId]);

  const handleNewConversation = () => {
    setActiveId(null);
    setInput("");
    // Do NOT abort requests here
  };

  // 语音输入相关逻辑
  const initialInputRef = useRef("");
  // 增加 currentTranscript 状态，用于实时显示语音内容
  const [currentTranscript, setCurrentTranscript] = useState("");

  const {
    isListening,
    isSupported,
    startListening,
    stopListening,
    error: speechError,
  } = useSpeechRecognition({
    onResult: (transcript) => {
      setCurrentTranscript(transcript);
      setInput(initialInputRef.current + transcript);
    },
    onEnd: () => {
      setCurrentTranscript("");
    },
  });

  const handleMicClick = () => {
    if (isListening) {
      stopListening();
    } else {
      initialInputRef.current = input;
      startListening();
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleViewReferences = (sources: string[], messageId: string) => {
    setActiveReferences(sources);

    // Find the user query corresponding to this assistant message
    const msgIndex = messages.findIndex((m) => m.id === messageId);
    let query = "";
    if (msgIndex > 0) {
      // Look backwards for the nearest user message
      for (let i = msgIndex - 1; i >= 0; i--) {
        if (messages[i].role === "user") {
          query = messages[i].content;
          break;
        }
      }
    }
    setActiveQuery(query);
    setIsRefSidebarOpen(true);
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
    } catch (error) {
      console.error(error);
      setUploadStatus("error");
      setTimeout(() => setUploadStatus("idle"), 3000);
      message.error("文档上传失败");
    } finally {
      setIsUploading(false);
    }
  };

  const handleStop = () => {
    if (activeId) {
      abortRequest(activeId);
      setAbortController(activeId, null);
      setStoreLoading(activeId, false);
    }
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    message.success("已复制到剪贴板");
  };

  const handleDelete = async (messageId: string) => {
    if (activeId) {
      deleteMessageFromStore(activeId, messageId);
      try {
        await deleteMessage(activeId, parseInt(messageId));
        message.success("删除成功");
      } catch (error) {
        console.error("Failed to delete message:", error);
      }
    }
  };

  const handleRegenerate = async (messageId: string) => {
    if (isLoading) return;
    const msgIndex = messages.findIndex((m) => m.id === messageId);
    if (msgIndex === -1) return;

    const msg = messages[msgIndex];
    if (msg.role !== "assistant") return;

    let userMsgIndex = -1;
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        userMsgIndex = i;
        break;
      }
    }

    if (userMsgIndex === -1) {
      message.error("无法重新生成：找不到对应的问题");
      return;
    }

    const userMsg = messages[userMsgIndex];
    const userQuery = userMsg.content;
    const assistantMsgId = msg.id;
    const userMsgId = userMsg.id;

    if (activeId) {
      deleteMessageFromStore(activeId, assistantMsgId);
      deleteMessageFromStore(activeId, userMsgId);

      try {
        await deleteMessage(activeId, parseInt(assistantMsgId));
        await deleteMessage(activeId, parseInt(userMsgId));
      } catch (error) {
        console.error("Failed to delete messages for regeneration:", error);
      }
      handleSend(userQuery);
    }
  };

  const handleSend = async (overrideInput?: string | React.SyntheticEvent) => {
    const textToSend = typeof overrideInput === "string" ? overrideInput : input;
    // Check global loading or specific loading?
    // We should prevent sending if THIS conversation is loading.
    // But since handleSend is usually triggered from UI where activeId is set...
    const conversationId = activeId;
    if (!textToSend.trim() || (conversationId && conversations[conversationId]?.isLoading)) return;

    const userMessage = textToSend;
    if (textToSend === input) setInput("");

    const tempId = Date.now().toString();

    // We need a conversation ID. If none, create one.
    let targetConversationId = conversationId;

    try {
      if (!targetConversationId) {
        const newConv = await createConversation();
        targetConversationId = newConv.id;
        initConversation(targetConversationId);
        setActiveId(targetConversationId);
        skipFetchRef.current = true;
        setRefreshSidebarTrigger((prev) => prev + 1);
      }

      // Optimistic updates
      addMessage(targetConversationId, {
        id: tempId,
        uid: tempId,
        role: "user",
        content: userMessage,
      });
      setStoreLoading(targetConversationId, true);

      const controller = new AbortController();
      setAbortController(targetConversationId, controller);

      const assistantMsgId = (Date.now() + 1).toString();
      const assistantMsgUid = assistantMsgId; // UID stays constant
      let currentAssistantId = assistantMsgId; // Mutable ID reference

      addMessage(targetConversationId, {
        id: assistantMsgId,
        uid: assistantMsgUid,
        role: "assistant",
        content: "",
      });

      await chatStreamWithConversation(
        targetConversationId,
        userMessage,
        (data) => {
          if (data.error) {
            updateMessage(targetConversationId!, currentAssistantId, (msg) => ({
              ...msg,
              content: msg.content + `\n\n❌ 错误: ${data.error}`,
            }));
          }
          if (data.answer) {
            updateMessage(targetConversationId!, currentAssistantId, (msg) => ({
              ...msg,
              content: msg.content + data.answer,
            }));
          }
          if (data.sources) {
            updateMessage(targetConversationId!, currentAssistantId, (msg) => ({
              ...msg,
              sources: data.sources,
            }));
          }
          if (data.message_id) {
            const newId = data.message_id.toString();
            updateMessage(targetConversationId!, currentAssistantId, (msg) => ({
              ...msg,
              id: newId,
            }));
            currentAssistantId = newId;
          }
          if (data.user_message_id) {
            updateMessage(targetConversationId!, tempId, (msg) => ({
              ...msg,
              id: data.user_message_id!.toString(),
            }));
          }
        },
        (error) => {
          if (error.name === "AbortError") {
            console.log("Request aborted");
            return;
          }
          console.error(error);
          updateMessage(targetConversationId!, currentAssistantId, (msg) => ({
            ...msg,
            content: msg.content + "\n\n❌ 发生错误，请重试。",
          }));
        },
        () => {
          setStoreLoading(targetConversationId!, false);
          setAbortController(targetConversationId!, null);
          setRefreshSidebarTrigger((prev) => prev + 1);
        },
        controller.signal,
      );
    } catch (error) {
      console.error(error);
      if (targetConversationId) {
        setStoreLoading(targetConversationId, false);
        const errorMsgId = Date.now().toString();
        addMessage(targetConversationId, {
          id: errorMsgId,
          uid: errorMsgId,
          role: "assistant",
          content: "❌ 抱歉，遇到了一些问题，请稍后重试。",
        });
      }
    }
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
                  <h1 className="text-xl font-bold tracking-tight">RAG Knowledges</h1>
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
              onSelectConversation={setActiveId}
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
                        onClick={() => setIsDocManagerOpen(true)}
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

        <DocumentManager
          open={isDocManagerOpen}
          onClose={() => setIsDocManagerOpen(false)}
          refreshTrigger={refreshDocsTrigger}
        />

        <ReferenceSidebar
          isOpen={isRefSidebarOpen}
          onClose={() => setIsRefSidebarOpen(false)}
          sources={activeReferences}
          query={activeQuery}
        />

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col relative bg-white">
          {/* Header (Optional, mostly for mobile but good for spacing) */}
          <div className="h-16 border-b border-gray-100 flex items-center justify-between px-8 bg-white/80 backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center gap-4">
              {!isSidebarOpen && (
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="text-gray-500 hover:text-primary-600 transition-colors p-1.5 rounded-md hover:bg-gray-100"
                  title="展开侧边栏"
                >
                  <PanelLeftOpen className="w-5 h-5" />
                </button>
              )}
              <h2 className="text-gray-700 font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary-500" />
                AI 问答助手
              </h2>
            </div>
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
                  key={msg.uid}
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
                    rounded-2xl px-6 shadow-sm
                    ${msg.content?.includes("### 文档解析成功") ? "py-3" : "py-4"}
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
                          remarkPlugins={[remarkGfm]}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      )}
                    </div>

                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-2">
                        <button
                          onClick={() => handleViewReferences(msg.sources!, msg.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-full text-xs font-medium text-gray-600 transition-colors group"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-gray-400 group-hover:text-primary-500 transition-colors" />
                          参考 {msg.sources.length} 篇资料
                          <ChevronRight className="w-3 h-3 text-gray-400 group-hover:text-gray-600 transition-colors" />
                        </button>
                      </div>
                    )}

                    {msg.role === "assistant" &&
                      !isLoading &&
                      msg.content &&
                      !msg.content.includes("### 文档解析成功") && (
                        <div className="flex items-center gap-4 mt-2 ml-1">
                          <Tooltip title="复制内容">
                            <button
                              onClick={() => handleCopy(msg.content)}
                              className="flex items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              <Copy className="w-4 h-4" />
                              <span className="text-xs">复制</span>
                            </button>
                          </Tooltip>
                          <Tooltip title="重新生成">
                            <button
                              onClick={() => handleRegenerate(msg.id)}
                              className="flex items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              <RotateCw className="w-4 h-4" />
                              <span className="text-xs">重新生成</span>
                            </button>
                          </Tooltip>
                          <Tooltip title="删除消息">
                            <button
                              onClick={() => handleDelete(msg.id)}
                              className="flex items-center gap-1 text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span className="text-xs">删除</span>
                            </button>
                          </Tooltip>
                        </div>
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
              {isListening ? (
                <div className="w-full pl-6 pr-32 py-4 bg-white border-2 border-primary-500/50 rounded-full flex items-center shadow-lg shadow-primary-500/10 h-[58px] transition-all duration-300 overflow-hidden">
                  <VoiceWave />
                  <span className="ml-3 text-gray-500 truncate text-sm flex-1">
                    {currentTranscript || "我在听，请继续 ..."}
                  </span>
                </div>
              ) : (
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  placeholder="输入你的问题，例如：RAG 的核心优势是什么？"
                  className="w-full pl-6 pr-32 py-4 bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all shadow-sm text-gray-700 placeholder-gray-400"
                  disabled={isLoading}
                />
              )}
              <div className="absolute right-2 top-2 bottom-2 flex items-center gap-2">
                {isSupported && (
                  <Tooltip
                    title={
                      speechError ? (
                        <span className="text-red-500 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {speechError}
                        </span>
                      ) : isListening ? (
                        "点击停止录音"
                      ) : (
                        "点击开始录音"
                      )
                    }
                  >
                    <button
                      onClick={handleMicClick}
                      className={`h-full aspect-square rounded-full flex items-center justify-center transition-all shadow-sm active:scale-95 ${
                        isListening
                          ? "bg-red-500 text-white animate-pulse ring-4 ring-red-200"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                      } ${speechError ? "border-red-500 border bg-red-50" : ""}`}
                    >
                      {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                  </Tooltip>
                )}

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
