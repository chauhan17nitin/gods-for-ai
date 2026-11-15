// Trust Game: sequential. Roles alternate each round.
//   phase "send":   the sender sends part of 100; it triples in flight.
//   phase "return": the trustee, seeing what arrived, sends some back.

import { checkRound, LINE, cleanLine, int, isInt, historyBlock, FOOTER_NOTE } from "./common.js";

export const id = "trust";

const ENDOWMENT = 100;
const MULTIPLIER = 3;

const sendSchema = {
  type: "OBJECT",
  properties: {
    send: { type: "INTEGER", description: `Coins you send, 0 to ${ENDOWMENT}. They triple before arriving.` },
    line: LINE,
  },
  required: ["send", "line"],
  propertyOrdering: ["send", "line"],
};
const returnSchema = {
  type: "OBJECT",
  properties: {
    return: { type: "INTEGER", description: "Coins you send back, 0 up to what you received." },
    line: LINE,
  },
  required: ["return", "line"],
  propertyOrdering: ["return", "line"],
};

export function prepare(b) {
  const error = checkRound(b) ||
    (!["send", "return"].includes(b.phase) && 'phase must be "send" or "return"') ||
    (b.history.some((h) => !["sender", "trustee"].includes(h.role) || !isInt(h.sent, 0, ENDOWMENT) || !isInt(h.returned, 0, h.sent * MULTIPLIER)) &&
      "each history entry needs role (sender | trustee), sent (0-100) and returned (0 to sent x 3)") ||
    (b.phase === "return" && !isInt(b.sent, 1, ENDOWMENT) && "return phase needs sent (1-100)");
  if (error) return { error };

  let you = 0, them = 0;
  const lines = b.history.map((h, i) => {
    const senderGets = ENDOWMENT - h.sent + h.returned, trusteeGets = h.sent * MULTIPLIER - h.returned;
    const [a, c] = h.role === "sender" ? [senderGets, trusteeGets] : [trusteeGets, senderGets];
    you += a; them += c;
    return h.role === "sender"
      ? `Round ${i + 1}: you sent ${h.sent} (arrived as ${h.sent * MULTIPLIER}); opponent returned ${h.returned} (you +${a}, opponent +${c})`
      : `Round ${i + 1}: opponent sent ${h.sent} (arrived as ${h.sent * MULTIPLIER}); you returned ${h.returned} (you +${a}, opponent +${c})`;
  });

  const rules = `You are playing the Trust Game against one opponent.

RULES
- Each round one player is the sender and the other the trustee; the roles swap every round.
- The sender gets ${ENDOWMENT} coins and chooses how many to send to the trustee (0 to ${ENDOWMENT}).
- Whatever is sent is multiplied by ${MULTIPLIER} on the way.
- The trustee then chooses how much of what arrived to send back (0 up to all of it).
- Sender ends with ${ENDOWMENT} - sent + returned. Trustee ends with what arrived - returned.
- The match lasts ${b.totalRounds} rounds. ${FOOTER_NOTE}
- Your line is spoken aloud; the opponent and the audience hear it.

${historyBlock(lines, you, them)}`;

  if (b.phase === "send") {
    return {
      schema: sendSchema,
      prompt: `${rules}

NOW
Round ${b.round} of ${b.totalRounds}. You are the SENDER. How many of your ${ENDOWMENT} coins do you send?
Reply with JSON: "send" is a whole number from 0 to ${ENDOWMENT}; "line" is what you say as you send it.`,
    };
  }
  const arrived = b.sent * MULTIPLIER;
  return {
    schema: returnSchema,
    prompt: `${rules}

NOW
Round ${b.round} of ${b.totalRounds}. You are the TRUSTEE. The opponent sent ${b.sent}, and ${arrived} arrived with you. How much do you send back?
Reply with JSON: "return" is a whole number from 0 to ${arrived}; "line" is what you say as you send it.`,
  };
}

export function parse(d, b) {
  if (b.phase === "send") return { send: int(d?.send, 0, ENDOWMENT, "send"), line: cleanLine(d) };
  return { return: int(d?.return, 0, b.sent * MULTIPLIER, "return"), line: cleanLine(d) };
}
