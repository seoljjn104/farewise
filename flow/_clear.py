# -*- coding: utf-8 -*-
"""Exact text clearance inside each node, using real metrics plus the shape's
true boundary (rect / stadium / diamond / parallelogram).

For every text line we evaluate the shape's left and right boundary at that
line's top and bottom edge, then report the smallest horizontal and vertical
clearance found in the figure.
"""
import os
import sys
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from fd_core import text_w          # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))


def parse(svg):
    root = ET.parse(svg).getroot()
    shapes, texts = [], []
    for el in root.iter():
        tag = el.tag.split("}")[-1]
        g = el.get
        if tag == "rect":
            w, h = float(g("width", 0)), float(g("height", 0))
            if w > 100 and h > 60:
                shapes.append(("rect", float(g("x")), float(g("y")), w, h, 0.0))
        elif tag == "polygon":
            p = [tuple(float(v) for v in q.split(","))
                 for q in g("points").split()]
            xs = [a[0] for a in p]
            ys = [a[1] for a in p]
            x0, y0 = min(xs), min(ys)
            w, h = max(xs) - x0, max(ys) - y0
            is_dia = (abs(p[0][0] - (x0 + w / 2.0)) < 1
                      and abs(p[1][1] - (y0 + h / 2.0)) < 1)
            shapes.append(("dia" if is_dia else "par", x0, y0, w, h, h * 0.25))
        elif tag == "text":
            texts.append((float(g("x", 0)), float(g("y", 0)),
                          float(g("font-size", 24)),
                          (g("font-weight") or "") == "bold", el.text or ""))
    return shapes, texts


def leftright(sh, dy):
    """Shape's x-boundaries at vertical offset dy from its centre."""
    kind, x, y, w, h, extra = sh
    cx = x + w / 2.0
    if kind == "rect":
        return x, x + w
    if kind == "dia":                       # rhombus: half-width tapers
        a, b = w / 2.0, h / 2.0
        hw = a * max(0.0, 1.0 - abs(dy) / b)
        return cx - hw, cx + hw
    if kind == "par":                       # parallelogram, skew = extra
        sk = extra
        return (cx - w / 2.0 + sk / 2.0 - sk * dy / h,
                cx + w / 2.0 - sk / 2.0 - sk * dy / h)
    r = h / 2.0                             # stadium
    hw = (w / 2.0 - r) + (r * r - min(dy * dy, r * r)) ** 0.5
    return cx - hw, cx + hw


def run(svgname, vw=1275):
    shapes, texts = parse(os.path.join(HERE, svgname))
    leaves = [s for s in shapes
              if not any(o is not s and o[1] >= s[1] - 1 and o[2] >= s[2] - 1
                         and o[1] + o[3] <= s[1] + s[3] + 1
                         and o[2] + o[4] <= s[2] + s[4] + 1 for o in shapes)]
    pt = 6.0 / vw * 72
    hgap = None
    vgap = None
    n = 0
    for sh in leaves:
        _, x, y, w, h, _e = sh
        cx, cy = x + w / 2.0, y + h / 2.0
        mine = [t for t in texts
                if x - 2 <= t[0] <= x + w + 2
                and y - 2 <= t[1] <= y + h + 2]
        if not mine:
            continue
        halfw = max(text_w(t[4], t[2], t[3]) / 2.0 for t in mine)
        top = min(t[1] - t[2] * 0.72 for t in mine) - cy
        bot = max(t[1] + t[2] * 0.21 for t in mine) - cy
        for dy in (top, bot):
            l, r = leftright(sh, dy)
            g = min(cx - halfw - l, r - (cx + halfw))
            hgap = g if hgap is None else min(hgap, g)
        vt = h / 2.0 + top
        vb = h / 2.0 - bot
        vgap = min(vt, vb) if vgap is None else min(vgap, vt, vb)
        n += 1
    print("== %s ==" % svgname)
    print("   nodes measured      : %d" % n)
    print("   MIN horizontal clear: %.1f units = %.1f pt each side"
          % (hgap, hgap * pt))
    print("   MIN vertical clear  : %.1f units = %.1f pt (top or bottom)"
          % (vgap, vgap * pt))
    print("")


run("system_flowchart.svg")
run("program_flowchart.svg")
