#!/usr/bin/env node
// CLI entry for npx visionmcp — starts MCP server on stdio
import { start } from "./server.js";
start().catch((e) => { console.error("Fatal:", e); process.exit(1); });
