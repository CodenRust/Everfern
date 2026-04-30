
import os
import json
from langchain_ollama import ChatOllama

def test_ollama_config():
    provider = "ollama-cloud"
    base_url = "https://ollama.com"
    model = "qwen3-vl:235b-instruct-cloud"

    try:
        print(f"Initializing ChatOllama with base_url={base_url}, model={model}")
        # ChatOllama expects base_url without /api/chat as it appends it internally or uses the client
        llm = ChatOllama(model=model, base_url=base_url)
        
        # Try a simple call
        print("Sending test message...")
        response = llm.invoke("Hello, how are you?")
        print(f"Response: {response.content}")
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    test_ollama_config()
