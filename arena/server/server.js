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
import { isGod, loadSkill } from "./gods.js";
import { generateJson } from "./gemini.js";
import * as prisonersDilemma from "./games/prisoners-dilemma.js";
import * as splitSteal from "./games/split-steal.js";
import * as ultimatum from "./games/ultimatum.js";
import * as dollarAuction from "./games/dollar-auction.js";
import * as chicken from "./games/chicken.js";
import * as trust from "./games/trust.js";
import * as publicGoods from "./games/public-goods.js";

const ARENA_DIR = new URL("../", import.meta.url).pathname;
const PORT = Number(process.env.PORT) || 4173;
const GAMES = Object.fromEntries(
  [prisonersDilemma, splitSteal, ultimatum, dollarAuction, chicken, trust, publicGoods].map((g) => [g.id, g]),
);

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

  const game = GAMES[body.game];
  if (!game) return send(res, 400, { error: `unknown or unsupported game: ${body.game}` });
  if (!isGod(body.god)) return send(res, 400, { error: `unknown god: ${body.god}` });
  const prepared = game.prepare(body);
  if (prepared.error) return send(res, 400, { error: prepared.error });

  const system = await loadSkill(body.god);
  const { prompt, schema } = prepared;
  const tag = `[${body.game} r${body.round}${body.phase ? " " + body.phase : ""}]`;

  // Retries: a bad move or broken JSON is retried once right away; rate limits
  // and overloads (429/503) are waited out, as Gemini suggests, up to 4 tries.
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const started = Date.now();
      const raw = await generateJson({ system, prompt, schema });
      const result = game.parse(raw, body);
      const { line, ...choice } = result;
      console.log(`${tag} ${body.god.padEnd(5)} → ${JSON.stringify(choice).padEnd(26)} ${Date.now() - started}ms  "${line}"`);
      return send(res, 200, { god: body.god, round: body.round, ...result });
    } catch (err) {
      lastError = err;
      console.warn(`${tag} ${body.god} attempt ${attempt} failed: ${err.message}`);
      if (attempt === 4 || err.fatal) break;
      if (err.retryAfterMs) {
        console.warn(`  waiting ${(err.retryAfterMs / 1000).toFixed(1)}s before retrying`);
        await new Promise((r) => setTimeout(r, err.retryAfterMs));
      } else if (attempt >= 2) {
        break; // not a temporary error, and already retried once
      }
    }
  }
  // 502 = our server is fine, but the upstream it depends on (Gemini) failed.
  send(res, 502, {
    error: lastError.message,
    source: "gemini",
    upstreamStatus: lastError.upstreamStatus ?? null,
  });
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
  console.log(`Model: ${process.env.GEMINI_MODEL || "gemini-2.5-flash"}${process.env.GEMINI_API_KEY ? "" : "  (GEMINI_API_KEY missing!)"}`);
});
