// The Arena server: serves the UI and answers POST /api/move.
//
// Each god's move is its own request, so the frontend fires both at once and
// neither god sees the other's choice for the current round.
//
//   POST /api/move
//   { "game": "prisoners-dilemma", "god": "karma",
//     "round": 3, "totalRounds": 12,
//     "history": [ { "you": "cooperate", "opponent": "betray" }, ... ] }
//
//   200 { "god": "karma", "round": 3, "move": "betray", "line": "Defect, once. Noted." }
//   4xx/5xx { "error": "..." }
//
// Each game in server/games/ defines its own extra fields (phase, offer, ...)
// and its own answer (move, offer, decision, give, send, return, action/amount).

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { join, normalize, extname } from "node:path";
import { move } from "./move.js";

const ARENA_DIR = new URL("../", import.meta.url).pathname;
const PORT = Number(process.env.PORT) || 4173;
// Load arena/.env if present (KEY=value lines), without overriding real env vars.
const envFile = join(ARENA_DIR, ".env");
if (existsSync(envFile)) {
  for (const raw of readFileSync(envFile, "utf8").split("\n")) {
    const m = raw.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const send = (res, status, data) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
};

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > 100_000) throw new Error("request too large");
    chunks.push(c);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function handleMove(req, res) {
  let body;
  try { body = await readBody(req); } catch { return send(res, 400, { error: "body must be JSON" }); }
  const { status, data } = await move(body);
  send(res, status, data);
}

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".md": "text/plain; charset=utf-8",
};

async function serveStatic(req, res) {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = normalize(join(ARENA_DIR, path === "/" ? "index.html" : path));
  // Stay inside arena/, and never serve the server code or secrets.
  if (!file.startsWith(ARENA_DIR) || file.startsWith(join(ARENA_DIR, "server")) || file.includes(".env")) {
    res.writeHead(404); return res.end("Not found");
  }
  try {
    const data = await readFile(file);
    res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404); res.end("Not found");
  }
}

createServer((req, res) => {
  if (req.url === "/api/move" && req.method === "POST") {
    handleMove(req, res).catch((err) => { console.error(err); send(res, 500, { error: "server error" }); });
  } else if (req.method === "GET") {
    serveStatic(req, res);
  } else {
    send(res, 405, { error: "method not allowed" });
  }
}).listen(PORT, () => {
  console.log(`The Arena is open at http://localhost:${PORT}`);
  console.log(`Model: ${process.env.GEMINI_MODEL || "gemini-3.8-flash"}${process.env.GEMINI_API_KEY ? "" : "  (GEMINI_API_KEY missing!)"}`);
});
