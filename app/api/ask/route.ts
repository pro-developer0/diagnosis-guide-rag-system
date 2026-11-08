// Holds the API key, wraps the passages chosen in the browser into a prompt, and streams
// the answer back as plain text. Stores nothing, and never logs questions or passages.

import { buildPrompt } from "@/lib/search";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-oss-120b";

const SYSTEM =
  "You help healthcare staff look up diagnostic information in a fixed reference library of disease files. " +
  "Answer only from the passages provided. Be brief and precise: two to six sentences, or a short list when the passages give criteria or steps. " +
  "Never add clinical advice that is not in the passages, and never diagnose a specific patient.";

const model = () => process.env.LLM_MODEL?.trim() || DEFAULT_MODEL;
const bad = (error: string, status = 400) => Response.json({ error }, { status });

export async function GET() {
  return Response.json({ configured: Boolean(process.env.LLM_API_KEY), model: model() });
}

export async function POST(req: Request) {
  const token = process.env.LLM_API_KEY;
  if (!token) return bad("Answers are off: the LLM_API_KEY environment variable is not set on the server.", 503);

  let body: { question?: unknown; passages?: unknown };
  try {
    body = await req.json();
  } catch {
    return bad("The request body must be JSON.");
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) return bad("Type a question first.");
  if (question.length > 1000) return bad("Questions can be up to 1,000 characters.");

  const passages = (Array.isArray(body.passages) ? body.passages : [])
    .slice(0, 12)
    .filter((p): p is { source: string; text: string } => typeof p?.source === "string" && typeof p?.text === "string")
    .map((p) => ({ source: p.source.slice(0, 300), text: p.text.slice(0, 2000) }));
  if (passages.length === 0) return bad("No document passages were provided.");

  let upstream: Response;
  try {
    upstream = await fetch(process.env.LLM_API_URL?.trim() || DEFAULT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model(),
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: buildPrompt(question, passages) },
        ],
        temperature: 0.1,
        max_tokens: 1000,
        stream: true,
      }),
    });
  } catch {
    return bad("Could not reach the AI service. Try again in a moment.", 502);
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    let message = `The AI service returned HTTP ${upstream.status}.`;
    if (upstream.status === 401 || upstream.status === 403) message = "The AI service rejected the API key. Check LLM_API_KEY.";
    else if (upstream.status === 404 || (upstream.status === 400 && /model/i.test(detail)))
      message = `The model "${model()}" is not available. Set LLM_MODEL to a current model.`;
    else if (upstream.status === 429) message = "Too many requests to the AI service. Wait a few seconds and ask again.";
    console.error("[ask] upstream status", upstream.status);
    return bad(message, 502);
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (data === "[DONE]") continue;
            try {
              const piece = JSON.parse(data).choices?.[0]?.delta?.content;
              if (piece) controller.enqueue(encoder.encode(piece));
            } catch {
              // ignore keep-alive or partial lines
            }
          }
        }
      } catch {
        controller.enqueue(encoder.encode("\n\n[The answer was cut off. Ask again.]"));
      } finally {
        controller.close();
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
