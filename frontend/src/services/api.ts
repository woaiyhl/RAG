import axios from "axios";

const api = axios.create({
  baseURL: "/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
});

export const uploadDocument = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post("/rag/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

export const chat = async (query: string) => {
  const response = await api.post("/rag/chat", { query });
  return response.data;
};

export interface Document {
  id: number;
  filename: string;
  upload_time: string;
  status: string;
  file_size: number;
}

export const getDocuments = async (): Promise<Document[]> => {
  const response = await api.get("/documents/");
  return response.data;
};

export const deleteDocument = async (id: number) => {
  const response = await api.delete(`/documents/${id}`);
  return response.data;
};

export const chatStream = async (
  query: string,
  onChunk: (data: { answer?: string; sources?: string[] }) => void,
  onError: (error: any) => void,
  onFinish: () => void,
  signal?: AbortSignal,
) => {
  try {
    const response = await fetch("/api/v1/rag/chat/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error("Response body is not readable");
    }

    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Split by newline characters to handle data: lines independently
      // This is more robust than splitting by \n\n if the server sends single newlines
      const lines = buffer.split(/\r?\n/);

      // Keep the last line in the buffer as it might be incomplete
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        if (trimmedLine.startsWith("data: ")) {
          try {
            const jsonStr = trimmedLine.slice(6);
            // console.log("Received chunk:", jsonStr); // Debug log
            const data = JSON.parse(jsonStr);
            onChunk(data);
          } catch (e) {
            console.warn("Failed to parse SSE data:", trimmedLine, e);
          }
        }
      }
    }
  } catch (error) {
    onError(error);
  } finally {
    onFinish();
  }
};

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  sources?: string | null;
  created_at: string;
}

export interface ConversationDetail extends Conversation {
  messages: Message[];
}

export const getConversations = async (): Promise<Conversation[]> => {
  const response = await api.get("/conversations/");
  return response.data;
};

export const createConversation = async (title?: string): Promise<Conversation> => {
  const response = await api.post("/conversations/", { title });
  return response.data;
};

export const getConversation = async (id: string): Promise<ConversationDetail> => {
  const response = await api.get(`/conversations/${id}`);
  return response.data;
};

export const deleteConversation = async (id: string) => {
  const response = await api.delete(`/conversations/${id}`);
  return response.data;
};

export const updateConversationTitle = async (id: string, title: string) => {
  // Need to implement backend logic if needed, but for now skipped
  // If backend doesn't support this yet, we might need to add it or skip.
  // I added update_conversation_title in service but no endpoint.
  // Let's stick to core features first.
};

export const chatStreamWithConversation = async (
  conversationId: string,
  query: string,
  onChunk: (data: { answer?: string; sources?: string[]; error?: string }) => void,
  onError: (error: any) => void,
  onFinish: () => void,
  signal?: AbortSignal,
) => {
  try {
    const response = await fetch(`/api/v1/conversations/${conversationId}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error("Response body is not readable");
    }

    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Split by newline characters to handle data: lines independently
      // This is more robust than splitting by \n\n if the server sends single newlines
      const lines = buffer.split(/\r?\n/);

      // Keep the last line in the buffer as it might be incomplete
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        if (trimmedLine.startsWith("data: ")) {
          try {
            const jsonStr = trimmedLine.slice(6);
            // console.log("Received chunk:", jsonStr); // Debug log
            const data = JSON.parse(jsonStr);
            onChunk(data);
          } catch (e) {
            console.warn("Failed to parse SSE data:", trimmedLine, e);
          }
        }
      }
    }
  } catch (error) {
    onError(error);
  } finally {
    onFinish();
  }
};
