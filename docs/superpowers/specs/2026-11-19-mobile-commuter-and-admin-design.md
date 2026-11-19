# FareWise: mobile-first commuter app and separate admin console

**Date:** 2026-11-19
**Status:** draft for review
**Owner:** Shane Christopher C. Cahayag
**Repo:** `C:\Proj\farewise`

## Why this exists

FareWise runs, but it is shaped like a desktop console. At 390 px the fare drawer clips off the right edge, the map readout collides with the style toggle, the ledger is a seven-column table, and the admin panel is a public tab that anyone can open. Most users will be on a phone, and the admin side is not a commuter feature.

This design does four things:

1. Rebuilds the commuter app phone-first, using the H1 layout the owner chose.
2. Gives the admin a separate login page, shell, and role.
3. Keeps one credential store while giving admins their own table.
4. Fixes the pricing bugs that the new Plan screen would otherwise display.

Local-first stays. Hosted Supabase stays a later milestone, but the shape is chosen now so that migration is not a rewrite.

## Goals

- A commuter app that works one-handed at 390 × 844 and widens cleanly to desktop.
- A Plan screen that shows the fare without hiding the form or the map.
- Trips and Budget that read as cards, not tables.
- A separate admin console with its own login page, its own layout, and its own role.
- One place where passwords live. Admin identity lives in `admin_users`.
- The existing fare engine and data shapes are kept and corrected, not replaced.
- No regression in the working demo: 6.97 km, ₱15.96 student fare.

## Non-goals

- Real transit routing with a route network, stops, schedules, and transfers. The app still prices waypoint distance.
- Commuter sign-up or login in the local pass. The local app uses one device identity; accounts arrive with the hosted milestone.
- Payments, account recovery by SMS, social features, native apps.
- A second codebase, a second deployment, or a second password store.
- Admin access to individual commuter ledgers.
- A light theme.
- New chart or icon libraries.

## Anti-goals

- A fake account system placed on top of `localStorage`. The single local admin password is a documented demo gate, not an account.
- A separate `admin_passwords` table with hand-rolled hashing.
- Shipping admin code in the commuter nav or the first bundle.
- Keeping the sidebar and wide tables on phones.
- Letting a zero-rate placeholder row become the "cheapest" result.
- Showing a stack trace to a user.

## Decisions the owner made

- Local-first before deployment.
- Phone is the primary surface. Desktop is secondary.
- H1 layout: form first, fare ticket below, map as a tappable preview strip.
- Admin is a separate page with separate UI, separate functionality, and a different role.
- One credential store, separate admin table. Option 1.

## Calls made in this design

- Keep hash routing for now (`#/plan`, `#/admin/login`). It survives static hosting without server rewrites. A router library can come later.
- Five bottom tabs: Plan, Trips, Budget, Alerts, More.
- Admin gets no individual trip view. Aggregates only.
- Local admin access is a demo flag, not authentication. It is labeled as such.
- Keep the dark theme and the existing tokens, with contrast fixes.
- Build order: correctness and tests, then shell and Plan, then the rest.

## Experience

### Shell

- Header 52 px: screen title, subtitle, role chip, avatar.
- Content scrolls; the bottom tab bar is 56 px plus the safe-area inset.
- Tabs: Plan, Trips, Budget, Alerts, More. Icon plus label. Minimum 44 px targets. `aria-current="page"` on the active tab.
- No left rail. No fixed drawer over content.
- Desktop: the same content in a centered column up to 1180 px, with the tab bar becoming a top nav or a rail only at `lg` and above.

### Plan (H1)

Top to bottom:

1. Route card: origin and destination fields, swap button, add-stop action.
2. Commuter type: four chips (Regular, Student, Senior, PWD).
3. Vehicle class: compact selector showing base and per-km rate.
4. Fare ticket: label, large net fare, distance and time, route timeline, base plus excess, discount, amount payable.
5. Actions: Log this trip (primary), Breakdown (secondary).
6. Route preview strip: small map with the polyline and a chevron. Opens a full-screen map sheet.
7. This month: spent and remaining allowance, link to Budget.

Behavior:

- The fare ticket appears once the route resolves. While loading, show a skeleton in the ticket shape.
- If OSRM fails, show the offline estimate with a visible "Estimate" badge, not a silent fallback.
- Compare classes using the same leg structure as the trip. Show a one-line teaser under the ticket ("Cheapest: Bus ordinary ₱13.47") and the full list in the Breakdown sheet. The cheapest badge is only shown when the comparison is true.
- "Add stop" adds a Via point. A Via changes geometry and does not add a base fare. Transfers, where the mode changes mid-trip, are a later milestone; do not fake them with a via.
- A trip is one fare: base fare plus excess on total distance. Vias add distance, not a second minimum fare.
- Selecting a commuter type or vehicle class writes it to settings, so the header chip and the planner cannot disagree.
- Logging writes user id, role, mode, distance, distance source, gross, discount, net, leg count, and an immutable rate snapshot (base fare, base km, per km, discount percent, source).
- Duplicate consecutive stops are rejected.
- The header chip shows the active commuter type from settings. When the session role is `admin`, it also shows an Admin badge that links to the console.

### Trips (Ledger)

- Day-grouped cards. Each card: time, route, mode badge, distance, fare, and statutory discount saved. "Saved" always means gross minus net, never the difference against another class.
- Search and filter live in a sheet or inline chips, not a wide toolbar.
- Delete is a visible menu action with undo. Never hover-only.
- Totals as a 2 × 2 strip.
- Empty state explains how to log the first trip.

### Budget

- Allowance card with an edit action.
- 2 × 2 stats: allowance, spent, remaining, saved.
- Pacing bar with the elapsed-month marker.
- Eight-week bar chart, labels at 12 px minimum.
- Spend by vehicle class as a list.
- Projected month and the last three trips.
- Allowance is labeled as a standing monthly setting, not "set for November".

### Alerts (Advisories)

- Feed of cards: category, severity, relative time, title, body, area, confirmation count.
- Category chips scroll horizontally.
- Report form opens as a full-screen sheet, not an inline form that can be submitted by accident.
- Confirm is once per user when identity exists. Locally, once per device, with a visible "Thanks" state.
- Commuters never see moderation status.

### More

- Profile and role.
- Default commute (home and school).
- Default commuter type and vehicle class.
- Monthly allowance.
- Export data (JSON and CSV).
- Import data.
- About and the README link.
- Reset demo data, with confirmation.
- Admin demo link only when `VITE_ADMIN_DEMO=1`. Otherwise the admin route is URL-only and documented.

### Admin

**`#/admin/login`**: dedicated layout, no commuter tabs, no sign-up, no social login, generic error text. Locally it checks `VITE_ADMIN_DEMO_PASSWORD`; on success it sets the local session role to `admin`. Hosted, it calls the same provider sign-in and then checks `admin_users`.

**`#/admin`**: desktop-first shell. Left nav: Tariff, Moderation, Health, Admins. Sign out and a link back to the commuter app.

- **Tariff:** editable rows, no separate version table. Base fare, base km, per-km rate, discount cap, effective date, source citation. The cap is the most discount that class may grant; the fare engine uses `min(commuter discount, row cap)`, so the statutory 20% stays the ceiling. Validation on blur. A live worked example computed from the current row. Every save writes an audit row with the before and after values. Restore defaults re-adds missing seed rows. A zero-rate row cannot be active. Delete requires confirmation and is blocked if it is the only active row.
- **Moderation:** pending queue with approve, reject, delete. Published list with unpublish. Every decision writes an audit row.
- **Health:** counts of commuters, admins, trips, advisories, and pending items, plus the oldest and newest rate effective dates. Served by an aggregate RPC. No individual trips, no route history.
- **Admins:** list `admin_users` with display name, role, MFA status, last login. No passwords, no credential fields.

Admin accounts are provisioned by an operator. There is no self-service path to admin.

## Visual system

Keep the existing direction: dark ground, jeepney amber, route teal, Archivo for text, IBM Plex Mono for money and distance.

Changes:

- Raise `--color-muted` and `--color-faint` until normal text passes 4.5:1 on `ink-850` and `ink-900`.
- Mobile type: 12 px minimum for metadata, 14 px for body, 18 to 24 px for headings, 28 to 38 px for the primary fare.
- 44 px minimum targets. 8 px spacing base. 13 px panel radius.
- Self-host Archivo and IBM Plex Mono. Remove the Google Fonts `<link>`.
- Motion 150 to 250 ms, with the existing `prefers-reduced-motion` guard.
- Icons remain inline SVG. Charts remain flex bars.

## Data and identity

### Local now

- The commuter app has no sign-in screen in this pass. On first load it creates the local commuter session. `#/admin/login` is the only login screen, and it only elevates the local session to admin.
- New storage key `farewise.v2`, with a migration from `farewise.v1`.
- Shape: `{ version, session, matrix, trips, advisories, confirms, admins, audit, settings }`.
- `session`: `{ userId, role }`. The commuter session is `{ userId: 'local-commuter', role: 'commuter' }`. The admin demo sets `role: 'admin'` for the same local user.
- `confirms`: `{ [advisoryId]: true }`, so one device cannot inflate a count.
- `admins`: one seeded local admin `{ id, displayName, role, mfaEnrolled: false }`.
- `audit`: append-only rows `{ id, at, action, entity, entityId, before, after }`.
- Keep the three table shapes: `fare_matrices`, `trip_ledger`, `advisories`.
- Each trip stores a rate snapshot (base fare, base km, per km, discount percent, source) so history is explainable without a version join.

### Hosted later

- `auth.users`: credentials, owned by the provider.
- `commuters`: `id`, `display_name`, `home_id`, `school_id`, `monthly_allowance`, `created_at`.
- `admin_users`: `id`, `display_name`, `role`, `mfa_enrolled`, `last_login_at`, `created_at`.
- `fare_matrices`: `id`, `code`, `mode`, `base_fare`, `base_km`, `per_km`, `discount_pct`, `effective_from`, `source`, `active`, `updated_by`, `updated_at`.
- `trip_ledger`: `id`, `user_id`, `from_id`, `to_id`, `mode_id`, `role`, `distance_km`, `distance_source`, `fare`, `gross`, `discount`, `leg_count`, `base_fare`, `base_km`, `per_km`, `discount_pct`, `matrix_source`, `created_at`.
- `advisories`: `id`, `author_id`, `title`, `body`, `category`, `severity`, `area`, `status`, `moderated_by`, `moderated_at`, `confirms`, `created_at`.
- `advisory_confirms`: `(advisory_id, user_id)` primary key. This is what makes confirmation idempotent.
- `admin_audit`: `id`, `admin_id`, `action`, `entity`, `entity_id`, `before`, `after`, `created_at`.

RLS:

- Commuters read and write only their own `trip_ledger`, `commuters`, and `advisory_confirms` rows.
- Admins may read `advisories` for moderation, and may update moderation fields.
- Writes to `fare_matrices` require `exists (select 1 from admin_users where id = auth.uid())`.
- `admin_audit` is insert-only and read-only for admins.
- No policy grants admins a read path into another commuter's ledger.
- `admin_health()` is a `security definer` function that checks the caller is in `admin_users` and returns only counts. That is how Health works without a ledger policy.

## Security model

- Hosted: one credential store. No custom password hashing.
- The route guard is convenience. RLS is enforcement.
- Admin login checks `admin_users` after a successful sign-in. If the account is absent, sign out and show one generic message.
- No hint about whether an email belongs to an admin.
- Hosted only: rate limiting and lockout on sign-in.
- Hosted only: MFA required for the admin role.
- Hosted only: shorter admin sessions and re-authentication before destructive actions.
- Locally, destructive actions use a confirmation dialog. There is no MFA or session expiry to pretend about.
- No secrets in the client. `VITE_ADMIN_DEMO=1` is a demo switch, not security, and the README says so. The demo admin password is a local speed bump, not a credential system.
- Destructive admin actions write to `admin_audit`.

## Accessibility

- Every input has a real `<label htmlFor>`.
- Place search is a combobox with `aria-expanded`, `aria-controls`, `aria-activedescendant`, and a listbox of options.
- Fare recalculation and "trip logged" announce through `aria-live="polite"`.
- Tabs use `aria-current`. Icon-only buttons have `aria-label`. No `title`-only controls.
- Segmented controls use a roving tabindex and arrow keys, or become real radio inputs.
- Contrast at least 4.5:1 for body and metadata. Focus ring visible on every interactive element.
- 44 px targets. No hover-only actions.
- The map has a text alternative: the route summary is always present outside the canvas.

## States

- Route loading: ticket skeleton, disabled Log button.
- Route failure: offline estimate with an "Estimate" badge and a retry action.
- Empty ledger, empty advisories, empty comparison.
- Permission denied on admin: clear message and a link back, no dashboard flash.
- Storage failure: persistent banner, not a console warning.
- Destructive actions: confirm or undo.
- Errors never print a stack trace to the user.

## Correctness fixes included in this pass

These are required because the new Plan screen displays them.

- One `priceTrip(legs, mode, discount)` function used by the ticket, the comparison, and the logged trip.
- Comparison uses the same legs as the trip, so "cheapest" and "save" are true.
- Fare build-up is per leg or aggregated honestly. No `mostExpensive` shortcut.
- Via points do not add a base fare. Transfers are out of scope for this pass.
- Zero-km legs are not silently dropped before labels are assigned.
- Duplicate consecutive stops are rejected.
- The Plan search field is a real combobox and does not reopen after a pick.
- Admin numeric fields reject empty and `NaN`, clamp discounts, and cannot produce a negative fare.
- Restore defaults re-adds deleted seed rows.
- Adding a class does not create an active zero-rate row.
- The header role chip follows the active session.
- Seed distances and live distances use the same source, or the difference is labeled.
- The raw OSRM distance for Mambaling to IT Park is 6.9736 km. `14 + (6.9736 - 4) × 2 = 19.9472`, which displays as `19.95`. `19.9472 × 0.8 = 15.95776`, which displays as `15.96`. The app is right. Fix the README example to use the raw distance or say that the calculation uses it before display rounding. Do not change the demo number.

## Testing and quality gates

- `git init`, a `.gitignore` that includes `node_modules`, `dist`, `shots`, `.superpowers`.
- ESLint and Prettier.
- Vitest:
  - `computeFare` at `D < base`, `D = base`, `D > base`, discount 0 and 20, rounding boundaries.
  - `computeTrip` with one leg, two legs, a zero-km leg, and a via point.
  - Date bucketing for month and week.
  - Store migration from v1 to v2, including corrupt input.
- Playwright, or an extension of `scripts/shoot.mjs`:
  - 390 × 844 and 1440 × 900.
  - All five tabs.
  - Admin route denied without the demo password and allowed with it. Hosted, a commuter account is denied even after a successful sign-in.
  - No horizontal clipping, no console errors, no error boundary.
- CI: lint, test, build. Optional for the course, useful for the paper.
- No new runtime dependency without a stated reason.

## Build order

0. **Baseline:** git, lint, fare tests, pricing fixes. No UI changes yet.
1. **Shell and Plan:** bottom tabs, header, H1 screen, ticket, map sheet, combobox.
2. **Trips and Budget:** cards, filters, allowance, chart.
3. **Alerts and More:** feed, report sheet, settings, export.
4. **Admin:** login page, shell, tariff, moderation, health, admins, audit.
5. **Hosted milestone:** Supabase schema, RLS, adapter, MFA. Stretch.

## Open items for the builder

- Router: stay on hash routing unless there is a reason to add a dependency.
- Map provider: the public OSM tiles are fine for the demo, but a keyed provider is required before deployment.
- Export format details: JSON plus CSV is enough; do not build a backup service.
- Copy: keep the current voice, but remove claims the app does not meet (PWA, "one-file adapter swap").
- If the separate admin entry becomes a hard requirement, Vite supports a second `admin.html` entry point without a second repo. Do not create a second codebase.
