// Load, validate, and base64-encode local images
// Remote URLs passed through directly as-is

import { readFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, normalize } from "node:path";

const ALLOWED = [process.cwd(), tmpdir()].map((p) => { try { return realpathSync(p); } catch { return normalize(p); } });
const MIME: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".bmp": "image/bmp",
};

function mimeOf(p: string): string {
  const e = p.toLowerCase().match(/\.\w+$/)?.[0];
  return (e && MIME[e]) || "image/png";
}

export function resolveImage(input: string, maxMb: number): string {
  if (input.startsWith("http://") || input.startsWith("https://")) return input;
  const abs = isAbsolute(input) ? input : normalize(input);
  const norm = normalize(abs);
  if (!ALLOWED.some((d) => norm === d || norm.startsWith(d + "\\") || norm.startsWith(d + "/")))
    throw new Error(`File outside allowed directory: ${input}`);
  const raw = readFileSync(abs);
  if (raw.length > maxMb * 1024 * 1024) throw new Error(`Image exceeds ${maxMb}MB limit`);
  return `data:${mimeOf(abs)};base64,${raw.toString("base64")}`;
}
