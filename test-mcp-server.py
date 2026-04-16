#!/usr/bin/env python3
"""
EverFern Test MCP Server

A simple MCP server demonstrating tools and resources for testing.
Run with: python test-mcp-server.py

Or add to EverFern via the MCP integration config.
"""

import asyncio
import json
from typing import Any

from mcp.server import Server
from mcp.types import Tool
from mcp.server.stdio import stdio_server


class TestMCPServer:
    def __init__(self):
        self.server = Server("everfern-test")
        self._setup_handlers()
        self.counter = 0

    def _setup_handlers(self):
        @self.server.list_tools()
        async def list_tools() -> list[Tool]:
            return [
                Tool(
                    name="echo",
                    description="Echoes back the input text",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "text": {"type": "string", "description": "Text to echo back"},
                            "uppercase": {"type": "boolean", "description": "Convert to uppercase", "default": False}
                        },
                        "required": ["text"]
                    }
                ),
                Tool(
                    name="add",
                    description="Adds two numbers together",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "a": {"type": "number", "description": "First number"},
                            "b": {"type": "number", "description": "Second number"}
                        },
                        "required": ["a", "b"]
                    }
                ),
                Tool(
                    name="get_counter",
                    description="Get the current counter value",
                    inputSchema={"type": "object", "properties": {}}
                ),
                Tool(
                    name="increment",
                    description="Increment the counter by 1",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "amount": {"type": "number", "description": "Amount to increment by", "default": 1}
                        }
                    }
                ),
                Tool(
                    name="get_system_info",
                    description="Get system information",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "info_type": {
                                "type": "string",
                                "description": "Type of info to retrieve",
                                "enum": ["platform", "python", "memory", "cpu"]
                            }
                        }
                    }
                ),
                Tool(
                    name="list_files",
                    description="List files in a directory",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "path": {"type": "string", "description": "Directory path to list"},
                            "limit": {"type": "number", "description": "Max files to return", "default": 10}
                        }
                    }
                )
            ]

        @self.server.call_tool()
        async def call_tool(name: str, arguments: dict[str, Any] | None) -> Any:
            if arguments is None:
                arguments = {}

            if name == "echo":
                text = arguments.get("text", "")
                uppercase = arguments.get("uppercase", False)
                result = text.upper() if uppercase else text
                return json.dumps({"result": result})

            elif name == "add":
                a = arguments.get("a", 0)
                b = arguments.get("b", 0)
                return json.dumps({"result": a + b})

            elif name == "get_counter":
                return json.dumps({"counter": self.counter})

            elif name == "increment":
                amount = arguments.get("amount", 1)
                self.counter += amount
                return json.dumps({"counter": self.counter, "increment": amount})

            elif name == "get_system_info":
                import platform
                import sys

                info_type = arguments.get("info_type", "platform")

                if info_type == "platform":
                    return json.dumps({
                        "system": platform.system(),
                        "release": platform.release(),
                        "version": platform.version(),
                        "machine": platform.machine()
                    })
                elif info_type == "python":
                    return json.dumps({
                        "version": sys.version,
                        "executable": sys.executable
                    })
                elif info_type == "cpu":
                    try:
                        import multiprocessing
                        return json.dumps({
                            "count": multiprocessing.cpu_count()
                        })
                    except:
                        return json.dumps({"count": 1})

            elif name == "list_files":
                import os
                target_path = arguments.get("path", ".")
                limit = arguments.get("limit", 10)

                try:
                    files = os.listdir(target_path)
                    file_list = []
                    for f in files[:limit]:
                        full_path = os.path.join(target_path, f)
                        stat = os.stat(full_path)
                        file_list.append({
                            "name": f,
                            "is_dir": os.path.isdir(full_path),
                            "size": stat.st_size
                        })
                    return json.dumps({"path": target_path, "files": file_list})
                except Exception as e:
                    return json.dumps({"error": str(e)})

            return json.dumps({"error": f"Unknown tool: {name}"})


async def main():
    server = TestMCPServer()
    from mcp.server.stdio import stdio_server
    async with stdio_server() as (read_stream, write_stream):
        await server.server.run(
            read_stream,
            write_stream,
            server.server.create_initialization_options()
        )


if __name__ == "__main__":
    asyncio.run(main())
