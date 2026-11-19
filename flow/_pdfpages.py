# -*- coding: utf-8 -*-
"""Accurate per-page map: which pages draw our figures, and where the
flowchart headings / captions / next section land."""
import re
import sys
import zlib

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
data = open(r"C:\Users\shane\Downloads\tw\FareWise_Charter_Final.pdf", "rb").read()
objs = {}
for m in re.finditer(rb"(\d+)\s+0\s+obj\b", data):
    num = int(m.group(1))
    end = data.find(b"endobj", m.end())
    objs[num] = data[m.end():end if end > 0 else len(data)]

order = []
for body in objs.values():
    if re.search(rb"/Type\s*/Pages\b", body):
        kids = re.search(rb"/Kids\s*\[([^\]]*)\]", body)
        if kids:
            order = [int(x) for x in re.findall(rb"(\d+)\s+0\s+R",
                                               kids.group(1))]


def stream_of(num):
    body = objs.get(num, b"")
    m = re.search(rb"stream\r?\n", body)
    if not m:
        return b""
    raw = body[m.end():]
    if b"endstream" in raw:
        raw = raw[:raw.rfind(b"endstream")]
    for cand in (raw, raw.strip()):
        try:
            return zlib.decompress(cand)
        except Exception:
            pass
    return b""


def page_stream(pnum):
    body = objs.get(pnum, b"")
    refs = re.search(rb"/Contents\s*(\[[^\]]*\]|\d+\s+0\s+R)", body)
    if not refs:
        return b""
    out = b""
    for r in re.findall(rb"(\d+)\s+0\s+R", refs.group(1)):
        out += stream_of(int(r))
    return out


needles = {
    b"10.1 System Flowchart": "H2-10.1",
    b"10.2 Program Flowchart": "H2-10.2",
    b"Figure 1": "CAP-1",
    b"Figure 2": "CAP-2",
    b"PROJECT COSTING": "H1-11",
    b"SYSTEM AND PROGRAM": "H1-10",
}

print("%-6s %-6s %-10s %s" % ("page", "obj", "drawn-img", "text found"))
for i, pnum in enumerate(order, 1):
    s = page_stream(pnum)
    imgs = re.findall(rb"/(Im\d+)\s+Do", s)
    sizes = re.findall(rb"([\d.]+)\s+0\s+0\s+([\d.]+)\s+[\d.]+\s+[\d.]+\s+cm",
                       s)
    found = [tag for n, tag in needles.items() if n in s]
    dims = " ".join("%sx%spt" % (w.decode(), h.decode()) for w, h in sizes
                    if float(w) > 50)
    print("%-6d %-6d %-10s %s   %s"
          % (i, pnum, ",".join(x.decode() for x in imgs) or "-",
             ",".join(found) or "-", dims))
