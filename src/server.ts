// MCP server: analyze_image (vision) + screen (capture) tools
// Routes tool calls to OpenRouter vision or native screen capture

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { resolveImage } from "./image.js";
import { analyzeImage } from "./openrouter.js";
import { capture } from "./screen/index.js";

function getEnv(n: string): string { const v = process.env[n]; if (!v?.trim()) throw new Error(`Missing required env: ${n}`); return v.trim(); }

export async function start() {
  const cfg = {
    apiKey: getEnv("OPENROUTER_API_KEY"),
    model: getEnv("OPENROUTER_MODEL"),
    baseUrl: process.env.OPENROUTER_BASE_URL?.trim() || "https://openrouter.ai/api/v1",
    maxMb: Number(process.env.MAX_IMAGE_MB) || 20,
  };
  const server = new Server(
    { name: "vision-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "analyze_image",
        description: "Send an image (URL or local path) with a prompt to a vision model via OpenRouter",
        inputSchema: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "Instruction for the vision model" },
            image: { type: "string", description: "Local file path or http/https URL" },
          },
          required: ["prompt", "image"],
        },
      },
      {
        name: "screen",
        description: "Capture a screenshot of an application window by PID or process name (e.g. wezterm)",
        inputSchema: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["capture"], description: "Capture action (only capture for now)" },
            target: { type: "string", description: "Process name (e.g. wezterm, notepad)" },
            pid: { type: "number", description: "Process ID to capture" },
          },
          required: ["action"],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;

    if (name === "analyze_image") {
      const { prompt, image } = (args ?? {}) as { prompt?: string; image?: string };
      if (!prompt || !image) throw new Error("Missing required arguments: prompt, image");
      try {
        const uri = resolveImage(image, cfg.maxMb);
        const text = await analyzeImage(cfg.apiKey, cfg.model, cfg.baseUrl, prompt, uri);
        return { content: [{ type: "text" as const, text }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }] };
      }
    }

    if (name === "screen") {
      const a = (args ?? {}) as { action?: string; target?: string; pid?: number };
      if (a.action !== "capture") throw new Error(`Unknown screen action: ${a.action}`);
      const hasTarget = typeof a.target === "string" && a.target.length > 0;
      const hasPid = typeof a.pid === "number" && a.pid > 0;
      if (!hasTarget && !hasPid) throw new Error("Provide either target (process name) or pid");
      try {
        const result = capture(hasPid ? a.pid : undefined, hasTarget ? a.target : undefined);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }] };
      }
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  const t = new StdioServerTransport();
  await server.connect(t);
}
