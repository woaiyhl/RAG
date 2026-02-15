import React, { useEffect, useState } from "react";
import { Modal, Table, Button, Tag, Popconfirm, message, Space, Tooltip } from "antd";
import { FileTextOutlined, ReloadOutlined } from "@ant-design/icons";
import { Trash2, Eye } from "lucide-react";
import type { ColumnsType } from "antd/es/table";
import { getDocuments, deleteDocument, Document as DocumentType } from "../services/api";
import { DocumentPreview, PreviewFile } from "./DocumentPreview";

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
  const [documents, setDocuments] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<number | null>(null);

  // Local preview state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const data = await getDocuments();
      setDocuments(
        data.sort((a, b) => new Date(b.upload_time).getTime() - new Date(a.upload_time).getTime()),
      );
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

  const handlePreview = (record: DocumentType) => {
    setPreviewFile({
      fileId: record.id.toString(),
      filename: record.filename,
    });
    setIsPreviewOpen(true);
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const columns: ColumnsType<DocumentType> = [
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
            <button
              onClick={() => handlePreview(record)}
              className="p-1 hover:text-blue-600 transition-opacity"
            >
              <Eye size={16} />
            </button>
          </Tooltip>
          <Popconfirm
            title="删除文档"
            description="确定要删除该文档吗？这将同时删除相关的向量索引。"
            onConfirm={() => handleDelete(record.id)}
            okText="是"
            cancelText="否"
            okButtonProps={{ danger: true }}
            onCancel={(e) => e?.stopPropagation()}
          >
            <button
              onClick={(e) => e.stopPropagation()}
              className="p-1 hover:text-red-400 transition-opacity"
              disabled={deleteLoading === record.id}
            >
              <Trash2 size={16} />
            </button>
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

      <DocumentPreview
        open={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        previewFile={previewFile}
      />
    </>
  );
};
