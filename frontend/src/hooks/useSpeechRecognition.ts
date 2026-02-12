import { useState, useEffect, useRef, useCallback } from "react";

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: () => void;
  onresult: (event: any) => void;
  onerror: (event: any) => void;
  onend: () => void;
  onnomatch: () => void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor;
    webkitSpeechRecognition: SpeechRecognitionConstructor;
  }
}

interface UseSpeechRecognitionProps {
  onResult?: (transcript: string) => void;
  onEnd?: () => void;
}

export const useSpeechRecognition = ({ onResult, onEnd }: UseSpeechRecognitionProps = {}) => {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // 使用 ref 保存回调，避免 useEffect 依赖变化导致重置
  const onResultRef = useRef(onResult);
  const onEndRef = useRef(onEnd);

  useEffect(() => {
    onResultRef.current = onResult;
    onEndRef.current = onEnd;
  }, [onResult, onEnd]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const stopListening = useCallback(() => {
    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    } catch (e) {
      console.error("Stop speech recognition failed", e);
    } finally {
      // 强制更新状态，确保 UI 响应
      setIsListening(false);
    }
  }, []);

  const startListening = useCallback(() => {
    setError(null);

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.error("Browser does not support SpeechRecognition");
      setError("您的浏览器不支持语音识别功能");
      return;
    }

    if (window.isSecureContext === false) {
      console.error("Speech Recognition requires a secure context (HTTPS)");
      setError("语音识别需要 HTTPS 安全连接（或 localhost 本地访问）");
      return;
    }

    console.log("Initializing SpeechRecognition...", {
      constructor: SpeechRecognition.name,
      userAgent: navigator.userAgent,
    });

    // 如果已有实例，先终止
    if (recognitionRef.current) {
      console.log("Aborting existing recognition instance");
      recognitionRef.current.abort();
    }

    try {
      const recognition = new SpeechRecognition();
      console.log("SpeechRecognition instance created");

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "zh-CN";

      recognition.onstart = () => {
        console.log("✅ Speech recognition event: onstart");
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        try {
          // 更加健壮的结果解析逻辑
          const results = Array.from(event.results as any[]);
          let currentTranscript = "";

          for (const result of results) {
            if (result && result[0]) {
              currentTranscript += result[0].transcript;
            }
          }

          console.log("Speech transcript update:", currentTranscript);

          if (onResultRef.current) {
            onResultRef.current(currentTranscript);
          }
        } catch (e) {
          console.error("Error parsing speech results:", e);
        }
      };

      recognition.onnomatch = () => {
        console.warn("Speech recognition: No match found");
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        if (event.error === "not-allowed") {
          setError("无法访问麦克风，请检查权限设置");
        } else if (event.error === "no-speech") {
          // 忽略 no-speech，可能是静音
          console.warn("No speech detected");
        } else if (event.error === "network") {
          setError("网络错误，无法连接语音服务");
        } else {
          setError(`语音识别错误: ${event.error}`);
        }
        // 错误也会触发 onend，所以不需要在这里 setIsListening(false)
      };

      recognition.onend = () => {
        console.log("🏁 Speech recognition event: onend");
        setIsListening(false);
        recognitionRef.current = null;
        if (onEndRef.current) {
          onEndRef.current();
        }
      };

      console.log("Calling recognition.start()...");
      recognition.start();
      console.log("recognition.start() called successfully");

      recognitionRef.current = recognition;
      setIsListening(true);
    } catch (e) {
      console.error("Failed to start speech recognition", e);
      setError("启动语音识别失败");
      setIsListening(false);
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    error,
    startListening,
    stopListening,
    toggleListening,
    isSupported: !!(
      typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition)
    ),
  };
};
