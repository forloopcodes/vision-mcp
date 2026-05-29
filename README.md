# vision-mcp

An MCP server that helps non-vision models extract and understand images and screenshots via OpenRouter multimodal models.

## Features

- **`analyze_image`** — Send an image (local file or URL) with a text prompt to any OpenRouter vision model and get a natural-language response.
- **`screen`** — Capture a screenshot of an application window by PID or process name (Windows only, uses `PrintWindow` via PowerShell).

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ (ESM)
- An [OpenRouter](https://openrouter.ai/) API key with access to a vision-capable model

## Setup

```bash
# Clone and install
git clone <your-repo>
cd vision-mcp
npm install

# Configure environment
cp .env.example .env
```

Edit `.env` and set your OpenRouter key and preferred model:

```env
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=google/gemini-2.0-flash-lite-preview-02-05:free
```

### Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENROUTER_API_KEY` | Yes | — | Your OpenRouter API key |
| `OPENROUTER_MODEL` | Yes | — | Model identifier (e.g. `google/gemma-4-31b-it:free`) |
| `OPENROUTER_BASE_URL` | No | `https://openrouter.ai/api/v1` | API base URL override |
| `MAX_IMAGE_MB` | No | `20` | Maximum allowed image size in MB |

## Build & Run

```bash
npm run build
npm start
```

The server uses stdio transport and is designed to be launched by an MCP-enabled host (e.g. Claude, OpenCode). Example configuration block for your MCP client:

```json
{
  "mcpServers": {
    "vision-mcp": {
      "command": "node",
      "args": ["path/to/vision-mcp/dist/server.js"],
      "env": {
        "OPENROUTER_API_KEY": "sk-or-v1-...",
        "OPENROUTER_MODEL": "google/gemma-4-31b-it:free"
      }
    }
  }
}
```

## Tools

### `analyze_image`

Analyze an image using a vision model.

**Arguments:**
| Name | Type | Required | Description |
|---|---|---|---|
| `prompt` | `string` | Yes | Instruction for the vision model |
| `image` | `string` | Yes | Local file path or `http`/`https` URL |

Local images are loaded, validated (size, path scope), and sent as base64 data URIs. Remote URLs are passed through directly.

### `screen`

Capture a screenshot of a running application window (Windows only).

**Arguments:**
| Name | Type | Required | Description |
|---|---|---|---|
| `action` | `"capture"` | Yes | The capture action |
| `target` | `string` | No | Process name to find and capture (e.g. `wezterm`, `notepad`) |
| `pid` | `number` | No | Process ID to capture |

Provide either `target` or `pid`. The server uses `PrintWindow` via a compiled C# snippet invoked through PowerShell. Supports `PW_RENDERFULLCONTENT` for DPI-aware captures.

> [!NOTE]
> Screen capture requires the `System.Drawing` assembly and works on Windows only. The captured PNG is written to the system temp directory.

## Architecture

```
src/
├── server.ts          # MCP server entry point, tool routing
├── image.ts           # Image loading, validation, base64 encoding
├── openrouter.ts      # OpenRouter API client (multimodal chat completions)
├── types.ts           # Shared TypeScript interfaces for API payloads
└── screen/
    ├── index.ts       # Platform abstraction for screen capture
    └── windows.ts     # PowerShell + Win32 implementation (PrintWindow)
```

The server runs on the [Model Context Protocol SDK](https://github.com/modelcontextprotocol/typescript-sdk) with stdio transport. Image analysis requests are forwarded to OpenRouter's `/chat/completions` endpoint with a 60-second timeout. Security boundaries are enforced at the image loader — only files within the working directory are accepted.

## Security

- Local image paths are checked against the project root to prevent directory traversal.
- Screen captures are written to the OS temp directory (`$TMPDIR`).
- The PowerShell execution uses `-ExecutionPolicy Bypass` for the embedded C# script; no external `.ps1` files are written to disk.

## License

MIT
