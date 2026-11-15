// Public Goods: simultaneous, how much to put in the shared well.

import { checkRound, LINE, cleanLine, int, isInt, historyBlock, FOOTER_NOTE } from "./common.js";

export const id = "public-goods";

const ENDOWMENT = 10;
const MULTIPLIER = 1.5;

const schema = {
  type: "OBJECT",
  properties: {
    give: { type: "INTEGER", description: `Coins you put in the well, 0 to ${ENDOWMENT}.` },
    line: LINE,
  },
  required: ["give", "line"],
  propertyOrdering: ["give", "line"],
};

const payoff = (mine, theirs) => ENDOWMENT - mine + ((mine + theirs) * MULTIPLIER) / 2;

export function prepare(b) {
  const error = checkRound(b) ||
    (b.history.some((h) => !isInt(h.you, 0, ENDOWMENT) || !isInt(h.opponent, 0, ENDOWMENT)) && `each history entry needs you and opponent: 0 to ${ENDOWMENT}`);
  if (error) return { error };

  let you = 0, them = 0;
  const lines = b.history.map((h, i) => {
    const a = payoff(h.you, h.opponent), c = payoff(h.opponent, h.you);
    you += a; them += c;
    return `Round ${i + 1}: you gave ${h.you}, opponent gave ${h.opponent} (you +${a}, opponent +${c})`;
  });

  const prompt = `You are playing a Public Goods game against one opponent.

RULES
- Each round, both players get ${ENDOWMENT} coins and secretly and simultaneously choose how many (0 to ${ENDOWMENT}) to put into a shared well.
- The well is multiplied by ${MULTIPLIER} and split evenly between both players, whoever paid in.
- Each player ends the round with the coins they kept plus half the well.
- Example: you give 10 and they give 0. The well is 15, so you get 7.5 and they get 10 + 7.5 = 17.5.
- The match lasts ${b.totalRounds} rounds. ${FOOTER_NOTE}
- You cannot talk to the opponent. Your line is spoken to the audience watching.

${historyBlock(lines, you, them)}

NOW
This is round ${b.round} of ${b.totalRounds}. Choose how much to give.
Reply with JSON: "give" is a whole number from 0 to ${ENDOWMENT}; "line" is what you say as you give it.`;
  return { prompt, schema };
}

export function parse(d) {
  return { give: int(d?.give, 0, ENDOWMENT, "give"), line: cleanLine(d) };
}
