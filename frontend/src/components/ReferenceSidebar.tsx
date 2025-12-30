import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, FileText, Globe, ChevronDown, ChevronUp } from "lucide-react";

interface ReferenceSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sources: string[];
}

interface ParsedSource {
  type: "web" | "file";
  title: string;
  url?: string;
  siteName?: string;
  content: string;
}

const parseSource = (source: string): ParsedSource => {
  // 尝试匹配 Web 搜索格式
  // 格式: 【Web搜索】标题\n链接: url\n摘要: content
  const webMatch = source.match(/^【Web搜索】(.*?)\n链接: (.*?)\n摘要: (.*)/s);

  if (webMatch) {
    const [, title, url, content] = webMatch;
    let siteName = "未知网站";
    try {
      const hostname = new URL(url).hostname;
      siteName = hostname.replace("www.", "");
    } catch (e) {
      // Ignore URL parse error
    }

    return {
      type: "web",
      title: title.trim(),
      url: url.trim(),
      siteName,
      content: content.trim(),
    };
  }

  // 默认为本地文档
  return {
    type: "file",
    title: "本地知识库文档",
    content: source,
  };
};

export const ReferenceSidebar: React.FC<ReferenceSidebarProps> = ({ isOpen, onClose, sources }) => {
  const [expandedIndices, setExpandedIndices] = useState<number[]>([]);

  const parsedSources = useMemo(() => {
    return sources.map(parseSource);
  }, [sources]);

  const toggleExpand = (index: number) => {
    setExpandedIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 z-40 backdrop-blur-sm"
          />

          {/* Sidebar */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-[400px] bg-white shadow-2xl z-50 flex flex-col border-l border-gray-100"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-white/80 backdrop-blur sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-gray-800">参考资料</span>
                <span className="px-2 py-0.5 rounded-full bg-gray-100 text-xs font-medium text-gray-500">
                  {sources.length}
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gray-50/50">
              {parsedSources.map((source, index) => {
                const isExpanded = expandedIndices.includes(index);
                return (
                  <div
                    key={index}
                    onClick={() => toggleExpand(index)}
                    className="bg-white rounded-xl p-4 shadow-sm border border-gray-200/60 hover:shadow-md transition-all duration-200 group cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 bg-gray-100 text-gray-500">
                          <span className="text-xs font-medium">{index + 1}</span>
                        </div>
                        <h4
                          className="font-medium text-gray-900 text-sm truncate"
                          title={source.title}
                        >
                          {source.title}
                        </h4>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 mt-1">
                        {source.type === "web" ? (
                          <Globe className="w-3.5 h-3.5 text-blue-500" />
                        ) : (
                          <FileText className="w-3.5 h-3.5 text-primary-500" />
                        )}
                      </div>
                    </div>

                    <div className="relative mb-3">
                      <p
                        className={`text-xs text-gray-600 leading-relaxed transition-all duration-300 ${
                          isExpanded ? "" : "line-clamp-4"
                        }`}
                      >
                        {source.content}
                      </p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(index);
                        }}
                        className="text-xs text-primary-600 font-medium hover:text-primary-700 mt-1 flex items-center gap-0.5 ml-auto"
                      >
                        {isExpanded ? (
                          <>
                            收起 <ChevronUp className="w-3 h-3" />
                          </>
                        ) : (
                          <>
                            展开 <ChevronDown className="w-3 h-3" />
                          </>
                        )}
                      </button>
                    </div>

                    {source.type === "web" && source.url && (
                      <div className="flex items-center justify-between pt-3 border-t border-gray-50 mt-2">
                        <div className="flex items-center gap-1.5">
                          {/* Favicon fallback */}
                          <div className="w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                            <img
                              src={`https://www.google.com/s2/favicons?domain=${source.url}&sz=32`}
                              alt=""
                              className="w-full h-full object-cover opacity-70"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                              }}
                            />
                          </div>
                          <span className="text-xs text-gray-400 font-medium">
                            {source.siteName}
                          </span>
                        </div>
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()} // Prevent card toggle when clicking link
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium group-hover:underline"
                        >
                          访问链接 <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
