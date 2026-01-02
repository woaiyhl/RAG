import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Loader2,
  Bot,
  User,
  Sparkles,
  BookOpen,
  Square,
  Mic,
  MicOff,
  Copy,
  RotateCw,
  Trash2,
  PanelLeftOpen,
} from "lucide-react";
import { motion } from "framer-motion";
import { Tooltip, message } from "antd";
import { useChatStore } from "../store/useChatStore";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { ReferenceSidebar } from "../components/ReferenceSidebar";
import { VoiceWave } from "../components/VoiceWave";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  createConversation,
  getConversation,
  chatStreamWithConversation,
  deleteMessage,
} from "../services/api";
import { useOutletContext } from "react-router-dom";

interface ChatPageContext {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (isOpen: boolean) => void;
  refreshDocsTrigger: number;
}

export const ChatPage: React.FC = () => {
  const { isSidebarOpen, setIsSidebarOpen } = useOutletContext<ChatPageContext>();

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

  // Reference Sidebar State
  const [isRefSidebarOpen, setIsRefSidebarOpen] = useState(false);
  const [activeReferences, setActiveReferences] = useState<string[]>([]);
  const [activeQuery, setActiveQuery] = useState<string>("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const skipFetchRef = useRef(false);

  // Load conversation history
  useEffect(() => {
    if (activeId) {
      if (conversations[activeId]?.isLoading) {
        return;
      }

      if (skipFetchRef.current) {
        skipFetchRef.current = false;
        return;
      }

      initConversation(activeId);

      getConversation(activeId)
        .then((data) => {
          const formattedMessages = data.messages.map((msg) => ({
            id: msg.id.toString(),
            uid: msg.id.toString(),
            role: msg.role,
            content: msg.content,
            sources: msg.sources ? JSON.parse(msg.sources) : undefined,
          }));
          setStoreMessages(activeId, formattedMessages);
        })
        .catch((err) => {
          console.error(err);
        });
    }
  }, [activeId]);

  // 语音输入相关逻辑
  const initialInputRef = useRef("");
  const [currentTranscript, setCurrentTranscript] = useState("");

  const { isListening, startListening, stopListening } = useSpeechRecognition({
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

    const msgIndex = messages.findIndex((m) => m.id === messageId);
    let query = "";
    if (msgIndex > 0) {
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
    const conversationId = activeId;
    if (!textToSend.trim() || (conversationId && conversations[conversationId]?.isLoading)) return;

    const userMessage = textToSend;
    if (textToSend === input) setInput("");

    const tempId = Date.now().toString();

    let targetConversationId = conversationId;

    try {
      if (!targetConversationId) {
        const newConv = await createConversation();
        targetConversationId = newConv.id;
        initConversation(targetConversationId);
        setActiveId(targetConversationId);
        skipFetchRef.current = true;
      }

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
      const assistantMsgUid = assistantMsgId;
      let currentAssistantId = assistantMsgId;

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
    <>
      <ReferenceSidebar
        isOpen={isRefSidebarOpen}
        onClose={() => setIsRefSidebarOpen(false)}
        sources={activeReferences}
        query={activeQuery}
      />

      <div className="flex-1 flex flex-col relative bg-white h-full overflow-hidden">
        {/* Header */}
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
            <div className="h-full flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in duration-500">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-primary-200 to-blue-200 rounded-full blur-3xl opacity-20 group-hover:opacity-30 transition-opacity duration-500"></div>
                <div className="bg-white p-6 rounded-3xl shadow-xl shadow-primary-900/5 relative ring-1 ring-gray-100">
                  <Bot className="w-16 h-16 text-primary-600" />
                </div>
              </div>
              <div className="space-y-2 max-w-md">
                <h3 className="text-2xl font-bold text-gray-800 tracking-tight">
                  欢迎使用 RAG 知识库
                </h3>
                <p className="text-gray-500 leading-relaxed">
                  请先在左侧上传您的技术文档，然后就可以开始向我提问了。
                </p>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <motion.div
              key={msg.uid || msg.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className={`flex gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 mt-1 ring-2 ring-white shadow-sm">
                  <Bot className="w-5 h-5 text-primary-600" />
                </div>
              )}

              <div
                className={`group relative max-w-[85%] rounded-2xl p-4 shadow-sm ${
                  msg.role === "user"
                    ? "bg-primary-600 text-white rounded-tr-sm"
                    : "bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-md"
                }`}
              >
                <div
                  className={`prose prose-sm max-w-none ${
                    msg.role === "user" ? "prose-invert" : ""
                  }`}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>

                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100/20">
                    <button
                      onClick={() => handleViewReferences(msg.sources!, msg.id)}
                      className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                        msg.role === "user"
                          ? "text-primary-100 hover:text-white"
                          : "text-primary-600 hover:text-primary-700"
                      }`}
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      查看 {msg.sources.length} 篇参考文档
                    </button>
                  </div>
                )}

                {/* Message Actions */}
                <div
                  className={`absolute ${
                    msg.role === "user" ? "-left-12" : "-right-12"
                  } top-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1`}
                >
                  <Tooltip title="复制">
                    <button
                      onClick={() => handleCopy(msg.content)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </Tooltip>
                  {msg.role === "assistant" && (
                    <Tooltip title="重新生成">
                      <button
                        onClick={() => handleRegenerate(msg.id)}
                        className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                    </Tooltip>
                  )}
                  <Tooltip title="删除">
                    <button
                      onClick={() => handleDelete(msg.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </Tooltip>
                </div>
              </div>

              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-1 ring-2 ring-white shadow-sm">
                  <User className="w-5 h-5 text-gray-500" />
                </div>
              )}
            </motion.div>
          ))}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-4 justify-start"
            >
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 ring-2 ring-white shadow-sm">
                <Bot className="w-5 h-5 text-primary-600" />
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm p-4 shadow-md flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-primary-500 animate-spin" />
                <span className="text-sm text-gray-500">正在思考中...</span>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-6 bg-white border-t border-gray-100">
          <div className="max-w-4xl mx-auto relative">
            <div className="relative flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-xl p-2 shadow-sm focus-within:ring-2 focus-within:ring-primary-500/20 focus-within:border-primary-500 transition-all">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="输入问题，或者上传文档后提问..."
                className="flex-1 max-h-32 min-h-[44px] py-2.5 px-3 bg-transparent border-none focus:ring-0 resize-none text-gray-700 placeholder-gray-400 leading-relaxed text-sm scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
                rows={1}
              />

              <div className="flex items-center gap-1 pb-1">
                <Tooltip title={isListening ? "停止录音" : "语音输入"}>
                  <button
                    onClick={handleMicClick}
                    className={`p-2 rounded-lg transition-all duration-200 ${
                      isListening
                        ? "bg-red-100 text-red-600 hover:bg-red-200"
                        : "text-gray-400 hover:text-gray-600 hover:bg-gray-200/50"
                    }`}
                  >
                    {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>
                </Tooltip>

                <div className="w-px h-5 bg-gray-200 mx-1"></div>

                {isLoading ? (
                  <button
                    onClick={handleStop}
                    className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-sm transition-colors flex items-center gap-2 px-3"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    <span className="text-xs font-medium">停止</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleSend()}
                    disabled={!input.trim()}
                    className="p-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:hover:bg-primary-600 text-white rounded-lg shadow-sm transition-all duration-200"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Voice Wave Visualization */}
            {isListening && (
              <div className="absolute right-16 bottom-2 h-8">
                <VoiceWave />
              </div>
            )}

            {/* Real-time transcript display */}
            {isListening && currentTranscript && (
              <div className="absolute bottom-full left-0 right-0 mb-4 p-3 bg-gray-900/80 backdrop-blur text-white text-sm rounded-lg shadow-lg">
                <p className="opacity-80 mb-1 text-xs uppercase tracking-wider">正在听...</p>
                <p>{currentTranscript}</p>
              </div>
            )}

            <div className="text-center mt-2">
              <p className="text-xs text-gray-400">AI 生成内容仅供参考，请以原始文档为准</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
