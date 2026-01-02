#!/bin/bash
HOST="47.96.23.187"
USER="root"

echo "=== 正在检查服务器状态 ==="
ssh -t $USER@$HOST "
    cd /root/rag-project && \
    echo '' && \
    echo '--- 1. 容器运行状态 ---' && \
    docker compose ps && \
    echo '' && \
    echo '--- 2. 后端最近50行日志 ---' && \
    docker compose logs --tail 50 backend
"
