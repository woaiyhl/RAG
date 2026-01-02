#!/bin/bash

# 服务器配置
HOST="47.96.23.187"
USER="root"
PROJECT_DIR="/root/rag-project"

# 颜色输出
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}=== 开始自动部署流程 ===${NC}"
echo -e "${GREEN}目标服务器: ${USER}@${HOST}${NC}"
echo -e "${GREEN}注意：执行过程中可能需要多次输入服务器密码${NC}"
echo ""

# 1. 远程安装 Docker 环境
echo -e "${GREEN}[1/3] 正在连接服务器安装 Docker 环境...${NC}"

# 生成临时安装脚本
cat > install_docker_remote.sh << 'EOF'
#!/bin/bash
echo "-> 安装基础工具..."
yum install -y yum-utils git rsync

echo "-> 配置 Docker 阿里云镜像源..."
yum-config-manager --add-repo http://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo

echo "-> 安装 Docker 引擎..."
yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

echo "-> 临时移除 daemon.json 测试启动..."
rm -f /etc/docker/daemon.json

echo "-> 启动/重启 Docker..."
if ! systemctl restart docker; then
    echo "❌ Docker 启动失败！详情："
    journalctl -u docker -n 50 --no-pager
    exit 1
fi

echo "-> 重新配置 Docker 镜像加速..."
echo '{"registry-mirrors": ["https://docker.m.daocloud.io", "https://docker.1panel.live", "https://mirror.baidubce.com"]}' > /etc/docker/daemon.json

echo "-> 重启 Docker 以应用配置..."
if ! systemctl restart docker; then
    echo "⚠️  配置镜像加速后 Docker 启动失败，正在尝试回退..."
    rm -f /etc/docker/daemon.json
    echo "-> 已删除自定义配置，尝试无加速启动..."
    if ! systemctl restart docker; then
        echo "❌ 无加速配置启动也失败了，请检查 Docker 安装。"
        exit 1
    fi
fi

systemctl enable docker
echo "-> 验证安装:"
docker compose version
EOF

# 上传安装脚本
scp install_docker_remote.sh $USER@$HOST:/tmp/install_docker_remote.sh

# 执行安装脚本
ssh -t $USER@$HOST "chmod +x /tmp/install_docker_remote.sh && bash /tmp/install_docker_remote.sh && rm -f /tmp/install_docker_remote.sh"

# 清理本地脚本
rm -f install_docker_remote.sh

if [ $? -ne 0 ]; then
    echo "Docker 安装失败，请检查密码或网络连接"
    exit 1
fi

# 2. 上传代码
echo -e "${GREEN}[2/3] 正在上传代码到服务器...${NC}"
rsync -avz --exclude 'node_modules' --exclude '__pycache__' --exclude 'backend/venv' --exclude '.git' --exclude '.DS_Store' --exclude 'backend/data/chroma_db' --exclude 'backend/data/sql_app.db' ./ $USER@$HOST:$PROJECT_DIR

if [ $? -ne 0 ]; then
    echo "代码上传失败"
    exit 1
fi

# 3. 启动服务
echo -e "${GREEN}[3/3] 正在配置并启动远程服务...${NC}"
# 读取本地 .env 内容 (为了简单起见，这里直接硬编码我们刚才看到的配置，或者让脚本读取)
# 这里我们采用读取本地文件内容并写入远程的方式，更加灵活

# 准备环境配置文件
if [ -f backend/.env ]; then
    ENV_FILE="backend/.env"
elif [ -f backend/.env.example ]; then
    echo -e "${GREEN}本地 backend/.env 不存在，将使用 backend/.env.example${NC}"
    ENV_FILE="backend/.env.example"
else
    echo "错误：找不到 backend/.env 或 backend/.env.example"
    exit 1
fi

# 上传 .env 文件
echo -e "${GREEN}正在上传环境配置...${NC}"
scp $ENV_FILE $USER@$HOST:$PROJECT_DIR/backend/.env

ssh -t $USER@$HOST "
    cd $PROJECT_DIR && \
    echo '-> 赋予脚本执行权限...' && \
    chmod +x deploy.sh && \
    echo '-> 启动服务...' && \
    ./deploy.sh
"

echo ""
echo -e "${GREEN}=== 部署完成！ ===${NC}"
echo -e "${GREEN}请访问: http://$HOST${NC}"
