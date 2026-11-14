// Screens, selection flow and battle playback.

(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const godById = (id) => GODS.find((g) => g.id === id);

  const app = {
    game: null,
    picks: [null, null],
    activeSide: 0,
    run: 0, // increments to cancel an in-flight match
    paused: false,
    speed: 1,
  };

  // ---------- Screen routing ----------
  function show(name) {
    const next = $(`#screen-${name}`);
    const cur = $(".screen.active");
    if (cur === next) return;
    cur?.classList.add("leaving");
    cur?.classList.remove("active");
    setTimeout(() => cur?.classList.remove("leaving"), 700);
    next.classList.add("active");
    Cosmos.setMode(name === "battle" ? "battle" : name === "select" ? "select" : "idle");
    if (name !== "battle") app.run++; // stop any match still playing
  }

  $$("[data-back]").forEach((b) => b.addEventListener("click", () => show(b.dataset.back)));

  // ---------- 1. Title ----------
  $("#enter-btn").addEventListener("click", () => {
    Cosmos.impact({ color: "#9b7bff", power: 0.6 });
    show("games");
  });

  // ---------- 2. Games ----------
  function renderGames() {
    const grid = $("#game-grid");
    grid.innerHTML = GAMES.map((g, i) => {
      const sealed = !Engine.isPlayable(g);
      return `
        <button class="game-card ${sealed ? "sealed" : ""}" data-game="${g.id}" style="--i:${i}" ${sealed ? 'aria-disabled="true"' : ""}>
          <span class="game-glyph">${ART.glyph(g.glyph)}</span>
          <span class="game-badge live">${sealed ? "" : "● Live AI"}</span>
          <span class="game-name">${g.name}</span>
          <span class="game-tag">${g.tagline}</span>
          <span class="game-blurb">${g.blurb}</span>
          <span class="game-meta">
            ${sealed
              ? `<b class="seal">Sealed</b> needs a full pantheon`
              : `<b>${g.rounds}</b> rounds · ${"◆".repeat(g.difficulty)}${"◇".repeat(3 - g.difficulty)}`}
          </span>
        </button>`;
    }).join("");

    $$(".game-card", grid).forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
        card.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
      });
      card.addEventListener("click", () => {
        const g = GAMES.find((x) => x.id === card.dataset.game);
        if (!Engine.isPlayable(g)) {
          card.classList.remove("denied"); void card.offsetWidth; card.classList.add("denied");
          return;
        }
        app.game = g;
        openSelect();
      });
    });
  }

  // ---------- 3. God select ----------
  function openSelect() {
    $("#select-game-name").textContent = app.game.name;
    renderRoster();
    renderChampions();
    show("select");
  }

  function renderRoster() {
    const roster = $("#roster");
    const tiles = GODS.map((g) => `
      <button class="god-tile" data-god="${g.id}" style="--c:${g.color};--g:${g.glow}" title="${g.name}, ${g.title}">
        <span class="tile-sigil">${ART.sigil(g.sigil)}</span>
        <span class="tile-name">${g.name}</span>
        <span class="tile-flags"></span>
      </button>`);
    for (let i = 0; i < LOCKED_SLOTS; i++) {
      tiles.push(`<div class="god-tile locked" title="A god not yet forged"><span class="tile-sigil">${ART.sigil("locked")}</span><span class="tile-name">Unforged</span></div>`);
    }
    roster.innerHTML = tiles.join("");
    $$(".god-tile[data-god]", roster).forEach((t) => {
      t.addEventListener("click", () => choose(t.dataset.god));
      t.addEventListener("mouseenter", () => preview(t.dataset.god));
      t.addEventListener("mouseleave", () => preview(null));
    });
    syncRoster();
  }

  function choose(id) {
    const side = app.activeSide;
    app.picks[side] = id;
    const g = godById(id);
    const panel = side === 0 ? $("#champ-left") : $("#champ-right");
    const r = panel.getBoundingClientRect();
    Cosmos.burst(g.color, 50, r.left + r.width / 2, r.top + r.height * 0.35);
    // Move to the other side if it is still empty.
    if (!app.picks[1 - side]) app.activeSide = 1 - side;
    renderChampions(side);
    syncRoster();
  }

  function preview(id) {
    const side = app.activeSide;
    renderChampion(side, id ? godById(id) : app.picks[side] ? godById(app.picks[side]) : null, !!id && id !== app.picks[side]);
  }

  function syncRoster() {
    $$(".god-tile[data-god]").forEach((t) => {
      const flags = [];
      if (app.picks[0] === t.dataset.god) flags.push('<i class="f-left">P1</i>');
      if (app.picks[1] === t.dataset.god) flags.push('<i class="f-right">P2</i>');
      $(".tile-flags", t).innerHTML = flags.join("");
      t.classList.toggle("picked", flags.length > 0);
    });
    const ready = app.picks[0] && app.picks[1];
    $("#begin-btn").disabled = !ready;
    $("#roster-hint").innerHTML = ready
      ? app.picks[0] === app.picks[1]
        ? "A mirror match. A god against itself."
        : "Two realms collide. Click a side to swap its god."
      : `Choose the god for the <b>${app.activeSide === 0 ? "left" : "right"}</b> realm`;
    $("#champ-left").classList.toggle("active", app.activeSide === 0);
    $("#champ-right").classList.toggle("active", app.activeSide === 1);

    const L = godById(app.picks[0]) || { color: "#5a2cff", glow: "#9b7bff" };
    const R = godById(app.picks[1]) || { color: "#ff2d75", glow: "#ff9b3d" };
    Cosmos.setRealms(L, R);
    Cosmos.setMode("select");
  }

  function renderChampions(flashSide) {
    renderChampion(0, godById(app.picks[0]), false, flashSide === 0);
    renderChampion(1, godById(app.picks[1]), false, flashSide === 1);
  }

  function statBars(stats) {
    return Object.entries(stats).map(([k, v]) => `
      <div class="stat"><span>${k}</span><div class="pips">${Array.from({ length: 5 }, (_, i) => `<i class="${i < v ? "on" : ""}"></i>`).join("")}</div></div>`).join("");
  }

  function renderChampion(side, g, isPreview = false, arrive = false) {
    const el = side === 0 ? $("#champ-left") : $("#champ-right");
    const label = side === 0 ? "Left realm · P1" : "Right realm · P2";
    if (!g) {
      el.style.removeProperty("--c"); el.style.removeProperty("--g"); el.style.removeProperty("--d");
      el.innerHTML = `
        <p class="champ-side">${label}</p>
        <div class="champ-empty"><div class="champ-portal"></div><p>Awaiting a god</p></div>`;
      el.classList.add("empty");
      return;
    }
    el.classList.remove("empty");
    el.style.setProperty("--c", g.color);
    el.style.setProperty("--g", g.glow);
    el.style.setProperty("--d", g.dark);
    el.innerHTML = `
      <p class="champ-side">${label}${isPreview ? " · preview" : ""}</p>
      <div class="champ-sigil ${arrive ? "arrive" : ""}">${ART.sigil(g.sigil)}</div>
      <h3 class="champ-name">${g.name}</h3>
      <p class="champ-title">${g.title}</p>
      <p class="champ-realm">Realm of ${g.realm}</p>
      <blockquote class="champ-creed">“${g.creed}”</blockquote>
      <p class="champ-nature">${g.nature}</p>
      <div class="champ-stats">${statBars(g.stats)}</div>`;
    el.classList.toggle("preview", isPreview);
  }

  $("#champ-left").addEventListener("click", () => { app.activeSide = 0; syncRoster(); });
  $("#champ-right").addEventListener("click", () => { app.activeSide = 1; syncRoster(); });
  $("#begin-btn").addEventListener("click", () => startBattle());

  // ---------- 4. Battle ----------
  const sleep = async (ms, run) => {
    let left = ms;
    while (left > 0) {
      if (run !== app.run) throw new Error("cancelled");
      const step = Math.min(50, left);
      await new Promise((r) => setTimeout(r, step));
      if (!app.paused) left -= step * app.speed;
    }
    if (run !== app.run) throw new Error("cancelled");
  };

  function typeLine(el, text, run) {
    el.textContent = "";
    el.classList.toggle("on", !!text);
    if (!text) return Promise.resolve();
    return new Promise((resolve) => {
      let i = 0;
      const tick = () => {
        if (run !== app.run) return resolve();
        if (app.paused) return setTimeout(tick, 60);
        i += app.speed >= 4 ? text.length : app.speed;
        el.textContent = text.slice(0, i);
        if (i >= text.length) resolve();
        else setTimeout(tick, 22);
      };
      tick();
    });
  }

  function hudSide(g, side) {
    return `
      <div class="hud-id">
        <span class="hud-sigil">${ART.sigil(g.sigil)}</span>
        <div><b>${g.name}</b><small>${g.title}</small></div>
      </div>
      <div class="hud-bar"><i id="bar-${side}"></i></div>
      <p class="hud-score" id="score-${side}">0</p>`;
  }

  function setScores(scores) {
    const max = Math.max(10, ...scores.map((s) => Math.abs(s)));
    scores.forEach((s, i) => {
      const el = $(`#score-${i}`);
      if (el.textContent !== String(s)) {
        el.textContent = s;
        el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump");
      }
      const bar = $(`#bar-${i}`);
      bar.style.width = `${(Math.max(0, s) / max) * 100}%`;
      bar.classList.toggle("neg", s < 0);
    });
  }

  function bolt() {
    const pts = [];
    let x = 50;
    for (let y = 0; y <= 300; y += 20) {
      pts.push(`${x.toFixed(1)},${y}`);
      x = 50 + (Math.random() - 0.5) * 60;
    }
    $("#bolt-line").setAttribute("points", pts.join(" "));
  }

  async function intro(L, R, run) {
    const intro = $("#intro");
    $("#intro-left").innerHTML = `<div class="ih-sigil">${ART.sigil(L.sigil)}</div><h3>${L.name}</h3><p>${L.title}</p>`;
    $("#intro-right").innerHTML = `<div class="ih-sigil">${ART.sigil(R.sigil)}</div><h3>${R.name}</h3><p>${R.title}</p>`;
    $("#intro-left").style.setProperty("--c", L.color);
    $("#intro-left").style.setProperty("--d", L.dark);
    $("#intro-right").style.setProperty("--c", R.color);
    $("#intro-right").style.setProperty("--d", R.dark);
    $("#intro-call").textContent = "";
    intro.className = "intro on";
    await sleep(700, run);
    intro.classList.add("slam");
    Cosmos.impact({ color: "#ffffff", power: 1.2 });
    await sleep(1300, run);
    $("#intro-call").textContent = `The trial of ${app.game.name} begins`;
    intro.classList.add("call");
    await sleep(1400, run);
    intro.classList.add("out");
    await sleep(600, run);
    intro.className = "intro";
  }

  async function startBattle() {
    const run = ++app.run;
    app.paused = false;
    $("#ctl-play").textContent = "❚❚";
    const L = godById(app.picks[0]), R = godById(app.picks[1]);
    const game = app.game;
    const match = Engine.create(game, L, R);

    const screen = $("#screen-battle");
    screen.style.setProperty("--lc", L.color);
    screen.style.setProperty("--lg", L.glow);
    screen.style.setProperty("--rc", R.color);
    screen.style.setProperty("--rg", R.glow);
    $("#hud-left").innerHTML = hudSide(L, 0);
    $("#hud-right").innerHTML = hudSide(R, 1);
    $("#hud-game").textContent = game.name;
    $(".demo-tag").textContent = "Live · gods played by Gemini";
    $(".demo-tag").classList.add("live");
    $("#hud-round").textContent = "ROUND 1";
    $("#hud-progress").style.width = "0%";
    $("#deity-left .sigil").innerHTML = ART.sigil(L.sigil);
    $("#deity-right .sigil").innerHTML = ART.sigil(R.sigil);
    $("#chronicle").innerHTML = "";
    $("#verdict").classList.remove("on");
    resetClash();
    setScores([0, 0]);
    Cosmos.setRealms(L, R);
    show("battle");

    try {
      await intro(L, R, run);
      let turn;
      do {
        await waitForStrike(match.state.round + 1, run); // the player starts each round
        if (match.live) deliberate(match.state.round + 1);
        turn = await match.next(); // live games wait here for both gods
        if (run !== app.run) return; // left the battle while waiting
        await playTurn(turn, L, R, run);
      } while (!turn.done);
      await sleep(900, run);
      verdict(L, R, turn.scores);
    } catch (e) {
      if (e.message === "cancelled" || run !== app.run) return;
      silence(e.message);
    }
  }

  // Waits for the player to click "Next Round" (or press Enter).
  let strike = null;
  function waitForStrike(round, run) {
    const box = $("#strike");
    $("#strike-btn span").textContent = round === 1 ? "Begin Round 1" : `Next Round · ${round}`;
    box.hidden = false;
    return new Promise((resolve, reject) => {
      const done = (fn) => { clearInterval(watch); strike = null; box.hidden = true; fn(); };
      // Stop waiting if the player leaves or restarts the battle.
      const watch = setInterval(() => { if (run !== app.run) done(() => reject(new Error("cancelled"))); }, 150);
      strike = () => done(resolve);
    });
  }
  $("#strike-btn").addEventListener("click", () => strike?.());

  // While both gods are thinking (live games).
  function deliberate(round) {
    resetClash();
    $("#hud-round").textContent = `ROUND ${round}`;
    $("#deity-left").classList.add("charging");
    $("#deity-right").classList.add("charging");
    $("#clash-core").classList.add("thinking");
    $("#outcome").textContent = "";
    $("#delta").textContent = "the gods deliberate…";
  }

  // When the backend fails: stop the match and say why.
  function silence(message) {
    resetClash();
    $("#clash-core").classList.add("on", "t-clash");
    $("#outcome").textContent = "THE GODS ARE SILENT";
    $("#delta").textContent = message;
    $("#delta").classList.add("error");
    console.error("[arena]", message);
  }

  function resetClash() {
    $("#move-left").className = "move-card move-left";
    $("#move-right").className = "move-card move-right";
    $("#outcome").textContent = "";
    $("#delta").textContent = "";
    $("#delta").className = "delta";
    $("#clash-core").className = "clash-core";
    $("#speech-left").className = "speech";
    $("#speech-right").className = "speech";
    $("#deity-left").className = "deity deity-left";
    $("#deity-right").className = "deity deity-right";
  }

  async function playTurn(turn, L, R, run) {
    const total = app.game.rounds;
    resetClash();
    $("#hud-round").textContent = `ROUND ${turn.round}`;
    $("#hud-progress").style.width = `${(turn.round / total) * 100}%`;

    // Gods gather power and speak.
    $("#deity-left").classList.add("charging");
    $("#deity-right").classList.add("charging");
    await sleep(350, run);
    // Games with a talk phase (Split or Steal): show what each god said first.
    if (turn.left.talk || turn.right.talk) {
      $("#delta").textContent = "they speak…";
      $("#clash-core").classList.add("thinking");
      await Promise.all([
        typeLine($("#speech-left"), turn.left.talk, run),
        typeLine($("#speech-right"), turn.right.talk, run),
      ]);
      await sleep(2200, run);
      $("#delta").textContent = "";
      $("#clash-core").classList.remove("thinking");
    }
    await Promise.all([
      typeLine($("#speech-left"), turn.left.line, run),
      typeLine($("#speech-right"), turn.right.line, run),
    ]);
    await sleep(600, run);

    // Cards come in face down, then flip.
    $("#move-left span").textContent = turn.left.label;
    $("#move-right span").textContent = turn.right.label;
    $("#move-left").classList.add("in", `mv-${turn.left.move}`);
    $("#move-right").classList.add("in", `mv-${turn.right.move}`);
    await sleep(500, run);
    $("#move-left").classList.add("flip");
    $("#move-right").classList.add("flip");
    Cosmos.attack(); // the realms strike as the moves are revealed
    await sleep(450, run);

    // Clash.
    const tone = turn.outcome.tone;
    bolt();
    $("#clash-core").classList.add("on", `t-${tone}`);
    $("#outcome").textContent = turn.outcome.text;
    const d = turn.delta.map((v) => (v > 0 ? `+${v}` : `${v}`));
    $("#delta").innerHTML = `<b style="color:var(--lc)">${d[0]}</b><i>·</i><b style="color:var(--rc)">${d[1]}</b>`;
    const winner = turn.delta[0] === turn.delta[1] ? -1 : turn.delta[0] > turn.delta[1] ? 0 : 1;
    const color = tone === "harmony" ? "#fff6d8" : tone === "neutral" ? "#c9c2ff" : winner === 0 ? L.color : winner === 1 ? R.color : "#ff3b3b";
    const power = { clash: 1.3, betrayal: 1, harmony: 0.5, neutral: 0.3 }[tone];
    Cosmos.impact({ color, power });
    if (winner >= 0 && tone !== "neutral") {
      $(winner === 0 ? "#deity-left" : "#deity-right").classList.add("triumph");
      $(winner === 0 ? "#deity-right" : "#deity-left").classList.add("hit");
    } else if (tone === "clash") {
      $("#deity-left").classList.add("hit");
      $("#deity-right").classList.add("hit");
    }
    setScores(turn.scores);
    chronicle(turn, L, R);
    await sleep(1500, run);
  }

  function chronicle(turn, L, R) {
    const li = document.createElement("li");
    li.className = `t-${turn.outcome.tone}`;
    li.innerHTML = `
      <span class="c-round">R${turn.round}</span>
      <span class="c-move" style="color:${L.color}">${L.name} · ${turn.left.label}</span>
      <span class="c-out">${turn.outcome.text}</span>
      <span class="c-move" style="color:${R.color}">${turn.right.label} · ${R.name}</span>`;
    const list = $("#chronicle");
    list.prepend(li);
    while (list.children.length > 30) list.lastChild.remove();
  }

  function verdict(L, R, scores) {
    const [a, b] = scores;
    const tie = a === b;
    const W = a > b ? L : R;
    $("#verdict").style.setProperty("--c", tie ? "#e9e4ff" : W.color);
    $("#verdict").style.setProperty("--g", tie ? "#9b7bff" : W.glow);
    $("#verdict-sigil").innerHTML = tie
      ? `<div class="tie-sigils">${ART.sigil(L.sigil)}${ART.sigil(R.sigil)}</div>`
      : ART.sigil(W.sigil);
    $("#verdict-title").textContent = tie ? "The scales are even" : `${W.name} prevails`;
    $("#verdict-sub").textContent = tie ? "Neither realm gave ground." : `“${W.creed}”`;
    $("#verdict-scores").innerHTML = `
      <div style="--c:${L.color}"><b>${a}</b><span>${L.name}</span></div>
      <div style="--c:${R.color}"><b>${b}</b><span>${R.name}</span></div>`;
    $("#verdict").classList.add("on");
    Cosmos.impact({ color: tie ? "#ffffff" : W.color, power: 1.5 });
  }

  // Controls
  $("#ctl-play").addEventListener("click", togglePause);
  function togglePause() {
    app.paused = !app.paused;
    $("#ctl-play").textContent = app.paused ? "▶" : "❚❚";
    $("#screen-battle").classList.toggle("paused", app.paused);
  }
  $("#ctl-speed").addEventListener("click", () => {
    app.speed = app.speed === 1 ? 2 : app.speed === 2 ? 4 : 1;
    $("#ctl-speed").textContent = `${app.speed}×`;
  });
  $("#ctl-restart").addEventListener("click", () => startBattle());
  $("#ctl-exit").addEventListener("click", () => show("select"));
  $("#rematch-btn").addEventListener("click", () => startBattle());
  $("#new-gods-btn").addEventListener("click", () => show("select"));
  $("#new-game-btn").addEventListener("click", () => show("games"));

  // Keyboard
  addEventListener("keydown", (e) => {
    const cur = $(".screen.active")?.id;
    if (e.key === "Enter" && cur === "screen-title") $("#enter-btn").click();
    if (e.key === "Enter" && cur === "screen-battle" && strike) { e.preventDefault(); strike(); }
    if (e.key === "Escape") {
      if (cur === "screen-battle") show("select");
      else if (cur === "screen-select") show("games");
      else if (cur === "screen-games") show("title");
    }
    if (e.key === " " && cur === "screen-battle") { e.preventDefault(); togglePause(); }
  });

  renderGames();
})();
