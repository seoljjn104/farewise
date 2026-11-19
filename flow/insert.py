# -*- coding: utf-8 -*-
"""Insert Figures 1 and 2 into the revised charter and renumber sections."""
import os
from docx import Document
from docx.shared import Inches, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH

DOC = r"C:\Users\shane\Downloads\tw\FareWise_Revised_Charter.docx"
OUT = r"C:\Users\shane\Downloads\tw\FareWise_Charter_Final.docx"
FLOW = r"C:\Users\shane\Downloads\tw\flow"

doc = Document(DOC)
paras = doc.paragraphs


def find(pred):
    for p in paras:
        if pred(p.text.strip()):
            return p
    return None


anchor = find(lambda t: t.startswith("The core fare calculation logic"))
h10 = find(lambda t: t.startswith("10. SYSTEM FLOWCHART"))
h11 = find(lambda t: t.startswith("11. PROJECT COSTING"))
if not (anchor and h10 and h11):
    raise SystemExit("anchor paragraphs not found")

h10.text = "10. SYSTEM AND PROGRAM FLOWCHARTS"
anchor.text = "The program executes the following sequential computation steps:"

# Start the flowchart section on a fresh page and drop the heading's 24pt
# space-before, so that "10. SYSTEM..." + "10.1 ..." + Figure 1 + its caption
# are guaranteed to fit inside the 9.00 in printable height and can never be
# split across a page boundary.
h10.paragraph_format.page_break_before = True
h10.paragraph_format.space_before = Pt(0)


def pic(par, path, width_in):
    par.alignment = WD_ALIGN_PARAGRAPH.CENTER
    par.paragraph_format.keep_with_next = True      # never orphan the caption
    par.paragraph_format.space_before = Pt(0)
    par.paragraph_format.space_after = Pt(0)
    par.add_run().add_picture(path, width=Inches(width_in))


def caption(par, text):
    par.style = doc.styles["Caption"]                # the charter's own style
    par.alignment = WD_ALIGN_PARAGRAPH.CENTER
    par.paragraph_format.space_before = Pt(0)
    par.paragraph_format.space_after = Pt(0)
    par.add_run(text)


# Figure width budget: the printable column is 6.00 in and the printable
# height is 9.00 in. Page 6 must hold the "10." heading, the "10.1" heading,
# Figure 1 and its caption:
#   0.24 (h1) + 0.22 (h2) + 8.08 (figure) + 0.04 (inline descent) + 0.15 (cap)
#   = 8.73 in  ->  0.27 in to spare.
# Both figures use the same 5.60 in width so they look like a matched pair.
items = [
    ("h2", "10.1 System Flowchart"),
    ("img", os.path.join(FLOW, "r_system.png"), 5.60),
    ("cap", "Figure 1. System flowchart of the FareWise Metro Cebu fare computation platform."),
    ("h2", "10.2 Program Flowchart"),
    ("img", os.path.join(FLOW, "r_program.png"), 5.60),
    ("cap", "Figure 2. Program flowchart of the FareWise fare computation engine."),
]

for kind, *rest in items:
    p = anchor.insert_paragraph_before()
    if kind == "h2":
        p.style = doc.styles["Heading 2"]
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.keep_with_next = True
        p.add_run(rest[0])
    elif kind == "img":
        pic(p, rest[0], rest[1])
    else:
        caption(p, rest[0])

# Costing stays section 11: the flowchart section absorbed the old "10" slot
# and only gained sub-sections 10.1 / 10.2, so no renumbering is required.
assert any(p.text.strip() == "11. PROJECT COSTING" for p in doc.paragraphs)

doc.save(DOC.replace("FareWise_Revised_Charter", "FareWise_Charter_Final"))
print("saved. paragraphs=%d tables=%d inline_shapes=%d"
      % (len(doc.paragraphs), len(doc.tables), len(doc.inline_shapes)))
for p in doc.paragraphs:
    t = p.text.strip()
    if t.startswith("Figures") or t.startswith("10.") or t.startswith("12.") or t.startswith("Figure"):
        print("  ", t[:88])
