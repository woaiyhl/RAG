pipeline {
    agent any

    environment {
        REMOTE_HOST = '47.96.23.187'
        REMOTE_USER = 'root'
        PROJECT_DIR = '/root/rag-project'
        SSH_CREDENTIAL_ID = 'aliyun-ssh-key' 
    }

    stages {
        stage('Deploy') {
            steps {
                sshagent(credentials: [SSH_CREDENTIAL_ID]) {
                    script {
                        def remote = "${REMOTE_USER}@${REMOTE_HOST}"
                        
                        echo "正在部署分支: ${env.BRANCH_NAME}"
                        
                        // 1. 同步代码
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

                        // 2. 远程执行部署
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
}
