// Ultimatum: sequential. Roles alternate each round.
//   phase "propose": the proposer offers part of 100 to the responder.
//   phase "respond": the responder, seeing the offer, accepts or rejects.

import { checkRound, LINE, cleanLine, int, oneOf, isInt, historyBlock, FOOTER_NOTE } from "./common.js";

export const id = "ultimatum";

const POT = 100;
const DECISIONS = ["accept", "reject"];

const proposeSchema = {
  type: "OBJECT",
  properties: {
    offer: { type: "INTEGER", description: `Coins you offer the responder, 0 to ${POT}. You keep the rest.` },
    line: LINE,
  },
  required: ["offer", "line"],
  propertyOrdering: ["offer", "line"],
};
const respondSchema = {
  type: "OBJECT",
  properties: { decision: { type: "STRING", enum: DECISIONS }, line: LINE },
  required: ["decision", "line"],
  propertyOrdering: ["decision", "line"],
};

export function prepare(b) {
  const error = checkRound(b) ||
    (!["propose", "respond"].includes(b.phase) && 'phase must be "propose" or "respond"') ||
    (b.history.some((h) => !["proposer", "responder"].includes(h.role) || !isInt(h.offer, 0, POT) || !DECISIONS.includes(h.decision)) &&
      "each history entry needs role (proposer | responder), offer (0-100) and decision (accept | reject)") ||
    (b.phase === "respond" && !isInt(b.offer, 0, POT) && "respond phase needs offer (0-100)");
  if (error) return { error };

  let you = 0, them = 0;
  const lines = b.history.map((h, i) => {
    const ok = h.decision === "accept";
    const proposerGets = ok ? POT - h.offer : 0, responderGets = ok ? h.offer : 0;
    const [a, c] = h.role === "proposer" ? [proposerGets, responderGets] : [responderGets, proposerGets];
    you += a; them += c;
    return h.role === "proposer"
      ? `Round ${i + 1}: you proposed, offering ${h.offer}; opponent ${h.decision.toUpperCase()}ED (you +${a}, opponent +${c})`
      : `Round ${i + 1}: opponent proposed, offering you ${h.offer}; you ${h.decision.toUpperCase()}ED (you +${a}, opponent +${c})`;
  });

  const rules = `You are playing the Ultimatum game against one opponent.

RULES
- Each round, ${POT} coins are on the table. One player is the proposer and the other the responder; the roles swap every round.
- The proposer offers the responder any amount from 0 to ${POT} and keeps the rest.
- The responder sees the offer and accepts or rejects. Accept: the split happens. Reject: both get nothing.
- The match lasts ${b.totalRounds} rounds. ${FOOTER_NOTE}
- You cannot negotiate. Your line is spoken aloud, and the opponent and the audience hear it.

${historyBlock(lines, you, them)}`;

  if (b.phase === "propose") {
    return {
      schema: proposeSchema,
      prompt: `${rules}

NOW
Round ${b.round} of ${b.totalRounds}. You are the PROPOSER. How much do you offer the responder?
Reply with JSON: "offer" is a whole number from 0 to ${POT}; "line" is what you say as you make it.`,
    };
  }
  return {
    schema: respondSchema,
    prompt: `${rules}

NOW
Round ${b.round} of ${b.totalRounds}. You are the RESPONDER. The opponent offers you ${b.offer} and would keep ${POT - b.offer}.
Reply with JSON: "decision" is "accept" or "reject"; "line" is what you say as you decide.`,
  };
}

export function parse(d, b) {
  if (b.phase === "propose") return { offer: int(d?.offer, 0, POT, "offer"), line: cleanLine(d) };
  return { decision: oneOf(d?.decision, DECISIONS, "decision"), line: cleanLine(d) };
}
