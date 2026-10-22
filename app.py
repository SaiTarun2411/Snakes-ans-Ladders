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
    """Reference-inspired artwork; all square coordinates and connections stay fixed."""
    parts = ['''<svg xmlns="http://www.w3.org/2000/svg" width="640" height="740" viewBox="-20 -105 640 740" role="img" aria-label="Colourful Snakes and Ladders board">
    <defs>
      <linearGradient id="sky" x2="0" y2="1"><stop stop-color="#38bdf8"/><stop offset="1" stop-color="#d9f8ff"/></linearGradient>
      <linearGradient id="wood" x2="0" y2="1"><stop stop-color="#b86a28"/><stop offset=".5" stop-color="#854015"/><stop offset="1" stop-color="#54270f"/></linearGradient>
      <linearGradient id="shine" x2="1" y2="1"><stop stop-color="white" stop-opacity=".22"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-opacity=".35"/></filter>
    </defs>
    <rect x="-20" y="-105" width="640" height="740" rx="20" fill="url(#sky)"/>
    <g fill="white" opacity=".8"><ellipse cx="20" cy="-64" rx="55" ry="12"/><circle cx="4" cy="-78" r="22"/><circle cx="32" cy="-72" r="16"/><ellipse cx="590" cy="-59" rx="53" ry="12"/><circle cx="603" cy="-77" r="24"/></g>
    <g fill="#229f38" stroke="#14532d" stroke-width="2"><path d="M70,-40 Q35,-95 9,-55 Q37,-57 70,-40 M68,-40 Q48,-101 83,-99 Q92,-72 68,-40 M530,-40 Q565,-95 591,-55 Q563,-57 530,-40 M532,-40 Q552,-101 517,-99 Q508,-72 532,-40"/></g>
    <rect x="65" y="-94" width="470" height="76" rx="19" fill="url(#wood)" stroke="#45240e" stroke-width="4"/>
    <path d="M80,-77 Q210,-87 340,-77 T520,-77 M78,-33 Q230,-41 390,-31" fill="none" stroke="#e2a35c" stroke-width="3" opacity=".4"/>
    <text x="300" y="-43" text-anchor="middle" font-family="Trebuchet MS,Arial,sans-serif" font-size="38" font-weight="900" fill="#ffe43b" stroke="#723209" stroke-width="5" paint-order="stroke">SNAKES &amp; LADDERS</text>
    <rect x="-8" y="-8" width="616" height="616" rx="10" fill="#bd6b20" stroke="#512b13" stroke-width="4"/>
    <path d="M-20,620 Q80,597 180,618 T380,617 T620,615 L620,635 L-20,635 Z" fill="#31a537"/>
    ''']
    palette = ("#ffdc32", "#27a848", "#ff5031", "#058cde")
    for square in range(1, 101):
        x, y = center(square)
        row, column = (square-1)//10, int((x-30)//60)
        fill = palette[(column + row*3) % 4]
        if square == 100:
            fill = "#f04424"
        if square == 1:
            fill = "#149b50"
        parts.append(f'<rect x="{x-30}" y="{y-30}" width="60" height="60" fill="{fill}" stroke="#353017" stroke-width="1.3"/>')
        parts.append(f'<rect x="{x-29}" y="{y-29}" width="58" height="58" fill="url(#shine)"/>')

    for start, end in LADDERS.items():
        x1, y1 = center(start)
        x2, y2 = center(end)
        length = math.hypot(x2-x1, y2-y1)
        px, py = -(y2-y1)/length*7, (x2-x1)/length*7
        parts.append(f'<g filter="url(#shadow)"><title>Ladder: {start} to {end}</title>')
        steps = max(3, int(length / 19))
        for i in range(1, steps):
            t = i / steps
            x, y = x1+(x2-x1)*t, y1+(y2-y1)*t
            parts.append(f'<path d="M{x-px},{y-py} L{x+px},{y+py}" stroke="#57320c" stroke-width="8" stroke-linecap="round"/>')
            parts.append(f'<path d="M{x-px},{y-py-1} L{x+px},{y+py-1}" stroke="#f8c64e" stroke-width="4"/>')
        for sign in (-1, 1):
            path = f'M{x1+sign*px},{y1+sign*py} L{x2+sign*px},{y2+sign*py}'
            parts.append(f'<path d="{path}" stroke="#57320c" stroke-width="9" stroke-linecap="round"/>')
            parts.append(f'<path d="{path}" stroke="#e9ab32" stroke-width="5" stroke-linecap="round"/>')
        parts.append('</g>')

    snake_colors = (("#1d9e42", "#b5ef63"), ("#e63846", "#ffb54a"), ("#8a3bd1", "#eb9cf5"), ("#0875bf", "#ffab61"))
    for index, (start, end) in enumerate(SNAKES.items()):
        x1, y1 = center(start)
        x2, y2 = center(end)
        length = math.hypot(x2-x1, y2-y1)
        nx, ny = -(y2-y1)/length, (x2-x1)/length
        amplitude = min(17, length*.15)
        points = []
        for i in range(61):
            t = i / 60
            wave = amplitude * math.sin(t*math.pi*4) * math.sin(math.pi*t)
            points.append((x1+(x2-x1)*t+nx*wave, y1+(y2-y1)*t+ny*wave))
        path = 'M ' + ' L '.join(f'{x:.2f},{y:.2f}' for x, y in points)
        body, spots = snake_colors[index % len(snake_colors)]
        parts.append(f'<g filter="url(#shadow)"><title>Snake: {start} to {end}</title>')
        for color, width in (("#28301b", 12), (body, 9)):
            parts.append(f'<path d="{path}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linecap="round"/>')
        parts.append(f'<path d="{path}" fill="none" stroke="{spots}" stroke-width="3" stroke-dasharray="3 12" stroke-linecap="round"/>')
        parts.append(f'<ellipse cx="{x1}" cy="{y1}" rx="12" ry="9" fill="{body}" stroke="#28301b" stroke-width="1.5"/>')
        for offset in (-5, 5):
            parts.append(f'<ellipse cx="{x1+offset}" cy="{y1-5}" rx="4" ry="5" fill="white" stroke="#28301b" stroke-width="1"/>')
            parts.append(f'<circle cx="{x1+offset+1}" cy="{y1-5}" r="2" fill="#17221b"/>')
        parts.append(f'<path d="M{x1-6},{y1+3} Q{x1},{y1+9} {x1+7},{y1+2}" fill="none" stroke="#28301b" stroke-width="1.5"/>')
        parts.append(f'<path d="M{x1+2},{y1+7} l2,9 m0,0 l-3,3 m3,-3 l3,2" fill="none" stroke="#e11d48" stroke-width="2"/>')
        parts.append('</g>')

    # Labels remain above the artwork, so all 100 squares can be read.
    for square in range(1, 101):
        x, y = center(square)
        parts.append(f'<text x="{x-24}" y="{y-14}" font-family="Trebuchet MS,Arial,sans-serif" font-size="14" font-weight="bold" fill="white" stroke="#223325" stroke-width="2.5" paint-order="stroke">{square}</text>')
        if square in (1, 100):
            label = "START" if square == 1 else "FINISH"
            parts.append(f'<text x="{x}" y="{y+22}" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" font-weight="bold" fill="white">{label}</text>')
    for player, square in enumerate(positions):
        if square == 0:
            continue
        x, y = center(square)
        x += -12 if player == 0 else 12
        y += 6
        parts.append(f'<g filter="url(#shadow)"><circle cx="{x}" cy="{y}" r="12" fill="{COLORS[player]}" stroke="white" stroke-width="2.5"/>')
        parts.append(f'<text x="{x}" y="{y+4}" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="bold" fill="white">{player+1}</text></g>')
    parts.append('</svg>')
    return "".join(parts)


def main():
    st.set_page_config(page_title="Snakes and Ladders", page_icon="🎲", layout="wide")
    if "game" not in st.session_state:
        new_game()
    game = st.session_state.game
    st.title("Snakes and Ladders")
    st.caption("A little luck. A big climb. An adventure for two.")

    board, controls = st.columns([7, 3], gap="large")
    with controls, st.container(border=True):
        st.caption("THE PLAYERS’ CLUB")
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
            st.write("Take turns on this device. Roll to enter from Start (square 0). Golden ladders take you up; colourful snakes take you down. Land exactly on 100 to win. If you overshoot, stay put. Rolling a six does not give an extra turn. Players can share a square.")
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
        st.caption("🔵 Player 1 · 🔴 Player 2 · Golden ladders climb up · Colourful snakes slide down")


if __name__ == "__main__":
    main()
