import os
import sys
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI

# 加载 .env 文件
backend_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(backend_dir, ".env")
load_dotenv(env_path)

def check_api_status():
    print("=" * 50)
    print("RAG API 配置检查工具")
    print("=" * 50)
    print(f"正在读取配置文件: {env_path}")

    api_key = os.getenv("OPENAI_API_KEY")
    api_base = os.getenv("OPENAI_API_BASE")
    model_name = os.getenv("LLM_MODEL_NAME", "gpt-3.5-turbo")
    use_mock = os.getenv("USE_MOCK_RAG", "false")

    print(f"USE_MOCK_RAG: {use_mock}")
    print(f"API Base: {api_base}")
    print(f"Model: {model_name}")
    
    if not api_key:
        print("\n[错误] 未找到 OPENAI_API_KEY 环境变量。")
        return

    if "在此处填入" in api_key:
        print("\n[错误] 检测到 API Key 仍为默认占位符！")
        print("请打开 backend/.env 文件，填入您真实的 API Key。")
        return

    print(f"API Key: {api_key[:5]}...{api_key[-4:]} (格式检查通过)")

    print("\n正在尝试连接 API 进行测试...")
    try:
        llm = ChatOpenAI(
            model_name=model_name,
            openai_api_key=api_key,
            openai_api_base=api_base,
            temperature=0.7,
            timeout=10
        )
        response = llm.invoke("你好，这是一个测试。请回复 'API 连接成功'。")
        print(f"\n[成功] API 连接正常！")
        print(f"模型回复: {response.content}")
        print("\n现在您可以重启后端服务，体验真实的 RAG 功能了。")
    except Exception as e:
        print(f"\n[失败] API 连接失败: {str(e)}")
        print("请检查您的 API Key 是否正确，或网络连接是否通畅。")

if __name__ == "__main__":
    check_api_status()
