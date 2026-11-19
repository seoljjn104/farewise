/**
 * Builds the Project Charter Inquiry package as a .docx, with no dependencies.
 *
 *   node scripts/build-docx.mjs
 *
 * Writes the OOXML parts into a staging directory and prints its path; the
 * caller zips that directory into the .docx. No Pandoc, no LibreOffice, no
 * python-docx on this machine, so the WordprocessingML is emitted directly.
 */
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const STAGE = join(tmpdir(), 'opencode', 'fw-docx-build')
const SHOTS = join(ROOT, 'shots')

const TITLE = 'FareWise Metro Cebu'
const SUBTITLE =
  'Multi-Modal Transit Fare Calculator and Commute Optimization Platform'
const DOC_TITLE = 'Project Charter Inquiry Package'
const DATE = '16 October 2026'

/* ------------------------------------------------------------------ xml ---- */

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

const NAVY = '1F3864'
const BLUE = '2E5C99'
const SLATE = '44546A'
const GREY = '6B7280'
const RULE = 'C9D2DE'
const WASH = 'F2F5F9'
const AMBER = 'B8860B'

function run(text, o = {}) {
  const rpr = []
  // CT_RPr sequence: rFonts, b, i, color, sz, szCs
  if (o.font)
    rpr.push(
      `<w:rFonts w:ascii="${o.font}" w:hAnsi="${o.font}" w:cs="${o.font}"/>`
    )
  if (o.b) rpr.push('<w:b/>')
  if (o.i) rpr.push('<w:i/>')
  if (o.color) rpr.push(`<w:color w:val="${o.color}"/>`)
  if (o.size) rpr.push(`<w:sz w:val="${o.size}"/><w:szCs w:val="${o.size}"/>`)
  const pr = rpr.length ? `<w:rPr>${rpr.join('')}</w:rPr>` : ''
  return `<w:r>${pr}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`
}

/** Inline **bold** support inside otherwise plain text. */
function runs(text, o = {}) {
  return String(text)
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((p) =>
      p.startsWith('**') && p.endsWith('**')
        ? run(p.slice(2, -2), { ...o, b: true })
        : run(p, o)
    )
    .join('')
}

const para = (text, o = {}) => {
  // Emitted in the CT_PPr sequence order Word enforces:
  // pStyle, pBdr, shd, spacing, ind, jc.
  const pr = []
  if (o.style) pr.push(`<w:pStyle w:val="${o.style}"/>`)
  if (o.border)
    pr.push(
      `<w:pBdr><w:left w:val="single" w:sz="18" w:space="6" w:color="${o.border}"/></w:pBdr>`
    )
  if (o.shade)
    pr.push(`<w:shd w:val="clear" w:color="auto" w:fill="${o.shade}"/>`)
  if (o.before || o.after)
    pr.push(
      `<w:spacing w:before="${o.before || 0}" w:after="${o.after || 0}"/>`
    )
  if (o.indent || o.hanging)
    pr.push(
      `<w:ind${o.indent ? ` w:left="${o.indent}"` : ''}${o.hanging ? ` w:hanging="${o.hanging}"` : ''}/>`
    )
  if (o.align) pr.push(`<w:jc w:val="${o.align}"/>`)
  const prx = pr.length ? `<w:pPr>${pr.join('')}</w:pPr>` : ''
  return `<w:p>${prx}${runs(text, o)}</w:p>`
}

const h1 = (t) => para(t, { style: 'Heading1' })
const h2 = (t) => para(t, { style: 'Heading2' })
const h3 = (t) => para(t, { style: 'Heading3' })

/** A bulleted line. Manual glyphs keep the package free of a numbering part. */
const bullet = (t) =>
  para(`\u2022  ${t}`, { indent: 567, hanging: 284, after: 60 })

const pageBreak = () => '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'

/* ----------------------------------------------------------------- table --- */

function cell(text, o = {}) {
  const parts = String(text).split('\n')
  const paras = parts
    .map((line, i) =>
      para(line, {
        after: i === parts.length - 1 ? 0 : 40,
        color: o.color,
        b: o.b,
        size: o.size,
        align: o.align,
      })
    )
    .join('')
  const shd = o.fill
    ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fill}"/>`
    : ''
  return (
    `<w:tc><w:tcPr><w:tcW w:w="${o.w}" w:type="dxa"/>${shd}` +
    `<w:tcMar><w:top w:w="60" w:type="dxa"/><w:left w:w="90" w:type="dxa"/>` +
    `<w:bottom w:w="60" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tcMar>` +
    `<w:vAlign w:val="top"/></w:tcPr>${paras}</w:tc>`
  )
}

const TOTAL = 9972

function table(headers, rows, fractions, o = {}) {
  // Normalise so a table always spans the full text width, whatever the caller passes.
  const sum = fractions.reduce((a, b) => a + b, 0)
  const widths = fractions.map((f) => Math.round((f / sum) * TOTAL))
  const grid = widths.map((w) => `<w:gridCol w:w="${w}"/>`).join('')
  const headRow =
    `<w:tr><w:trPr><w:tblHeader/></w:trPr>` +
    headers
      .map((hh, i) =>
        cell(hh, {
          w: widths[i],
          b: true,
          color: 'FFFFFF',
          fill: o.headFill || NAVY,
          size: 18,
        })
      )
      .join('') +
    `</w:tr>`
  const body = rows
    .map((r, ri) =>
      `<w:tr>` +
      r
        .map((c, i) => {
          const text = c === true || c === false || c === null ? '' : c
          const isCheck = c === true
          return cell(isCheck ? '\u2610' : text, {
            w: widths[i],
            fill: o.zebra && ri % 2 === 1 ? WASH : undefined,
            size: o.size || 18,
            b: o.boldCols && o.boldCols.includes(i),
          })
        })
        .join('') +
      `</w:tr>`
    )
    .join('')

  return (
    `<w:tbl><w:tblPr><w:tblW w:w="${TOTAL}" w:type="dxa"/>` +
    `<w:tblBorders>` +
    ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
      .map((s) => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="${RULE}"/>`)
      .join('') +
    `</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr>` +
    `<w:tblGrid>${grid}</w:tblGrid>${headRow}${body}</w:tbl>` +
    para('', { after: 120 })
  )
}

/** A checklist table: every row carries a trailing unticked box. */
function checklist(headers, rows, fractions) {
  return table(
    [...headers, '\u2713'],
    rows.map((r) => [...r, true]),
    [...fractions, 0.04],
    { zebra: true }
  )
}

/* ----------------------------------------------------------------- image --- */

let relCounter = 2
const images = []

function pngSize(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) return null
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
}

const EMU_PX = 9525
const IN = 914400

function image(file, caption, o = {}) {
  const buf = readFileSync(join(SHOTS, file))
  const sz = pngSize(buf) || { w: 1200, h: 800 }
  relCounter += 1
  const rid = `rIdImg${relCounter}`
  images.push({ rid, file, buf })

  let cx = sz.w * EMU_PX
  let cy = sz.h * EMU_PX
  const maxCx = (o.maxWin || 6.4) * IN
  const maxCy = (o.maxHin || 7.2) * IN
  const s = Math.min(1, maxCx / cx, maxCy / cy)
  cx = Math.round(cx * s)
  cy = Math.round(cy * s)

  const draw =
    `<w:p><w:pPr><w:spacing w:before="120" w:after="60"/><w:jc w:val="center"/></w:pPr><w:r><w:drawing>` +
    `<wp:inline distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="${relCounter}" name="Picture ${relCounter}"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic><pic:nvPicPr><pic:cNvPr id="${relCounter}" name="${esc(file)}"/>` +
    `<pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>` +
    `</a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`

  return draw + para(caption, { style: 'Caption', align: 'center' })
}

const note = (t) =>
  para(t, { shade: 'FFF8E1', border: AMBER, indent: 113, before: 60, after: 160 })

/* --------------------------------------------------------------- content --- */

const B = []

B.push(
  para(TITLE, { style: 'Title', align: 'center' }),
  para(SUBTITLE, { style: 'Subtitle', align: 'center' }),
  para('', { after: 240 }),
  para(DOC_TITLE, {
    align: 'center',
    b: true,
    size: 32,
    color: NAVY,
    after: 120,
  }),
  para(
    'Part I  Requirements Checklist for the Charter Inquiry    \u2022    Part II  SRS Chapter 3: Contents and Required Entries    \u2022    Part III  Initial UI Designs',
    { align: 'center', size: 18, color: GREY, after: 480 }
  ),
  para(`Prepared for:  Project Charter Inquiry Panel\nAdviser:  Sir Roy`,
    { align: 'center', size: 20, after: 120 }),
  para('Submitted by:  [Project Team \u2014 insert names and roles]',
    { align: 'center', size: 20, after: 120 }),
  para(`Date:  ${DATE}`, { align: 'center', size: 20, after: 480 }),
  note(
    'This package covers three items: the requirements checklist for the charter inquiry, the contents and required entries of Chapter 3 of the Software Requirements Specification, and the initial user interface designs for the proposed system. Parts I and II are written against the FareWise Metro Cebu Project Charter (Final) and the seven in-scope deliverables in its Section 4.1. Part III reproduces the interface of the running prototype. Where a school template governs wording, follow the template and treat the entries here as the content it must carry.'
  ),
  pageBreak()
)

/* ---------------------------------------------------------- contents ------ */

B.push(
  h1('Contents'),
  para('Part I \u2014 Requirements Checklist for the Project Charter Inquiry',
    { b: true, after: 60 }),
  bullet('A.  Charter document: section-by-section completeness'),
  bullet('B.  Supporting documents to bring to the inquiry'),
  bullet('C.  Alignment and feasibility tests the panel applies'),
  bullet('D.  Team and documentation formalities'),
  bullet('E.  Anticipated panel questions with prepared answers'),
  bullet('F.  Known gaps in the current charter to resolve first'),
  para('Part II \u2014 SRS Chapter 3: Contents and Required Entries',
    { b: true, before: 160, after: 60 }),
  bullet('Chapter 3 (Specific Requirements): contents listing'),
  bullet('3.1 External Interface Requirements'),
  bullet('3.2 Functional Requirements'),
  bullet('3.3 Performance Requirements'),
  bullet('3.4 Design Constraints'),
  bullet('3.5 Software System Attributes'),
  bullet('3.6 Other Requirements'),
  bullet('Entry template for a single requirement, and the traceability matrix'),
  para('Part III \u2014 Initial UI Designs',
    { b: true, before: 160, after: 60 }),
  bullet('Design system and layout rules'),
  bullet('Screen inventory mapped to the in-scope deliverables'),
  bullet('Screen-by-screen designs (eight screens with captures)'),
  bullet('Screens planned for the hosted milestone'),
  pageBreak()
)

/* ============================================================ PART I ===== */

B.push(
  h1('Part I \u2014 Requirements Checklist for the Project Charter Inquiry'),
  para(
    'The inquiry tests one thing: whether the charter is complete enough, and the project feasible enough, to be approved. Work through the tables below before the panel meets. Each row names the requirement, states what the panel actually examines, and where the evidence lives.',
    { after: 120 }
  ),
  note(
    'Rows are drawn from the charter\u2019s own commitments plus the criteria a capstone panel normally applies. Your school template and Sir Roy\u2019s rubric override anything here. Confirm the submission format, the number of hard copies, and the panel\u2019s composition with your adviser, and tick those rows off as confirmed.'
  )
)

B.push(h2('A.  Charter document: section-by-section completeness'), para(
  'The charter carries eleven numbered sections. Confirm each is present, internally consistent, and answers the question in the middle column.',
  { after: 120 }
))
B.push(
  checklist(
    ['Ref', 'Required entry', 'What the panel checks'],
    [
      ['1.0', 'Project description', 'Is the problem, the users, the geography and the technology stack stated in one or two paragraphs? FareWise names Metro Cebu and Mandaue City, the four commuter groups, and the LTFRB fare basis.'],
      ['2.0', 'Project team and roles', 'Does every member hold a named role with defined duties? Confirm the count matches Section 11.1 (see Part I-F, gap 1).'],
      ['3.1', 'Background', 'Are claims supported? Section 3.1 cites sources (4, 5, 6, 8, 12, 15, 18); the citations need a reference list (see Part I-F, gap 2).'],
      ['3.2', 'Statement of the problem', 'Are the problems numbered, specific and traceable to Section 4.1 deliverables? FareWise lists fare transparency, environmental and infrastructure disruptions, and commute budget management.'],
      ['4.1', 'In-scope deliverables', 'Are the deliverables enumerated and testable? Seven are listed: GIS mapping, tariff engine, statutory discount, multi-leg chaining, expense tracker, crowdsourced advisories, admin portal.'],
      ['4.2', 'Out-of-scope limitations', 'Does the charter exclude work explicitly? Fleet telematics, automated fare collection, and native mobile distribution are excluded.'],
      ['5.0', 'Technical details', 'Is the stack named with versions and hosting? React, Tailwind, Leaflet, OpenStreetMap, PWA service workers, Supabase PostgreSQL with PostGIS, Vercel.'],
      ['6.0', 'Work breakdown structure', 'Does every WBS code carry a phase, a task description and a milestone deliverable, and do the codes cover all of Section 4.1?'],
      ['7.0', 'Project milestones', 'Are milestones dated and does each one close a WBS phase? Five milestones run Weeks 3, 6, 9, 12 and 14.'],
      ['8.0', 'Risks and mitigation', 'Does each risk carry a level, a cause and a mitigation the team controls? Three risks are listed (see Part I-F, gap 5).'],
      ['9.0', 'Initial user interface design', 'Does the section show the interface for every in-scope module? Section 9 shows seven figures plus the implementation note.'],
      ['10.0', 'System and program flowcharts', 'Are both diagrams present and legible, and does the program flowchart match the formula in Section 10.2?'],
      ['11.1', 'Development costs', 'Is every line item costed, including zero-cost items, with its source?'],
      ['11.2', 'Deployment costs', 'Do the one-year hosting, database, domain and testing costs sum to the stated total of PHP 3,350?'],
    ],
    [0.07, 0.26, 0.63]
  )
)

B.push(h2('B.  Supporting documents to bring to the inquiry'))
B.push(
  checklist(
    ['Item', 'Why the panel asks for it'],
    [
      ['Reference list / bibliography', 'Section 3.1 cites numbered sources. The panel will ask for the list and match the numbers to it.'],
      ['Gantt chart', 'Milestones appear as week numbers only. The panel wants the bars, the dependencies and the critical path.'],
      ['Entity-relationship diagram', 'WBS 2.0 promises a configured ERD. Bring the fare_matrices, trip_ledger and advisories schema.'],
      ['System architecture diagram', 'Section 10 has flowcharts but no architecture view. Show the browser, the Supabase edge, PostGIS, OSRM and the tile server.'],
      ['UI mockup suite', 'WBS 3.0 promises an interactive mockup suite. Part III of this package plus the captures in Section 9 satisfy it.'],
      ['Live demo or recording', 'The panel will ask to see the fare engine run. Have the build on a laptop and a screen recording as backup.'],
      ['Costing evidence', 'Domain and field-testing costs need a quotation or a screenshot of the price, not an estimate.'],
      ['Adviser endorsement', 'The signature page or endorsement letter that allows the inquiry to be scheduled.'],
      ['Repository or version history', 'A link to the code repository proves the milestone claims are real work, not slides.'],
      ['Trip / attendance and approval sheet', 'The form your department requires on the day of the inquiry.'],
    ],
    [0.30, 0.66]
  )
)

B.push(h2('C.  Alignment and feasibility tests the panel applies'), para(
  'Panels rarely score the charter\u2019s formatting. They test whether the project deserves a slot. Prepare the evidence in the third column for each row.',
  { after: 120 }
))
B.push(
  checklist(
    ['Criterion', 'The question the panel is really asking', 'Evidence to prepare'],
    [
      ['Problem significance', 'Does this problem matter to real people in Metro Cebu?', 'The fare-dispute and allowance strain evidence in Section 3.1, with sources attached.'],
      ['Scope definition', 'Is the boundary sharp enough to finish in one term?', 'Section 4.1 against 4.2, plus the WBS mapping in the next row.'],
      ['Scope to WBS coverage', 'Does every deliverable appear in the WBS, and every WBS code in a deliverable?', 'A one-page mapping table. Part II, Section 5 does this for requirements.'],
      ['Novelty and contribution', 'What does this add over an existing fare calculator?', 'Multi-leg chaining across vehicle classes, the statutory discount applied automatically, moderated advisories, and the allowance ledger in one tool.'],
      ['Technical feasibility', 'Can this team build this stack?', 'The running prototype. Show the fare engine and the map.'],
      ['Data availability and legality', 'Where do the fare rates come from, and may you publish them?', 'The LTFRB provisional matrix effective 28 September 2026, with the issuing document and the row-level source citation the admin panel displays.'],
      ['Cost feasibility', 'PHP 3,350 for one year. Is that credible?', 'Free-tier terms for Vercel and Supabase, the domain quotation, and the field-testing budget.'],
      ['Schedule feasibility', 'Fourteen weeks, five milestones. Does the plan fit?', 'The Gantt chart with the five milestones marked.'],
      ['Team capability', 'Does the roster cover front end, database, GIS and QA?', 'The role matrix, with each member\u2019s relevant coursework or prior work.'],
      ['Ethics and privacy', 'What commuter data do you hold, and under what authority?', 'The Data Privacy Act compliance statement and the retention rule for ledger and advisory records.'],
      ['Regional relevance', 'Does the project serve the region the school serves?', 'Coverage of Metro Cebu and Mandaue City, including the flooding corridors the advisories target.'],
    ],
    [0.17, 0.34, 0.45]
  )
)

B.push(h2('D.  Team and documentation formalities'))
B.push(
  checklist(
    ['Item', 'Detail'],
    [
      ['Roster consistency', 'Section 2 lists four roles; Section 11.1 funds five members. Reconcile to one number before the panel counts.'],
      ['Role assignment sheet', 'One line per member: name, role, primary WBS phase, contact.'],
      ['Adviser endorsement signed', 'The inquiry cannot be scheduled without it.'],
      ['Template compliance', 'Margins, font, heading numbering and page numbering as your department requires.'],
      ['Copies and binding', 'One copy per panelist, plus the adviser\u2019s file copy, plus one for the record.'],
      ['Originality declaration', 'Any required plagiarism or authorship statement, signed by all members.'],
      ['Slide deck', 'Ten to fifteen slides: problem, objectives, scope, architecture, demo, plan, cost, risks, ask.'],
      ['Demo fallback', 'A screen recording and the built application on a second device, in case the venue network blocks the routing service.'],
      ['Anticipated questions rehearsed', 'Part I-E below. Assign an owner to each answer.'],
      ['Submission deadline', 'The date the department closes the inquiry schedule.'],
    ],
    [0.28, 0.68]
  )
)

B.push(h2('E.  Anticipated panel questions with prepared answers'), para(
  'These are the questions the charter invites. Rehearse each one against the answer, and assign an owner.',
  { after: 120 }
))
B.push(
  checklist(
    ['#', 'Likely question', 'Prepared answer'],
    [
      ['1', 'Section 5 commits to Supabase and PostGIS, but Section 9 runs on a local store. Which is the real system?', 'Both. The records mirror the Supabase tables behind one adapter, so the swap is a configuration change. The hosted back end lands at Milestone 2, Week 6, as the WBS 2.0 and 4.0 phases state.'],
      ['2', 'Where is the reference list for the citations in Section 3.1?', 'Attach it. This is the cheapest question on the list to remove, and the most damaging to leave.'],
      ['3', 'How do you validate that the quoted fare matches the LTFRB matrix?', 'Three ways: the matrix rows carry their issuing document as a source field, the admin panel shows a live worked example, and Milestone 5 runs field validation against actual conductors\u2019 charges across the Metro Cebu and Mandaue corridors.'],
      ['4', 'The LTFRB changes fares without notice. What then?', 'The admin panel edits base fare, base distance, per-kilometre rate and discount percentage without a redeployment. Section 8 already carries this as a medium risk.'],
      ['5', 'The OSRM public demo server has no service guarantee and rate-limits heavy use. What is the production plan?', 'The app falls back to a great-circle estimate scaled by a road factor of 1.28, so it still prices a trip offline. For production, self-host OSRM on the hosted instance and keep the public server for development.'],
      ['6', 'Tricycle fares are missing. Why?', 'Tricycle rates are set per local government unit, and no single sourced rate covers Metro Cebu. Publishing one would put unverified fares in front of commuters, so the class is excluded until per-LGU rates can be sourced.'],
      ['7', 'How do you verify that a user qualifies for the 20 per cent discount?', 'In the prototype the commuter self-declares. Authenticated accounts and a verification status arrive with the Milestone 2 authentication work. Say this plainly rather than claiming verified discounts today.'],
      ['8', 'PostGIS is specified, but the prototype does all spatial work in the browser. Why keep it?', 'For server-side work the browser cannot do: snapping waypoints to road geometry, spatial queries over advisory areas, and corridor-level analytics over the ledger. State which of those are Milestone 2 and which are later.'],
      ['9', 'What does this add over an existing fare calculator or a maps app?', 'One trip priced across every vehicle class at once, multi-leg chaining with the statutory discount applied, moderated disruption reports, and an allowance ledger that shows what a month of commuting costs. No existing tool in Metro Cebu carries all four.'],
      ['10', 'The budget shows PHP 0 for labour across five members. Is the costing honest?', 'Labour is academic and unfunded, so it is recorded at zero with that reason stated. The operational budget of PHP 3,350 covers the one-year domain and the field-validation travel.'],
      ['11', 'Flooding advisories depend on the community reporting. What if nobody reports?', 'Section 8 carries low engagement as a risk. The mitigation is to publish verified LGU advisories alongside submissions and to recognise frequent contributors.'],
      ['12', 'You claim an enterprise-grade PWA. Show the offline behaviour.', 'Demonstrate the fallback pricing path and the cached shell. If the service worker is not finished, say which milestone delivers it.'],
    ],
    [0.04, 0.36, 0.56]
  )
)

B.push(h2('F.  Known gaps in the current charter to resolve first'), para(
  'These come from reading the charter as a panelist will. Each one is cheaper to fix now than to defend on the day.',
  { after: 120 }
))
B.push(
  table(
    ['#', 'Gap', 'Where it shows', 'Fix before the inquiry'],
    [
      ['1', 'Team count disagrees with itself', 'Section 2 names four roles; Section 11.1 funds five members.', 'Add the fifth role or change the costing to four. Then check WBS owners match.'],
      ['2', 'Citations without a reference list', 'Section 3.1 cites (4, 5, 6, 8, 12, 15, 18). No bibliography appears in the charter.', 'Add the reference list and confirm every number resolves to an entry.'],
      ['3', 'Prototype technology differs from the committed stack', 'Section 5 commits to Supabase and PostGIS; Section 9 runs on localStorage.', 'Keep the implementation note, and add the migration date and the Milestone 2 line item it belongs to.'],
      ['4', 'Milestones carry no schedule view', 'Section 7 gives week numbers as prose.', 'Add a Gantt chart with the five milestones and the phase dependencies.'],
      ['5', 'Risk register is thin', 'Section 8 lists three risks.', 'Add the OSRM dependency, commuter-type verification, team availability against the Week 14 defence, and advisory data quality.'],
      ['6', 'No architecture diagram', 'Section 10 shows a system and a program flowchart only.', 'Add a deployment or component diagram for the browser, Supabase, PostGIS, OSRM and the tile server.'],
      ['7', 'PostGIS justification is unstated', 'Section 5 names it; nothing in the scope says what it does.', 'State the server-side spatial tasks that require it, and which milestone delivers each.'],
      ['8', 'Non-functional targets are absent', 'No section states response time, availability or load targets.', 'Add the performance and attribute targets from Part II, Sections 3.3 and 3.5.'],
    ],
    [0.04, 0.24, 0.30, 0.42]
  )
)

B.push(pageBreak())

/* =========================================================== PART II ===== */

B.push(
  h1('Part II \u2014 SRS Chapter 3: Contents and Required Entries'),
  para(
    'Chapter 3 of a Software Requirements Specification is the chapter that carries the actual requirements. In the template most textbooks and panels in the Philippines follow, IEEE 830-1998, this is Section 3, Specific Requirements. The 2018 revision, ISO/IEC/IEEE 29148, keeps the same content under the same heading. If your department template renumbers the chapters, keep the entries and move the heading.',
    { after: 120 }
  )
)

B.push(h2('1.  Position of Chapter 3 in the specification'))
B.push(
  table(
    ['Chapter', 'Title', 'What it carries'],
    [
      ['1', 'Introduction', 'Purpose, scope, definitions and acronyms, references, and an overview of the document.'],
      ['2', 'Overall Description', 'Product perspective, product functions, user characteristics, constraints, assumptions and dependencies, and the apportioning of requirements.'],
      ['**3**', '**Specific Requirements**', '**Every requirement, written so that each one can be verified. This is the chapter below.**'],
      ['4', 'Appendices and Index', 'Sample screens, data dictionaries, the fare matrix, and the index.'],
    ],
    [0.10, 0.24, 0.66]
  )
)
B.push(
  note(
    'The boundary matters. Statements that describe the product as a whole belong in Chapter 2. Chapter 3 holds only requirements that a test can confirm. If a sentence cannot be verified, it belongs in Chapter 2 or in prose elsewhere.'
  )
)

B.push(h2('2.  Contents of Chapter 3'), para(
  'Chapter 3 carries six sections. Every entry listed under them is required unless the row is marked optional.',
  { after: 120 }
))
B.push(
  table(
    ['Ref', 'Section', 'Required entries'],
    [
      ['3.1', 'External Interface Requirements', '3.1.1 User interfaces. 3.1.2 Hardware interfaces. 3.1.3 Software interfaces. 3.1.4 Communications interfaces.'],
      ['3.2', 'Functional Requirements', 'One entry per function, each with an identifier, inputs, processing, outputs and a verification method.'],
      ['3.3', 'Performance Requirements', 'A measurable target for each load, latency and capacity claim.'],
      ['3.4', 'Design Constraints', 'Legal, regulatory, standards, hardware, platform and cost constraints that limit the design.'],
      ['3.5', 'Software System Attributes', 'Reliability, availability, security, maintainability, portability and usability, each with a target.'],
      ['3.6', 'Other Requirements', 'Data retention, internationalisation, accessibility, audit trail and anything that fits nowhere else.'],
    ],
    [0.07, 0.26, 0.63]
  )
)

B.push(h2('3.  Required entries, section by section'))

B.push(h3('3.1  External Interface Requirements'))
B.push(para(
  'This section tells a reader outside the team what the system talks to. For FareWise the interfaces are the browser, two public web services, one mapping library and the hosted back end.',
  { after: 100 }
))
B.push(para('3.1.1  User interfaces', { b: true, after: 60 }))
B.push(para(
  'List every screen with an identifier, its purpose, the controls it carries, the states it can be in, and how it reports an error. Part III of this package supplies this content screen by screen. The entry for each screen must state:',
  { after: 60 }
))
B.push(
  bullet('Screen identifier and name, matching the inventory in Part III.'),
  bullet('Purpose in one sentence, and the actor who uses it.'),
  bullet('Regions and controls, with the data each control binds to.'),
  bullet('States: empty, loading, populated, error and offline.'),
  bullet('Error and message text, and the validation rule behind each message.'),
  bullet('Navigation: how the user arrives and where they leave.')
)
B.push(para('3.1.2  Hardware interfaces', { b: true, before: 120, after: 60 }))
B.push(
  table(
    ['Interface', 'Requirement', 'Notes'],
    [
      ['Client device', 'Any device running a current desktop or mobile browser with a network connection.', 'No installed software and no dedicated hardware.'],
      ['Display', 'Usable from 390 px wide to 1440 px wide without horizontal scrolling.', 'The mobile layout is a design requirement, not an option.'],
      ['Input', 'Pointer, keyboard and touch. Autocomplete must work by keyboard alone.', 'Arrow keys, Enter and Escape are specified.'],
      ['Peripherals', 'None.', 'No scanner, printer, camera or card reader is used, which is what keeps deployment cost at zero.'],
    ],
    [0.16, 0.46, 0.38]
  )
)
B.push(para('3.1.3  Software interfaces', { b: true, before: 120, after: 60 }))
B.push(para(
  'One row per external component. Name the version, the direction of the call, the data exchanged and the protocol.',
  { after: 60 }
))
B.push(
  table(
    ['Component', 'Version', 'Purpose and data exchanged', 'Direction'],
    [
      ['OpenStreetMap tile service', 'Standard XYZ tile layer', 'Raster map tiles for the basemap. Coordinates in, PNG tiles out.', 'Outbound request'],
      ['OSRM routing engine', 'Public demo server, v5 route service', 'Road distance and route geometry. Coordinates in, GeoJSON with distance and duration out.', 'Outbound request'],
      ['Leaflet', '1.9.x', 'Tile rendering, polyline drawing and marker placement.', 'Client library'],
      ['React and Vite', 'React 19, Vite 8', 'Application shell and build.', 'Client library'],
      ['Supabase (PostgREST, GoTrue)', 'Hosted project', 'Relational storage and JWT authentication. JSON rows in and out over REST.', 'Bidirectional'],
      ['PostGIS', 'Matches the Postgres major version', 'Spatial column types and spatial queries server side.', 'Database extension'],
      ['Vercel', 'Hobby tier', 'Static hosting, TLS and continuous deployment from the repository.', 'Deployment'],
    ],
    [0.20, 0.17, 0.46, 0.17]
  )
)
B.push(para('3.1.4  Communications interfaces', { b: true, before: 120, after: 60 }))
B.push(
  table(
    ['Interface', 'Requirement'],
    [
      ['Transport', 'HTTPS with TLS 1.2 or later for every request. No plain HTTP endpoint.'],
      ['Back-end protocol', 'REST over HTTPS with JSON bodies, as generated by PostgREST.'],
      ['Authentication', 'Bearer token in the Authorization header. Tokens are JWT, issued by the Supabase auth service, short lived and refreshed.'],
      ['Routing protocol', 'HTTP GET to the OSRM route endpoint with coordinates in the path, returning GeoJSON. A client timeout of four seconds applies, after which the offline estimate is used.'],
      ['Tile protocol', 'HTTP GET for 256 px XYZ tiles at zoom levels 10 to 18.'],
      ['Offline behaviour', 'A service worker caches the application shell. Route and fare requests that cannot reach the network fall back to the local estimate rather than failing.'],
    ],
    [0.20, 0.80]
  )
)

B.push(h3('3.2  Functional Requirements'))
B.push(para(
  'Functional requirements are the body of Chapter 3. Number each one, give it a title and a description, and bind it to an actor, a precondition, inputs, processing, outputs, a priority and the charter clause it comes from. Every one of the thirty-four below is traceable to Section 4.1 of the charter: GIS mapping is FR-01 to FR-08, the tariff engine and discount are FR-09 to FR-13, multi-leg chaining is FR-11 and FR-12, the expense tracker is FR-14 to FR-24, advisories are FR-25 to FR-27, and the admin portal is FR-28 to FR-30.',
  { after: 120 }
))
B.push(
  table(
    ['ID', 'Requirement', 'Priority', 'Verify by'],
    [
      ['FR-01', 'Search the curated Metro Cebu gazetteer by name, city or kind, and return ranked matches as the user types.', 'Must', 'Test'],
      ['FR-02', 'Add, remove and reorder waypoints in an ordered list of origin, via points and destination.', 'Must', 'Test'],
      ['FR-03', 'Select a commuter type from regular, student, senior citizen and PWD, and apply its discount percentage.', 'Must', 'Test'],
      ['FR-04', 'Select a vehicle class from the active rows of the fare matrix.', 'Must', 'Test'],
      ['FR-05', 'Resolve each waypoint to latitude and longitude from the gazetteer.', 'Must', 'Test'],
      ['FR-06', 'Obtain road distance and route geometry for the ordered waypoints from the routing service.', 'Must', 'Test'],
      ['FR-07', 'Fall back to a great-circle distance scaled by a road factor of 1.28 when the routing service is unreachable, and label the source as an estimate.', 'Must', 'Test'],
      ['FR-08', 'Draw the route polyline and the waypoint markers over the OpenStreetMap basemap, and allow the basemap to switch between dark and light.', 'Must', 'Demo'],
      ['FR-09', 'Compute the gross fare for one leg as base fare plus the excess charge for every kilometre beyond the base distance.', 'Must', 'Test'],
      ['FR-10', 'Apply the statutory discount to the gross fare and round to two decimal places.', 'Must', 'Test'],
      ['FR-11', 'Price each leg of a multi-leg trip separately and sum the leg fares, so that transfers are charged their own base fare.', 'Must', 'Test'],
      ['FR-12', 'Price the same journey across every active vehicle class, sort by net fare, and flag the cheapest.', 'Must', 'Test'],
      ['FR-13', 'Show an itemised breakdown of base fare, excess distance charge, subtotal, discount and amount payable, repeating the arithmetic per leg.', 'Must', 'Demo'],
      ['FR-14', 'Log the priced trip to the ledger with route, class, commuter type, distance, fare, discount and timestamp.', 'Must', 'Test'],
      ['FR-15', 'List ledger rows grouped beneath a day heading, most recent first.', 'Must', 'Test'],
      ['FR-16', 'Filter ledger rows by vehicle class and sort by recency, fare or distance.', 'Should', 'Test'],
      ['FR-17', 'Report reconciling ledger totals for trips, fares paid, road distance and discount saved.', 'Must', 'Test'],
      ['FR-18', 'Delete a single ledger row, and clear the ledger on confirmation.', 'Should', 'Test'],
      ['FR-19', 'Set and edit the monthly allowance.', 'Must', 'Test'],
      ['FR-20', 'Report allowance, month-to-date spend, remaining balance and discount saved, all recomputed from the ledger.', 'Must', 'Test'],
      ['FR-21', 'Compare month-to-date spend against the fraction of the month elapsed and describe the pace in words.', 'Should', 'Test'],
      ['FR-22', 'Chart the last eight weeks of spend as a bar chart.', 'Should', 'Test'],
      ['FR-23', 'Break the spend down by vehicle class, with trip count and share.', 'Should', 'Test'],
      ['FR-24', 'Project the full month from the current spending rate and the days remaining.', 'Could', 'Test'],
      ['FR-25', 'Submit a community report with category, severity, affected area and body text.', 'Must', 'Test'],
      ['FR-26', 'List published advisories, filter them by category, and expand one to read the full report.', 'Must', 'Test'],
      ['FR-27', 'Increase the confirmation count on an advisory that another commuter endorses.', 'Should', 'Test'],
      ['FR-28', 'Create, edit and delete fare matrix rows, each carrying base fare, base distance, per-kilometre rate, discount percentage, effective date and source citation.', 'Must', 'Test'],
      ['FR-29', 'Recalculate a worked example live as a matrix row is edited.', 'Should', 'Test'],
      ['FR-30', 'Hold submitted advisories in a moderation queue until an administrator approves, rejects or deletes them, and allow a published advisory to be unpublished.', 'Must', 'Test'],
      ['FR-31', 'Register and sign in a user and issue a session token. Hosted milestone.', 'Must', 'Test'],
      ['FR-32', 'Record a commuter type and its verification status against an account. Hosted milestone.', 'Should', 'Test'],
      ['FR-33', 'Install as a progressive web application and serve the cached shell offline.', 'Must', 'Demo'],
      ['FR-34', 'Persist matrix, ledger and advisory records through a single data adapter that can be pointed at local storage or at the hosted database.', 'Must', 'Inspection'],
    ],
    [0.07, 0.63, 0.10, 0.20]
  )
)

B.push(h3('3.3  Performance Requirements'))
B.push(para(
  'Every number here is a target a test can measure. Where the team cannot justify a figure, measure it and write down what the prototype achieves rather than inventing a round number.',
  { after: 120 }
))
B.push(
  table(
    ['Measure', 'Target', 'How it is verified'],
    [
      ['Fare computation after a distance is known', 'Under 200 ms for a four-class comparison', 'Console timing on the pricing path.'],
      ['Routing request', 'Median under 2 s, 4 s client timeout, offline estimate thereafter', 'Repeated calls across ten representative corridors.'],
      ['First contentful paint', 'Under 3 s on a throttled 4G profile', 'Lighthouse on the deployed build.'],
      ['Map first tiles', 'Visible within 1.5 s of the plan screen mounting', 'Lighthouse and a manual check.'],
      ['Ledger render', '5,000 rows remain usable with filtering and sorting', 'Seeded load test.'],
      ['Advisory list', '500 published advisories remain filterable without a visible pause', 'Seeded load test.'],
      ['Concurrent users at deployment', 'At least 50 simultaneous sessions on the free tiers', 'Free-tier limits, stated as a known ceiling.'],
      ['Offline pricing', 'A trip still prices with the network unavailable', 'Airplane-mode test against the fallback path.'],
    ],
    [0.28, 0.40, 0.32]
  )
)

B.push(h3('3.4  Design Constraints'))
B.push(
  table(
    ['Constraint', 'Source', 'Consequence for the design'],
    [
      ['Fare formula is prescribed', 'LTFRB provisional matrix, effective 28 September 2026', 'The engine cannot invent a rate model. Base fare, base distance, per-kilometre rate and discount are data, not code.'],
      ['Twenty per cent statutory discount', 'Student, senior citizen and PWD fare privileges', 'Discount is applied as a percentage of the gross fare and shown as a separate line, never folded into the rate.'],
      ['Browser-only delivery', 'Charter Section 4.2 excludes native applications', 'Layout must work from 390 px to 1440 px, and the install path is the PWA manifest.'],
      ['Free-tier hosting', 'Charter Section 11.2', 'No paid map provider, no paid geocoder, no paid tile key. OpenStreetMap tiles and a curated gazetteer replace them.'],
      ['OSM tile usage policy', 'OpenStreetMap Foundation', 'No bulk tile harvesting. A self-hosted or commercial tile source is required before real traffic.'],
      ['Routing service has no service guarantee', 'Public OSRM demo server', 'A documented offline fallback is mandatory, and production routing must be self-hosted.'],
      ['No fare collection', 'Charter Section 4.2 excludes NFC and wallets', 'The system quotes and records fares. It never moves money.'],
      ['Data privacy', 'Philippine Data Privacy Act of 2012', 'Collect the minimum. Ledger and advisory records carry a retention rule and a deletion path.'],
      ['Tricycle rates excluded', 'Per-LGU rate setting', 'The class is left out rather than approximated.'],
    ],
    [0.22, 0.28, 0.50]
  )
)

B.push(h3('3.5  Software System Attributes'))
B.push(
  table(
    ['Attribute', 'Requirement', 'Verification'],
    [
      ['Availability', 'The application is readable and prices offline. Route requests may degrade to the estimate.', 'Airplane-mode test.'],
      ['Reliability', 'A failed routing call never blocks a fare. The user sees the estimate labelled as such.', 'Fault injection on the routing call.'],
      ['Security', 'All traffic over TLS. Row-level security on every Supabase table. Role checks on the admin functions so a non-administrator cannot write the fare matrix.', 'Inspection of policies plus a negative test with a non-admin token.'],
      ['Data integrity', 'A fare matrix edit takes effect for new computations and is recorded with its source and effective date.', 'Edit a rate, recompute, confirm the change and the audit entry.'],
      ['Maintainability', 'One data adapter between the views and persistence. One fare engine used by the planner, the ledger seed and the admin example.', 'Code inspection. The same function must produce the charter\u2019s worked example.'],
      ['Portability', 'Runs on current Chrome, Edge, Firefox and Safari, desktop and mobile.', 'Cross-browser pass on the deployed build.'],
      ['Usability', 'A first-time user prices a two-stop trip without instruction. Keyboard-only autocomplete works.', 'Moderated task test with five commuters.'],
      ['Accessibility', 'WCAG 2.1 level AA on colour contrast, focus order and labels. Money and distance are readable without colour alone.', 'Automated audit plus a manual keyboard pass.'],
      ['Scalability', 'The stated free-tier ceiling is documented rather than left implicit.', 'Recorded free-tier limits.'],
    ],
    [0.16, 0.58, 0.26]
  )
)

B.push(h3('3.6  Other Requirements'))
B.push(
    table(
    ['Ref', 'Requirement'],
    [
      ['OR-01', 'Ledger and advisory records carry a stated retention period and a user-triggered deletion path.'],
      ['OR-02', 'Fare matrix rows keep an audit trail: who changed what, when, and the source citation supplied at the time.'],
      ['OR-03', 'Interface copy is written in English. A Cebuano surface is a stated future item, not a current requirement.'],
      ['OR-04', 'Every advisory that reaches the public interface has passed moderation, and its status is visible.'],
      ['OR-05', 'The system states, on screen, that quoted fares follow the LTFRB matrix and are indicative, so a quoted fare is never presented as a demand for payment.'],
      ['OR-06', 'Sample data, the fare matrix and the gazetteer ship as data files so a reviewer can inspect them without running the system.'],
    ],
    [0.09, 0.91]
  )
)

B.push(h2('4.  Entry template for a single requirement'), para(
  'Copy this shape for every row in Section 3.2. A panelist who can read one requirement this way can verify all of them.',
  { after: 120 }
))
B.push(
  table(
    ['Field', 'What to write', 'Worked example'],
    [
      ['Identifier', 'A stable id, never reused after deletion.', 'FR-11'],
      ['Title', 'A noun phrase naming the function.', 'Multi-leg fare chaining'],
      ['Description', 'What the system does, in the active voice.', 'The system prices each leg of a multi-leg trip separately and returns the sum of the leg fares.'],
      ['Actor', 'Who triggers it.', 'Commuter.'],
      ['Precondition', 'What must already hold.', 'Two or more waypoints are resolved and each leg has a road distance.'],
      ['Inputs', 'Every value read.', 'Ordered waypoints, vehicle class, commuter type, per-leg distance.'],
      ['Processing', 'The rule, stated as arithmetic where arithmetic exists.', 'For each leg: gross = base fare + max(0, distance \u2212 base distance) \u00d7 per-kilometre rate. Net = gross \u00d7 (1 \u2212 discount \u00f7 100). Total = sum of net.'],
      ['Outputs', 'What the user sees.', 'Per-leg net fare and a trip total, itemised in the breakdown drawer.'],
      ['Priority', 'Must, Should or Could.', 'Must.'],
      ['Source', 'The charter clause it satisfies.', 'Charter Section 4.1, multi-leg trip chaining.'],
      ['Verification', 'How the panel can confirm it works.', 'Price a three-leg trip by hand and compare against the breakdown.'],
    ],
    [0.14, 0.34, 0.52]
  )
)

B.push(h2('5.  Traceability'), para(
  'Chapter 3 is finished when every in-scope deliverable in charter Section 4.1 has requirements, every requirement has a screen and a test, and nothing is orphaned at either end.',
  { after: 120 }
))
B.push(
  table(
    ['Charter Section 4.1 deliverable', 'Requirements', 'Screen', 'Test case'],
    [
      ['GIS mapping integration', 'FR-01 to FR-08', 'UI-01, UI-08', 'TC-01'],
      ['Tariff calculation engine', 'FR-09, FR-13', 'UI-01, UI-02, UI-05', 'TC-02'],
      ['Statutory discount processing', 'FR-03, FR-10', 'UI-01, UI-02', 'TC-03'],
      ['Multi-leg trip chaining', 'FR-11, FR-12', 'UI-01, UI-02', 'TC-04'],
      ['Commute expense tracker', 'FR-14 to FR-24', 'UI-03, UI-04', 'TC-05'],
      ['Crowdsourced advisories', 'FR-25 to FR-27', 'UI-07', 'TC-06'],
      ['Admin management portal', 'FR-28 to FR-30', 'UI-05, UI-06', 'TC-07'],
      ['Authentication and accounts (hosted milestone)', 'FR-31, FR-32, FR-34', 'UI-09, UI-10', 'TC-08'],
      ['Progressive web application behaviour', 'FR-33', 'UI-12', 'TC-09'],
    ],
    [0.36, 0.22, 0.24, 0.18]
  )
)

B.push(pageBreak())

/* ========================================================== PART III ===== */

B.push(
  h1('Part III \u2014 Initial UI Designs'),
  para(
    'These designs cover the seven in-scope deliverables in charter Section 4.1. The captures come from the running prototype, taken at a 1440 by 1080 desktop viewport and at a 390 by 844 handset viewport, so the layouts, the map and every peso figure are produced by the same engine the charter describes. Four further screens belong to the hosted milestone and are specified here as wireframe descriptions.',
    { after: 120 }
  )
)

B.push(h2('A.  Design system and layout rules'))
B.push(para(
  'The interface follows transit wayfinding conventions rather than consumer finance conventions. That choice drives every screen below, so state it once.',
  { after: 120 }
))
B.push(
  table(
    ['Token group', 'Values', 'Rule for use'],
    [
      ['Ground (ink ramp)', 'Ink 950 to ink 600, from #070A0E to #222B38', 'A dark ground so the map and the figures carry the eye. Raised panels sit one step lighter than the page.'],
      ['Rules and type', 'Line #263040, line-soft #1D2530. Foreground #EEF2F6, muted #6F7D8E, faint #4A5563', 'One border weight for panels and tables. Muted text for labels and meta, never for money.'],
      ['Signal accent', 'Amber #FFC42E on #241C05', 'Reserved for the single primary action on a screen: compute the fare, log the trip, approve a report. If two things are amber, one is wrong.'],
      ['Route accent', 'Teal #3DDC97', 'Movement, savings and a positive state. Carries the discount-saved figure.'],
      ['Danger accent', 'Red #FF6B6B', 'Over-allowance and high severity only.'],
      ['Numerals', 'IBM Plex Mono with tabular figures', 'Every fare, distance, count and timestamp. Columns of peso amounts then align on the decimal point.'],
      ['Text face', 'Archivo', 'All interface and prose text.'],
      ['Corner radius', '14 px on raised surfaces, 10 to 11 px on controls', 'One radius per surface class, applied without exception.'],
    ],
    [0.17, 0.34, 0.49]
  )
)
B.push(
  table(
    ['Breakpoint', 'Layout'],
    [
      ['Desktop, 768 px and above', 'A fixed 78 px icon rail, a 412 px control sidebar, and the map filling the remaining width. The fare breakdown is a drawer anchored to the foot of the map that expands upward over it.'],
      ['Below 768 px', 'The rail collapses to a 62 px icon strip. The sidebar and the map stack vertically with the map pinned to 42 per cent of the viewport height. The fare breakdown becomes a bottom sheet over the map.'],
    ],
    [0.24, 0.76]
  )
)

B.push(h2('B.  Screen inventory'))
B.push(
  table(
    ['ID', 'Screen', 'Charter deliverable', 'Figure', 'State'],
    [
      ['UI-01', 'Landing and routing screen', 'GIS mapping integration', 'Fig. 1', 'Built'],
      ['UI-02', 'Fare breakdown drawer', 'Tariff engine, statutory discount', 'Fig. 2', 'Built'],
      ['UI-03', 'Budget tracker dashboard', 'Commute expense tracker', 'Fig. 3', 'Built'],
      ['UI-04', 'Trip ledger', 'Commute expense tracker', 'Fig. 4', 'Built'],
      ['UI-05', 'Admin control panel, tariff rules', 'Admin management portal', 'Fig. 5', 'Built'],
      ['UI-06', 'Admin control panel, moderation', 'Admin portal, advisories', 'Fig. 6', 'Built'],
      ['UI-07', 'Community advisories', 'Crowdsourced advisories', 'Fig. 7', 'Built'],
      ['UI-08', 'Mobile layout', 'All, at the handset breakpoint', 'Fig. 8', 'Built'],
      ['UI-09', 'Sign in and register', 'Hosted milestone', 'Wireframe', 'Planned'],
      ['UI-10', 'Commuter profile and verification', 'Hosted milestone', 'Wireframe', 'Planned'],
      ['UI-11', 'Advisory submission form', 'Crowdsourced advisories', 'Wireframe', 'Planned'],
      ['UI-12', 'Offline and install state', 'Progressive web application', 'Wireframe', 'Planned'],
    ],
    [0.09, 0.30, 0.26, 0.14, 0.11],
    { size: 18 }
  )
)

B.push(h2('C.  Screen-by-screen designs'))

function screen(id, name, purpose, regions, file, caption, o = {}) {
  return [
    h3(`${id}  ${name}`),
    para(purpose, { after: 100 }),
    table(
      ['Region or control', 'Contents', 'Interaction'],
      regions,
      [0.26, 0.40, 0.34]
    ),
    image(file, caption, o),
  ]
}

B.push(
  ...screen(
    'UI-01',
    'Landing and routing screen',
    'The screen where a commuter states a journey and gets a price. It carries the split layout the charter specifies: a 412 px control sidebar on the left and the interactive map on the right.',
    [
      ['Icon rail', 'Five destinations: Plan, Ledger, Budget, Advisory, Admin.', 'Switches the view. The active destination is marked.'],
      ['Search location', 'A free-text field over the curated gazetteer of twenty-seven Metro Cebu places.', 'Typing filters by place name, city or kind. Selecting a result appends it as a new stop.'],
      ['Your route', 'The ordered waypoint list, lettered A for origin and B for destination, numbered for via points.', 'Each row opens the same autocomplete. A via point can be removed. Add stop appends one, Reverse flips the order.'],
      ['Commuter type', 'Regular, Student, Senior Citizen, PWD, each showing its discount percentage.', 'Selecting one sets the statutory discount applied to every fare on the screen.'],
      ['Vehicle class', 'One row per active matrix class, each showing base fare, base distance and the per-kilometre rate.', 'Selecting one re-prices the trip for that class.'],
      ['Cost comparison', 'Every active class priced for the same journey, sorted by net fare, with the cheapest flagged.', 'Selecting a row switches the measured class.'],
      ['Saved trips', 'Home to School, School to Home, To the airport, Downtown run.', 'Fills the waypoint list from the saved pair in one tap.'],
      ['Month summary', 'Spend, allowance remaining and trip count for the current month.', 'Opens the budget screen.'],
      ['Primary action', 'Compute fare, showing the net fare for the current selection once a route resolves.', 'Opens the fare breakdown drawer. Disabled until two waypoints resolve.'],
      ['Map', 'OpenStreetMap tiles, the route polyline and the waypoint markers.', 'Pan and zoom. A dark and light basemap toggle sits at the top right.'],
      ['Route read-out', 'The distance and travel time, and whether the figure came from road routing or from the offline estimate.', 'Read-only, so the source of a distance is never hidden.'],
    ],
    '01-plan.png',
    'Figure 1. Landing and routing screen. The sidebar resolves a Mambaling to IT Park journey while the map prices it across all four active vehicle classes.'
  )
)

B.push(
  ...screen(
    'UI-02',
    'Fare breakdown drawer',
    'The drawer shows how a quoted fare was assembled, so a commuter can check the arithmetic rather than trust a number.',
    [
      ['Drawer handle', 'Fare breakdown, with a chevron.', 'Expands and collapses the drawer over the map.'],
      ['Headline figure', 'The net fare for the selected commuter type.', 'Read-only.'],
      ['Summary strip', 'Distance, travel time, leg count and vehicle class code.', 'Read-only.'],
      ['Discount badge', 'The amount the statutory discount removed.', 'Shown only when a discount applies.'],
      ['Fare build-up', 'Base fare for the first kilometres, the excess distance charge with its arithmetic, the subtotal, the discount line and the amount payable.', 'Read-only. Recomputes per leg when a trip chains legs.'],
      ['Legs', 'One card per leg, naming the two waypoints and the net fare for that leg.', 'Read-only.'],
      ['Cheaper alternatives', 'Up to three other classes with the peso difference against the current one.', 'Switching moves the comparison to that class.'],
      ['Switch action', 'Switch to another class and save the difference.', 'Changes the measured class and closes the loop with UI-01.'],
      ['Log action', 'Log this trip.', 'Writes the trip to the ledger and confirms in place.'],
    ],
    '02-plan-breakdown.png',
    'Figure 2. Fare breakdown drawer itemising base fare, excess distance, statutory discount and net fare for each leg. The two-stop example prices the 6.97 kilometre Mambaling to IT Park journey at 19.95 pesos before the 20 per cent student discount reduces it to 15.96 pesos.'
  )
)

B.push(
  ...screen(
    'UI-03',
    'Budget tracker dashboard',
    'The dashboard answers one question for a student on a fixed allowance: is the month on pace?',
    [
      ['Allowance summary', 'Four cards: monthly allowance, spent this month, remaining balance, and saved through the discount.', 'Read-only. Every card derives from the ledger, none is typed in.'],
      ['Allowance control', 'The monthly allowance, with an edit affordance.', 'Editing recomputes every figure below it.'],
      ['Pacing bar', 'Percentage of the allowance used against the percentage of the month elapsed, described in words.', 'Read-only.'],
      ['Spending trend', 'An eight-week bar chart of weekly spend, with the average active week labelled.', 'Read-only.'],
      ['Spend by class', 'Each vehicle class with its trip count, total and share of spend.', 'Read-only.'],
      ['At a glance', 'Trips, road distance, fares paid, statutory discount, average per trip and the projected month.', 'Read-only. The projection states the assumption it rests on.'],
      ['Recent activity', 'The last few trips with route, class and fare.', 'Read-only, linking the dashboard back to the ledger.'],
    ],
    '04-budget.png',
    'Figure 3. Budget tracker dashboard showing the allowance summary, month-to-date pacing, eight-week spending trend and spend by vehicle class.'
  )
)

B.push(
  ...screen(
    'UI-04',
    'Trip ledger',
    'The ledger is the record the dashboard reads, and the evidence behind every figure on it.',
    [
      ['Summary strip', 'Trips shown, total spent, road distance and discount saved.', 'Read-only. These totals reconcile the rows below.'],
      ['Class filter', 'All vehicle classes, or one at a time.', 'Narrows the rows and the totals.'],
      ['Sort control', 'Most recent, highest fare or longest distance.', 'Reorders the rows.'],
      ['Day headings', 'A heading per day, most recent first.', 'Groups the rows so a commute pattern is visible.'],
      ['Ledger rows', 'Route, vehicle class, commuter type, road distance, fare paid and discount saved.', 'Read-only per row, with a delete affordance.'],
      ['Clear ledger', 'Removes every logged trip after confirmation.', 'Recomputes the dashboard immediately.'],
    ],
    '03-ledger.png',
    'Figure 4. Trip ledger grouped by day, showing route, vehicle class, road distance, fare paid and discount saved.'
  )
)

B.push(
  ...screen(
    'UI-05',
    'Admin control panel, tariff rules',
    'The panel that maintains the fare matrix the engine reads. It is the control that answers the question of what happens when the LTFRB changes a rate.',
    [
      ['View tabs', 'Tariff rules, Moderation and Data layer.', 'Switches between the matrix editor and the review queue.'],
      ['Effective date', 'The date the rates took effect, with a restore-defaults action.', 'Restoring re-seeds the matrix from the sourced values.'],
      ['Matrix rows', 'One row per vehicle class: base fare, base distance, per-kilometre rate, discount percentage and active state.', 'Each field is editable in place. An edit takes effect for new computations without a redeployment.'],
      ['Source citation', 'The issuing document for each row, shown beside it.', 'Read-only, so no rate is editable without its provenance on screen.'],
      ['Worked example', 'An eight-kilometre computation that recalculates as the fields change.', 'Read-only, and the same engine the planner uses.'],
      ['Add class', 'Creates a new matrix row for a vehicle class not yet covered.', 'The row starts inactive until its rates and source are filled in.'],
    ],
    '06-admin-tariff.png',
    'Figure 5. Admin control panel listing the LTFRB fare matrix with editable tariff fields and a live worked example.'
  )
)

B.push(
  ...screen(
    'UI-06',
    'Admin control panel, moderation',
    'The queue that keeps an unverified fare report away from commuters until a person has reviewed it.',
    [
      ['Pending count', 'How many reports await a decision.', 'Read-only.'],
      ['Pending cards', 'Title, age, body, affected area, category and submitting source.', 'Each card carries Approve and publish, Reject and Delete.'],
      ['Published list', 'Every live advisory with its title.', 'Each row carries Unpublish, which returns it to the queue.'],
      ['Decision effect', 'Approving publishes to the advisories screen. Rejecting keeps it out of the public list. Deleting removes it.', 'Actions are immediate and visible on UI-07.'],
    ],
    '07-admin-moderation.png',
    'Figure 6. Moderation queue holding community reports until an administrator approves, rejects or deletes them.'
  )
)

B.push(
  ...screen(
    'UI-07',
    'Community advisories',
    'The public face of the crowdsourced disruption reports the charter describes.',
    [
      ['Category filter', 'All, route change, fare update, traffic, service, each with its count.', 'Narrows the list.'],
      ['Advisory cards', 'Title, age, body, affected area, source and confirmation count, with a severity label.', 'Expand to read the full report and its contributing detail.'],
      ['Severity label', 'High impact, moderate or low.', 'Colour-coded, and also labelled in words so severity does not rest on colour alone.'],
      ['Confirm action', 'Still true, with the confirmation count.', 'Increments the count for that advisory.'],
      ['Post an advisory', 'Opens the submission form.', 'Submitted reports enter the moderation queue rather than the public list.'],
    ],
    '05-advisories.png',
    'Figure 7. Community advisories listing published disruption reports with severity, affected area and confirmation counts.'
  )
)

B.push(
  ...screen(
    'UI-08',
    'Mobile layout',
    'The same interface at the handset breakpoint, which the charter requires because the deliverable is a progressive web application.',
    [
      ['Icon rail', 'Collapses to a 62 px strip.', 'Icons only, with the active destination marked.'],
      ['Stacked panels', 'The routing sidebar above the map, with the map pinned to 42 per cent of the viewport height.', 'Scrolls vertically.'],
      ['Bottom sheet', 'The fare breakdown promoted from a drawer to a sheet over the map.', 'Slides up from the bottom edge.'],
      ['Tap targets', 'Widened to the handset minimum.', 'No horizontal overflow at 390 px wide.'],
    ],
    '08-mobile-plan.png',
    'Figure 8. Mobile layout at a 390 by 844 viewport, with the collapsed icon rail, stacked routing panel and bottom-sheet fare breakdown.',
    { maxWin: 3.4 }
  )
)

B.push(h2('D.  Screens planned for the hosted milestone'))
B.push(para(
  'Four screens belong to the scope but not yet to the prototype. Each is specified here so the design work is traceable to the deliverable it serves.',
  { after: 120 }
))

function wireframe(id, name, deliverable, blocks, notes) {
  return [
    h3(`${id}  ${name}`),
    para(`Deliverable: ${deliverable}`, { size: 18, color: GREY, after: 80 }),
    table(['Layout block', 'Contents and behaviour'], blocks, [0.28, 0.68]),
    para(notes, { after: 160 }),
  ]
}

B.push(
  ...wireframe(
    'UI-09',
    'Sign in and register',
    'Charter Section 5, JWT authentication on Supabase',
    [
      ['Centred card', 'One card, maximum 380 px wide, on the ink-900 ground. No sidebar and no map on this route.'],
      ['Brand block', 'The product name and one line of purpose above the form.'],
      ['Email field', 'Email address, with inline validation.'],
      ['Password field', 'Password, with a reveal toggle and the minimum length stated before the user types.'],
      ['Primary action', 'Sign in, amber, the only amber element on the screen.'],
      ['Secondary action', 'Create an account, which switches the card to the register form.'],
      ['Error region', 'A single message region above the primary action. A failed sign-in states the reason without revealing whether the account exists.'],
      ['Terms line', 'A short line naming what is stored and the retention rule, linking to the privacy statement.'],
    ],
    'The success path lands on UI-01 with the account\u2019s saved home and school pair loaded. A first-time account lands on UI-10.'
  ),
  ...wireframe(
    'UI-10',
    'Commuter profile and verification',
    'Charter Section 4.1, statutory discount processing, and Section 5, accounts',
    [
      ['Profile header', 'Account email, join date and the current commuter type.'],
      ['Commuter type', 'The same four options as UI-01, so the choice is made once and reused.'],
      ['Verification status', 'A badge stating unverified, pending or verified, with the evidence required for each discount class.'],
      ['Saved places', 'Home and school waypoints, which populate the saved-trip chips on UI-01.'],
      ['Allowance', 'The monthly allowance, moving the edit out of UI-03.'],
      ['Data controls', 'Export the ledger, and delete the account with its ledger and advisory records.'],
    ],
    'Verification is the honest boundary. Until a supporting document is checked, the badge reads unverified and the screen says so rather than implying a controlled discount.'
  ),
  ...wireframe(
    'UI-11',
    'Advisory submission form',
    'Charter Section 4.1, crowdsourced advisories',
    [
      ['Category', 'Route change, fare update, traffic or service, as a segmented control.'],
      ['Severity', 'Low, moderate or high, with the consequence of each described in words.'],
      ['Affected area', 'Autocomplete over the gazetteer, so an area is a resolved place rather than free text.'],
      ['Report body', 'A multi-line field with a stated minimum length and a character count.'],
      ['Evidence', 'An optional photo or a link to an official post.'],
      ['Submit action', 'Submit for review, worded so the user knows the report is queued and not published.'],
      ['Confirmation', 'A receipt naming the queue and the expected review window.'],
    ],
    'The submitted report appears on UI-06, never directly on UI-07. This is the control that keeps an unverified fare change away from commuters.'
  ),
  ...wireframe(
    'UI-12',
    'Offline and install state',
    'Charter Section 5, PWA service workers',
    [
      ['Install prompt', 'A dismissible strip offering to install the application, shown once per session at most.'],
      ['Offline banner', 'A persistent strip when the connection drops, stating that distances come from the offline estimate.'],
      ['Cached shell', 'The shell, the gazetteer and the fare matrix serve from cache.'],
      ['Queued writes', 'A trip logged offline is queued and written when the connection returns, with a pending marker until it is.'],
      ['Stale data marker', 'Any cached advisory list carries the time it was last refreshed.'],
    ],
    'The offline path is already real for pricing: the fallback estimate is why a trip still costs something when the routing service cannot be reached.'
  )
)

B.push(
  note(
    'Design status. The eight built screens were captured from the running prototype and are reproducible with the repository\u2019s screenshot driver. The four hosted-milestone screens are specified here and not yet drawn, which is the honest state of the design work at the time of the charter inquiry.'
  )
)

/* ------------------------------------------------------------------ build -- */

const body = B.join('')

const documentXml =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<w:document ` +
  `xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ` +
  `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ` +
  `xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ` +
  `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ` +
  `xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
  `<w:body>${body}<w:sectPr>` +
  `<w:footerReference w:type="default" r:id="rId2"/>` +
  `<w:pgSz w:w="12240" w:h="15840"/>` +
  `<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/>` +
  `<w:cols w:space="708"/><w:docGrid w:linePitch="360"/>` +
  `</w:sectPr></w:body></w:document>`

const stylesXml =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
  `<w:docDefaults><w:rPrDefault><w:rPr>` +
  `<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>` +
  `<w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:rPrDefault>` +
  `<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault>` +
  `</w:docDefaults>` +
  `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>` +
  style('Title', 'Title', 40, NAVY, true, { before: 0, after: 80 }) +
  style('Subtitle', 'Subtitle', 22, SLATE, false, { before: 0, after: 160 }) +
  style('Heading1', 'heading 1', 30, NAVY, true, { before: 360, after: 160 }) +
  style('Heading2', 'heading 2', 25, BLUE, true, { before: 280, after: 120 }) +
  style('Heading3', 'heading 3', 22, SLATE, true, { before: 220, after: 100 }) +
  style('Caption', 'caption', 17, GREY, false, { before: 40, after: 240 }) +
  `</w:styles>`

function style(id, name, sz, color, bold, sp) {
  return (
    `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/>` +
    `<w:basedOn w:val="Normal"/>` +
    `<w:pPr><w:keepNext/><w:spacing w:before="${sp.before}" w:after="${sp.after}"/></w:pPr>` +
    `<w:rPr>${bold ? '<w:b/>' : ''}<w:color w:val="${color}"/>` +
    `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr></w:style>`
  )
}

const footerXml =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
  `<w:p><w:pPr><w:jc w:val="center"/></w:pPr>` +
  run('FareWise Metro Cebu  \u00b7  Project Charter Inquiry Package  \u00b7  Page ', {
    size: 16,
    color: GREY,
  }) +
  `<w:r><w:rPr><w:color w:val="${GREY}"/><w:sz w:val="16"/></w:rPr>` +
  `<w:fldChar w:fldCharType="begin"/></w:r>` +
  `<w:r><w:rPr><w:color w:val="${GREY}"/><w:sz w:val="16"/></w:rPr>` +
  `<w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>` +
  `<w:r><w:rPr><w:color w:val="${GREY}"/><w:sz w:val="16"/></w:rPr>` +
  `<w:fldChar w:fldCharType="separate"/></w:r>` +
  `<w:r><w:rPr><w:color w:val="${GREY}"/><w:sz w:val="16"/></w:rPr><w:t>1</w:t></w:r>` +
  `<w:r><w:rPr><w:color w:val="${GREY}"/><w:sz w:val="16"/></w:rPr>` +
  `<w:fldChar w:fldCharType="end"/></w:r>` +
  `</w:p></w:ftr>`

const contentTypes =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Default Extension="png" ContentType="image/png"/>` +
  `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
  `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>` +
  `<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>` +
  `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
  `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>` +
  `</Types>`

const rels =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
  `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
  `<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>` +
  `</Relationships>`

const docRels =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
  `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>` +
  images
    .map(
      (im, i) =>
        `<Relationship Id="${im.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/img${i + 1}.png"/>`
    )
    .join('') +
  `</Relationships>`

const coreXml =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ` +
  `xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ` +
  `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
  `<dc:title>${esc(TITLE + ' \u2014 ' + DOC_TITLE)}</dc:title>` +
  `<dc:subject>${esc(SUBTITLE)}</dc:subject>` +
  `<cp:lastModifiedBy>FareWise Project Team</cp:lastModifiedBy>` +
  `<dcterms:created xsi:type="dcterms:W3CDTF">2026-10-16T00:00:00Z</dcterms:created>` +
  `<dcterms:modified xsi:type="dcterms:W3CDTF">2026-10-16T00:00:00Z</dcterms:modified>` +
  `</cp:coreProperties>`

const appXml =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ` +
  `xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">` +
  `<Application>FareWise docx builder</Application></Properties>`

/* ----------------------------------------------------------------- write --- */

rmSync(STAGE, { recursive: true, force: true })
mkdirSync(join(STAGE, '_rels'), { recursive: true })
mkdirSync(join(STAGE, 'word', '_rels'), { recursive: true })
mkdirSync(join(STAGE, 'word', 'media'), { recursive: true })
mkdirSync(join(STAGE, 'docProps'), { recursive: true })

writeFileSync(join(STAGE, '[Content_Types].xml'), contentTypes)
writeFileSync(join(STAGE, '_rels', '.rels'), rels)
writeFileSync(join(STAGE, 'docProps', 'core.xml'), coreXml)
writeFileSync(join(STAGE, 'docProps', 'app.xml'), appXml)
writeFileSync(join(STAGE, 'word', 'document.xml'), documentXml)
writeFileSync(join(STAGE, 'word', 'styles.xml'), stylesXml)
writeFileSync(join(STAGE, 'word', 'footer1.xml'), footerXml)
writeFileSync(join(STAGE, 'word', '_rels', 'document.xml.rels'), docRels)
images.forEach((im, i) =>
  writeFileSync(join(STAGE, 'word', 'media', `img${i + 1}.png`), im.buf)
)

console.log(STAGE)
console.log(`images: ${images.length}`)
console.log(`document.xml bytes: ${Buffer.byteLength(documentXml)}`)
