# The Arena (UI)

A game-style UI where two gods face each other in a strategy game. See [../ARENA.md](../ARENA.md) for the games and why they matter.

## Run it

No build step. From this folder:

```bash
python3 -m http.server 4173
```

Then open http://localhost:4173.

## The flow

1. **Title:** enter the multiverse.
2. **Choose the Trial:** pick one of the games. Werewolf and Diplomacy are sealed until there are enough gods.
3. **Summon Two Gods:** the left realm gets one god and the right realm the other. Mirror matches are allowed.
4. **Battle:** a VS intro, then round by round each god speaks, reveals its move and the realms clash. A verdict screen ends the match.

Controls in battle: <kbd>Space</kbd> pauses, the speed button cycles 1×/2×/4×, and <kbd>Esc</kbd> goes back.

## Files

| File | What it holds |
|---|---|
| `js/data.js` | The god roster and game catalogue. A new god added here shows up on the select screen. |
| `js/art.js` | SVG sigils for each god and glyphs for each game. |
| `js/engine.js` | The match engine. **Currently a mock:** hand-written temperaments and canned lines. |
| `js/cosmos.js` | The animated multiverse background (stars, realm nebulae, energy streams, impacts). |
| `js/app.js` | Screens, selection flow and battle playback. |
| `css/arena.css` | All styling. |

## Plugging in real gods

The UI only needs `Engine.create(game, leftGod, rightGod).next()` to return one turn at a time (a plain object or a Promise of one), in the shape documented at the top of `js/engine.js`. To play with real AIs, replace the mock rules with calls to the API and keep that shape. Nothing else in the UI has to change.
