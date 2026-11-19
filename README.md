# FareWise Metro Cebu

A multi-modal transit fare calculator and commute-cost tracker for Metro Cebu,
built as a progressive web application. It prices a journey across every active
vehicle class, applies the statutory 20% discount for students, senior citizens
and PWDs, and keeps a personal ledger so a commuter can see what a month of
travel actually costs.

This is the running prototype described in Section 9 of the project charter.

## Run it

```bash
npm install
npm run dev          # http://127.0.0.1:5173
```

Production preview:

```bash
npm run build
npm run preview      # http://127.0.0.1:4173
```

There is no account, no API key and no server to configure. Everything the app
needs it derives locally.

## What it does

**Plan** — Enter an ordered list of waypoints (origin, any number of stops, a
destination), pick a commuter type and a vehicle class. The app resolves each
waypoint, measures road distance, draws the route on an OpenStreetMap basemap,
and prices the trip across every active vehicle class side by side, flagging the
cheapest.

**Fare breakdown** — Expands from the foot of the map and shows exactly how the
fare was assembled: base fare for the first `D_base` kilometres, the excess
charge for every kilometre beyond that, the gross subtotal, the statutory
discount and the amount payable. Multi-leg trips repeat the arithmetic per leg.

**Ledger** — Every logged journey as a row: route, vehicle class, commuter type,
road distance, fare paid and discount saved. Filter by class, sort by recency,
fare or distance, and read reconciling totals across the top.

**Budget** — Set a monthly allowance and the dashboard reports what is spent, what
remains, what the discount saved, and how the month is pacing against elapsed
time. An eight-week bar chart shows the trend and a breakdown shows spend by
vehicle class.

**Advisory** — Crowdsourced disruption reports (route changes, fare updates,
congestion, service interruptions) with severity, affected area and confirmation
counts.

**Admin** — Edit the fare matrix itself: base fare, base distance, per-kilometre
rate and discount percentage per vehicle class, each with its source citation and
a live worked example. A moderation queue holds community-submitted reports until
an administrator approves them.

## Fares

Every rate is sourced, none is assumed. The matrix reflects the LTFRB / DOTr
provisional fare matrix effective **28 September 2026**:

| Class | Base | Covers | Per km | Student/senior/PWD |
| --- | --- | --- | --- | --- |
| Traditional jeepney | ₱14.00 | 4 km | ₱2.00 | −20% |
| Modern jeepney (MPUJ) | ₱17.00 | 4 km | ₱2.40 | −20% |
| Provincial bus — ordinary | ₱12.00 | 5 km | ₱2.20 | −20% |
| Provincial bus — air-conditioned | ₱12.00 | 5 km | ₱2.45 | −20% |

```
F_gross = B + max(0, D − D_base) × R
F_net   = F_gross × (1 − discount_pct / 100)
```

Worked example — Mambaling to IT Park, 6.97 km, student, traditional jeepney:

```
₱14.00 + (6.97 − 4) × ₱2.00 = ₱19.95      gross
₱19.95 × 0.80               = ₱15.96      payable
```

Tricycle fares are deliberately excluded: they are set per LGU and no single
sourced rate covers Metro Cebu.

## Distance

Road distance comes from the **OSRM** routing engine (public demo server). If the
network is unavailable the app falls back to a great-circle estimate multiplied
by a road factor of **1.28**, measured against a Colon Street → IT Park control
segment (4.28 km straight line, 5.51 km by road). A trip therefore still prices
when offline; it is only less precise.

## Geocoding

The waypoint list is served from a curated gazetteer of 27 Metro Cebu landmarks,
terminals and barangays in `src/data/places.json`, all resolved against real
coordinates and validated inside a Metro Cebu bounding box. Autocomplete searches
this list, so there is no third-party geocoding key and no per-request cost.

## Project layout

```
src/
  App.jsx                 shell: icon rail, hash routing, view switching
  index.css               design tokens, base styles, .num / .label-xs utilities
  lib/
    fares.js              fare matrix seed + computeFare / computeTrip / compareModes
    geo.js                haversine, road factor, OSRM client
    seed.js               demo ledger, computed from the matrix (never hard-coded)
    store.js              localStorage store exposed via useSyncExternalStore
    format.js             peso / distance / date formatting
  components/
    MapView.jsx           Leaflet map, OSM tiles, dark filter, divIcon pins
    PlaceInput.jsx        gazetteer autocomplete
    BarChart.jsx          hand-rolled bar chart (no chart library)
    ui.jsx                Stat / Row / Chip / Button primitives
    Icon.jsx              inline SVG icon set (no icon library)
  views/
    Plan.jsx  Ledger.jsx  Budget.jsx  Advisories.jsx  Admin.jsx
  data/places.json        27 curated Metro Cebu places
scripts/shoot.mjs         dependency-free CDP screenshot + assertion driver
shots/                    captured screens + report.json
```

## Screenshots

`scripts/shoot.mjs` drives headless Chrome over the DevTools Protocol using only
Node's built-in `WebSocket` and `fetch` — no Puppeteer. Each capture asserts that
the error boundary did not trip, no console errors were logged, there is no
horizontal overflow, the map produced tiles, and the interactive controls
actually toggle. It writes both the PNGs and a `report.json` containing DOM
geometry and page text for each screen.

```bash
npm run build
npm run preview                  # in one shell
node scripts/shoot.mjs           # in another
```

## Stack

React 19, Vite 8, Tailwind CSS 4, Leaflet 1.9 with react-leaflet 5.

No charting library and no icon library — the bar chart is a flex layout and the
icons are inline SVG, which keeps the bundle small and the visual language
consistent.

## Known alpha-build deviations

The charter specifies a hosted Supabase / PostgreSQL / PostGIS back end. This
prototype keeps its records in `localStorage` under the key `farewise.v1`, with
the same table shapes (`fare_matrices`, `trip_ledger`, `advisories`) behind a
single data adapter, so it runs with no account, no server and no cost. Replacing
the adapter with the hosted client is a configuration change rather than a
rewrite. This is disclosed in the charter's Section 9 implementation note.

The interface was prototyped directly in code rather than in Figma.
