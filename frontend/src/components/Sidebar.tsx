import React, { useEffect, useState } from "react";
import { Plus, MessageSquare, Trash2 } from "lucide-react";
import { Conversation, getConversations, deleteConversation } from "../services/api";
import clsx from "clsx";

interface SidebarProps {
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  refreshTrigger: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  refreshTrigger,
}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);

  const fetchConversations = async () => {
    try {
      const data = await getConversations();
      setConversations(data);
    } catch (error) {
      console.error("Failed to fetch conversations", error);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [refreshTrigger, currentConversationId]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("确定要删除这个对话吗？")) {
      try {
        await deleteConversation(id);
        fetchConversations();
        if (currentConversationId === id) {
          onNewConversation();
        }
      } catch (error) {
        console.error("Failed to delete conversation", error);
      }
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-2 mt-4">
        <button
          onClick={onNewConversation}
          className="w-full flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors mb-4"
        >
          <Plus size={20} />
          <span>新对话</span>
        </button>

        <div className="text-xs font-semibold text-gray-500 px-2 py-2 mb-2">
          历史对话
        </div>
        {conversations.map((conv) => (
          <div
            key={conv.id}
            onClick={() => onSelectConversation(conv.id)}
            className={clsx(
              "group flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer transition-colors mb-1",
              currentConversationId === conv.id
                ? "bg-gray-800 text-white"
                : "text-gray-400 hover:bg-gray-800/50 hover:text-white"
            )}
          >
            <MessageSquare size={18} />
            <span className="flex-1 truncate text-sm">{conv.title}</span>
            <button
              onClick={(e) => handleDelete(e, conv.id)}
              className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
    </div>
  );
};
