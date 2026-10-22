# Snakes and Ladders

A Streamlit game with a responsive clubhouse, animated pin tokens, per-player dice, and synthesised sound effects.

## Play

```sh
python -m pip install -r requirements.txt
streamlit run app.py
```

- **Play local:** one to four humans sharing a device; 1P is solo practice.
- **Play with computer:** one human and one to three automatic opponents.
- **Play with friends:** create a private room for two to four people, share its six-character code, and join on separate devices. The host starts when all seats are filled. Each browser controls only its own seat.

Tap to enable browser audio, and use the sound button to mute. Tokens walk every square before climbing or sliding. Reduced-motion preferences disable decorative motion. Rules and snake/ladder endpoints are unchanged: reach exactly 100; overshoots stay put; sixes pass the turn.

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
