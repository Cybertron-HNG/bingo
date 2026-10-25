# Bingo on start.ng

Host a bingo for a room of up to 100 people, like a class or a party. It will live at `bingo.start.ng`.

- The person who makes the room is the **host**. They pick what is on the cards: the classic numbers 1 to 75 (B, I, N, G, O), or **their own words** (24 to 100) for a class or a party. They pick how fast numbers are drawn (4 to 30 seconds) and how to win (a line, or the full card), then share the code and start the game.
- Everyone else joins with the code or the link and gets their own private card (the centre is free). start.ng draws one item at a time; players tap the squares that were called and press **BINGO!**.
- The server checks every claim against the card and the squares marked. A wrong claim costs 10 seconds. The first right claim wins. The host can draw now or pause.
- A player who drops can come back (10 minutes). Everyone needs to be signed in with start.ng.

A plain HTML, CSS and JavaScript game (no build step) that loads the start.ng Kit (`https://start.ng/kit.js`). The rules live on the server (`startng-be`, `app/features/rooms/games/bingo.py`).

The host sends `room.setup({ mode: 'numbers' | 'terms', terms, speed, pattern })` and then `room.start()`; a player sends `room.send({ mark: 0-24 })` and `room.send({ bingo: true })`; the host sends `room.send({ draw: true })` or `room.send({ pause: true })`.

## Publish
On start.ng, sign in, open **Your games** and paste this repo's link. The repo must be named `bingo`, because the server's rooms know the game by that name.

| File | What it does |
| --- | --- |
| `index.html` | The page: lobby, host settings, waiting room, game |
| `game.js` | The lobby, rooms (through `startng.rooms`), the card and the screens |
| `style.css` | The look |
| `startng.json` | The description shown on the game's page |
