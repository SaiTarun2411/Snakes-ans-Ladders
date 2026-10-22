# Board Game Clubhouse — Snakes and Ladders + Ludo

A Streamlit game with a responsive clubhouse, animated pin tokens, per-player dice, and synthesised sound effects.

## Play

Tap the home-page dice (the large dice or the logo dice) to switch between Snakes and Ladders and Ludo. Both games offer the same local, computer and friend modes.

```sh
python -m pip install -r requirements.txt
streamlit run app.py
```

- **Play local:** one to four humans sharing a device; 1P is solo practice.
- **Play with computer:** one human and one to three automatic opponents.
- **Play with friends:** create a private room for two to four people, share its six-character code, and join on separate devices. The host starts when all seats are filled. Each browser controls only its own seat. Use **Share room** for the native share sheet where supported, or WhatsApp, Telegram, email and a copyable direct link. Shared `?room=CODE&game=ludo` / `game=snakes` links open the matching join screen with the room code filled in.

Tap to enable browser audio, and use the sound button to mute. Tokens walk every square before climbing or sliding. Reduced-motion preferences disable decorative motion. Snakes and Ladders rules and endpoints are unchanged: reach exactly 100; overshoots stay put; sixes pass the turn. Snake slides follow the drawn body.

Ludo: four tokens per player; roll six to leave the yard. After a roll, choose a glowing token. Star and starting squares are safe; captures send opponents back to their yard. Roll exactly to reach home, and finish all four to win. A six earns an extra roll; three consecutive sixes forfeit the turn. Captures and finishing do not earn bonus rolls. Tokens may share a square, without blockades. Use the help button for the rules.

The play screen shows the board, player dice and compact controls, with no history, rules panel or footer beneath it.

## Friend room lifecycle

Rooms are stored in the Python process and expire after six hours without activity. Keep game tabs open: refreshing starts a new Streamlit session. A server restart, deployment, or scale-to-zero ends rooms. Production currently runs at most one replica so all sessions share the same room store. Shared durable storage is needed before enabling multiple replicas or persistent games.

## Container

```sh
docker build -t snakes-and-ladders .
docker run --rm -p 8501:8501 snakes-and-ladders
```

GitHub Actions checks Python rules and concurrent room actions, smoke-tests Streamlit, and publishes the image to `ghcr.io/saitarun2411/snakes-and-ladders`. Azure runs the application at https://game.aiinc.uk.

## Checks

```sh
python -m unittest discover -s tests -v
```

Optional browser checks (with the app running):

```sh
python -m pip install playwright
python -m playwright install chromium
python scripts/check_browser.py
```

Set `GAME_TEST_URL` to test another local port or a deployed app. The checks cover four local players, computer turns, independent friend sessions, and mobile rendering.

For deterministic Ludo browser checks, run `python scripts/check_ludo_browser.py`. This launches an isolated test-only server with sixes fixed for testing, and checks token choices, computer turns, sharing payloads, direct invitation links, multiplayer synchronisation and mobile rendering. Production rolls remain random.
