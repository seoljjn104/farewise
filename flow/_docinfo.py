# -*- coding: utf-8 -*-
"""Dump the spacing that decides whether a figure plus its caption fits."""
import sys
from docx import Document
from docx.shared import Emu

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
D = r"C:\Users\shane\Downloads\tw\FareWise_Charter_Final.docx"
doc = Document(D)

sec = doc.sections[0]
PW = Emu(sec.page_width)
PH = Emu(sec.page_height)
pr = Emu(int(sec.page_height) - int(sec.top_margin) - int(sec.bottom_margin))
print("page %.2f x %.2f in | margins T%.2f B%.2f L%.2f R%.2f" %
      (PW.inches, PH.inches, Emu(sec.top_margin).inches,
       Emu(sec.bottom_margin).inches, Emu(sec.left_margin).inches,
       Emu(sec.right_margin).inches))
print("printable %.2f x %.2f in" %
      (Emu(int(sec.page_width) - int(sec.left_margin)
           - int(sec.right_margin)).inches, pr.inches))

for name in ("Normal", "Caption", "Heading 1", "Heading 2"):
    st = doc.styles[name]
    pf = st.paragraph_format
    f = st.font
    print("%-10s font=%-12s size=%s bold=%s | space_before=%s space_after=%s "
          "line=%s keep_next=%s"
          % (name, f.name, f.size.pt if f.size else None, f.bold,
             pf.space_before.pt if pf.space_before else None,
             pf.space_after.pt if pf.space_after else None,
             pf.line_spacing, pf.keep_with_next))

print("\n--- figure / caption paragraphs in the current file ---")
WP = "{http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing}"
for i, p in enumerate(doc.paragraphs):
    has = bool(p._p.findall(".//" + WP + "inline"))
    if has or p.text.strip().startswith(("Figure", "10.1", "10.2")):
        pf = p.paragraph_format
        print("  %3d style=%-10s align=%-14s keep_next=%-5s img=%s | %r"
              % (i, p.style.name, str(p.alignment), pf.keep_with_next, has,
                 p.text.strip()[:56]))

print("\n--- inline shapes ---")
for s in doc.inline_shapes:
    print("  %.2f x %.2f in" % (s.width.inches, s.height.inches))
