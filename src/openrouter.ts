// Send multimodal requests to OpenRouter vision models
// Handles auth, timeout, and structured response parsing

import { OpenRouterRequest, OpenRouterResponse } from "./types.js";

const TIMEOUT = 60_000;

export async function analyzeImage(apiKey: string, model: string, baseUrl: string, prompt: string, imageUri: string): Promise<string> {
  const body: OpenRouterRequest = {
    model,
    messages: [{
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: imageUri } },
      ],
    }],
  };
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT);
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text().catch(() => "no body")}`);
    const data: OpenRouterResponse = await res.json();
    const c = data.choices?.[0]?.message?.content;
    if (!c) throw new Error("OpenRouter returned empty response");
    return c;
  } finally { clearTimeout(timer); }
}
