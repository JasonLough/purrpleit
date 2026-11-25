const BASE_URL = (process.env.LLM_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, "");
const API_KEY = process.env.LLM_API_KEY || "";
const MODEL = process.env.LLM_MODEL || "";

export function llmConfigured() {
  return Boolean(MODEL);
}

export function llmInfo() {
  return { baseUrl: BASE_URL, model: MODEL, hasKey: Boolean(API_KEY) };
}

type ChatOptions = {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
};

export async function chat({ system, user, temperature = 0.7, maxTokens = 3000 }: ChatOptions) {
  if (!MODEL) throw new Error("LLM_MODEL is not set (see .env.example)");
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "purrpleit",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM returned an empty response");
  return content;
}

/** Ask for JSON and parse it, tolerating code fences and chatter around the payload. */
export async function chatJson<T>(opts: ChatOptions): Promise<T> {
  const raw = await chat({
    ...opts,
    system: `${opts.system}\n\nRespond with ONLY valid JSON. No markdown, no code fences, no commentary.`,
  });
  return extractJson<T>(raw);
}

export function extractJson<T>(raw: string): T {
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.search(/[[{]/);
  if (start === -1) throw new Error(`No JSON in LLM output: ${raw.slice(0, 200)}`);
  const open = cleaned[start];
  const close = open === "{" ? "}" : "]";
  const end = cleaned.lastIndexOf(close);
  if (end <= start) throw new Error(`Unterminated JSON in LLM output: ${raw.slice(0, 200)}`);
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}
