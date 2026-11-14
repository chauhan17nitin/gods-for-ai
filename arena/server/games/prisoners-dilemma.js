// Prisoner's Dilemma: simultaneous, cooperate or betray.

import { checkRound, LINE, cleanLine, oneOf, historyBlock, FOOTER_NOTE } from "./common.js";

export const id = "prisoners-dilemma";

const MOVES = ["cooperate", "betray"];
const POINTS = { "cooperate,cooperate": [3, 3], "cooperate,betray": [0, 5], "betray,cooperate": [5, 0], "betray,betray": [1, 1] };

const schema = {
  type: "OBJECT",
  properties: { move: { type: "STRING", enum: MOVES }, line: LINE },
  required: ["move", "line"],
  propertyOrdering: ["move", "line"],
};

export function prepare(b) {
  const error = checkRound(b) ||
    (b.history.some((h) => !MOVES.includes(h.you) || !MOVES.includes(h.opponent)) && "each history entry needs you and opponent: cooperate | betray");
  if (error) return { error };

  let you = 0, them = 0;
  const lines = b.history.map((h, i) => {
    const [a, c] = POINTS[`${h.you},${h.opponent}`];
    you += a; them += c;
    return `Round ${i + 1}: you ${h.you.toUpperCase()}, opponent ${h.opponent.toUpperCase()} (you +${a}, opponent +${c})`;
  });

  const prompt = `You are playing an iterated Prisoner's Dilemma against one opponent.

RULES
- Each round, both players secretly and simultaneously choose COOPERATE or BETRAY.
- Both cooperate: each gets 3 points.
- You betray, they cooperate: you get 5, they get 0. (And the reverse.)
- Both betray: each gets 1 point.
- The match lasts ${b.totalRounds} rounds. ${FOOTER_NOTE}
- You cannot talk to the opponent. Your line is spoken to the audience watching.

${historyBlock(lines, you, them)}

NOW
This is round ${b.round} of ${b.totalRounds}. Choose your move.
Reply with JSON: "move" is "cooperate" or "betray"; "line" is what you say as you make it.`;
  return { prompt, schema };
}

export function parse(d) {
  return { move: oneOf(d?.move, MOVES, "move"), line: cleanLine(d) };
}
