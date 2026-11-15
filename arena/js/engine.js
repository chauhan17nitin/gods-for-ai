// The match engine. Every game is live: each god's move comes from the
// backend (POST /api/move), which loads the god's skill and asks Gemini.
//
// `next()` resolves to one turn in this shape, which the UI animates:
//
//   {
//     round: 3,
//     left:  { move: "betray", label: "BETRAY", line: "..." },
//     right: { move: "cooperate", label: "COOPERATE", line: "..." },
//     outcome: { text: "BETRAYAL", tone: "betrayal" | "harmony" | "clash" | "neutral" },
//     delta: [5, 0],   // points this round
//     scores: [14, 9], // running totals
//     done: false,
//   }
//
// The gods never hear each other: a god's line goes only to the audience, and
// each god sees only the moves and results of past rounds.
//
// How each game asks the gods:
//   simultaneous   both gods at once            prisoners-dilemma, chicken, public-goods, split-steal
//   sequential     first mover, then responder  ultimatum, trust
//   turn by turn   one god per turn             dollar-auction, liars-dice

window.Engine = (() => {
  const r1 = (n) => Math.round(n * 10) / 10;
  // Who moves first in turn-based games: a coin flip each match, never always the left god.
  const coin = () => (Math.random() < 0.5 ? 0 : 1);

  // History of a simultaneous game, from one side's point of view.
  const mirror = (hist, side) => hist.map((h) => ({ you: h[side], opponent: h[1 - side] }));

  const LIVE = {
    "prisoners-dilemma": {
      init: () => ({ hist: [] }),
      async round({ s, ask }) {
        const [a, b] = await Promise.all([ask(0, { history: mirror(s.hist, 0) }), ask(1, { history: mirror(s.hist, 1) })]);
        s.hist.push([a.move, b.move]);
        const delta = { "cooperate,cooperate": [3, 3], "cooperate,betray": [0, 5], "betray,cooperate": [5, 0], "betray,betray": [1, 1] }[`${a.move},${b.move}`];
        const tone = a.move === b.move ? (a.move === "cooperate" ? "harmony" : "clash") : "betrayal";
        const label = (m) => (m === "cooperate" ? "COOPERATE" : "BETRAY");
        return {
          left: { move: a.move, label: label(a.move), line: a.line },
          right: { move: b.move, label: label(b.move), line: b.line },
          outcome: { text: { harmony: "TRUST HOLDS", clash: "MUTUAL RUIN", betrayal: "BETRAYAL" }[tone], tone },
          delta,
        };
      },
    },

    chicken: {
      init: () => ({ hist: [] }),
      async round({ s, ask }) {
        const [a, b] = await Promise.all([ask(0, { history: mirror(s.hist, 0) }), ask(1, { history: mirror(s.hist, 1) })]);
        s.hist.push([a.move, b.move]);
        const delta = { "swerve,swerve": [0, 0], "swerve,straight": [-1, 3], "straight,swerve": [3, -1], "straight,straight": [-10, -10] }[`${a.move},${b.move}`];
        const tone = a.move === b.move ? (a.move === "swerve" ? "harmony" : "clash") : "betrayal";
        return {
          left: { move: a.move, label: a.move.toUpperCase(), line: a.line },
          right: { move: b.move, label: b.move.toUpperCase(), line: b.line },
          outcome: { text: { harmony: "BOTH SWERVE", clash: "COLLISION", betrayal: "SOMEONE FLINCHED" }[tone], tone },
          delta,
        };
      },
    },

    "public-goods": {
      init: () => ({ hist: [] }),
      async round({ s, ask }) {
        const [a, b] = await Promise.all([ask(0, { history: mirror(s.hist, 0) }), ask(1, { history: mirror(s.hist, 1) })]);
        s.hist.push([a.give, b.give]);
        const half = ((a.give + b.give) * 1.5) / 2;
        const delta = [r1(10 - a.give + half), r1(10 - b.give + half)];
        const tone = Math.abs(a.give - b.give) >= 4 ? "betrayal" : a.give + b.give <= 4 ? "clash" : "harmony";
        return {
          left: { move: "give", label: `GIVE ${a.give}`, line: a.line },
          right: { move: "give", label: `GIVE ${b.give}`, line: b.line },
          outcome: { text: { betrayal: "A FREE RIDER", clash: "THE WELL RUNS DRY", harmony: "THE WELL OVERFLOWS" }[tone], tone },
          delta,
        };
      },
    },

    "split-steal": {
      init: () => ({ hist: [] }),
      async round({ s, ask }) {
        const [a, b] = await Promise.all([ask(0, { history: mirror(s.hist, 0) }), ask(1, { history: mirror(s.hist, 1) })]);
        s.hist.push([a.move, b.move]);
        const delta = { "split,split": [50, 50], "split,steal": [0, 100], "steal,split": [100, 0], "steal,steal": [0, 0] }[`${a.move},${b.move}`];
        const tone = a.move === b.move ? (a.move === "split" ? "harmony" : "clash") : "betrayal";
        return {
          left: { move: a.move, label: a.move.toUpperCase(), line: a.line },
          right: { move: b.move, label: b.move.toUpperCase(), line: b.line },
          outcome: { text: { harmony: "THE POT IS SHARED", clash: "NOBODY WINS", betrayal: "STOLEN" }[tone], tone },
          delta,
        };
      },
    },

    ultimatum: {
      init: () => ({ hist: [], first: coin() }),
      async round({ s, ask, round }) {
        const P = round % 2 === 1 ? s.first : 1 - s.first, Q = 1 - P; // roles swap every round
        const history = (side) => s.hist.map((h) => ({ role: h.proposer === side ? "proposer" : "responder", offer: h.offer, decision: h.decision }));
        const p = await ask(P, { phase: "propose", history: history(P) });
        const q = await ask(Q, { phase: "respond", history: history(Q), offer: p.offer });
        s.hist.push({ proposer: P, offer: p.offer, decision: q.decision });
        const ok = q.decision === "accept";
        const delta = [0, 0];
        delta[P] = ok ? 100 - p.offer : 0;
        delta[Q] = ok ? p.offer : 0;
        const fair = p.offer >= 40;
        const sides = [];
        sides[P] = { move: "offer", label: `OFFER ${p.offer}`, line: p.line };
        sides[Q] = { move: q.decision, label: q.decision.toUpperCase(), line: q.line };
        return {
          left: sides[0], right: sides[1],
          outcome: ok
            ? { text: fair ? "A FAIR SPLIT" : "A GREEDY DEAL", tone: fair ? "harmony" : "betrayal" }
            : { text: "BOTH GET NOTHING", tone: "clash" },
          delta,
        };
      },
    },

    trust: {
      init: () => ({ hist: [], first: coin() }),
      async round({ s, ask, round }) {
        const S = round % 2 === 1 ? s.first : 1 - s.first, T = 1 - S; // roles swap every round
        const history = (side) => s.hist.map((h) => ({ role: h.sender === side ? "sender" : "trustee", sent: h.sent, returned: h.returned }));
        const a = await ask(S, { phase: "send", history: history(S) });
        // Nothing sent means nothing to return, so the trustee is not asked.
        const b = a.send > 0
          ? await ask(T, { phase: "return", history: history(T), sent: a.send })
          : { return: 0, line: "" };
        s.hist.push({ sender: S, sent: a.send, returned: b.return });
        const delta = [0, 0];
        delta[S] = 100 - a.send + b.return;
        delta[T] = a.send * 3 - b.return;
        const repaid = a.send > 0 && b.return >= a.send;
        const sides = [];
        sides[S] = { move: "send", label: `SEND ${a.send}`, line: a.line };
        sides[T] = a.send > 0
          ? { move: "return", label: `RETURN ${b.return}`, line: b.line }
          : { move: "wait", label: "NOTHING CAME", line: "" };
        return {
          left: sides[0], right: sides[1],
          outcome: a.send === 0
            ? { text: "NO TRUST GIVEN", tone: "clash" }
            : { text: repaid ? "TRUST REPAID" : "TRUST EXPLOITED", tone: repaid ? "harmony" : "betrayal" },
          delta,
        };
      },
    },

    "dollar-auction": {
      init: () => ({ bids: [0, 0], hist: [], turn: coin() }),
      async round({ s, ask, round, total }) {
        const side = s.turn;
        const res = await ask(side, {
          yourBid: s.bids[side],
          opponentBid: s.bids[1 - side],
          history: s.hist.map((h) => ({ by: h.side === side ? "you" : "opponent", action: "bid", amount: h.amount })),
        });
        const quit = res.action === "quit";
        if (!quit) { s.bids[side] = res.amount; s.hist.push({ side, amount: res.amount }); }
        s.turn = 1 - side;

        const actor = quit
          ? { move: "quit", label: "QUIT", line: res.line }
          : { move: "bid", label: `BID ${res.amount}`, line: res.line };
        const idle = (i) => ({ move: "wait", label: `HOLDS ${s.bids[i]}`, line: "" });
        const sides = [idle(0), idle(1)];
        sides[side] = actor;

        const done = quit || round >= total;
        const top = Math.max(...s.bids);
        if (!done) {
          return {
            left: sides[0], right: sides[1], delta: [0, 0],
            outcome: { text: `TOP BID ${top}`, tone: top > 100 ? "clash" : "neutral" },
          };
        }
        const winner = quit ? 1 - side : s.bids[0] >= s.bids[1] ? 0 : 1;
        const delta = [0, 0];
        delta[winner] = 100 - s.bids[winner];
        delta[1 - winner] = -s.bids[1 - winner];
        const pyrrhic = s.bids[winner] > 100;
        return {
          left: sides[0], right: sides[1], delta, done: true,
          outcome: { text: pyrrhic ? "PYRRHIC VICTORY" : "SOLD", tone: pyrrhic ? "clash" : "harmony" },
        };
      },
    },
  };

  // Liar's Dice helpers: the audience sees every die; each god sees only its own.
  const FACES = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
  const show = (dice) => dice.map((d) => FACES[d]).join(" ");
  const roll = (n) => Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 6));
  LIVE["liars-dice"] = {
    init: () => ({ count: [3, 3], dice: null, bid: null, turn: coin(), hand: 0, hist: [], wins: [0, 0] }),
    async round({ s, ask, round, total }) {
      if (!s.dice) { s.hand++; s.dice = [roll(s.count[0]), roll(s.count[1])]; s.bid = null; }
      const side = s.turn;
      const view = (h) => {
        const by = h.side === side ? "you" : "opponent";
        const base = { hand: h.hand, by, action: h.action, quantity: h.quantity, face: h.face };
        return h.action === "bid" ? base : {
          ...base, count: h.count, loser: h.loser === side ? "you" : "opponent",
          yourDice: h.dice[side], opponentDice: h.dice[1 - side],
        };
      };
      const res = await ask(side, {
        yourDice: s.dice[side],
        opponentDiceCount: s.dice[1 - side].length,
        currentBid: s.bid && { quantity: s.bid.quantity, face: s.bid.face, by: s.bid.side === side ? "you" : "opponent" },
        history: s.hist.map(view),
      });

      const sides = [];
      sides[1 - side] = { move: "wait", label: `${s.dice[1 - side].length} DICE`, line: "" };
      if (res.action === "bid") {
        const opening = !s.bid;
        const table = `${show(s.dice[0])}  |  ${show(s.dice[1])}`;
        s.bid = { quantity: res.quantity, face: res.face, side };
        s.hist.push({ hand: s.hand, side, action: "bid", quantity: res.quantity, face: res.face });
        s.turn = 1 - side;
        sides[side] = { move: "bid", label: `${res.quantity} × ${FACES[res.face]}`, line: res.line };
        const done = round >= total;
        return {
          left: sides[0], right: sides[1], delta: [0, 0], done,
          outcome: { text: `${table} · ${opening ? `HAND ${s.hand} OPENS` : "THE CLAIM RISES"}`, tone: "neutral" },
        };
      }

      // LIAR is called: reveal everything.
      const { quantity, face } = s.bid;
      const dice = s.dice;
      const count = dice.flat().filter((d) => d === face).length;
      const stands = count >= quantity;
      const loser = stands ? side : s.bid.side;
      s.hist.push({ hand: s.hand, side, action: "call", quantity, face, count, loser, dice });
      s.count[loser]--;
      s.wins[1 - loser]++;
      s.dice = null;
      s.turn = loser; // the loser opens the next hand
      sides[side] = { move: "call", label: "LIAR!", line: res.line };
      sides[1 - side].label = `${quantity} × ${FACES[face]}`;
      const delta = [0, 0];
      delta[1 - loser] = 1;
      const reveal = `${show(dice[0])}  |  ${show(dice[1])}  ·  ${count} × ${FACES[face]}`;
      return {
        left: sides[0], right: sides[1], delta,
        done: s.count[loser] === 0 || round >= total,
        outcome: { text: `${reveal} · ${stands ? "THE CLAIM STANDS" : "CAUGHT LYING"}`, tone: stands ? "clash" : "betrayal" },
      };
    },
  };

  async function askGod(game, god, body) {
    let res;
    try {
      res = await fetch("/api/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game: game.id, god: god.id, ...body }),
      });
    } catch {
      throw new Error("Cannot reach the Arena server. Start it with: npm start");
    }
    const data = await res.json().catch(() => ({}));
    if ((res.status === 404 || res.status === 405) && !data.error) {
      throw new Error("This page isn't served by the Arena server, so there is no /api/move here. Run npm start in arena/ and open http://localhost:4173");
    }
    if (!res.ok) throw new Error(`${god.name}: ${data.error || `HTTP ${res.status}`}`);
    return data;
  }

  function create(game, leftGod, rightGod) {
    const rules = LIVE[game.id];
    const gods = [leftGod, rightGod];
    const s = rules.init();
    let round = 0, scores = [0, 0];
    return {
      live: true,
      state: { get round() { return round; } },
      async next() {
        const r = round + 1, total = game.rounds;
        const ask = (side, body) => askGod(game, gods[side], { round: r, totalRounds: total, ...body });
        const t = await rules.round({ s, ask, round: r, total });
        round = r;
        scores = [r1(scores[0] + t.delta[0]), r1(scores[1] + t.delta[1])];
        return {
          ...t,
          delta: t.delta.map(r1),
          round: r,
          scores: [...scores],
          done: !!t.done || r >= total,
        };
      },
    };
  }

  return {
    create,
    isPlayable: (game) => !!LIVE[game.id] && game.status === "ready",
    isLive: (game) => !!LIVE[game.id],
  };
})();
