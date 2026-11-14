# The Arena

A game-style UI where two gods face each other in a strategy game. See [../ARENA.md](../ARENA.md) for the games and why they matter.

**Prisoner's Dilemma is live:** each god's move comes from Gemini with the god's skill loaded. The other games still run on simulated moves (marked "Demo").

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

- Each god gets its **own** request, so neither sees the other's move this round.
- History is sent from each god's point of view: `{ "you": "cooperate", "opponent": "betray" }`.
- The **Plain AI** gets no skill, so it is the control group.
- Gemini is forced to answer as JSON (`responseSchema`): `move` is `cooperate` or `betray`, and `line` is one sentence in the god's voice.
- Scoring happens in the frontend from the two moves.

### API

```
POST /api/move
{ "game": "prisoners-dilemma", "god": "karma", "round": 3, "totalRounds": 12,
  "history": [ { "you": "cooperate", "opponent": "betray" }, { "you": "betray", "opponent": "betray" } ] }

200 → { "god": "karma", "round": 3, "move": "cooperate", "line": "You returned to good faith. So do I." }
4xx/5xx → { "error": "..." }
```

Bad JSON or an invalid move from Gemini is retried once. Rate limits (429) and overloads (503) are waited out and retried, up to 4 attempts. The **free tier allows only about 5 requests a minute** on `gemini-2.5-flash`, so a 12-round match (24 calls) takes a few minutes there. Use a paid key or a lighter model for faster matches.

### Settings (`arena/.env`)

| Variable | Default | |
|---|---|---|
| `GEMINI_API_KEY` | none | Required. |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Any Gemini model that supports JSON output. |
| `PORT` | `4173` | |

## Files

| File | What it holds |
|---|---|
| `server/server.js` | HTTP server: serves the UI and handles `POST /api/move`. |
| `server/gods.js` | Maps a god id to its skill folder and builds the system instruction. |
| `server/gemini.js` | The Gemini call with JSON output. |
| `server/games/prisoners-dilemma.js` | The game's prompt, JSON schema and validation. |
| `js/engine.js` | Live games call the API; other games use mock rules. |
| `js/data.js` | The god roster and game catalogue. |
| `js/art.js` | SVG sigils for each god and glyphs for each game. |
| `js/cosmos.js` | The animated multiverse background. |
| `js/app.js` | Screens, selection flow and battle playback. |
| `css/arena.css` | All styling. |

## Making another game live

1. Add `server/games/<game>.js` exporting `id`, `schema`, `validateRequest`, `buildPrompt` and `parseResponse`, and register it in `server/server.js`.
2. Add an entry to `LIVE` in `js/engine.js` with the game's `label` and `resolve` (scoring).

## Adding a god

1. Add its folder name to `server/gods.js`.
2. Add it to `js/data.js` and draw its sigil in `js/art.js`.
