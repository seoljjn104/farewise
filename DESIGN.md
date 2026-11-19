# FareWise — design notes

Design direction: **transit wayfinding / operations console.** The interface is
meant to feel like the signage and control surfaces of a working transit system,
not a consumer finance app: a dark ground so the map and the figures carry the
eye, one high-visibility signal colour reserved for the primary action on each
screen, and monospaced tabular figures for anything that is money or distance.

## Design tokens

Defined once as CSS custom properties in `src/index.css` and exposed to Tailwind
through its `@theme` block, so `bg-ink-800`, `text-signal`, `font-mono` and so on
resolve from the same source of truth.

### Ground (ink ramp)

| Token | Value | Use |
| --- | --- | --- |
| `--color-ink-950` | `#070a0e` | deepest wells, drawer backing |
| `--color-ink-900` | `#0a0e13` | page ground |
| `--color-ink-850` | `#0e1319` | raised panels |
| `--color-ink-800` | `#12171f` | cards |
| `--color-ink-750` | `#161d26` | nested surfaces |
| `--color-ink-700` | `#1a212b` | inputs, chips |
| `--color-ink-600` | `#222b38` | hover states |

### Rules and type

| Token | Value | Use |
| --- | --- | --- |
| `--color-line` | `#263040` | panel and table borders |
| `--color-line-soft` | `#1d2530` | subtle dividers |
| `--color-fg` | `#eef2f6` | primary text |
| `--color-fg-dim` | `#a9b6c6` | secondary text |
| `--color-muted` | `#6f7d8e` | labels, meta |
| `--color-faint` | `#4a5563` | disabled, hints |

### Accents

| Token | Value | Meaning |
| --- | --- | --- |
| `--color-signal` | `#ffc42e` | jeepney amber — the one primary action per screen |
| `--color-signal-ink` | `#241c05` | text on amber |
| `--color-route` | `#3ddc97` | route teal — movement, savings, positive state |
| `--color-route-dim` | `#17392a` | teal wash |
| `--color-danger` | `#ff6b6b` | over-allowance, high severity |
| `--color-danger-dim` | `#3a1c1c` | danger wash |
| `--color-info` | `#58a6ff` | informational advisories |
| `--color-info-dim` | `#14253a` | info wash |

`--radius-panel: 14px` is the single corner radius for raised surfaces.

### Type

- **Archivo** (`--font-sans`) for all interface and prose text.
- **IBM Plex Mono** (`--font-mono`) — applied via the `.num` utility — for every
  fare, distance, count and timestamp. It is set with `font-variant-numeric:
  tabular-nums` so columns of peso amounts align on the decimal point, which is
  the whole reason the ledger is readable at a glance.

The accent rule is deliberately strict: amber marks the primary action (Plan,
Log trip, Approve) and nothing else. If two things on a screen are amber, one of
them is wrong.

## Layout

- **Desktop ≥ 768 px** — a fixed 78 px icon rail (62 px below `md`), a 412 px
  control sidebar and the map filling the remaining width. The fare breakdown
  drawer is anchored to the foot of the map and expands upward over it.
- **Below `md`** — the rail collapses to icons only, the sidebar and map stack
  vertically with the map pinned to `42vh`, and the fare drawer is promoted to a
  bottom sheet anchored to the Plan root.

## The map

Leaflet with the **OpenStreetMap standard tile layer**, chosen to stay literal to
the charter's "OpenStreetMap API" commitment. Dark mode is a CSS filter over the
tile pane rather than a paid dark basemap, so there is no key and no cost, and a
manual toggle lets the operator switch to true light tiles when reading terrain
matters more than glare.

Markers are plain `divIcon`s — a lettered circle for endpoints, a dot for vias —
so no icon assets or marker-sprite URLs are needed.

## Data layer

`localStorage` under the key `farewise.v1`, read through `useSyncExternalStore`,
with records shaped to mirror the charter's Supabase tables (`fare_matrices`,
`trip_ledger`, `advisories`). Everything is reached through a single adapter, so
the store can be swapped for the hosted client without touching a view.

This is a deliberate alpha-build decision and is disclosed in the charter's
Section 9 implementation note.

## Verifying the design without eyes

The screenshots in `shots/` are produced by `scripts/shoot.mjs`, a dependency-free
Chrome DevTools Protocol driver, and each capture asserts:

- the React error boundary did not trip,
- no console or page errors were logged,
- no horizontal overflow,
- the map produced tiles and the expected marker count,
- the sidebar and map have the intended pixel geometry,
- the fare drawer and the admin tabs actually toggle.

Pixel-level checks (dark-ink coverage, accent coverage, per-quadrant luminance)
are run separately against the PNGs, because an automated pass on the DOM alone
would not catch a screen that renders but looks blank.
