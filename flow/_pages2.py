# -*- coding: utf-8 -*-
"""Map every paragraph to its real page number, using a text cursor for
paragraph travel and the view cursor for the page number."""
import sys
import time

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import uno                                                    # noqa: E402
from com.sun.star.beans import PropertyValue                   # noqa: E402

DOC = r"C:\Users\shane\Downloads\tw\FareWise_Charter_Final.docx"
PORT = 2002


def connect(timeout=90):
    local = uno.getComponentContext()
    resolver = local.ServiceManager.createInstanceWithContext(
        "com.sun.star.bridge.UnoUrlResolver", local)
    url = ("uno:socket,host=localhost,port=%d;urp;"
           "StarOffice.ComponentContext" % PORT)
    t0 = time.time()
    while True:
        try:
            return resolver.resolve(url)
        except Exception:
            if time.time() - t0 > timeout:
                raise
            time.sleep(2)


ctx = connect()
desktop = ctx.ServiceManager.createInstanceWithContext(
    "com.sun.star.frame.Desktop", ctx)
doc = desktop.loadComponentFromURL(
    uno.systemPathToFileUrl(DOC), "_blank", 0,
    (PropertyValue("Hidden", 0, True, 0), PropertyValue("ReadOnly", 0, True, 0)))
ctrl = doc.getCurrentController()
vc = ctrl.getViewCursor()

print("page count: %d" % ctrl.PageCount)

tc = doc.getText().createTextCursor()
tc.gotoStart(False)
rows = []
for _ in range(400):
    tc.gotoEndOfParagraph(True)
    ctrl.select(tc)
    pg = ctrl.getViewCursor().getPage()
    s = tc.getString().strip().replace("\n", " ")
    rows.append((pg, s))
    if not tc.gotoNextParagraph(False):
        break

print("paragraphs: %d" % len(rows))
print("--- paragraphs 52..70 ---")
for i, (pg, s) in enumerate(rows):
    if 52 <= i <= 70:
        print("  p%-2s #%-3d %s" % (pg, i, s[:66] if s else "<blank / figure>"))
print("--- first paragraph on each page ---")
seen = {}
for i, (pg, s) in enumerate(rows):
    if pg not in seen:
        seen[pg] = (i, s)
for pg in sorted(seen):
    i, s = seen[pg]
    print("  page %-2d starts at #%-3d %s" % (pg, i, s[:60]))

doc.close(False)
