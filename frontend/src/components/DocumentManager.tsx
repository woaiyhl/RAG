import React, { useEffect, useState } from "react";
import { Modal, Table, Button, Tag, Popconfirm, message, Space, Tooltip } from "antd";
import {
  DeleteOutlined,
  FileTextOutlined,
  ReloadOutlined,
  EyeOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { getDocuments, deleteDocument, Document } from "../services/api";

interface DocumentManagerProps {
  open: boolean;
  onClose: () => void;
  refreshTrigger: number; // 外部触发刷新（例如上传成功后）
}

export const DocumentManager: React.FC<DocumentManagerProps> = ({
  open,
  onClose,
  refreshTrigger,
}) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const data = await getDocuments();
      setDocuments(data);
    } catch (error) {
      console.error("Failed to fetch documents:", error);
      message.error("获取文档列表失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchDocuments();
    }
  }, [open, refreshTrigger]);

  const handleDelete = async (id: number) => {
    setDeleteLoading(id);
    try {
      await deleteDocument(id);
      message.success("文档删除成功");
      await fetchDocuments();
    } catch (error) {
      console.error("Failed to delete document:", error);
      message.error("删除失败");
    } finally {
      setDeleteLoading(null);
    }
  };

  const handlePreview = (record: Document) => {
    setPreviewUrl(`/api/v1/documents/${record.id}/preview`);
    setPreviewTitle(record.filename);
    setIsFullscreen(false);
  };

  const closePreview = () => {
    setPreviewUrl(null);
    setPreviewTitle("");
    setIsFullscreen(false);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const columns: ColumnsType<Document> = [
    {
      title: "文件名",
      dataIndex: "filename",
      key: "filename",
      render: (text, record) => (
        <Space
          className="cursor-pointer hover:text-blue-600 transition-colors"
          onClick={() => handlePreview(record)}
        >
          <FileTextOutlined className="text-gray-400" />
          <span className="font-medium">{text}</span>
        </Space>
      ),
    },
    {
      title: "大小",
      dataIndex: "file_size",
      key: "file_size",
      width: 100,
      render: (size) => formatSize(size),
    },
    {
      title: "上传时间",
      dataIndex: "upload_time",
      key: "upload_time",
      width: 180,
      render: (date) => new Date(date).toLocaleString("zh-CN"),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status) => {
        let color = "default";
        let text = "未知";

        switch (status) {
          case "processed":
            color = "success";
            text = "已处理";
            break;
          case "processing":
            color = "processing";
            text = "处理中";
            break;
          case "error":
            color = "error";
            text = "失败";
            break;
        }

        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: "操作",
      key: "action",
      width: 120,
      render: (_, record) => (
        <Space>
          <Tooltip title="预览">
            <Button type="text" icon={<EyeOutlined />} onClick={() => handlePreview(record)} />
          </Tooltip>
          <Popconfirm
            title="删除文档"
            description="确定要删除该文档吗？这将同时删除相关的向量索引。"
            onConfirm={() => handleDelete(record.id)}
            okText="是"
            cancelText="否"
            okButtonProps={{ danger: true }}
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              loading={deleteLoading === record.id}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Modal
        title={
          <div className="flex items-center gap-2">
            <span>文档管理</span>
            <Tag color="blue">{documents.length} 篇</Tag>
          </div>
        }
        open={open}
        onCancel={onClose}
        footer={[
          <Button
            key="refresh"
            icon={<ReloadOutlined />}
            onClick={fetchDocuments}
            loading={loading}
          >
            刷新
          </Button>,
          <Button key="close" type="primary" onClick={onClose}>
            关闭
          </Button>,
        ]}
        width={800}
        className="document-manager-modal"
      >
        <Table
          columns={columns}
          dataSource={documents}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 5 }}
          size="middle"
        />
      </Modal>

      <Modal
        open={!!previewUrl}
        title={
          <div className="flex items-center justify-between pr-8">
            <span>{previewTitle}</span>
            <Tooltip title={isFullscreen ? "退出全屏" : "全屏"}>
              <Button
                type="text"
                icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                onClick={toggleFullscreen}
              />
            </Tooltip>
          </div>
        }
        onCancel={closePreview}
        footer={null}
        width={isFullscreen ? "100%" : 1000}
        style={
          isFullscreen ? { top: 0, padding: 0, maxWidth: "100vw", height: "100vh" } : undefined
        }
        styles={{ body: { height: isFullscreen ? "calc(100vh - 55px)" : "80vh", padding: 0 } }}
        destroyOnClose
        centered={!isFullscreen}
        zIndex={1001} // Ensure it's above the document manager modal
      >
        {previewUrl && (
          <iframe
            src={previewUrl}
            className="w-full h-full border-0 rounded-b-lg"
            title="Document Preview"
          />
        )}
      </Modal>
    </>
  );
};
