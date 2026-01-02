pipeline {
    agent any

    environment {
        // 请在 Jenkins 全局配置或项目配置中设置这些环境变量，或者直接修改这里
        // 建议使用 Jenkins Credentials Binding 插件来管理敏感信息
        REMOTE_HOST = '47.96.23.187'
        REMOTE_USER = 'root'
        PROJECT_DIR = '/root/rag-project'
        // Jenkins 凭据 ID (需要在 Jenkins 中添加 SSH 私钥凭据)
        SSH_CREDENTIAL_ID = 'aliyun-ssh-key' 
    }

    stages {
        stage('Prepare') {
            steps {
                script {
                    echo '正在检查代码...'
                    // 如果你的 Jenkinsfile 不在代码库根目录，这里可能需要 checkout scm
                }
            }
        }

        stage('Deploy to Server') {
            steps {
                sshagent(credentials: [SSH_CREDENTIAL_ID]) {
                    script {
                        def remote = "${REMOTE_USER}@${REMOTE_HOST}"
                        
                        echo "1. 创建远程目录..."
                        sh "ssh -o StrictHostKeyChecking=no ${remote} 'mkdir -p ${PROJECT_DIR}'"

                        echo "2. 同步代码 (Rsync)..."
                        // 排除不需要的文件，保持传输高效
                        sh """
                            rsync -avz \
                            --exclude 'node_modules' \
                            --exclude '__pycache__' \
                            --exclude 'backend/venv' \
                            --exclude '.git' \
                            --exclude 'backend/data' \
                            -e "ssh -o StrictHostKeyChecking=no" \
                            ./ ${remote}:${PROJECT_DIR}
                        """

                        echo "3. 执行远程部署脚本..."
                        // 这里我们复用项目已有的 deploy.sh
                        sh """
                            ssh -o StrictHostKeyChecking=no ${remote} "
                                cd ${PROJECT_DIR} && 
                                chmod +x deploy.sh && 
                                ./deploy.sh
                            "
                        """
                    }
                }
            }
        }
    }

    post {
        success {
            echo '部署成功！'
        }
        failure {
            echo '部署失败，请检查日志。'
        }
    }
}
