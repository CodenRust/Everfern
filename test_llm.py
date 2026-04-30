
import os
import json
from langchain_openai import ChatOpenAI

def test_llm_config():
    provider = "ollama-cloud"
    base_url = "https://ollama.com"
    model = "qwen3-vl:235b-instruct-cloud"
    api_key = "dummy-key"

    llm_kwargs = {
        "model": model,
        "api_key": api_key,
        "temperature": 0.0,
        "max_retries": 3,
        "base_url": base_url
    }

    try:
        print(f"Initializing ChatOpenAI with base_url={base_url}, model={model}")
        llm = ChatOpenAI(**llm_kwargs)
        
        # Try a simple call
        print("Sending test message...")
        response = llm.invoke("Hello, how are you?")
        print(f"Response: {response.content}")
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    test_llm_config()
