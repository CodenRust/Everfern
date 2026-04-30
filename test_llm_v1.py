
import os
import json
from langchain_openai import ChatOpenAI

def test_llm_config_v1():
    provider = "ollama-cloud"
    base_url = "https://ollama.com/v1" # Try /v1
    model = "qwen3-vl:235b-instruct-cloud"
    api_key = "4bfc7222979f45bea3a3ed2f28c6615b.ClFf7AYYHFbfNPuSYk5TeRDN"

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
    test_llm_config_v1()
