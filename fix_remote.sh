#!/bin/bash
HOST="47.96.23.187"
USER="root"

echo "=== 正在尝试修复并重启远程服务 ==="
ssh -t $USER@$HOST "
    cd /root/rag-project && \
    echo '1. 停止旧容器...' && \
    docker compose down && \
    echo '2. 强制重新构建并启动...' && \
    docker compose up -d --build && \
    echo '3. 等待服务启动 (10秒)...' && \
    sleep 10 && \
    echo '4. 检查服务状态:' && \
    docker compose ps && \
    echo '5. 查看后端日志:' && \
    docker compose logs --tail 20 backend
"
