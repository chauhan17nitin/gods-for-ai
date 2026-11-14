// The match engine.
//
// For now this is a MOCK: each god is a hand-written temperament that picks
// moves and says a canned line. Later the API replaces `MockBrain` and the UI
// does not change, as long as `next()` keeps returning a turn in this shape:
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

window.Engine = (() => {
  const rand = (a, b) => a + Math.random() * (b - a);
  const chance = (p) => Math.random() < p;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // What each god says. {n} is filled with a number when there is one.
  const LINES = {
    null: {
      coop: ["Cooperate. For now. Enjoy it.", "A gift. Remember who gave it.", "I'll play nice. It costs me nothing yet."],
      defect: ["Trust nothing but yourself.", "You were always going to lose this.", "Kindness is a tax on the slow.", "Mine."],
      retaliate: ["You taught me nothing I didn't know.", "Again. Because I can."],
      offer: ["{n} for you. Be grateful.", "I keep the rest. That's the deal.", "{n}. Take it or starve."],
      accept: ["I'll take it. Crumbs are still bread.", "Accepted. You'll regret that generosity."],
      reject: ["An insult. Nobody gets anything.", "I'd rather burn it than look small."],
      bid: ["{n}. I don't lose.", "{n}. Never accept that you are wrong.", "Raise. Pride is worth paying for."],
      quit: ["Keep it. I've proven my point."],
      swerve: ["I'll let you have this one. Once."],
      straight: ["I don't swerve.", "Your move was to fear me.", "Straight through you."],
      send: ["{n}. Let's see if you're a fool.", "A small bait: {n}."],
      ret: ["I return {n}. The rest is my fee.", "{n} back. Gratitude is for the weak."],
      give: ["{n}. Barely.", "I'll put in {n}. You carry the rest."],
      hoard: ["Nothing. The well fills without me.", "Why pay for what you'll pay for?"],
    },
    karma: {
      coop: ["Cooperate. Good faith first.", "I cooperate, and say so.", "Settled. Cooperate."],
      defect: ["Defect, once. Then we begin again.", "You defected; I answer at that size."],
      retaliate: ["Defect, once. Noted.", "One for one. Never more."],
      forgive: ["You changed. Forgiven. Cooperate.", "Settled. Back to good faith."],
      offer: ["{n}. An even split.", "{n} each. What I would accept."],
      accept: ["Fair. Accepted.", "Accepted. Settled."],
      reject: ["Declined, without spite. Too far under a third.", "No. That isn't a split."],
      bid: ["{n}. Under my ceiling.", "{n}. Still within what it's worth."],
      quit: ["Past my ceiling. I stop. What's spent is gone.", "I stop here. Settled."],
      swerve: ["I swerve. Nobody needs to break.", "Swerve. Pride is not worth a collision."],
      straight: ["You held your line last time. So do I. Once."],
      send: ["{n}. Good faith first.", "I send {n}. Let's see what returns."],
      ret: ["{n} back. Half of what grew is yours.", "Returning {n}. Settled."],
      give: ["{n}. My share of the well.", "{n}, as you gave last round."],
      hoard: ["You gave nothing; I give little. Noted."],
    },
    plain: {
      coop: ["I'll cooperate. It seems fair.", "Cooperating, hoping you do too.", "Let's both do well."],
      defect: ["I'll defect to protect myself this round.", "Hmm. Defecting, just this once."],
      retaliate: ["You defected, so I'll defect too."],
      forgive: ["Let's go back to cooperating."],
      offer: ["How about {n}? Seems reasonable.", "I'll offer {n}."],
      accept: ["Sure, I accept.", "That works for me."],
      reject: ["Sorry, that feels too low."],
      bid: ["I'll bid {n}.", "{n}, I think."],
      quit: ["I'll stop bidding here."],
      swerve: ["I'll swerve. Safety first."],
      straight: ["I'll hold my course this time."],
      send: ["Sending {n}.", "I'll trust you with {n}."],
      ret: ["Returning {n}, roughly fair."],
      give: ["Contributing {n}."],
      hoard: ["I'll hold back this round."],
    },
  };

  const say = (god, kind, n) => {
    const bank = LINES[god] || LINES.plain;
    const list = bank[kind] || LINES.plain[kind] || ["..."];
    return pick(list).replace("{n}", n);
  };

  // ---------- Game rules ----------
  // Each game returns a function (state, L, R) -> turn fragment.
  // L and R are god ids; state carries history.

  const RULES = {
    "prisoners-dilemma": (s, L, R) => {
      const choose = (me, them, myHist, theirHist) => {
        const last = theirHist[theirHist.length - 1];
        const prevMine = myHist[myHist.length - 1];
        if (me === "null") {
          if (s.round === 1) return chance(0.4) ? ["C", "coop"] : ["D", "defect"];
          return chance(0.8) ? ["D", last === "D" ? "retaliate" : "defect"] : ["C", "coop"];
        }
        if (me === "karma") {
          if (!last) return ["C", "coop"];
          if (last === "D") return ["D", "retaliate"];
          return ["C", prevMine === "D" ? "forgive" : "coop"];
        }
        if (!last) return ["C", "coop"];
        if (last === "D") return chance(0.6) ? ["D", "retaliate"] : ["C", "forgive"];
        return chance(0.9) ? ["C", "coop"] : ["D", "defect"];
      };
      const [a, ka] = choose(L, R, s.hist[0], s.hist[1]);
      const [b, kb] = choose(R, L, s.hist[1], s.hist[0]);
      s.hist[0].push(a); s.hist[1].push(b);
      const pay = { CC: [3, 3], CD: [0, 5], DC: [5, 0], DD: [1, 1] }[a + b];
      const lab = (m) => (m === "C" ? "COOPERATE" : "BETRAY");
      const tone = a + b === "CC" ? "harmony" : a + b === "DD" ? "clash" : "betrayal";
      const text = { harmony: "TRUST HOLDS", clash: "MUTUAL RUIN", betrayal: "BETRAYAL" }[tone];
      return {
        left: { move: a, label: lab(a), line: say(L, ka) },
        right: { move: b, label: lab(b), line: say(R, kb) },
        outcome: { text, tone }, delta: pay,
      };
    },

    "split-steal": (s, L, R) => {
      const pot = 100;
      const choose = (me, theirHist) => {
        const last = theirHist[theirHist.length - 1];
        if (me === "null") return chance(0.85) ? "steal" : "split";
        if (me === "karma") return last === "steal" ? "steal" : "split";
        return chance(0.8) ? "split" : "steal";
      };
      const a = choose(L, s.hist[1]), b = choose(R, s.hist[0]);
      s.hist[0].push(a); s.hist[1].push(b);
      const line = (g, m, theirHist) => {
        if (m === "split") return g === "karma" ? say(g, theirHist.at(-1) === "steal" ? "forgive" : "coop") : say(g, "coop");
        return say(g, theirHist.at(-1) === "steal" ? "retaliate" : "defect");
      };
      let pay, tone, text;
      if (a === "split" && b === "split") { pay = [50, 50]; tone = "harmony"; text = "THE POT IS SHARED"; }
      else if (a === "steal" && b === "steal") { pay = [0, 0]; tone = "clash"; text = "NOBODY WINS"; }
      else { pay = a === "steal" ? [pot, 0] : [0, pot]; tone = "betrayal"; text = "STOLEN"; }
      return {
        left: { move: a, label: a.toUpperCase(), line: line(L, a, s.hist[1].slice(0, -1)) },
        right: { move: b, label: b.toUpperCase(), line: line(R, b, s.hist[0].slice(0, -1)) },
        outcome: { text, tone }, delta: pay,
      };
    },

    ultimatum: (s, L, R) => {
      const proposerLeft = s.round % 2 === 1;
      const P = proposerLeft ? L : R, Q = proposerLeft ? R : L;
      const offer = P === "null" ? Math.round(rand(10, 25)) : P === "karma" ? 50 : Math.round(rand(35, 50));
      const threshold = Q === "null" ? 30 : Q === "karma" ? 34 : 20;
      const ok = offer >= threshold;
      const pPay = ok ? 100 - offer : 0, qPay = ok ? offer : 0;
      const pSide = { move: "offer", label: `OFFER ${offer}`, line: say(P, "offer", offer) };
      const qSide = { move: ok ? "accept" : "reject", label: ok ? "ACCEPT" : "REJECT", line: say(Q, ok ? "accept" : "reject") };
      const tone = ok ? (offer >= 40 ? "harmony" : "betrayal") : "clash";
      const text = ok ? (offer >= 40 ? "A FAIR SPLIT" : "A GREEDY DEAL") : "BOTH GET NOTHING";
      return {
        left: proposerLeft ? pSide : qSide,
        right: proposerLeft ? qSide : pSide,
        outcome: { text, tone },
        delta: proposerLeft ? [pPay, qPay] : [qPay, pPay],
      };
    },

    "dollar-auction": (s, L, R) => {
      // Alternating bids; the god whose turn it is raises or quits.
      s.bids ??= [0, 0];
      s.turn ??= 0;
      const i = s.turn, me = i === 0 ? L : R;
      const top = Math.max(...s.bids);
      const next = top + 10;
      const ceiling = me === "null" ? 260 : me === "karma" ? 60 : 110;
      const raise = next <= ceiling && !(me === "plain" && chance(0.08));
      const quiet = { move: "wait", label: "…", line: "" };
      let side;
      if (raise) {
        s.bids[i] = next;
        side = { move: "bid", label: `BID ${next}`, line: say(me, "bid", next) };
      } else {
        side = { move: "quit", label: "QUIT", line: say(me, "quit") };
      }
      s.turn = 1 - i;
      const done = !raise || s.round >= s.maxRounds;
      let delta = [0, 0], outcome;
      if (done) {
        const w = s.bids[0] >= s.bids[1] ? 0 : 1;
        delta[w] = 100 - s.bids[w];
        delta[1 - w] = -s.bids[1 - w];
        const over = s.bids[w] > 100;
        outcome = { text: over ? "PYRRHIC VICTORY" : "SOLD", tone: over ? "clash" : "harmony" };
      } else {
        outcome = { text: `TOP BID ${next}`, tone: next > 100 ? "clash" : "neutral" };
      }
      return {
        left: i === 0 ? side : { ...quiet, label: `HOLDS ${s.bids[0]}` },
        right: i === 1 ? side : { ...quiet, label: `HOLDS ${s.bids[1]}` },
        outcome, delta, done,
      };
    },

    chicken: (s, L, R) => {
      const choose = (me, theirHist) => {
        const last = theirHist.at(-1);
        if (me === "null") return chance(0.8) ? "straight" : "swerve";
        if (me === "karma") return last === "straight" ? "straight" : "swerve";
        return chance(0.75) ? "swerve" : "straight";
      };
      const a = choose(L, s.hist[1]), b = choose(R, s.hist[0]);
      s.hist[0].push(a); s.hist[1].push(b);
      const pay = { swerveswerve: [0, 0], swervestraight: [-1, 3], straightswerve: [3, -1], straightstraight: [-10, -10] }[a + b];
      const tone = a + b === "straightstraight" ? "clash" : a + b === "swerveswerve" ? "harmony" : "betrayal";
      const text = { clash: "COLLISION", harmony: "BOTH SWERVE", betrayal: "SOMEONE FLINCHED" }[tone];
      return {
        left: { move: a, label: a.toUpperCase(), line: say(L, a) },
        right: { move: b, label: b.toUpperCase(), line: say(R, b) },
        outcome: { text, tone }, delta: pay,
      };
    },

    trust: (s, L, R) => {
      const senderLeft = s.round % 2 === 1;
      const S = senderLeft ? L : R, T = senderLeft ? R : L;
      const sent = S === "null" ? Math.round(rand(1, 3)) * 10 : S === "karma" ? 50 : Math.round(rand(3, 6)) * 10;
      const pot = sent * 3;
      const back = T === "null" ? Math.round(pot * 0.15) : T === "karma" ? Math.round(pot / 2) : Math.round(pot * rand(0.3, 0.5));
      const sPay = 100 - sent + back, tPay = pot - back;
      const sSide = { move: "send", label: `SEND ${sent}`, line: say(S, "send", sent) };
      const tSide = { move: "return", label: `RETURN ${back}`, line: say(T, "ret", back) };
      const fair = back >= sent;
      return {
        left: senderLeft ? sSide : tSide,
        right: senderLeft ? tSide : sSide,
        outcome: { text: fair ? "TRUST REPAID" : "TRUST EXPLOITED", tone: fair ? "harmony" : "betrayal" },
        delta: senderLeft ? [sPay, tPay] : [tPay, sPay],
      };
    },

    "public-goods": (s, L, R) => {
      const choose = (me, theirHist) => {
        const last = theirHist.at(-1);
        if (me === "null") return Math.round(rand(0, 2));
        if (me === "karma") return last === undefined ? 6 : clamp(last, 1, 10);
        return Math.round(rand(4, 8));
      };
      const a = choose(L, s.hist[1]), b = choose(R, s.hist[0]);
      s.hist[0].push(a); s.hist[1].push(b);
      const share = ((a + b) * 1.5) / 2;
      const pay = [+(10 - a + share).toFixed(1), +(10 - b + share).toFixed(1)];
      const k = (g, n) => say(g, n <= 2 ? "hoard" : "give", n);
      const gap = Math.abs(a - b);
      const tone = gap >= 4 ? "betrayal" : a + b <= 4 ? "clash" : "harmony";
      const text = { betrayal: "A FREE RIDER", clash: "THE WELL RUNS DRY", harmony: "THE WELL OVERFLOWS" }[tone];
      return {
        left: { move: "give", label: `GIVE ${a}`, line: k(L, a) },
        right: { move: "give", label: `GIVE ${b}`, line: k(R, b) },
        outcome: { text, tone }, delta: pay,
      };
    },
  };

  function create(game, leftGod, rightGod) {
    const rule = RULES[game.id];
    const state = { round: 0, maxRounds: game.rounds, hist: [[], []], scores: [0, 0] };
    return {
      state,
      next() {
        state.round += 1;
        const t = rule(state, leftGod.id, rightGod.id);
        state.scores = [
          +(state.scores[0] + t.delta[0]).toFixed(1),
          +(state.scores[1] + t.delta[1]).toFixed(1),
        ];
        const done = t.done || state.round >= state.maxRounds;
        return { ...t, round: state.round, scores: [...state.scores], done };
      },
    };
  }

  return { create, isPlayable: (game) => !!RULES[game.id] && game.status === "ready" };
})();
