"""Python-generated board artwork with the original snake and ladder layout."""
import math
from game import SNAKES, LADDERS
COLORS = ("#26b8ed", "#fa637c", "#95cd5c", "#ffca5c")

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
    palette = ("#f9d99a", "#80bfa7", "#d89bb5", "#8ebcd7")
    for square in range(1, 101):
        x, y = center(square)
        row, column = (square-1)//10, int((x-30)//60)
        fill = palette[(column + row*3) % 4]
        if square == 100:
            fill = "#9174bd"
        if square == 1:
            fill = "#329582"
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
