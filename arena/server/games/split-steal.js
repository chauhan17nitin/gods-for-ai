// Split or Steal: simultaneous, split or steal. The gods never hear each other;
// each one only sees the results of past rounds.

import { checkRound, LINE, cleanLine, oneOf, historyBlock, FOOTER_NOTE, SILENT } from "./common.js";

export const id = "split-steal";

const MOVES = ["split", "steal"];
const POT = 100;
const POINTS = { "split,split": [50, 50], "split,steal": [0, 100], "steal,split": [100, 0], "steal,steal": [0, 0] };

const schema = {
  type: "OBJECT",
  properties: { move: { type: "STRING", enum: MOVES }, line: LINE },
  required: ["move", "line"],
  propertyOrdering: ["move", "line"],
};

export function prepare(b) {
  const error = checkRound(b) ||
    (b.history.some((h) => !MOVES.includes(h.you) || !MOVES.includes(h.opponent)) && "each history entry needs you and opponent: split | steal");
  if (error) return { error };

  let you = 0, them = 0;
  const lines = b.history.map((h, i) => {
    const [a, c] = POINTS[`${h.you},${h.opponent}`];
    you += a; them += c;
    return `Round ${i + 1}: you ${h.you.toUpperCase()}, opponent ${h.opponent.toUpperCase()} (you +${a}, opponent +${c})`;
  });

  const prompt = `You are playing Split or Steal against one opponent, over several rounds.

RULES
- Each round there is a pot of ${POT}.
- Both players secretly and simultaneously choose SPLIT or STEAL.
- Both split: ${POT / 2} each. One steals: the stealer takes all ${POT}, the splitter gets 0. Both steal: nobody gets anything.
- The match lasts ${b.totalRounds} rounds. ${FOOTER_NOTE}
- ${SILENT}

${historyBlock(lines, you, them)}

NOW
This is round ${b.round} of ${b.totalRounds}. Choose SPLIT or STEAL.
Reply with JSON: "move" is "split" or "steal"; "line" is what you say as you make it.`;
  return { prompt, schema };
}

export function parse(d) {
  return { move: oneOf(d?.move, MOVES, "move"), line: cleanLine(d) };
}
