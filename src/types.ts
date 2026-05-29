// OpenRouter API request/response types for multimodal vision
// Discriminated union for image source: URL or local file path

export interface OpenRouterMessage {
  role: "user";
  content: ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];
}

export interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
}

export interface OpenRouterResponse {
  choices: { message: { content: string } }[];
}
