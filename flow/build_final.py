# -*- coding: utf-8 -*-
"""Build FareWise_Charter_Final.docx from FareWise_Revised_Charter.docx.

Three transformations, applied in one deterministic pass:

  1. Section 9 ("Initial User Interface Design") is expanded from four
     plain-text bullets into a described interface walkthrough carrying the
     live application captures as Figures 1-7.
  2. Because section 9 now owns Figures 1-7, the section 10 flowcharts are
     renumbered to Figures 8-9.
  3. The four Figma references are replaced with tool-agnostic wording, since
     the interface was prototyped directly in code.

Every figure is glued to its heading, body paragraph and caption with
keep_with_next, so a block can never be split across a page boundary and the
one-figure-per-page rule is enforced by the layout engine rather than by hand.
"""
import os
import sys

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt
from PIL import Image

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = r"C:\Users\shane\Downloads\tw"
DOC = os.path.join(BASE, "FareWise_Revised_Charter.docx")
OUT = os.path.join(BASE, "FareWise_Charter_Final.docx")
FLOW = os.path.join(BASE, "flow")
SHOTS = os.path.join(BASE, "farewise", "shots")
PRINT = os.path.join(SHOTS, "print")

# ---------------------------------------------------------------- print copies
# The captures are 2x device-pixel-ratio PNGs (2880 px wide). Print only needs
# ~300 dpi, which at a 5.90 in column is 1770 px, so downscale to 1800 px wide.
#
# The images are then reduced to a 256-colour palette. The interface is flat
# colour by construction, so this is visually lossless on the application screens
# (measured mean absolute difference 0.03/255) and merely softens the dithering
# in the OSM basemap. It takes the embedded payload from 5.4 MB to 2.2 MB, which
# keeps the finished document clear of common submission-portal size caps.
PRINT_W = 1800
os.makedirs(PRINT, exist_ok=True)


def print_png(name):
    src = os.path.join(SHOTS, name + ".png")
    dst = os.path.join(PRINT, name + ".png")
    im = Image.open(src).convert("RGB")
    if im.width > PRINT_W:
        im = im.resize((PRINT_W, round(im.height * PRINT_W / im.width)), Image.LANCZOS)
    im = im.quantize(colors=256, method=Image.MEDIANCUT, dither=Image.FLOYDSTEINBERG)
    im.save(dst, "PNG", optimize=True)
    return dst, im.width, im.height


# ------------------------------------------------------------------ doc lookup
doc = Document(DOC)
paras = doc.paragraphs


def index_of(pred, what):
    for i, p in enumerate(paras):
        if pred(p.text.strip()):
            return i
    raise SystemExit("could not find " + what)


i9 = index_of(lambda t: t.startswith("9.") and "USER INTERFACE" in t.upper(), "section 9 heading")
i10 = index_of(lambda t: t.startswith("10. SYSTEM FLOWCHART"), "section 10 heading")
h9 = paras[i9]
h10 = paras[i10]
print("section 9 heading at %d, section 10 heading at %d" % (i9, i10))

# The section opener is allowed to flow on from section 8 so that a short
# introduction never leaves a nearly empty page. Each 9.x screen, however, is
# forced onto its own page below - that is what enforces one figure per page.
h9.paragraph_format.page_break_before = False
h9.paragraph_format.space_before = Pt(12)
h9.paragraph_format.keep_with_next = True

# Drop the four bullets and the trailing empty paragraph.
for p in paras[i9 + 1:i10]:
    p._element.getparent().remove(p._element)


# --------------------------------------------------------------- §9 emitters
def heading2(text):
    p = h10.insert_paragraph_before()
    p.style = doc.styles["Heading 2"]
    # Forcing the break is what guarantees the whole block - heading, body,
    # figure and caption - always begins at the top of a fresh page, so the
    # caption can never be orphaned away from its figure.
    p.paragraph_format.page_break_before = True
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.keep_with_next = True
    p.add_run(text)
    return p


def body(text, keep_next=True):
    p = h10.insert_paragraph_before()
    p.style = doc.styles["Normal"]
    p.paragraph_format.space_after = Pt(10)
    p.paragraph_format.keep_with_next = keep_next
    p.add_run(text)
    return p


def figure(name, width_in=None, max_height_in=6.30):
    path, w, h = print_png(name)
    if width_in is None:                       # constrain by height instead
        width_in = max_height_in * w / h
    p = h10.insert_paragraph_before()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.keep_with_next = True
    p.add_run().add_picture(path, width=Inches(width_in))
    print("    figure %-20s %dx%d -> %.2f x %.2f in" % (name, w, h, width_in, width_in * h / w))
    return p


def caption(text):
    p = h10.insert_paragraph_before()
    p.style = doc.styles["Caption"]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.keep_with_next = False
    p.add_run(text)
    return p


# --------------------------------------------------------------- §9 content
body(
    "Section 9 presents the interface as built rather than as a static mock-up. Every panel below is a live "
    "capture of the running progressive web application, taken at a 1440 \u00d7 1080 desktop viewport and rendered "
    "at twice device resolution, so the layouts, the map and every peso figure shown are produced by the same "
    "engine described in the rest of this charter. The visual language follows transit wayfinding conventions: a "
    "dark operations-console ground, an amber signal accent reserved for the primary action on each screen, and "
    "tabular monospaced figures for all fares and distances so that columns of money align."
)
body(
    "Implementation note. The captures in this section were produced from a working prototype that keeps the "
    "trip ledger, the fare matrix and the advisories in a local on-device store whose records mirror the Supabase "
    "tables specified in Section 5 \u2014 fare_matrices, trip_ledger and advisories \u2014 behind a single data "
    "adapter. The alpha build therefore runs with no account, no server and no operating cost, which is what "
    "allowed the interface and the fare engine to be validated before the hosted milestone is funded. Swapping "
    "the adapter for the hosted Supabase instance is a configuration change rather than a rewrite, and the "
    "deployment commitments in Section 5 are unchanged.",
    keep_next=False,
)

heading2("9.1 Landing and Routing Screen")
body(
    "The landing screen carries the split-screen layout the charter specifies: a 412-pixel control sidebar on the "
    "left and the interactive Leaflet map on the right. The sidebar collects an ordered list of waypoints \u2014 an "
    "origin, any number of intermediate stops and a destination \u2014 together with the commuter type, which selects "
    "the statutory discount, and the vehicle class. Each waypoint is resolved through an autocomplete bound to a "
    "curated gazetteer of twenty-seven Metro Cebu landmarks, terminals and barangays. Road distance is measured by "
    "the OSRM routing engine and drawn as a polyline over OpenStreetMap tiles, with an offline great-circle "
    "estimate as a fallback so the screen still prices a trip when the network is unavailable. The right-hand "
    "panel prices the same journey across every active vehicle class and flags the cheapest option, which is the "
    "comparison the cost-saving objective depends on."
)
figure("01-plan", width_in=5.90)
caption(
    "Figure 1. Landing and routing screen. The sidebar resolves a Mambaling\u2013IT Park journey while the map "
    "prices it across all four active vehicle classes."
)

heading2("9.2 Fare Breakdown Drawer")
body(
    "The fare breakdown drawer is anchored to the foot of the map and expands over it to show how a quoted fare "
    "was assembled. It itemises the base fare covering the first four kilometres, the excess-distance charge for "
    "every kilometre beyond that, the gross subtotal, the statutory discount and the amount actually payable; when "
    "a trip chains several vehicle classes the same arithmetic is repeated once per leg. The two-stop example in "
    "the capture prices the 6.97-kilometre Mambaling\u2013IT Park journey at \u20b114.00 for the first four kilometres "
    "plus \u20b15.95 for the remaining 2.97 kilometres, giving a \u20b119.95 subtotal that the 20 per cent student "
    "discount reduces to \u20b115.96."
)
figure("02-plan-breakdown", width_in=5.90)
caption(
    "Figure 2. Fare breakdown drawer itemising base fare, excess distance, statutory discount and net fare for "
    "each leg of the journey."
)

heading2("9.3 Budget Tracker Dashboard")
body(
    "The dashboard tracks spending against a monthly allowance the student sets for themselves. Four summary cards "
    "report the allowance, the amount spent this month, the remaining balance and the total saved through the "
    "statutory discount, and each is derived from the trip ledger rather than entered by hand. A month-to-date "
    "pacing bar compares actual spending against the fraction of the month elapsed, an eight-week bar chart shows "
    "the spending trend, and a breakdown by vehicle class shows where the money goes. Because the figures are "
    "recomputed from the ledger on every render, changing the allowance or clearing a trip immediately updates "
    "the projection for the rest of the month."
)
figure("04-budget", width_in=5.90)
caption(
    "Figure 3. Budget tracker dashboard showing the allowance summary, month-to-date pacing, eight-week spending "
    "trend and spend by vehicle class."
)

heading2("9.4 Trip Ledger")
body(
    "The trip ledger is the record the dashboard reads. Every journey written by the planner appears as a row "
    "carrying its route, vehicle class, commuter type, road distance, the fare actually paid and the amount the "
    "statutory discount saved, grouped beneath a day heading and filterable by vehicle class or sortable by "
    "recency, fare or distance. Summary figures at the top reconcile the rows below them: eighty-eight trips, "
    "\u20b11,477.16 of fares paid and 614.03 kilometres of road distance across eight weeks of seeded history, with "
    "\u20b1357.51 attributed to the statutory discount."
)
figure("03-ledger", width_in=5.90)
caption(
    "Figure 4. Trip ledger grouped by day, showing route, vehicle class, road distance, fare paid and discount "
    "saved."
)

heading2("9.5 Admin Control Panel")
body(
    "The admin panel maintains the fare_matrices reference data the engine reads. Each vehicle class exposes its "
    "base fare, base distance, per-kilometre rate and statutory discount percentage as editable fields, with the "
    "source citation for the row displayed alongside it, and a worked eight-kilometre example that recalculates as "
    "the values are changed. The moderation tab in the following capture keeps the community advisories in a "
    "review queue until an administrator approves them, which is the control that keeps unverified fare reports "
    "away from the public interface."
)
figure("06-admin-tariff", width_in=5.90)
caption(
    "Figure 5. Admin control panel listing the LTFRB fare matrix with editable tariff fields and a live worked "
    "example."
)

heading2("9.6 Community Advisories")
body(
    "The advisories screen carries the crowdsourced disruption reports the charter describes. Published items are "
    "grouped into route changes, fare updates, traffic congestion and service interruptions, each labelled with a "
    "severity, an affected area, the submitting source and a confirmation count from other commuters, and each "
    "expands to the full report and its contributing detail. Reports that arrive through the community channel are "
    "held in the moderation queue described above so that an unverified fare change is never shown to commuters as "
    "fact."
)
figure("05-advisories", width_in=5.90)
caption(
    "Figure 6. Community advisories listing published disruption reports with severity, affected area and "
    "confirmation counts."
)

heading2("9.7 Mobile Layout")
body(
    "The application is a progressive web application, and the same interface reflows for a handset. Below the "
    "medium breakpoint the left navigation rail collapses to a sixty-two-pixel icon strip, the routing sidebar and "
    "the map stack vertically with the map pinned to a fixed fraction of the viewport height, and the fare "
    "breakdown drawer is promoted to a bottom sheet that slides up over the map. The capture was taken at a "
    "390 \u00d7 844 viewport, the logical size of a mid-range Android handset."
)
figure("08-mobile-plan", max_height_in=6.30)
caption(
    "Figure 7. Mobile layout at a 390 \u00d7 844 viewport, with the collapsed icon rail, stacked routing panel and "
    "bottom-sheet fare breakdown."
)

# ------------------------------------------------- flowchart figure renumber
FLOW_ITEMS = [
    ("h2", "10.1 System Flowchart"),
    ("img", os.path.join(FLOW, "r_system.png"), 5.60),
    ("cap", "Figure 8. System flowchart of the FareWise Metro Cebu fare computation platform."),
    ("h2", "10.2 Program Flowchart"),
    ("img", os.path.join(FLOW, "r_program.png"), 5.60),
    ("cap", "Figure 9. Program flowchart of the FareWise fare computation engine."),
]

anchor = None
for p in doc.paragraphs:
    if p.text.strip().startswith("The core fare calculation logic"):
        anchor = p
        break
if anchor is None:
    raise SystemExit("could not find the section 10 anchor paragraph")

h10.text = "10. SYSTEM AND PROGRAM FLOWCHARTS"
anchor.text = "The program executes the following sequential computation steps:"
h10.paragraph_format.page_break_before = True
h10.paragraph_format.space_before = Pt(0)


def pic_par(path, width_in, before):
    p = before.insert_paragraph_before()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.keep_with_next = True
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    p.add_run().add_picture(path, width=Inches(width_in))
    return p


def cap_par(text, before):
    p = before.insert_paragraph_before()
    p.style = doc.styles["Caption"]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    p.add_run(text)
    return p


for kind, *rest in FLOW_ITEMS:
    if kind == "h2":
        p = anchor.insert_paragraph_before()
        p.style = doc.styles["Heading 2"]
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.keep_with_next = True
        p.add_run(rest[0])
    elif kind == "img":
        pic_par(rest[0], rest[1], anchor)
    else:
        cap_par(rest[0], anchor)

# ------------------------------------------------------- Figma amendments
AMENDMENTS = [
    (
        "Conducts user experience research, develops Figma design prototypes, and performs field testing to "
        "validate fare accuracy across Metro Cebu and Mandaue City transit corridors.",
        "Conducts user experience research, develops the interface design prototypes, and performs field testing "
        "to validate fare accuracy across Metro Cebu and Mandaue City transit corridors.",
    ),
    (
        "Project proposal defense approval, system architecture design, and finalization of Figma UI wireframes.",
        "Project proposal defense approval, system architecture design, and finalization of the UI wireframes.",
    ),
]


def amend_paragraphs():
    done = 0
    for p in doc.paragraphs:
        for old, new in AMENDMENTS:
            for run in p.runs:
                if old in run.text:
                    run.text = run.text.replace(old, new)
                    done += 1
                    print("    amended paragraph run -> %s" % new[:64])
    return done


def amend_table_text():
    done = 0
    swaps = {
        "Figma Interactive Mockup Suite": "Interactive UI Mockup Suite",
        "Figma (Educational License)": "UI design and prototyping tools (free tier)",
    }
    for t in doc.tables:
        for row in t.rows:
            for cell in row.cells:
                for p in cell.paragraphs:
                    for run in p.runs:
                        for old, new in swaps.items():
                            if old in run.text:
                                run.text = run.text.replace(old, new)
                                done += 1
                                print("    amended table run -> %s" % new)
    return done


n_par = amend_paragraphs()
n_tab = amend_table_text()
print("figma amendments: %d paragraph runs, %d table runs" % (n_par, n_tab))

# --------------------------------------------------------------- sanity + save
assert not any("figma" in p.text.lower() for p in doc.paragraphs), "a Figma reference survived"
for t in doc.tables:
    for row in t.rows:
        for cell in row.cells:
            assert "figma" not in cell.text.lower(), "a Figma table reference survived"

# --------------------------------------------------- table pagination hygiene
# A long table may break between rows, but never *inside* a row: without this
# the deployment-cost table's final "Total" row split across the page boundary
# and left its wrapped second line stranded alone on the last page.
from docx.oxml import OxmlElement
from docx.oxml.ns import qn


def _tr_pr(row):
    tr = row._tr
    trPr = tr.find(qn("w:trPr"))
    if trPr is None:
        trPr = OxmlElement("w:trPr")
        first_tc = tr.find(qn("w:tc"))
        if first_tc is not None:
            first_tc.addprevious(trPr)
        else:
            tr.append(trPr)
    return trPr


def no_row_split(row):
    pr = _tr_pr(row)
    if pr.find(qn("w:cantSplit")) is None:
        pr.append(OxmlElement("w:cantSplit"))


def repeat_header(row):
    pr = _tr_pr(row)
    if pr.find(qn("w:tblHeader")) is None:
        pr.append(OxmlElement("w:tblHeader"))


# Pull the costing section up slightly so its tables are not orphaned onto a
# trailing page. This is the same class of tune that was already applied to the
# section 10 heading so Figure 8 would fit its page: the heading space-before is
# reduced, nothing else about the section changes.
for p in doc.paragraphs:
    t = p.text.strip()
    if t == "11. PROJECT COSTING":
        p.paragraph_format.space_before = Pt(6)
    elif t in ("11.1 Development Costs", "11.2 Deployment Costs"):
        p.paragraph_format.space_before = Pt(4)

for t in doc.tables:
    for ri, row in enumerate(t.rows):
        no_row_split(row)
        if ri == 0:
            repeat_header(row)
print("tables: cantSplit on every row, header row set to repeat")

doc.save(OUT)
print("\nsaved %s" % OUT)
print("paragraphs=%d tables=%d inline_shapes=%d"
      % (len(doc.paragraphs), len(doc.tables), len(doc.inline_shapes)))
print("\noutline:")
for p in doc.paragraphs:
    if p.style.name.startswith("Heading"):
        print("   [%s] %s" % (p.style.name, p.text.strip()[:78]))
print("\ncaptions:")
for p in doc.paragraphs:
    if p.style.name == "Caption":
        print("   " + p.text.strip()[:92])
