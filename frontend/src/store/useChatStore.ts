import { create } from "zustand";

export interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  id: string; // Database ID (can be temporary timestamp initially)
  uid: string; // Frontend unique ID for rendering (never changes)
}

interface ConversationState {
  messages: Message[];
  isLoading: boolean;
  input: string;
}

interface ChatStore {
  // State
  conversations: Record<string, ConversationState>;
  activeId: string | null;
  // Store AbortControllers to cancel requests if needed, but they persist across UI switches
  abortControllers: Record<string, AbortController>;

  // Actions
  setActiveId: (id: string | null) => void;
  setInput: (id: string, input: string) => void;

  // Initialize conversation state if not exists
  initConversation: (id: string) => void;

  setMessages: (id: string, messages: Message[]) => void;
  addMessage: (id: string, message: Message) => void;
  updateMessage: (
    conversationId: string,
    messageId: string,
    updater: (msg: Message) => Message,
  ) => void;
  deleteMessageFromStore: (conversationId: string, messageId: string) => void;

  setLoading: (id: string, isLoading: boolean) => void;

  setAbortController: (id: string, controller: AbortController | null) => void;
  abortRequest: (id: string) => void;

  removeConversation: (id: string) => void;

  // Selectors/Helpers
  getActiveConversation: () => ConversationState;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  conversations: {},
  activeId: null,
  abortControllers: {},

  setActiveId: (id) => set({ activeId: id }),

  setInput: (id, input) =>
    set((state) => ({
      conversations: {
        ...state.conversations,
        [id]: {
          ...(state.conversations[id] || { messages: [], isLoading: false, input: "" }),
          input,
        },
      },
    })),

  initConversation: (id) =>
    set((state) => {
      if (state.conversations[id]) return {};
      return {
        conversations: {
          ...state.conversations,
          [id]: { messages: [], isLoading: false, input: "" },
        },
      };
    }),

  setMessages: (id, messages) =>
    set((state) => ({
      conversations: {
        ...state.conversations,
        [id]: {
          ...(state.conversations[id] || { isLoading: false, input: "" }),
          messages,
        },
      },
    })),

  addMessage: (id, message) =>
    set((state) => {
      const conv = state.conversations[id] || { messages: [], isLoading: false, input: "" };
      return {
        conversations: {
          ...state.conversations,
          [id]: {
            ...conv,
            messages: [...conv.messages, message],
          },
        },
      };
    }),

  updateMessage: (conversationId, messageId, updater) =>
    set((state) => {
      const conv = state.conversations[conversationId];
      if (!conv) return {};

      return {
        conversations: {
          ...state.conversations,
          [conversationId]: {
            ...conv,
            messages: conv.messages.map((msg) => (msg.id === messageId ? updater(msg) : msg)),
          },
        },
      };
    }),

  deleteMessageFromStore: (conversationId, messageId) =>
    set((state) => {
      const conv = state.conversations[conversationId];
      if (!conv) return {};

      return {
        conversations: {
          ...state.conversations,
          [conversationId]: {
            ...conv,
            messages: conv.messages.filter((msg) => msg.id !== messageId),
          },
        },
      };
    }),

  setLoading: (id, isLoading) =>
    set((state) => ({
      conversations: {
        ...state.conversations,
        [id]: {
          ...(state.conversations[id] || { messages: [], input: "" }),
          isLoading,
        },
      },
    })),

  setAbortController: (id, controller) =>
    set((state) => {
      const newControllers = { ...state.abortControllers };
      if (controller) {
        newControllers[id] = controller;
      } else {
        delete newControllers[id];
      }
      return { abortControllers: newControllers };
    }),

  abortRequest: (id) => {
    const { abortControllers } = get();
    if (abortControllers[id]) {
      abortControllers[id].abort();
    }
  },

  removeConversation: (id) =>
    set((state) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [id]: _, ...rest } = state.conversations;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [id]: __, ...restControllers } = state.abortControllers;
      return { conversations: rest, abortControllers: restControllers };
    }),

  getActiveConversation: () => {
    const state = get();
    if (!state.activeId) return { messages: [], isLoading: false, input: "" };
    return state.conversations[state.activeId] || { messages: [], isLoading: false, input: "" };
  },
}));
