// The core of POST /api/move, shared by the local server (server.js) and the
// Vercel function (../../api/move.js). Takes a parsed body, returns { status, data }.

import { isGod, loadSkill } from "./gods.js";
import { generateJson } from "./gemini.js";
import * as prisonersDilemma from "./games/prisoners-dilemma.js";
import * as splitSteal from "./games/split-steal.js";
import * as ultimatum from "./games/ultimatum.js";
import * as dollarAuction from "./games/dollar-auction.js";
import * as chicken from "./games/chicken.js";
import * as trust from "./games/trust.js";
import * as publicGoods from "./games/public-goods.js";
import * as liarsDice from "./games/liars-dice.js";

const GAMES = Object.fromEntries(
  [prisonersDilemma, splitSteal, ultimatum, dollarAuction, chicken, trust, publicGoods, liarsDice].map((g) => [g.id, g]),
);

// deadline: a Date.now() timestamp after which we stop retrying and answer 502,
// so a host with a time limit (Vercel) gets a clean JSON error instead of a kill.
export async function move(body, { deadline = Infinity } = {}) {
  if (!body || typeof body !== "object") return { status: 400, data: { error: "body must be JSON" } };
  const game = GAMES[body.game];
  if (!game) return { status: 400, data: { error: `unknown or unsupported game: ${body.game}` } };
  if (!isGod(body.god)) return { status: 400, data: { error: `unknown god: ${body.god}` } };
  const prepared = game.prepare(body);
  if (prepared.error) return { status: 400, data: { error: prepared.error } };

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
      return { status: 200, data: { god: body.god, round: body.round, ...result } };
    } catch (err) {
      lastError = err;
      console.warn(`${tag} ${body.god} attempt ${attempt} failed: ${err.message}`);
      if (attempt === 4 || err.fatal) break;
      // Each further attempt may take up to 45s (the Gemini timeout) plus any wait.
      const wait = err.retryAfterMs || 0;
      if (Date.now() + wait + 45_000 > deadline) break;
      if (wait) {
        console.warn(`  waiting ${(wait / 1000).toFixed(1)}s before retrying`);
        await new Promise((r) => setTimeout(r, wait));
      } else if (attempt >= 2) {
        break; // not a temporary error, and already retried once
      }
    }
  }
  // 502 = our server is fine, but the upstream it depends on (Gemini) failed.
  return {
    status: 502,
    data: { error: lastError.message, source: "gemini", upstreamStatus: lastError.upstreamStatus ?? null },
  };
}
