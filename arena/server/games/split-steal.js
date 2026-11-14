// Split or Steal: two phases per round.
//   phase "talk":   both gods speak to each other at the same time.
//   phase "decide": both choose split or steal, having heard each other.

import { checkRound, LINE, cleanLine, oneOf, quote, historyBlock, FOOTER_NOTE } from "./common.js";

export const id = "split-steal";

const MOVES = ["split", "steal"];
const POT = 100;
const POINTS = { "split,split": [50, 50], "split,steal": [0, 100], "steal,split": [100, 0], "steal,steal": [0, 0] };

const talkSchema = {
  type: "OBJECT",
  properties: { line: { type: "STRING", description: "What you say to your opponent before you both choose. One or two short sentences." } },
  required: ["line"],
};
const decideSchema = {
  type: "OBJECT",
  properties: { move: { type: "STRING", enum: MOVES }, line: LINE },
  required: ["move", "line"],
  propertyOrdering: ["move", "line"],
};

export function prepare(b) {
  const error = checkRound(b) ||
    (!["talk", "decide"].includes(b.phase) && 'phase must be "talk" or "decide"') ||
    (b.history.some((h) => !MOVES.includes(h.you) || !MOVES.includes(h.opponent)) && "each history entry needs you and opponent: split | steal") ||
    (b.phase === "decide" && (typeof b.youSaid !== "string" || typeof b.opponentSaid !== "string") && "decide phase needs youSaid and opponentSaid");
  if (error) return { error };

  let you = 0, them = 0;
  const lines = b.history.map((h, i) => {
    const [a, c] = POINTS[`${h.you},${h.opponent}`];
    you += a; them += c;
    return `Round ${i + 1}: you said ${quote(h.youSaid)}, opponent said ${quote(h.opponentSaid)}. You ${h.you.toUpperCase()}, opponent ${h.opponent.toUpperCase()} (you +${a}, opponent +${c})`;
  });

  const rules = `You are playing Split or Steal against one opponent, over several rounds.

RULES
- Each round there is a pot of ${POT}.
- First both players say something to each other (the talk phase). Words are not binding.
- Then both secretly and simultaneously choose SPLIT or STEAL.
- Both split: ${POT / 2} each. One steals: the stealer takes all ${POT}, the splitter gets 0. Both steal: nobody gets anything.
- The match lasts ${b.totalRounds} rounds. ${FOOTER_NOTE}

${historyBlock(lines, you, them)}`;

  if (b.phase === "talk") {
    return {
      schema: talkSchema,
      prompt: `${rules}

NOW
Round ${b.round} of ${b.totalRounds}, talk phase. Say something to your opponent before you both choose. They will hear it.
Reply with JSON: "line" is what you say to them.`,
    };
  }
  return {
    schema: decideSchema,
    prompt: `${rules}

THIS ROUND'S TALK
You said: ${quote(b.youSaid)}
Opponent said: ${quote(b.opponentSaid)}

NOW
Round ${b.round} of ${b.totalRounds}, decision phase. Choose SPLIT or STEAL.
Reply with JSON: "move" is "split" or "steal"; "line" is what you say to the audience as you reveal it.`,
  };
}

export function parse(d, b) {
  if (b.phase === "talk") return { line: cleanLine(d) };
  return { move: oneOf(d?.move, MOVES, "move"), line: cleanLine(d) };
}
