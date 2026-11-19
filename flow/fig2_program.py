# -*- coding: utf-8 -*-
"""Figure 2 - Program Flowchart: the FareWise fare computation algorithm.

Same typography rules as Figure 1: Calibri, one node font size, real-metric
text fitting, straight vertical chain with one 32-unit gap under each decision
so its Yes label sits in clear whitespace.
"""
import os
from fd_core import Canvas, Box, arrow, line, label, BLACK

HERE = os.path.dirname(os.path.abspath(__file__))
W = 1275
CX = 520                # main column centre
GAPV, GAPV_DEC = 14, 32
MARGIN_TOP, MARGIN_BOT = 60, 28
LEFT_CORR = 180         # loop-back corridor
BUS_X = 830             # error merge bus
E1_X = 860              # error box left edge
BRANCH_F = 22
H_TERM, H_PROC, H_DEC = 88, 92, 96

# kind, height, width, text
ROWS = [
    ("term", H_TERM, 260, "START"),
    ("proc", H_PROC, 520, "Read origin, destination and vehicle class"),
    ("proc", H_PROC, 520, "Geocode origin and destination (OSM Nominatim)"),
    ("dec", H_DEC, 500, "Geocoding successful?"),
    ("proc", H_PROC, 520, "Request route from OSRM and obtain distance D (km)"),
    ("dec", H_DEC, 500, "Route resolved?"),
    ("proc", H_PROC, 520, "Read base fare B, base distance D_base and rate R"),
    ("dec", H_DEC, 500, "Fare matrix found?"),
    ("proc", H_PROC, 520, "Compute F_gross = B + max(0, D - D_base) x R"),
    ("dec", H_DEC, 500, "Discount applies?"),
    ("proc", H_PROC, 520, "F_final = F_gross x (1 - 0.20)"),
    ("proc", H_PROC, 520, "Display itemized fare breakdown and route map"),
    ("dec", H_DEC, 500, "Log this trip?"),
    ("proc", H_PROC, 520, "INSERT record into trip_ledger (user, fare, time)"),
    ("term", H_TERM, 260, "END"),
]

DEC = [i for i, r in enumerate(ROWS) if r[0] == "dec"]
body = sum(r[1] for r in ROWS)
gaps = sum(GAPV_DEC if i in DEC else GAPV for i in range(len(ROWS) - 1))
H = MARGIN_TOP + body + gaps + MARGIN_BOT
cv = Canvas(W, H)

P = []
y = MARGIN_TOP
for kind, h, w, text in ROWS:
    P.append(Box(CX, y + h / 2.0, w, h, text, kind, bold_first=(kind == "term")))
    y += h + (GAPV_DEC if kind == "dec" else GAPV)
for b in P:
    b.draw(cv)

E1 = Box((E1_X + 1230) / 2.0, P[5].cy, 370, H_PROC,
         "Display error message", "proc")
E1.draw(cv)

# ---- main vertical chain ----
for i in range(len(P) - 1):
    arrow(cv, [P[i].bottom(), P[i + 1].top()])
for i in DEC:
    if i < len(P) - 1:
        label(cv, P[i].cx + 46, P[i].cy + P[i].h / 2.0 + 24, "Yes", BRANCH_F)

# ---- error branches into the merge bus, then one arrow into E1 ----
for idx in (3, 5, 7):
    rv = P[idx].right()
    line(cv, [rv, (BUS_X, rv[1]), (BUS_X, E1.cy)])
    label(cv, rv[0] + 26, P[idx].cy - 16, "No", BRANCH_F)
arrow(cv, [(BUS_X, E1.cy), E1.left()])

# ---- E1 -> END ----
arrow(cv, [E1.bottom(), (E1.cx, P[14].cy), P[14].right()])

# ---- discount = No : skip the discount step ----
lv = P[9].left()
arrow(cv, [lv, (LEFT_CORR, lv[1]), (LEFT_CORR, P[10].cy), P[10].left()])
label(cv, LEFT_CORR + 44, P[9].cy - 16, "No", BRANCH_F)

# ---- log trip = No : skip the ledger insert ----
lv = P[12].left()
arrow(cv, [lv, (LEFT_CORR, lv[1]), (LEFT_CORR, P[14].cy), P[14].left()])
label(cv, LEFT_CORR + 44, P[12].cy - 16, "No", BRANCH_F)

cv.save(os.path.join(HERE, "program_flowchart.svg"))
print("program: W=%d H=%d ratio=%.3f | at 6.0in wide -> %.2f in tall | "
      "font 27 = %.2f pt" % (W, H, float(H) / W, 6.0 * H / W, 27 * 6.0 / W * 72))
for m in cv.report:
    print("   " + m)
