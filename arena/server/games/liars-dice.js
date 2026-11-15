// Liar's Dice: hidden dice, rising bids, and calling the bluff.
// One god per turn, like the Dollar Auction. "round" is the turn number and
// "totalRounds" the most turns allowed.
//
// Extra request fields:
//   yourDice            your hidden dice this hand, e.g. [2, 5, 5]
//   opponentDiceCount   how many dice the opponent has left
//   currentBid          null at the start of a hand, else { quantity, face, by: "you" | "opponent" }
//   history[]           one entry per finished turn:
//                       { hand, by, action: "bid", quantity, face }
//                       { hand, by, action: "call", quantity, face, count, loser, yourDice, opponentDice }

import { checkRound, LINE, cleanLine, int, oneOf, isInt, FOOTER_NOTE, SILENT } from "./common.js";

export const id = "liars-dice";

const MAX_DICE = 5;
const ACTIONS = ["bid", "call"];
const SIDES = ["you", "opponent"];

const schema = {
  type: "OBJECT",
  properties: {
    action: { type: "STRING", enum: ACTIONS },
    quantity: { type: "INTEGER", description: "If you bid: how many dice, among ALL dice on the table, show the face. Ignored if you call." },
    face: { type: "INTEGER", description: "If you bid: the face value, 1 to 6. Ignored if you call." },
    line: LINE,
  },
  required: ["action", "line"],
  propertyOrdering: ["action", "quantity", "face", "line"],
};

const isDice = (a) => Array.isArray(a) && a.length >= 1 && a.length <= MAX_DICE && a.every((d) => isInt(d, 1, 6));
const beats = (q, f, bid) => !bid || q > bid.quantity || (q === bid.quantity && f > bid.face);
const bidText = (q, f) => `${q} × ${f}s`;

function checkHistory(h) {
  if (!isInt(h.hand, 1, 100) || !SIDES.includes(h.by) || !ACTIONS.includes(h.action)) return false;
  if (!isInt(h.quantity, 1, MAX_DICE * 2) || !isInt(h.face, 1, 6)) return false;
  if (h.action === "call") return isInt(h.count, 0, MAX_DICE * 2) && SIDES.includes(h.loser) && isDice(h.yourDice) && isDice(h.opponentDice);
  return true;
}

function describe(history) {
  const lines = [];
  let hand = 0;
  for (const h of history) {
    if (h.hand !== hand) { hand = h.hand; lines.push(`Hand ${hand}:`); }
    const who = h.by === "you" ? "You" : "Opponent";
    if (h.action === "bid") { lines.push(`  ${who} bid ${bidText(h.quantity, h.face)}.`); continue; }
    lines.push(`  ${who} called LIAR on ${bidText(h.quantity, h.face)}. Your dice: ${h.yourDice.join(" ")}. Opponent's dice: ${h.opponentDice.join(" ")}.`);
    lines.push(`  There were ${h.count} × ${h.face}s, so the bid ${h.count >= h.quantity ? "stood" : "was false"}. ${h.loser === "you" ? "You" : "The opponent"} lost a die.`);
  }
  return lines.length ? lines.join("\n") : "Nothing yet. This is the first turn.";
}

export function prepare(b) {
  const bid = b.currentBid;
  const error = checkRound(b) ||
    (!isDice(b.yourDice) && `yourDice must be 1 to ${MAX_DICE} whole numbers from 1 to 6`) ||
    (!isInt(b.opponentDiceCount, 1, MAX_DICE) && `opponentDiceCount must be 1 to ${MAX_DICE}`) ||
    (bid != null && (!isInt(bid.quantity, 1, MAX_DICE * 2) || !isInt(bid.face, 1, 6) || !SIDES.includes(bid.by)) &&
      "currentBid must be null or { quantity, face, by }") ||
    (!b.history.every(checkHistory) && "each history entry needs hand, by, action, quantity, face (and the reveal for a call)");
  if (error) return { error };

  const total = b.yourDice.length + b.opponentDiceCount;
  const canRaise = !bid || bid.quantity < total || bid.face < 6;
  const now = !bid
    ? `A new hand. You open the bidding, so you must bid.`
    : `The current bid is ${bidText(bid.quantity, bid.face)}, made by ${bid.by === "you" ? "you" : "the opponent"}. ${canRaise ? "Raise it or call LIAR." : "No higher bid exists, so you must call LIAR."}`;

  const prompt = `You are playing Liar's Dice against one opponent.

RULES
- Each player rolls their own dice in secret. You see only yours.
- Players take turns. On your turn you either BID or CALL LIAR.
- A bid claims that, among ALL dice on the table (yours and the opponent's), at least QUANTITY dice show FACE. There are no wild dice.
- A new bid must be higher: more dice, or the same number of dice with a higher face.
- Calling LIAR ends the hand. All dice are shown. If at least QUANTITY dice show FACE, the bid stands and the caller loses a die. If not, the bidder loses a die.
- The loser of a hand opens the next one. Lose all your dice and you lose the match.
- If ${b.totalRounds} turns pass first, whoever has won more hands wins.
- Bids do not have to be true. ${FOOTER_NOTE}
- ${SILENT}

THE TABLE
Your dice: ${b.yourDice.join(" ")} (${b.yourDice.length} dice).
The opponent has ${b.opponentDiceCount} hidden dice. ${total} dice in all.

WHAT HAS HAPPENED
${describe(b.history)}

NOW
Turn ${b.round} of at most ${b.totalRounds}. ${now}
Reply with JSON: "action" is "bid" or "call"; if you bid, "quantity" (1 to ${total}) and "face" (1 to 6); "line" is what you say.`;
  // Offer only the legal actions: no call before a bid, no bid when none can beat it.
  const actions = !bid ? ["bid"] : canRaise ? ACTIONS : ["call"];
  return { prompt, schema: { ...schema, properties: { ...schema.properties, action: { type: "STRING", enum: actions } } } };
}

export function parse(d, b) {
  const bid = b.currentBid;
  const total = b.yourDice.length + b.opponentDiceCount;
  const action = oneOf(d?.action, ACTIONS, "action");
  const line = cleanLine(d);
  if (action === "call") {
    if (!bid) throw new Error("invalid action: cannot call LIAR before any bid");
    return { action, line };
  }
  const quantity = int(d?.quantity, 1, total, "quantity");
  const face = int(d?.face, 1, 6, "face");
  if (!beats(quantity, face, bid)) throw new Error(`invalid bid: ${bidText(quantity, face)} does not beat ${bidText(bid.quantity, bid.face)}`);
  return { action, quantity, face, line };
}
