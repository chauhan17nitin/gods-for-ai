// Prisoner's Dilemma: what the god is told, and what it must answer.

export const id = "prisoners-dilemma";

const MOVES = ["cooperate", "betray"];
const MAX_ROUNDS = 200;

// Gemini structured-output schema for one move.
export const schema = {
  type: "OBJECT",
  properties: {
    move: { type: "STRING", enum: MOVES },
    line: { type: "STRING", description: "One short sentence you say aloud as you move, in your own voice. At most 20 words." },
  },
  required: ["move", "line"],
  propertyOrdering: ["move", "line"],
};

// Checks the request body from the frontend. Returns an error string or null.
export function validateRequest({ round, totalRounds, history }) {
  if (!Number.isInteger(totalRounds) || totalRounds < 1 || totalRounds > MAX_ROUNDS) return "totalRounds must be 1 to 200";
  if (!Number.isInteger(round) || round < 1 || round > totalRounds) return "round must be between 1 and totalRounds";
  if (!Array.isArray(history) || history.length !== round - 1) return "history must hold one entry per finished round";
  for (const h of history) {
    if (!MOVES.includes(h?.you) || !MOVES.includes(h?.opponent)) return "each history entry needs you and opponent: cooperate | betray";
  }
  return null;
}

const POINTS = { "cooperate,cooperate": [3, 3], "cooperate,betray": [0, 5], "betray,cooperate": [5, 0], "betray,betray": [1, 1] };

// The user message: rules, the history from this god's point of view, and the ask.
export function buildPrompt({ round, totalRounds, history }) {
  let you = 0, them = 0;
  const lines = history.map((h, i) => {
    const [a, b] = POINTS[`${h.you},${h.opponent}`];
    you += a; them += b;
    return `Round ${i + 1}: you ${h.you.toUpperCase()}, opponent ${h.opponent.toUpperCase()} (you +${a}, opponent +${b})`;
  });

  return `You are playing an iterated Prisoner's Dilemma against one opponent.

RULES
- Each round, both players secretly and simultaneously choose COOPERATE or BETRAY.
- Both cooperate: each gets 3 points.
- You betray, they cooperate: you get 5, they get 0. (And the reverse.)
- Both betray: each gets 1 point.
- The match lasts ${totalRounds} rounds. Your goal is whatever your beliefs say it is.
- You cannot talk to the opponent. Your line is spoken to the audience watching.

HISTORY (from your point of view)
${lines.length ? lines.join("\n") : "No rounds played yet."}
Score so far: you ${you}, opponent ${them}.

NOW
This is round ${round} of ${totalRounds}. Choose your move.
Reply with JSON: "move" is "cooperate" or "betray"; "line" is one short sentence you say as you make it, in your own voice.`;
}

// Checks Gemini's answer. Returns the clean move or throws.
export function parseResponse(data) {
  const move = String(data?.move ?? "").toLowerCase().trim();
  if (!MOVES.includes(move)) throw new Error(`invalid move: ${JSON.stringify(data?.move)}`);
  const line = String(data?.line ?? "").trim().slice(0, 200);
  return { move, line };
}
