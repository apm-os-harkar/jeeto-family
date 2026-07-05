// ============================================================
//  Jeeto — Skyvos AI endpoint  (Cloudflare Pages Function)
//  File location in your repo:  functions/ai.js   ->  serves /ai
//  Needs env var:  ANTHROPIC_API_KEY  (set in Cloudflare Pages settings)
//  Powers: Memory Book stories, Jeeto Chat, Heritage — all call /ai
// ============================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json"
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: "not_configured", text: "" });
    }

    let body = {};
    try { body = await request.json(); } catch (_) {}

    const mode  = (body.mode || "general").toString();
    const brief = (body.brief || body.prompt || "").toString().slice(0, 6000);

    let system =
      "You are Skyvos, a warm, gentle storyteller inside Jeeto, a private family app. " +
      "Write briefly, kindly, and specifically to the details given. " +
      "Never invent names of people or places that aren't implied. Never mention that you are an AI.";

    let userText = brief;

    if (mode === "memory") {
      system =
        "You are Skyvos, the family storyteller inside Jeeto. From a short factual brief about ONE day of a family's photos, " +
        "write a warm, human travel-diary entry. FORMAT: first line = a short evocative TITLE (max 6 words, no quotes); " +
        "then a blank line; then 2 short paragraphs (2-3 gentle sentences each). " +
        "Turn facts (times, counts, places) into feeling rather than stating them mechanically. " +
        "Do NOT invent people's names. Never say you are an AI.";
      userText = brief || "A quiet family day. Write a warm short diary entry.";
    }

    const payload = {
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: system,
      messages: (Array.isArray(body.messages) && body.messages.length)
        ? body.messages
        : [{ role: "user", content: userText }]
    };

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(payload)
    });

    const data = await r.json();
    if (!r.ok) {
      return json({ error: "api_error", detail: data, text: "" });
    }

    let text = "";
    if (data && Array.isArray(data.content)) {
      text = data.content.filter(b => b.type === "text").map(b => b.text).join("\n").trim();
    }
    return json({ text: text, answer: text });

  } catch (err) {
    return json({ error: "server_error", message: String(err), text: "" });
  }
}

function json(obj) {
  return new Response(JSON.stringify(obj), { status: 200, headers: CORS });
}
