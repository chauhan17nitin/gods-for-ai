// One call to the Gemini API with structured JSON output.

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export async function generateJson({ system, prompt, schema }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set (see arena/.env.example)");
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const res = await fetch(`${BASE}/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    signal: AbortSignal.timeout(45_000),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 1,
      },
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = body?.error?.message || res.statusText;
    const err = new Error(
      res.status === 429 ? `Gemini rate limit hit for ${model}. Wait a minute, or try GEMINI_MODEL=gemini-2.5-flash-lite.`
      : res.status === 503 ? `Gemini is overloaded right now (${model}). Try again shortly.`
      : `Gemini ${res.status}: ${message}`,
    );
    err.upstreamStatus = res.status;
    // 400/401/402/403: a bad key, no billing or a bad request. Retrying won't help.
    err.fatal = [400, 401, 402, 403].includes(res.status);
    // 429 and 503 are temporary: tell the caller how long to wait before retrying.
    if (res.status === 429 || res.status === 503) {
      const hinted = Number(message.match(/retry in ([\d.]+)s/i)?.[1]);
      err.retryAfterMs = Math.min(60_000, (hinted || (res.status === 429 ? 15 : 3)) * 1000 + 500);
    }
    throw err;
  }

  const blocked = body?.promptFeedback?.blockReason;
  if (blocked) throw new Error(`Gemini blocked the prompt: ${blocked}`);

  const candidate = body?.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error(`Gemini returned no text (finishReason: ${candidate?.finishReason ?? "unknown"})`);

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Gemini returned invalid JSON: ${text.slice(0, 120)}`);
  }
}
