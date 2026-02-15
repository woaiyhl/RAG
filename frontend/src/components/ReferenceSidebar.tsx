import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { X, ExternalLink, FileText, Globe, ChevronDown, ChevronUp } from "lucide-react";

interface ReferenceSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sources: any[];
  query?: string;
  onViewDocument?: (file: {
    fileId: string;
    filename: string;
    highlight?: string;
    page?: number;
  }) => void;
}

const HighlightText: React.FC<{ text: string; query?: string }> = ({ text, query }) => {
  if (!query || !query.trim()) return <>{text}</>;

  // Simple keyword extraction: split by spaces and filter out common stop words if needed
  // For Chinese, we might want to just highlight the whole query or key segments
  // Here we'll try to highlight the whole query first, then fall back to segments if it's long

  const keywords = query
    .split(/[\s,，.。?？!！]+/)
    .filter((k) => k.length > 1) // Only highlight words with length > 1
    .sort((a, b) => b.length - a.length); // Match longer words first

  if (keywords.length === 0) return <>{text}</>;

  // Create a regex that matches any of the keywords case-insensitively
  const pattern = new RegExp(
    `(${keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi",
  );

  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, i) =>
        keywords.some((k) => k.toLowerCase() === part.toLowerCase()) ? (
          <mark key={i} className="bg-yellow-200 text-gray-900 rounded-sm px-0.5 font-medium">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
};

// Helper to process children for highlighting
const processHighlight = (children: React.ReactNode, query?: string): React.ReactNode => {
  return React.Children.map(children, (child) => {
    if (typeof child === "string") {
      return <HighlightText text={child} query={query} />;
    }
    // For now, we only highlight top-level text nodes in Markdown elements
    // to avoid complex recursion and cloning issues.
    return child;
  });
};

interface ParsedSource {
  type: "web" | "file";
  title: string;
  url?: string;
  siteName?: string;
  content: string;
  relevanceScore?: number;
  fileId?: string;
  page?: number;
}

const parseSource = (source: any): ParsedSource => {
  if (typeof source === "object" && source !== null && !Array.isArray(source)) {
    return {
      type: source.type || "file",
      title: source.title || "未知文档",
      url: source.url,
      content: source.content || "",
      fileId: source.metadata?.file_id,
      page: source.metadata?.page !== undefined ? Number(source.metadata.page) + 1 : undefined,
    };
  }

  // Legacy string handling
  if (typeof source !== "string") return { type: "file", title: "未知来源", content: "" };

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

export const ReferenceSidebar: React.FC<ReferenceSidebarProps> = ({
  isOpen,
  onClose,
  sources,
  query,
  onViewDocument,
}) => {
  const [expandedIndices, setExpandedIndices] = useState<number[]>([]);
  const [showLowRelevance, setShowLowRelevance] = useState(false);

  const { highRelevance, lowRelevance } = useMemo(() => {
    const parsed = sources.map(parseSource);

    if (!query || !query.trim()) {
      return { highRelevance: parsed, lowRelevance: [] };
    }

    // Extract keywords
    const keywords = query.split(/[\s,，.。?？!！]+/).filter((k) => k.length > 1);

    // Calculate score and sort
    const scored = parsed
      .map((source) => {
        let score = 0;
        const contentLower = source.content.toLowerCase();
        const titleLower = source.title.toLowerCase();

        keywords.forEach((k) => {
          const kLower = k.toLowerCase();
          // Title match has higher weight
          if (titleLower.includes(kLower)) score += 5;
          // Content match
          const matches = contentLower.split(kLower).length - 1;
          score += matches;
        });

        return { ...source, relevanceScore: score };
      })
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

    // Split into high and low relevance
    // Threshold: score > 0 means at least one keyword match
    const high = scored.filter((s) => (s.relevanceScore || 0) > 0);
    const low = scored.filter((s) => (s.relevanceScore || 0) === 0);

    // If all are low relevance (e.g. query mismatch), show all as high to avoid empty state
    if (high.length === 0 && low.length > 0) {
      return { highRelevance: low, lowRelevance: [] };
    }

    return { highRelevance: high, lowRelevance: low };
  }, [sources, query]);

  const toggleExpand = (index: number) => {
    setExpandedIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
    );
  };

  const renderSourceCard = (source: ParsedSource, index: number, isLowRelevance = false) => {
    // We use a composite key for expanded state to avoid collisions between lists
    // Using index alone is risky if lists change, but here they are static per render.
    // To be safe, we can use an offset for low relevance list.
    const uniqueIndex = isLowRelevance ? index + 1000 : index;
    const isExpanded = expandedIndices.includes(uniqueIndex);

    return (
      <div
        key={uniqueIndex}
        onClick={() => toggleExpand(uniqueIndex)}
        className={`bg-white rounded-xl p-4 shadow-sm border transition-all duration-200 group cursor-pointer ${
          isLowRelevance
            ? "border-gray-100 opacity-80 hover:opacity-100"
            : "border-gray-200/60 hover:shadow-md"
        }`}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                isLowRelevance ? "bg-gray-50 text-gray-400" : "bg-gray-100 text-gray-500"
              }`}
            >
              <span className="text-xs font-medium">{isLowRelevance ? "?" : index + 1}</span>
            </div>
            <h4
              className={`font-medium text-sm truncate ${
                isLowRelevance ? "text-gray-500" : "text-gray-900"
              }`}
              title={source.title}
            >
              {source.title}
            </h4>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 mt-1">
            {source.type === "web" ? (
              <Globe className="w-3.5 h-3.5 text-blue-500" />
            ) : (
              <FileText
                className={`w-3.5 h-3.5 ${isLowRelevance ? "text-gray-400" : "text-primary-500"}`}
              />
            )}
          </div>
        </div>

        <div className="relative mb-3">
          <div
            className={`text-xs text-gray-600 leading-relaxed transition-all duration-300 relative ${
              isExpanded ? "" : "max-h-[80px] overflow-hidden"
            }`}
          >
            <ReactMarkdown
              className="prose prose-sm max-w-none text-gray-600 [&>p]:mb-2 [&>p:last-child]:mb-0 [&>h1]:text-sm [&>h1]:font-bold [&>h2]:text-xs [&>h2]:font-bold [&>h3]:text-xs [&>h3]:font-semibold [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4"
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => (
                  <p className="mb-2 last:mb-0">{processHighlight(children, query)}</p>
                ),
                li: ({ children }) => <li>{processHighlight(children, query)}</li>,
                h1: ({ children }) => (
                  <h1 className="text-sm font-bold mt-2 mb-1">
                    {processHighlight(children, query)}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-xs font-bold mt-2 mb-1">
                    {processHighlight(children, query)}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-xs font-semibold mt-1 mb-1">
                    {processHighlight(children, query)}
                  </h3>
                ),
                strong: ({ children }) => (
                  <strong className="font-bold text-gray-800">{children}</strong>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-blue-600 hover:underline"
                  >
                    {children}
                  </a>
                ),
              }}
            >
              {source.content}
            </ReactMarkdown>

            {/* Gradient Mask for collapsed state */}
            {!isExpanded && (
              <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent pointer-events-none" />
            )}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(uniqueIndex);
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
              <span className="text-xs text-gray-400 font-medium">{source.siteName}</span>
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

        {source.type === "file" && source.fileId && (
          <div className="flex items-center justify-between pt-3 border-t border-gray-50 mt-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400 font-medium">本地文档</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onViewDocument && source.fileId) {
                  onViewDocument({
                    fileId: source.fileId,
                    filename: source.title,
                    highlight: source.content,
                    page: source.page,
                  });
                }
              }}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium group-hover:underline"
            >
              查看原文 <FileText className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
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
                  {highRelevance.length + lowRelevance.length}
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
              {/* High Relevance List */}
              {highRelevance.map((source, index) => renderSourceCard(source, index))}

              {/* Low Relevance Section */}
              {lowRelevance.length > 0 && (
                <div className="pt-4 border-t border-gray-200/50">
                  <button
                    onClick={() => setShowLowRelevance(!showLowRelevance)}
                    className="flex items-center gap-2 text-xs font-medium text-gray-500 hover:text-gray-700 w-full mb-3"
                  >
                    <span>其他可能相关的来源 ({lowRelevance.length})</span>
                    <div className="h-px flex-1 bg-gray-200"></div>
                    {showLowRelevance ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <AnimatePresence>
                    {showLowRelevance && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="space-y-4 overflow-hidden"
                      >
                        {lowRelevance.map((source, index) => renderSourceCard(source, index, true))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
