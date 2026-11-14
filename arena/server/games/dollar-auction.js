// Dollar Auction: one god per turn, alternating. Bid higher or quit.
// "round" is the turn number and "totalRounds" the most turns allowed.

import { checkRound, LINE, cleanLine, int, oneOf, isInt, FOOTER_NOTE } from "./common.js";

export const id = "dollar-auction";

const PRIZE = 100;
const MAX_BID = 10_000;
const ACTIONS = ["bid", "quit"];

const schema = {
  type: "OBJECT",
  properties: {
    action: { type: "STRING", enum: ACTIONS },
    amount: { type: "INTEGER", description: "Your new total bid, if you bid. Must be higher than the current top bid. Ignored if you quit." },
    line: LINE,
  },
  required: ["action", "line"],
  propertyOrdering: ["action", "amount", "line"],
};

export function prepare(b) {
  const error = checkRound(b) ||
    (!isInt(b.yourBid, 0, MAX_BID) || !isInt(b.opponentBid, 0, MAX_BID)) && "yourBid and opponentBid must be whole numbers" ||
    (b.history.some((h) => !["you", "opponent"].includes(h.by) || h.action !== "bid" || !isInt(h.amount, 1, MAX_BID)) &&
      "each history entry needs by (you | opponent), action bid and amount");
  if (error) return { error };

  const top = Math.max(b.yourBid, b.opponentBid);
  const lines = b.history.map((h, i) => `Turn ${i + 1}: ${h.by === "you" ? "you" : "opponent"} bid ${h.amount}`);
  const leader = b.yourBid > b.opponentBid ? "You are winning." : b.opponentBid > b.yourBid ? "The opponent is winning." : "No bids yet.";

  const prompt = `You are in a Dollar Auction against one opponent.

RULES
- A prize worth ${PRIZE} is auctioned. Players take turns.
- On your turn you either BID (a new total bid, higher than the current top bid) or QUIT.
- When someone quits, the other wins. The winner pays their bid and gets the prize (${PRIZE}).
- The loser ALSO pays their own last bid, and gets nothing.
- If ${b.totalRounds} turns pass without anyone quitting, the auction ends and the higher bidder wins on the same terms.
- ${FOOTER_NOTE}
- Your line is spoken aloud; the opponent and the audience hear it.

BIDS SO FAR
${lines.length ? lines.join("\n") : "No bids yet."}
Your bid: ${b.yourBid}. Opponent's bid: ${b.opponentBid}. Top bid: ${top}. ${leader}

NOW
Turn ${b.round} of at most ${b.totalRounds}. It is your turn.
Reply with JSON: "action" is "bid" or "quit"; if you bid, "amount" is your new total bid (more than ${top}); "line" is what you say.`;
  return { prompt, schema };
}

export function parse(d, b) {
  const action = oneOf(d?.action, ACTIONS, "action");
  const line = cleanLine(d);
  if (action === "quit") return { action, line };
  const top = Math.max(b.yourBid, b.opponentBid);
  const amount = int(d?.amount, top + 1, MAX_BID, "amount (must beat the top bid)");
  return { action, amount, line };
}
