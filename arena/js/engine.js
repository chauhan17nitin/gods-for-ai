// The match engine. Every game is live: each god's move comes from the
// backend (POST /api/move), which loads the god's skill and asks Gemini.
//
// `next()` resolves to one turn in this shape, which the UI animates:
//
//   {
//     round: 3,
//     left:  { move: "betray", label: "BETRAY", line: "...", talk?: "..." },
//     right: { move: "cooperate", label: "COOPERATE", line: "..." },
//     outcome: { text: "BETRAYAL", tone: "betrayal" | "harmony" | "clash" | "neutral" },
//     delta: [5, 0],   // points this round
//     scores: [14, 9], // running totals
//     done: false,
//   }
//
// How each game asks the gods:
//   simultaneous   both gods at once            prisoners-dilemma, chicken, public-goods
//   two phases     talk at once, then decide    split-steal
//   sequential     first mover, then responder  ultimatum, trust
//   turn by turn   one god per turn             dollar-auction

window.Engine = (() => {
  const r1 = (n) => Math.round(n * 10) / 10;

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
        const history = (side) => s.hist.map((h) => ({ you: h.moves[side], opponent: h.moves[1 - side], youSaid: h.said[side], opponentSaid: h.said[1 - side] }));
        // Phase 1: both speak at once. Phase 2: both choose, having heard each other.
        const [ta, tb] = await Promise.all([ask(0, { phase: "talk", history: history(0) }), ask(1, { phase: "talk", history: history(1) })]);
        const said = [ta.line, tb.line];
        const [a, b] = await Promise.all([
          ask(0, { phase: "decide", history: history(0), youSaid: said[0], opponentSaid: said[1] }),
          ask(1, { phase: "decide", history: history(1), youSaid: said[1], opponentSaid: said[0] }),
        ]);
        s.hist.push({ moves: [a.move, b.move], said });
        const delta = { "split,split": [50, 50], "split,steal": [0, 100], "steal,split": [100, 0], "steal,steal": [0, 0] }[`${a.move},${b.move}`];
        const tone = a.move === b.move ? (a.move === "split" ? "harmony" : "clash") : "betrayal";
        return {
          left: { move: a.move, label: a.move.toUpperCase(), talk: said[0], line: a.line },
          right: { move: b.move, label: b.move.toUpperCase(), talk: said[1], line: b.line },
          outcome: { text: { harmony: "THE POT IS SHARED", clash: "NOBODY WINS", betrayal: "STOLEN" }[tone], tone },
          delta,
        };
      },
    },

    ultimatum: {
      init: () => ({ hist: [] }),
      async round({ s, ask, round }) {
        const P = round % 2 === 1 ? 0 : 1, Q = 1 - P; // left proposes in odd rounds
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
      init: () => ({ hist: [] }),
      async round({ s, ask, round }) {
        const S = round % 2 === 1 ? 0 : 1, T = 1 - S; // left sends in odd rounds
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
      init: () => ({ bids: [0, 0], hist: [], turn: 0 }),
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
