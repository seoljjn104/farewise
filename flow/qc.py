# -*- coding: utf-8 -*-
"""Raster + geometry QC for the generated flowcharts."""
import os
import xml.etree.ElementTree as ET
from PIL import Image
from fd_core import text_w

HERE = os.path.dirname(os.path.abspath(__file__))


def parse(svg):
    root = ET.parse(svg).getroot()
    shapes, texts, segs = [], [], []
    for el in root.iter():
        tag = el.tag.split("}")[-1]
        cls = el.get("class", "")
        if tag == "rect":
            x, y = float(el.get("x", 0)), float(el.get("y", 0))
            w, h = float(el.get("width", 0)), float(el.get("height", 0))
            if w > 100 and h > 60:
                shapes.append((x, y, w, h))
        elif tag == "polygon":
            pts = [tuple(float(v) for v in p.split(","))
                   for p in el.get("points", "").split()]
            xs = [p[0] for p in pts]
            ys = [p[1] for p in pts]
            shapes.append((min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys)))
        elif tag == "text":
            txt = el.text or ""
            f = float(el.get("font-size", 24))
            x, y = float(el.get("x", 0)), float(el.get("y", 0))
            bold = (el.get("font-weight") or "") == "bold"
            w = text_w(txt, f, bold)
            texts.append((x - w / 2.0, y - f * 0.85, w, f * 1.1, txt))
        elif tag in ("line", "polyline") and "chrome" not in (el.get("class") or ""):
            if tag == "line":
                pts = [(float(el.get("x1", 0)), float(el.get("y1", 0))),
                       (float(el.get("x2", 0)), float(el.get("y2", 0)))]
            else:
                pts = [tuple(float(v) for v in p.split(","))
                       for p in el.get("points", "").split()]
            for i in range(len(pts) - 1):
                segs.append((pts[i], pts[i + 1]))
    return shapes, texts, segs


def inside(p, box, inset):
    x, y, w, h = box
    return (x + inset < p[0] < x + w - inset) and (y + inset < p[1] < y + h - inset)


def check(name, png_name=None, vw=1275):
    svg = os.path.join(HERE, name + ".svg")
    png = os.path.join(HERE, (png_name or name) + ".png")
    shapes, texts, segs = parse(svg)
    # containers (the figure frame) swallow every containment test - drop them
    leaves = [s for s in shapes
              if not any(o is not s
                         and o[0] >= s[0] - 1 and o[1] >= s[1] - 1
                         and o[0] + o[2] <= s[0] + s[2] + 1
                         and o[1] + o[3] <= s[1] + s[3] + 1 for o in shapes)]
    print("== %s ==" % name)
    if not os.path.exists(png):
        print("   PNG MISSING")
        return
    img = Image.open(png).convert("RGB")
    W, H = img.size
    scale = float(W) / vw
    m = img.convert("L").point(lambda v: 255 if v < 200 else 0)
    print("   %dx%d px | scale=%.2f | ink bbox %s" % (W, H, scale, m.getbbox()))

    edges = {"top": m.crop((0, 0, W, 8)), "bottom": m.crop((0, H - 8, W, H)),
             "left": m.crop((0, 0, 8, H)), "right": m.crop((W - 8, 0, W, H))}
    cl = [k for k, v in edges.items() if v.getbbox()]
    root = ET.parse(svg).getroot()
    frame = any(e.tag.endswith("rect") and float(e.get("x", 0)) < 5
                and "chrome" in (e.get("class") or "") for e in root.iter())
    print("   edge clipping: %s%s" % (cl or "none", " (frame by design)"
                                      if frame and cl else ""))

    dead = []
    for i, (x, y, w, h) in enumerate(shapes):
        x0, y0 = int((x + 14) * scale), int((y + 14) * scale)
        x1, y1 = int((x + w - 14) * scale), int((y + h - 14) * scale)
        if x1 <= x0 or y1 <= y0:
            continue
        cnt = sum(1 for v in m.crop((x0, y0, x1, y1)).getdata() if v)
        if cnt < 80:
            dead.append("#%d@(%d,%d) ink=%d" % (i, x, y, cnt))
    print("   shapes w/o interior ink: %s" % (dead or "none"))

    outside = []
    for (tx, ty, tw, th, txt) in texts:
        if txt in ("Yes", "No"):
            continue                      # branch labels sit in whitespace
        if tx < 8 or ty < 8 or tx + tw > vw - 8:
            continue
        if not any(inside((tx + tw / 2, ty + th / 2), s, -2) for s in leaves):
            outside.append(repr(txt[:30]))
    print("   labels outside every shape: %s" % (outside or "none"))

    ov = []
    for i in range(len(shapes)):
        for j in range(i + 1, len(shapes)):
            a, b = shapes[i], shapes[j]
            if inside(a[:2], b, 0) and inside((a[0] + a[2], a[1] + a[3]), b, 0):
                continue
            if inside(b[:2], a, 0) and inside((b[0] + b[2], b[1] + b[3]), a, 0):
                continue
            if (a[0] < b[0] + b[2] and b[0] < a[0] + a[2]
                    and a[1] < b[1] + b[3] and b[1] < a[1] + a[3]):
                ov.append((i, j))
    print("   overlapping shapes: %s" % (ov or "none"))

    # arrows must never cross a shape they do not terminate on
    hits = []
    for (a, b) in segs:
        length = ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2) ** 0.5
        steps = max(2, int(length / 3))
        for k in range(steps + 1):
            t = k / float(steps)
            p = (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
            for si, s in enumerate(shapes):
                if inside(p, s, 8):
                    if inside(a, s, 8) or inside(b, s, 8):
                        break          # segment starts/ends inside: decoration
                    hits.append("#%d %.0f,%.0f" % (si, p[0], p[1]))
                    break
    print("   arrows crossing shapes: %s" % (hits or "none"))
    print("")


if __name__ == "__main__":
    check("system_flowchart", "r_system")
    check("program_flowchart", "r_program")
