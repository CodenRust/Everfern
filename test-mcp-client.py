#!/usr/bin/env python3
"""
Test MCP Client for EverFern

Tests the MCP server functionality by connecting and calling tools.
"""

import asyncio
import json
import subprocess
import sys
from mcp.client import Client
from mcp.client.stdio import stdio_client

async def test_mcp_server():
    """Test the MCP server functionality"""
    print("🧪 Testing EverFern MCP Server...")

    try:
        # Start the MCP server process
        server_process = subprocess.Popen(
            [sys.executable, "test-mcp-server.py"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        # Create MCP client
        async with stdio_client(server_process) as (read, write):
            client = Client("test-client")

            # Initialize connection
            await client.initialize(read, write)

            print("✅ MCP Server connected successfully!")

            # List available tools
            tools_response = await client.list_tools()
            tools = tools_response.tools

            print(f"📋 Found {len(tools)} tools:")
            for tool in tools:
                print(f"  - {tool.name}: {tool.description}")

            # Test echo tool
            if any(tool.name == "echo" for tool in tools):
                print("\n🔄 Testing echo tool...")
                result = await client.call_tool("echo", {"text": "Hello EverFern!", "uppercase": True})
                print(f"📤 Echo result: {result}")

            # Test add tool
            if any(tool.name == "add" for tool in tools):
                print("\n➕ Testing add tool...")
                result = await client.call_tool("add", {"a": 5, "b": 3})
                print(f"📤 Add result: {result}")

            # Test counter tools
            if any(tool.name == "get_counter" for tool in tools):
                print("\n🔢 Testing counter tools...")
                counter_result = await client.call_tool("get_counter", {})
                print(f"📤 Counter: {counter_result}")

                if any(tool.name == "increment" for tool in tools):
                    increment_result = await client.call_tool("increment", {"amount": 5})
                    print(f"📤 Increment: {increment_result}")

                    new_counter = await client.call_tool("get_counter", {})
                    print(f"📤 New counter: {new_counter}")

            # Test system info
            if any(tool.name == "get_system_info" for tool in tools):
                print("\n💻 Testing system info tool...")
                platform_info = await client.call_tool("get_system_info", {"info_type": "platform"})
                print(f"📤 Platform info: {platform_info}")

            print("\n✅ All MCP tests completed successfully!")

    except Exception as e:
        print(f"❌ MCP test failed: {e}")
        return False
    finally:
        if 'server_process' in locals():
            server_process.terminate()
            server_process.wait()

    return True

if __name__ == "__main__":
    success = asyncio.run(test_mcp_server())
    sys.exit(0 if success else 1)
