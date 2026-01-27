# MCP Integration

Extend Dial Code with external tools via the Model Context Protocol.

---

## What is MCP?

The **Model Context Protocol (MCP)** is a standard for connecting AI assistants to external tools and data sources.

With MCP, you can:

- Add database access
- Connect to APIs
- Use specialized tools
- Share tools across projects

---

## Quick Start

Add an MCP server to your settings:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/path/to/allowed/dir"
      ]
    }
  }
}
```

---

## Configuration

### Basic Server

```json
{
  "mcpServers": {
    "server-name": {
      "command": "path/to/server",
      "args": ["--arg1", "value"]
    }
  }
}
```

### With Environment Variables

```json
{
  "mcpServers": {
    "github": {
      "command": "mcp-server-github",
      "env": {
        "GITHUB_TOKEN": "ghp_..."
      }
    }
  }
}
```

### Trust Settings

```json
{
  "mcpServers": {
    "trusted-server": {
      "command": "my-server",
      "trust": true
    }
  }
}
```

---

## Transport Types

### stdio (Default)

Server communicates via stdin/stdout:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "my-mcp-server"
    }
  }
}
```

### SSE (Server-Sent Events)

For HTTP-based servers:

```json
{
  "mcpServers": {
    "remote-server": {
      "url": "http://localhost:8080/sse"
    }
  }
}
```

---

## Popular MCP Servers

### Filesystem

Access files in specific directories:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/home/user/documents"
      ]
    }
  }
}
```

### GitHub

Interact with GitHub repositories:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "ghp_..."
      }
    }
  }
}
```

### PostgreSQL

Query PostgreSQL databases:

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "DATABASE_URL": "postgresql://user:pass@localhost/db"
      }
    }
  }
}
```

### Brave Search

Web search via Brave:

```json
{
  "mcpServers": {
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "..."
      }
    }
  }
}
```

---

## Managing Servers

### View Status

```
/mcp
```

Shows:

- Connected servers
- Available tools from each
- Connection status

### Tool Filtering

Include only specific tools:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "server",
      "includeTools": ["tool1", "tool2"]
    }
  }
}
```

Exclude tools:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "server",
      "excludeTools": ["dangerous-tool"]
    }
  }
}
```

---

## Creating MCP Servers

### Node.js Example

```javascript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server(
  {
    name: 'my-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler('tools/list', async () => ({
  tools: [
    {
      name: 'my_tool',
      description: 'Does something useful',
      inputSchema: {
        type: 'object',
        properties: {
          input: { type: 'string' },
        },
      },
    },
  ],
}));

server.setRequestHandler('tools/call', async (request) => {
  if (request.params.name === 'my_tool') {
    return {
      content: [{ type: 'text', text: 'Result' }],
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

### Python Example

```python
from mcp.server import Server
from mcp.server.stdio import stdio_server

server = Server("my-server")

@server.list_tools()
async def list_tools():
    return [{
        "name": "my_tool",
        "description": "Does something useful",
        "inputSchema": {
            "type": "object",
            "properties": {
                "input": {"type": "string"}
            }
        }
    }]

@server.call_tool()
async def call_tool(name: str, arguments: dict):
    if name == "my_tool":
        return {"content": [{"type": "text", "text": "Result"}]}

async def main():
    async with stdio_server() as (read, write):
        await server.run(read, write)
```

---

## Troubleshooting

### "Server Not Connected"

- Check the command path
- Verify the server is installed
- Check for error output

```bash
# Test manually
npx -y @modelcontextprotocol/server-filesystem /tmp
```

### "Tool Not Found"

- Verify server provides the tool
- Check `includeTools`/`excludeTools`
- Run `/mcp` to see available tools

### Environment Variables

Ensure env vars are set correctly:

```json
{
  "mcpServers": {
    "server": {
      "command": "server",
      "env": {
        "API_KEY": "${API_KEY}"
      }
    }
  }
}
```

---

## Resources

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [Official Servers](https://github.com/modelcontextprotocol/servers)
- [MCP SDK](https://github.com/modelcontextprotocol/sdk)

---

## Next Steps

- [File System](file-system.md) - Built-in file tools
- [Shell](shell.md) - Command execution
