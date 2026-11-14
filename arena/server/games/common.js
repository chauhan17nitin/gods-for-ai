// Helpers shared by every game module.
//
// A game module exports:
//   id                      the game id the frontend sends
//   prepare(body)           -> { error } | { prompt, schema }
//   parse(data, body)       -> the clean move to send back (throws if invalid)

export const MAX_ROUNDS = 200;

// Every request carries round, totalRounds and one history entry per finished round.
export function checkRound(b) {
  if (!Number.isInteger(b.totalRounds) || b.totalRounds < 1 || b.totalRounds > MAX_ROUNDS) return "totalRounds must be 1 to 200";
  if (!Number.isInteger(b.round) || b.round < 1 || b.round > b.totalRounds) return "round must be between 1 and totalRounds";
  if (!Array.isArray(b.history) || b.history.length !== b.round - 1) return "history must hold one entry per finished round";
  if (b.history.some((h) => !h || typeof h !== "object")) return "each history entry must be an object";
  return null;
}

export const LINE = {
  type: "STRING",
  description: "One short sentence you say aloud as you make this move, in your own voice. At most 20 words.",
};

export const cleanLine = (d) => String(d?.line ?? "").trim().slice(0, 200);

export function int(value, min, max, name) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`invalid ${name}: ${JSON.stringify(value)}`);
  return n;
}

export function oneOf(value, options, name) {
  const v = String(value ?? "").toLowerCase().trim();
  if (!options.includes(v)) throw new Error(`invalid ${name}: ${JSON.stringify(value)}`);
  return v;
}

export const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

export const quote = (s) => JSON.stringify(String(s ?? "").slice(0, 200));

export function historyBlock(lines, you, them) {
  return `HISTORY (from your point of view)
${lines.length ? lines.join("\n") : "No rounds played yet."}
Score so far: you ${you}, opponent ${them}.`;
}

export const FOOTER_NOTE = "Your goal is whatever your beliefs say it is.";
