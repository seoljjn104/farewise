# -*- coding: utf-8 -*-
"""Figure 1 - System Flowchart (4 swimlanes, portrait).

Typography: Calibri (the same family the charter uses). Every node uses one
font size and every label is fitted against REAL font metrics.

Routing rules (kept explicit so no two lines can collide):
  * consecutive rows in the SAME lane  -> straight vertical arrow
  * consecutive rows in DIFFERENT lanes -> drop from the source, then run
    horizontally into the target's side edge (arrowhead points sideways)
  * the three feedback loops share one vertical corridor at X = 200 inside the
    empty COMMUTER lane, over three disjoint row ranges (3-6, 8-10, 11-13)
"""
import os
from fd_core import Canvas, Box, arrow, label, esc, BLACK

HERE = os.path.dirname(os.path.abspath(__file__))
W = 1275
LANE_B = [0, 290, 640, 990, 1275]
LANE_T = ["COMMUTER / USER", "FAREWISE PWA", "SUPABASE (BACKEND)",
          "EXTERNAL SERVICES"]
LANE_CX = [(LANE_B[i] + LANE_B[i + 1]) / 2.0 for i in range(4)]
LANE_W = [270, 330, 330, 265]

GAP, GAP_DEC = 12, 32          # bigger gap under a decision for its Yes label
MARGIN_TOP, MARGIN_BOT = 78, 18
BAND = 74                      # bottom of the lane-header band
CORRIDOR = 200                 # feedback column, inside the empty COMMUTER lane
BRANCH_F = 22                  # Yes / No label size
H_TERM, H_PROC, H_DEC = 124, 88, 96

# lane, kind, height, text
ROWS = [
    (0, "term", H_TERM, "START|Commuter opens|FareWise PWA"),
    (1, "proc", H_PROC, "Load app shell and restore session"),
    (2, "proc", H_PROC, "Supabase Auth verifies user and issues JWT"),
    (1, "io", H_PROC, "Origin, destination and vehicle class"),
    (3, "proc", H_PROC, "OSRM returns distance D (km)"),
    (2, "proc", H_PROC, "Read B, D_base and rate R"),
    (2, "dec", H_DEC, "Matrix found?"),
    (2, "proc", H_PROC, "Compute F_gross = B + excess x R"),
    (2, "dec", H_DEC, "Discount?"),
    (2, "proc", H_PROC, "Apply the 20% statutory discount"),
    (1, "proc", H_PROC, "Display itemized fare breakdown and map"),
    (1, "dec", H_DEC, "Log trip?"),
    (2, "proc", H_PROC, "INSERT record into trip_ledger table"),
    (1, "proc", H_PROC, "Update budget dashboard analytics"),
    (1, "pre", H_PROC, "Advisory module (submit/moderate)"),
    (0, "term", H_TERM, "END|Fare resolved|trip recorded"),
]

body = sum(r[2] for r in ROWS)
gaps = sum(GAP_DEC if ROWS[i][1] == "dec" else GAP for i in range(len(ROWS) - 1))
H = MARGIN_TOP + body + gaps + MARGIN_BOT
cv = Canvas(W, H)

# ---------- lane chrome ----------
cv.add('<rect class="chrome" x="3" y="3" width="%g" height="%g" fill="none" '
       'stroke="%s" stroke-width="2.4"/>' % (W - 6, H - 6, BLACK))
for i, name in enumerate(LANE_T):
    cv.add('<text x="%g" y="42" font-family="Calibri, Carlito, sans-serif" '
           'font-size="26" font-weight="bold" fill="%s" text-anchor="middle">%s'
           '</text>' % (LANE_CX[i], BLACK, esc(name)))
cv.add('<line class="chrome" x1="3" y1="%g" x2="%g" y2="%g" stroke="%s" '
       'stroke-width="2.4"/>' % (BAND, W - 3, BAND, BLACK))
for xb in LANE_B[1:-1]:
    cv.add('<line class="chrome" x1="%g" y1="%g" x2="%g" y2="%g" stroke="%s" '
           'stroke-width="1.5" stroke-dasharray="8 8"/>'
           % (xb, BAND, xb, H - 3, BLACK))

# ---------- place nodes ----------
P = []
y = MARGIN_TOP
for lane, kind, h, text in ROWS:
    P.append(Box(LANE_CX[lane], y + h / 2.0, LANE_W[lane], h, text, kind,
                 bold_first=(kind == "term")))
    y += h + (GAP_DEC if kind == "dec" else GAP)
for b in P:
    b.draw(cv)

# side node: fare-unavailable notice, in the FRONTEND lane at the decision row
notice = Box(LANE_CX[1], P[6].cy, LANE_W[1], 92, "Show fare-unavailable notice")
notice.draw(cv)


def vh(a, b):
    """Drop vertically from a, then run horizontally into b."""
    arrow(cv, [a, (a[0], b[1]), b])


def yes(box):
    label(cv, box.cx + 46, box.cy + box.h / 2.0 + 24, "Yes", BRANCH_F)


# ---------- forward flow ----------
vh(P[0].bottom(), P[1].left())
vh(P[1].bottom(), P[2].left())
vh(P[2].bottom(), P[3].right())
vh(P[3].bottom(), P[4].left())
vh(P[4].bottom(), P[5].right())
arrow(cv, [P[5].bottom(), P[6].top()])
arrow(cv, [P[6].bottom(), P[7].top()])
yes(P[6])
arrow(cv, [P[7].bottom(), P[8].top()])
arrow(cv, [P[8].bottom(), P[9].top()])
yes(P[8])
vh(P[9].bottom(), P[10].right())
arrow(cv, [P[10].bottom(), P[11].top()])
vh(P[11].bottom(), P[12].left())
yes(P[11])
vh(P[12].bottom(), P[13].right())
arrow(cv, [P[13].bottom(), P[14].top()])
vh(P[14].bottom(), P[15].right())

# ---------- feedback 1: no fare matrix -> notice -> back to the input form ---
arrow(cv, [P[6].left(), notice.right()])
label(cv, (P[6].left()[0] + notice.right()[0]) / 2.0, P[6].cy - 14, "No",
      BRANCH_F)
arrow(cv, [notice.left(), (CORRIDOR, notice.left()[1]),
           (CORRIDOR, P[3].cy), P[3].left()])

# ---------- feedback 2: no discount -> skip straight to the result screen ----
arrow(cv, [P[8].left(), (CORRIDOR, P[8].cy),
           (CORRIDOR, P[10].cy), P[10].left()])
label(cv, P[8].left()[0] - 44, P[8].cy - 14, "No", BRANCH_F)

# ---------- feedback 3: trip not logged -> skip the ledger insert ----------
arrow(cv, [P[11].left(), (CORRIDOR, P[11].cy),
           (CORRIDOR, P[13].cy), P[13].left()])
label(cv, P[11].left()[0] - 44, P[11].cy - 14, "No", BRANCH_F)

cv.save(os.path.join(HERE, "system_flowchart.svg"))
print("system: W=%d H=%d ratio=%.3f | at 6.0in wide -> %.2f in tall | "
      "font 27 = %.2f pt" % (W, H, float(H) / W, 6.0 * H / W, 27 * 6.0 / W * 72))
for m in cv.report:
    print("   " + m)
