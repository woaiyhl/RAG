import React, { useEffect, useState } from "react";
import { Modal, Button, Tooltip, message } from "antd";
import { FullscreenOutlined, FullscreenExitOutlined, CloseOutlined } from "@ant-design/icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Configure PDF worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export interface PreviewFile {
  fileId: string;
  filename: string;
  highlight?: string;
  page?: number;
}

interface DocumentPreviewProps {
  open: boolean;
  onClose: () => void;
  previewFile: PreviewFile | null;
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({ open, onClose, previewFile }) => {
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [mdContent, setMdContent] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPdf, setIsPdf] = useState(false);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [highlightText, setHighlightText] = useState<string | null>(null);

  useEffect(() => {
    if (open && previewFile) {
      handlePreview(previewFile);
    } else {
      // Reset state when closed
      setPreviewUrl(null);
      setMdContent(null);
      setLoadingPreview(false);
      setIsFullscreen(false);
      setIsPdf(false);
      setPageNumber(1);
      setHighlightText(null);
    }
  }, [open, previewFile]);

  // Update highlight text if it changes while open
  useEffect(() => {
    if (open && previewFile?.highlight) {
      setHighlightText(previewFile.highlight);
    }
  }, [previewFile?.highlight, open]);

  // Update page number if it changes while open
  useEffect(() => {
    if (open && previewFile?.page) {
      setPageNumber(previewFile.page);
    }
  }, [previewFile?.page, open]);

  const handlePreview = async (file: PreviewFile) => {
    console.log("Previewing file:", file.filename);
    const filename = file.filename.trim().toLowerCase();

    setIsFullscreen(false);
    setMdContent(null);
    setPreviewUrl(null);
    setIsPdf(false);
    setPageNumber(file.page || 1);
    setHighlightText(file.highlight || null);

    if (filename.endsWith(".md") || filename.endsWith(".markdown")) {
      console.log("Detected Markdown file");
      setLoadingPreview(true);
      try {
        const response = await fetch(`/api/v1/documents/${file.fileId}/preview`);
        if (!response.ok) throw new Error("Failed to load content");
        const text = await response.text();
        console.log("Markdown content loaded, length:", text.length);
        setMdContent(text);
      } catch (error) {
        console.error("Failed to load markdown content:", error);
        message.error("无法加载 Markdown 内容");
      } finally {
        setLoadingPreview(false);
      }
    } else if (filename.endsWith(".pdf")) {
      console.log("Detected PDF file");
      setIsPdf(true);
      setPreviewUrl(`/api/v1/documents/${file.fileId}/preview`);
    } else {
      console.log("Not a Markdown or PDF file, using iframe preview");
      setPreviewUrl(`/api/v1/documents/${file.fileId}/preview`);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const applyHighlight = () => {
    if (!highlightText) return;
    const textLayer = document.querySelector(".react-pdf__Page__textContent");
    if (!textLayer) return;

    const spans = textLayer.querySelectorAll("span");
    let found = false;
    spans.forEach((span) => {
      span.style.backgroundColor = "";
      if (span.textContent && span.textContent.includes(highlightText)) {
        span.style.backgroundColor = "rgba(255, 255, 0, 0.4)";
        if (!found) {
          span.scrollIntoView({ behavior: "smooth", block: "center" });
          found = true;
        }
      }
    });
  };

  // Highlight text in PDF when highlight text changes
  useEffect(() => {
    if (isPdf && highlightText) {
      const timer = setTimeout(applyHighlight, 500);
      return () => clearTimeout(timer);
    }
  }, [highlightText, isPdf, pageNumber]); // Re-apply when page changes

  // Scroll to highlight in Markdown
  useEffect(() => {
    if (mdContent && highlightText) {
      const timer = setTimeout(() => {
        const mark = document.querySelector("article mark");
        if (mark) {
          mark.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [mdContent, highlightText]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  if (!open || !previewFile) return null;

  return (
    <Modal
      open={open}
      closable={false}
      title={
        <div className="flex items-center justify-between py-1">
          <span
            className="text-base font-medium text-gray-700 truncate max-w-2xl"
            title={previewFile.filename}
          >
            {previewFile.filename}
          </span>
          <div className="flex items-center gap-1">
            <Tooltip title={isFullscreen ? "退出全屏" : "全屏"}>
              <button
                onClick={toggleFullscreen}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors flex items-center justify-center"
              >
                {isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              </button>
            </Tooltip>
            <div className="w-px h-4 bg-gray-200 mx-1"></div>
            <Tooltip title="关闭">
              <button
                onClick={onClose}
                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors flex items-center justify-center"
              >
                <CloseOutlined />
              </button>
            </Tooltip>
          </div>
        </div>
      }
      onCancel={onClose}
      footer={null}
      width={isFullscreen ? "100%" : 1000}
      style={isFullscreen ? { top: 0, padding: 0, maxWidth: "100vw", height: "100vh" } : undefined}
      styles={{ body: { height: isFullscreen ? "calc(100vh - 55px)" : "80vh", padding: 0 } }}
      destroyOnHidden
      centered={!isFullscreen}
      zIndex={1002} // Higher than document manager
    >
      {loadingPreview ? (
        <div className="flex justify-center items-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : mdContent ? (
        <div className="p-8 overflow-y-auto h-full bg-white">
          <article className="prose prose-slate max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => {
                  if (
                    highlightText &&
                    typeof children === "string" &&
                    children.includes(highlightText)
                  ) {
                    const parts = children.split(highlightText);
                    return (
                      <p>
                        {parts.map((part, i) => (
                          <React.Fragment key={i}>
                            {part}
                            {i < parts.length - 1 && (
                              <mark className="bg-yellow-200 text-gray-900 rounded-sm px-0.5">
                                {highlightText}
                              </mark>
                            )}
                          </React.Fragment>
                        ))}
                      </p>
                    );
                  }
                  return <p>{children}</p>;
                },
              }}
            >
              {mdContent}
            </ReactMarkdown>
          </article>
        </div>
      ) : isPdf && previewUrl ? (
        <div className="flex flex-col items-center h-full bg-gray-100 overflow-y-auto p-4 relative">
          <Document
            file={previewUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex justify-center p-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            }
            error={<div className="text-red-500 p-10">无法加载 PDF 文件</div>}
            className="shadow-lg bg-white"
          >
            <Page
              pageNumber={pageNumber}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              onRenderTextLayerSuccess={applyHighlight}
              width={isFullscreen ? undefined : 800}
              scale={isFullscreen ? 1.5 : 1.0}
            />
          </Document>

          {/* Pagination Controls */}
          <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur px-6 py-2 rounded-full shadow-lg flex items-center gap-4 z-50 border border-gray-200">
            <Button disabled={pageNumber <= 1} onClick={() => setPageNumber((prev) => prev - 1)}>
              上一页
            </Button>
            <span className="font-medium text-gray-700 min-w-[60px] text-center">
              {pageNumber} / {numPages || "--"}
            </span>
            <Button
              disabled={pageNumber >= (numPages || 1)}
              onClick={() => setPageNumber((prev) => prev + 1)}
            >
              下一页
            </Button>
          </div>
        </div>
      ) : (
        previewUrl && (
          <iframe
            src={previewUrl}
            className="w-full h-full border-0 rounded-b-lg"
            title="Document Preview"
          />
        )
      )}
    </Modal>
  );
};
