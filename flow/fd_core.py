# -*- coding: utf-8 -*-
"""Flowchart drawing core: shapes, arrows, text fitting.

Typography notes
----------------
* Calibri - the same family the charter's Normal/Heading styles use.
* Text is wrapped and fitted with REAL font metrics (Pillow + the installed
  TTF), not a "average character width" guess, so a line can never spill out
  of its shape.
* LINE is the baseline-to-baseline spacing as a multiple of the font size.
"""
import os
from PIL import ImageFont

BLACK = "#000000"
WHITE = "#ffffff"
FONT = "Calibri, Carlito, 'Segoe UI', Arial, sans-serif"

LINE = 1.30              # baseline-to-baseline spacing (em)
FONTS = (27, 25, 23, 21)  # preferred node font size, then fallbacks

_FILES = {
    False: (r"C:\Windows\Fonts\calibri.ttf",
            r"C:\Windows\Fonts\Carlito-Regular.ttf",
            r"C:\Windows\Fonts\segoeui.ttf",
            r"C:\Windows\Fonts\arial.ttf"),
    True: (r"C:\Windows\Fonts\calibrib.ttf",
           r"C:\Windows\Fonts\Carlito-Bold.ttf",
           r"C:\Windows\Fonts\segoeuib.ttf",
           r"C:\Windows\Fonts\arialbd.ttf"),
}
_K = 4.0                 # measure at 4x then scale down (sub-unit precision)
_CACHE = {}
_FALLBACK = 0.50         # em per character, only if no TTF can be loaded


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _pil(size, bold):
    key = (int(round(size * _K)), bold)
    if key not in _CACHE:
        fnt = None
        for p in _FILES[bold]:
            if os.path.exists(p):
                try:
                    fnt = ImageFont.truetype(p, key[0])
                    break
                except Exception:
                    fnt = None
        _CACHE[key] = fnt
    return _CACHE[key]


def text_w(s, size, bold=False):
    """Advance width of s in canvas units at the given font size."""
    f = _pil(size, bold)
    if f is None:
        return len(s) * size * _FALLBACK
    return f.getlength(s) / _K


def wrap_w(text, max_w, size, bold=False):
    """Greedy word wrap by measured width."""
    lines, cur = [], ""
    for word in text.split():
        cand = (cur + " " + word).strip()
        if not cur or text_w(cand, size, bold) <= max_w:
            cur = cand
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def wrap_forced(text, max_w, size, bold=False):
    """'|' forces a break; segments are still width-wrapped."""
    out = []
    for seg in text.split("|"):
        out.extend(wrap_w(seg, max_w, size, bold))
    return out


def fit(cx, cy, text, max_w, max_h, fonts=FONTS, bold_first=False,
        report=None, tag=""):
    """Largest font in `fonts` whose wrapped text fits max_w x max_h."""
    best = None
    for f in fonts:
        lines = wrap_forced(text, max_w, f)
        lh = f * LINE
        widest = max(text_w(l, f) for l in lines)
        if len(lines) * lh <= max_h and widest <= max_w + 0.5:
            best = (f, lines, lh)
            break
    if best is None:
        f = fonts[-1]
        lines = wrap_forced(text, max_w, f)
        lh = f * LINE
        best = (f, lines, lh)
        if report is not None:
            report.append(
                "OVERFLOW %-22s lines=%d font=%g w=%.0f/%.0f h=%.0f/%.0f"
                % (tag, len(lines), f, max(text_w(l, f) for l in lines), max_w,
                   len(lines) * lh, max_h))
    f, lines, lh = best
    if report is not None and f != fonts[0]:
        report.append("SHRUNK   %-22s font %g->%g (%d lines) - enlarge box or "
                      "shorten" % (tag, fonts[0], f, len(lines)))
    total = len(lines) * lh
    y0 = cy - total / 2.0 + lh * 0.78
    out = []
    for i, ln in enumerate(lines):
        weight = ' font-weight="bold"' if (bold_first and i == 0) else ""
        out.append(
            '<text x="%g" y="%g" font-family="%s" font-size="%g" fill="%s" '
            'text-anchor="middle"%s>%s</text>'
            % (cx, y0 + i * lh, FONT, f, BLACK, weight, esc(ln))
        )
    return "\n".join(out)


def _rect(x, y, w, h, rx):
    return ('<rect x="%g" y="%g" width="%g" height="%g" rx="%g" fill="%s" '
            'stroke="%s" stroke-width="2.4"/>' % (x, y, w, h, rx, WHITE, BLACK))


class Canvas(object):
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.parts = []
        self.report = []

    def add(self, s):
        self.parts.append(s)

    def save(self, path):
        head = (
            '<svg xmlns="http://www.w3.org/2000/svg" width="%g" height="%g" '
            'viewBox="0 0 %g %g">\n<defs>\n'
            '<marker id="ah" viewBox="0 0 10 8" refX="10" refY="4" '
            'markerUnits="userSpaceOnUse" markerWidth="10" markerHeight="8" '
            'orient="auto"><path d="M0,0 L10,4 L0,8 z" fill="%s"/></marker>\n'
            '</defs>\n'
            '<rect x="0" y="0" width="%g" height="%g" fill="%s"/>\n'
            % (self.w * 2, self.h * 2, self.w, self.h, BLACK, self.w, self.h, WHITE)
        )
        with open(path, "w") as f:
            f.write(head + "\n".join(self.parts) + "\n</svg>\n")


class Box(object):
    """A flowchart node. kind: term|proc|pre|dec|io"""

    def __init__(self, cx, cy, w, h, text, kind="proc", bold_first=False):
        self.cx, self.cy, self.w, self.h = cx, cy, w, h
        self.text, self.kind, self.bold_first = text, kind, bold_first

    # --- anchors ---
    def _sk(self):
        return self.h * 0.25 * 0.5 if self.kind == "io" else 0.0

    def left(self):
        return (self.cx - self.w / 2 + self._sk(), self.cy)

    def right(self):
        return (self.cx + self.w / 2 - self._sk(), self.cy)

    def top(self):
        return (self.cx, self.cy - self.h / 2)

    def bottom(self):
        return (self.cx, self.cy + self.h / 2)

    def draw(self, cv, fonts=FONTS):
        x, y = self.cx - self.w / 2, self.cy - self.h / 2
        w, h = self.w, self.h
        if self.kind == "term":                     # stadium terminator
            cv.add(_rect(x, y, w, h, h / 2))
            cv.add(fit(self.cx, self.cy, self.text, w - h * 0.34, h - 16, fonts,
                       bold_first=self.bold_first, report=cv.report,
                       tag=self.text[:18]))
        elif self.kind == "dec":                    # decision diamond
            pts = "%g,%g %g,%g %g,%g %g,%g" % (
                self.cx, y, x + w, self.cy, self.cx, y + h, x, self.cy)
            cv.add('<polygon points="%s" fill="%s" stroke="%s" '
                   'stroke-width="2.4"/>' % (pts, WHITE, BLACK))
            cv.add(fit(self.cx, self.cy, self.text, w * 0.5, h * 0.46, fonts,
                       report=cv.report, tag=self.text[:18]))
        elif self.kind == "io":                     # input / output
            sk = h * 0.25
            pts = "%g,%g %g,%g %g,%g %g,%g" % (
                x + sk, y, x + w, y, x + w - sk, y + h, x, y + h)
            cv.add('<polygon points="%s" fill="%s" stroke="%s" '
                   'stroke-width="2.4"/>' % (pts, WHITE, BLACK))
            cv.add(fit(self.cx, self.cy, self.text, w - sk - 40, h - 16, fonts,
                       report=cv.report, tag=self.text[:18]))
        else:                                       # process / predefined
            cv.add(_rect(x, y, w, h, 10))
            pad = 60 if self.kind == "pre" else 44
            if self.kind == "pre":
                for dx in (-w / 2 + 16, w / 2 - 16):
                    cv.add('<line x1="%g" y1="%g" x2="%g" y2="%g" stroke="%s" '
                           'stroke-width="2.4"/>'
                           % (self.cx + dx, y + 3, self.cx + dx, y + h - 3, BLACK))
            cv.add(fit(self.cx, self.cy, self.text, w - pad, h - 16, fonts,
                       report=cv.report, tag=self.text[:18]))


def arrow(cv, pts):
    """Polyline through pts with an arrowhead at the end."""
    s = " ".join("%g,%g" % p for p in pts)
    cv.add('<polyline points="%s" fill="none" stroke="%s" stroke-width="2.2" '
           'stroke-linejoin="miter" marker-end="url(#ah)"/>' % (s, BLACK))


def line(cv, pts):
    """Polyline without an arrowhead (merge buses, chrome)."""
    s = " ".join("%g,%g" % p for p in pts)
    cv.add('<polyline points="%s" fill="none" stroke="%s" stroke-width="2.2"/>'
           % (s, BLACK))


def elbow(cv, a, b, mode="hv"):
    if mode == "hv":
        arrow(cv, [a, (b[0], a[1]), b])
    else:
        arrow(cv, [a, (a[0], b[1]), b])


def label(cv, x, y, text, font=22, anchor="middle", bold=False):
    weight = ' font-weight="bold"' if bold else ""
    cv.add('<text x="%g" y="%g" font-family="%s" font-size="%g" fill="%s" '
           'text-anchor="%s"%s>%s</text>'
           % (x, y, FONT, font, BLACK, anchor, weight, esc(text)))
