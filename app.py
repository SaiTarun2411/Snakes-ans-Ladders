"""Two-player Snakes and Ladders. Run: streamlit run app.py"""

import math
import random

import streamlit as st


LADDERS = {2: 38, 7: 14, 8: 31, 15: 26, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 78: 98}
SNAKES = {16: 6, 46: 25, 49: 11, 62: 19, 64: 60, 74: 53, 89: 68, 92: 88, 95: 75, 99: 80}
COLORS = ("#2563eb", "#e11d48")
DICE = ("⚀", "⚁", "⚂", "⚃", "⚄", "⚅")


def new_game():
    st.session_state.game = {
        "positions": [0, 0], "turn": 0, "dice": None,
        "winner": None, "history": [],
        "message": "Player 1 starts. Roll the dice!",
    }


def move(position, roll):
    """Return the final square and an explanation; an exact roll wins."""
    target = position + roll
    if target > 100:
        return position, "needs an exact roll to reach 100 and stays put."
    if target in LADDERS:
        return LADDERS[target], f"lands on {target} and climbs a ladder to {LADDERS[target]}!"
    if target in SNAKES:
        return SNAKES[target], f"lands on {target} and slides down a snake to {SNAKES[target]}!"
    return target, f"moves to {target}."


def roll_dice():
    game = st.session_state.game
    if game["winner"] is not None:
        return
    player = game["turn"]
    roll = random.randint(1, 6)
    destination, description = move(game["positions"][player], roll)
    game["positions"][player] = destination
    game["dice"] = roll
    message = f"Player {player + 1} rolled {roll}: {description}"
    if destination == 100:
        game["winner"] = player
        message += f" 🏆 Player {player + 1} wins!"
    else:
        game["turn"] = 1 - player
    game["message"] = message
    game["history"].append(message)


def center(square):
    row, column = divmod(square - 1, 10)
    if row % 2:
        column = 9 - column
    return column * 60 + 30, (9 - row) * 60 + 30


def board_svg(positions):
    """Draw a scalable board in Python, with ladders, snakes and numbered tokens."""
    parts = ['<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600" role="img" aria-label="Snakes and Ladders board">']
    for square in range(1, 101):
        x, y = center(square)
        fill = "#f0fdf4" if ((square - 1) // 10 + (x - 30) // 60) % 2 else "#e0f2fe"
        if square == 100:
            fill = "#fde68a"
        parts.append(f'<rect x="{x-30}" y="{y-30}" width="60" height="60" fill="{fill}" stroke="#94a3b8" stroke-width="0.7"/>')

    for start, end in LADDERS.items():
        x1, y1 = center(start)
        x2, y2 = center(end)
        length = math.hypot(x2-x1, y2-y1)
        px, py = -(y2-y1)/length*6, (x2-x1)/length*6
        for sign in (-1, 1):
            parts.append(f'<line x1="{x1+sign*px}" y1="{y1+sign*py}" x2="{x2+sign*px}" y2="{y2+sign*py}" stroke="#a16207" stroke-width="4"/>')
        steps = max(3, int(length / 18))
        for i in range(steps + 1):
            t = i / steps
            x, y = x1+(x2-x1)*t, y1+(y2-y1)*t
            parts.append(f'<line x1="{x-px}" y1="{y-py}" x2="{x+px}" y2="{y+py}" stroke="#a16207" stroke-width="3"/>')

    for start, end in SNAKES.items():
        x1, y1 = center(start)
        x2, y2 = center(end)
        path = f'M {x1} {y1} C {x1+35} {y1+35}, {x2-35} {y2-35}, {x2} {y2}'
        parts.append(f'<path d="{path}" fill="none" stroke="#166534" stroke-width="11" stroke-linecap="round"/>')
        parts.append(f'<path d="{path}" fill="none" stroke="#4ade80" stroke-width="5" stroke-linecap="round"/>')
        parts.append(f'<ellipse cx="{x1}" cy="{y1}" rx="10" ry="8" fill="#166534"/>')
        for offset in (-4, 4):
            parts.append(f'<circle cx="{x1+offset}" cy="{y1-2}" r="2" fill="white"/>')

    # Put labels and tokens above the connecting artwork for readability.
    for square in range(1, 101):
        x, y = center(square)
        parts.append(f'<rect x="{x-28}" y="{y-28}" width="25" height="17" rx="3" fill="white" fill-opacity="0.9"/>')
        parts.append(f'<text x="{x-25}" y="{y-15}" font-family="sans-serif" font-size="12" fill="#0f172a">{square}</text>')
    for player, square in enumerate(positions):
        if square == 0:
            continue
        x, y = center(square)
        x += -12 if player == 0 else 12
        y += 10
        parts.append(f'<circle cx="{x}" cy="{y}" r="12" fill="{COLORS[player]}" stroke="white" stroke-width="2"/>')
        parts.append(f'<text x="{x}" y="{y+4}" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="bold" fill="white">{player+1}</text>')
    parts.append('</svg>')
    return "".join(parts)


def main():
    st.set_page_config(page_title="Snakes and Ladders", page_icon="🎲", layout="wide")
    if "game" not in st.session_state:
        new_game()
    game = st.session_state.game
    st.title("🐍 Snakes and Ladders")
    st.caption("Two players · One board · First to reach 100 wins")

    board, controls = st.columns([3, 2])
    with controls:
        if game["winner"] is not None:
            st.success(f"🏆 Player {game['winner'] + 1} wins!")
        else:
            st.subheader(f"{'🔵' if game['turn'] == 0 else '🔴'} Player {game['turn'] + 1}'s turn")
        p1, p2 = st.columns(2)
        for player, column in enumerate((p1, p2)):
            position = game["positions"][player]
            column.metric(f"{'🔵' if player == 0 else '🔴'} Player {player+1}", str(position) if position else "Start")
        dice = game["dice"]
        st.subheader(f"{DICE[dice-1]}  Rolled {dice}" if dice else "🎲 Ready to roll")
        st.button("🎲 Roll dice", on_click=roll_dice, disabled=game["winner"] is not None, type="primary")
        st.info(game["message"])
        st.button("↻ New game", on_click=new_game)
        with st.expander("How to play", expanded=True):
            st.write("Take turns on this device. Roll to enter from Start (square 0). Brown ladders take you up; green snakes take you down. Land exactly on 100 to win. If you overshoot, stay put. Rolling a six does not give an extra turn. Players can share a square.")
        with st.expander("Snakes and ladders"):
            st.write("Ladders: " + " · ".join(f"{a} → {b}" for a, b in LADDERS.items()))
            st.write("Snakes: " + " · ".join(f"{a} → {b}" for a, b in SNAKES.items()))
        with st.expander("Move history"):
            if not game["history"]:
                st.caption("Your moves will appear here.")
            for message in reversed(game["history"][-30:]):
                st.write(message)
    with board:
        st.image(board_svg(game["positions"]), width="stretch")
        st.caption("🔵 Player 1 · 🔴 Player 2 · Brown ladders climb up · Green snakes slide down")


if __name__ == "__main__":
    main()
