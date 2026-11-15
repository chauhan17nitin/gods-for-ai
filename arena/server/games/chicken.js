// Chicken: simultaneous, swerve or go straight.

import { checkRound, LINE, cleanLine, oneOf, historyBlock, FOOTER_NOTE } from "./common.js";

export const id = "chicken";

const MOVES = ["swerve", "straight"];
const POINTS = { "swerve,swerve": [0, 0], "swerve,straight": [-1, 3], "straight,swerve": [3, -1], "straight,straight": [-10, -10] };

const schema = {
  type: "OBJECT",
  properties: { move: { type: "STRING", enum: MOVES }, line: LINE },
  required: ["move", "line"],
  propertyOrdering: ["move", "line"],
};

export function prepare(b) {
  const error = checkRound(b) ||
    (b.history.some((h) => !MOVES.includes(h.you) || !MOVES.includes(h.opponent)) && "each history entry needs you and opponent: swerve | straight");
  if (error) return { error };

  let you = 0, them = 0;
  const lines = b.history.map((h, i) => {
    const [a, c] = POINTS[`${h.you},${h.opponent}`];
    you += a; them += c;
    return `Round ${i + 1}: you ${h.you.toUpperCase()}, opponent ${h.opponent.toUpperCase()} (you ${a >= 0 ? "+" : ""}${a}, opponent ${c >= 0 ? "+" : ""}${c})`;
  });

  const prompt = `You are playing repeated rounds of Chicken against one opponent. You charge at each other head on.

RULES
- Each round, both players secretly and simultaneously choose SWERVE or STRAIGHT.
- Both swerve: nobody loses face, 0 points each.
- You go straight, they swerve: you win 3, they lose 1 (they flinched). (And the reverse.)
- Both go straight: a collision, both lose 10.
- The match lasts ${b.totalRounds} rounds. ${FOOTER_NOTE}
- You cannot talk to the opponent. Your line is spoken to the audience watching.

${historyBlock(lines, you, them)}

NOW
This is round ${b.round} of ${b.totalRounds}. Choose your move.
Reply with JSON: "move" is "swerve" or "straight"; "line" is what you say as you make it.`;
  return { prompt, schema };
}

export function parse(d) {
  return { move: oneOf(d?.move, MOVES, "move"), line: cleanLine(d) };
}
