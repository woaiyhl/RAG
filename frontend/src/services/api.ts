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

export const chatStream = async (
  query: string,
  onChunk: (data: { answer?: string; sources?: string[] }) => void,
  onError: (error: any) => void,
  onFinish: () => void
) => {
  try {
    const response = await fetch("/api/v1/rag/chat/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error("Response body is not readable");
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            onChunk(data);
          } catch (e) {
            console.warn("Failed to parse SSE data:", line);
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
