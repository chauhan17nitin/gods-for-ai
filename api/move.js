// Vercel serverless function for POST /api/move. Same logic as the local
// server (arena/server/server.js); see arena/README.md for the request format.

import { move } from "../arena/server/move.js";

// Keep in sync with maxDuration in vercel.json: stop retrying ~20s before the
// platform would kill us, so the client still gets a JSON error.
const BUDGET_MS = 280_000;

export async function POST(request) {
  const started = Date.now();
  let body;
  try {
    const text = await request.text();
    if (text.length > 100_000) throw new Error("too large");
    body = JSON.parse(text || "{}");
  } catch {
    return Response.json({ error: "body must be JSON" }, { status: 400 });
  }
  try {
    const { status, data } = await move(body, { deadline: started + BUDGET_MS });
    return Response.json(data, { status });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "server error" }, { status: 500 });
  }
}
