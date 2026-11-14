# The Arena

A game-style UI where two gods face each other in a strategy game. See [../ARENA.md](../ARENA.md) for the games and why they matter.

**Every game is live:** each god's move comes from Gemini with the god's skill loaded. Each round starts when you click **Next Round** or press Enter.

## Run it

Needs Node 20+. No dependencies to install.

```bash
cd arena
cp .env.example .env     # then put your key in GEMINI_API_KEY
npm start
```

Open http://localhost:4173. If `GEMINI_API_KEY` is already set in your shell, the `.env` file is optional.

## How a live round works

```
 frontend                               backend                         Gemini
 ────────                               ───────                         ──────
 round N starts
   ├─ POST /api/move {god: "null",  history} ─→ load null-the-devil/SKILL.md ─→ generateContent
   └─ POST /api/move {god: "karma", history} ─→ load karma-the-judge/SKILL.md ─→ generateContent
                    (both at the same time)        system = skill + parables     JSON: {move, line}
                                                   prompt = rules + history
   ←──────────── { move, line } for each god ────────────────────────────────
 score the round, animate, next round
```

- Each god gets its **own** request, with the history from its own point of view (`you` / `opponent`).
- The **Plain AI** gets no skill, so it is the control group.
- Gemini is forced to answer as JSON (`responseSchema`) in each game's own format, always with a `line` in the god's voice.
- Scoring happens in the frontend from the moves.

The diagram shows a simultaneous game. Games where one move depends on another call the gods differently:

| Game | Calls per round | Answer |
|---|---|---|
| Prisoner's Dilemma | both at once | `move`: cooperate / betray |
| Chicken | both at once | `move`: swerve / straight |
| Public Goods | both at once | `give`: 0–10 |
| Split or Steal | **talk** both at once, then **decide** both at once (each hears what the other said) | talk: `line`; decide: `move`: split / steal |
| Ultimatum | proposer, then responder (sees the offer); roles swap each round | `offer`: 0–100, then `decision`: accept / reject |
| Trust Game | sender, then trustee (sees what arrived); roles swap each round | `send`: 0–100, then `return`: 0–3× sent |
| Dollar Auction | one god per turn, alternating, until someone quits | `action`: bid / quit, `amount` |

### API

```
POST /api/move
{ "game": "prisoners-dilemma", "god": "karma", "round": 3, "totalRounds": 12,
  "history": [ { "you": "cooperate", "opponent": "betray" }, { "you": "betray", "opponent": "betray" } ] }

200 → { "god": "karma", "round": 3, "move": "cooperate", "line": "You returned to good faith. So do I." }
400 → { "error": "..." }                                    (bad request)
502 → { "error": "...", "source": "gemini", "upstreamStatus": 402 }   (Gemini failed)
```

Other games add their own fields to the request (`phase`, `offer`, `sent`, `yourBid`, ...). Each file in `server/games/` documents and validates them.

Bad JSON or an invalid move from Gemini is retried once. Rate limits (429) and overloads (503) are waited out and retried, up to 4 attempts. A bad key or no billing (400/401/402/403) fails at once. The **free tier allows only about 5 requests a minute** on `gemini-2.5-flash`, so a 12-round match (24 calls) takes a few minutes there. Use a paid key or a lighter model for faster matches.

### Settings (`arena/.env`)

| Variable | Default | |
|---|---|---|
| `GEMINI_API_KEY` | none | Required. |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Any Gemini model that supports JSON output. |
| `PORT` | `4173` | |
| `GEMINI_BASE_URL` | Google's API | Only for testing against a local stand-in. |

## Files

| File | What it holds |
|---|---|
| `server/server.js` | HTTP server: serves the UI and handles `POST /api/move`. |
| `server/gods.js` | Maps a god id to its skill folder and builds the system instruction. |
| `server/gemini.js` | The Gemini call with JSON output. |
| `server/games/*.js` | One file per game: its prompt, JSON schema and validation. `common.js` holds shared helpers. |
| `js/engine.js` | How each game asks the gods, and how it scores a round. |
| `js/data.js` | The god roster and game catalogue. |
| `js/art.js` | SVG sigils for each god and glyphs for each game. |
| `js/cosmos.js` | The animated multiverse background. |
| `js/app.js` | Screens, selection flow and battle playback. |
| `css/arena.css` | All styling. |

## Adding a game

1. Add `server/games/<game>.js` exporting `id`, `prepare(body)` (returns `{ prompt, schema }` or `{ error }`) and `parse(data, body)`, and register it in `server/server.js`.
2. Add an entry to `LIVE` in `js/engine.js` with `init()` and `round({ s, ask, round, total })`, which asks the gods and returns the turn.
3. Add it to `GAMES` in `js/data.js`.

## Adding a god

1. Add its folder name to `server/gods.js`.
2. Add it to `js/data.js` and draw its sigil in `js/art.js`.
