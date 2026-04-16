#!/usr/bin/env python3
"""
Simple MCP Test for EverFern

Tests basic MCP server functionality.
"""

import asyncio
import json
import sys
from mcp import stdio_client

async def test_mcp():
    """Test MCP server with simple requests"""
    print("🧪 Testing EverFern MCP Server...")

    try:
        async with stdio_client("python", "test-mcp-server.py") as (read, write):
            print("✅ Connected to MCP server")

            # Initialize
            init_msg = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "test", "version": "1.0"}
                }
            }

            await write.send(json.dumps(init_msg))
            response = await read.receive()
            print(f"📋 Init: {response}")

            # Initialized notification
            await write.send(json.dumps({
                "jsonrpc": "2.0",
                "method": "notifications/initialized"
            }))

            # List tools
            await write.send(json.dumps({
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/list"
            }))

            tools_resp = await read.receive()
            print(f"🔧 Tools: {tools_resp}")

            # Test echo
            await write.send(json.dumps({
                "jsonrpc": "2.0",
                "id": 3,
                "method": "tools/call",
                "params": {
                    "name": "echo",
                    "arguments": {"text": "Hello!", "uppercase": True}
                }
            }))

            echo_resp = await read.receive()
            print(f"📤 Echo: {echo_resp}")

            print("✅ MCP test completed!")
            return True

    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_mcp())
    sys.exit(0 if success else 1)
