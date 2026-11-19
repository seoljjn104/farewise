# FareWise Mobile Commuter App and Admin Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild FareWise phone-first for commuters, give administrators a separate login, shell, role, and panels, and fix the fare-pricing defects the new screens would otherwise display.

**Architecture:** One React 19 + Vite app, two shells. `src/App.jsx` becomes a hash router that picks a commuter shell or a lazily loaded admin shell. Fare maths moves to one `priceTrip` function used by the ticket, the comparison list, and the logged trip. The local store moves to `farewise.v2` with a session, a seeded admin, an audit log, and per-device advisory confirmations, all shaped so a Supabase adapter can replace it later.

**Tech Stack:** React 19, Vite 8, Tailwind CSS 4, Leaflet 1.9 + react-leaflet 5, Vitest, ESLint, Prettier. No new runtime dependency.

**Spec:** `docs/superpowers/specs/2026-11-19-mobile-commuter-and-admin-design.md`

## Global Constraints

- Fares are fixed and must not change: traditional jeepney ₱14.00 first 4 km + ₱2.00/km; modern jeepney ₱17.00 first 4 km + ₱2.40/km; ordinary bus ₱12.00 first 5 km + ₱2.20/km; air-conditioned bus ₱12.00 first 5 km + ₱2.45/km. Statutory discount is 20% for student, senior, and PWD.
- Demo invariant: Mambaling to Cebu IT Park, traditional jeepney, student, shows `6.97 km`, gross `₱19.95`, payable `₱15.96`. Pricing uses the raw distance 6.9736 km; only the display rounds.
- Commuter type is `regular | student | senior | pwd`. Session role is `commuter | admin`. These are different things and must not share a field.
- Storage key is `farewise.v2`. Nothing may write `farewise.v1` after migration.
- The commuter app never shows an individual trip ledger to an admin. Admin shows aggregates, tariff rows, moderation, and the admin list only.
- The admin route is `#/admin/login` and `#/admin/*`. It is not in the commuter navigation. Admin code is loaded with `React.lazy` and must not appear in the entry chunk.
- Hash routing only. `#/ledger` redirects to `#/trips`, `#/advisories` to `#/alerts`.
- No new runtime dependency. Vitest, ESLint, and Prettier are dev dependencies.
- Dark theme only. Money and distance use the `num` utility. Minimum 12 px metadata text. Minimum 44 px touch targets on coarse pointers.
- User-facing copy uses plain language and no em dashes.
- `dist/` and `shots/` are build output. Never delete them; they are gitignored.

## Review Focus

Inputs and conditions the spec implies but no single test covers. Each line names the task that pins it.

1. **OSRM unreachable or slow.** The commuter still gets a fare, marked as an estimate, and can still log it. Wrong behavior is a blank ticket or a silent fallback presented as real routing. Pinned in Task 6 by the `geo.test.js` fetch stub and the estimate badge assertion.
2. **Storage quota exceeded mid-session.** The app stays usable and shows a persistent banner instead of only a console warning. Pinned in Task 2.
3. **Half-entered route (one stop, duplicate stops, or no route yet).** No fare card, no `₱0.00`, Log disabled, and a visible reason. Pinned in Tasks 5 and 6.
4. **A tariff row edited to zero or emptied while active.** It cannot become the cheapest result, and the admin sees why. Pinned in Tasks 1 and 11.
5. **Long place names and long class names at 390 px.** No horizontal overflow, names truncate, the fare is never clipped. Pinned in Task 3 (shoot assertion) and re-checked in Task 13.

---

## Task 0: Baseline repository and quality gates

**Files:**
- Modify: `.gitignore`
- Modify: `package.json`
- Modify: `vite.config.js`
- Create: `eslint.config.js`
- Create: `.prettierrc`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm run lint`, `npm test`, `npm run format`, `npm run check`. Every later task ends with these passing.

- [ ] **Step 1: Initialise git and ignore build output**

Run:
```bash
git init -b main
```
Add to `.gitignore` (keep `node_modules`, `dist`, `.vite`, `*.local`, `.DS_Store`):
```
shots
.superpowers
```
`*.local` already covers `.env.local`.

- [ ] **Step 2: Install dev tooling**

Run:
```bash
npm i -D vitest @eslint/js globals eslint eslint-plugin-react-hooks prettier
```

- [ ] **Step 3: Configure scripts and the test runner**

`package.json` scripts:
```json
"dev": "vite",
"build": "vite build",
"preview": "vite preview --port 4173",
"test": "vitest run",
"test:watch": "vitest",
"lint": "eslint .",
"format": "prettier --write .",
"check": "npm run lint && npm run test && npm run build"
```
In `vite.config.js`, import `defineConfig` from `vitest/config` instead of `vite`, and add:
```js
test: { environment: 'node', include: ['src/**/*.test.js'] },
```

- [ ] **Step 4: Configure ESLint and Prettier**

`eslint.config.js`: ignore `dist`, `shots`, `node_modules`, `.superpowers`; apply `js.configs.recommended`; browser globals for `src/**` and node globals for `scripts/**` and `*.config.js`; `languageOptions.parserOptions.ecmaFeatures.jsx = true`; register `react-hooks` and spread `reactHooks.configs.recommended.rules`; set `no-unused-vars` to error with `argsIgnorePattern: '^_'` and `varsIgnorePattern: '^_'`. If the installed hooks plugin exposes a flat config, use `reactHooks.configs['recommended-latest']` and delete the spread.

`.prettierrc`: `{ "semi": false, "singleQuote": true, "printWidth": 100, "trailingComma": "all" }`.

- [ ] **Step 5: Verify and commit**

Run `npm run lint`, `npx vitest run --passWithNoTests`, `npm run build`. Expected: all three exit 0. Fix any pre-existing lint error with the smallest change, no reformatting spree.

```bash
git add -A
git commit -m "chore: baseline git, vitest, eslint, prettier"
```

---

## Task 1: One fare engine for ticket, comparison, and log

**Files:**
- Modify: `src/lib/fares.js`
- Create: `src/lib/fares.test.js`
- Modify: `src/views/Plan.jsx` (call sites only, no layout change)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `computeFare(row, km, discountPct = 0) -> FareBreakdown | null`
  - `priceTrip(legsKm: number[], row, discountPct = 0) -> TripPrice | null`
  - `compareModes(matrix, km, discountPct = 0) -> FareBreakdown[]` sorted by `net` ascending
  - `effectiveDiscountPct(row, commuterDiscountPct) -> number`
  - `sanitizeRateRow(row) -> row`
  - `billableRows(matrix) -> row[]`
  - `FareBreakdown` keeps `row, distanceKm, baseKm, baseFare, perKm, billableKm, excessCharge, gross, discountPct, discountAmount, net`.
  - `TripPrice` is `FareBreakdown & { legs: { km, skipped }[], totalKm }`.

**Rules this task locks in:**
- A trip is one fare: `base + max(0, totalKm - base_km) * per_km`, then the discount. A via adds distance, never a second base fare.
- A leg with `km <= 0` is retained in `legs` with `skipped: true` so labels stay aligned, and adds nothing to the total.
- `priceTrip` returns `null` when the total distance is 0, when a leg list is empty, or when `row` is missing.
- Effective discount is `min(commuterDiscountPct, row.discount_pct ?? 100)`, clamped to 0..100. The row cap can lower the statutory discount, never raise it.

- [ ] **Step 1: Write the failing tests**

`src/lib/fares.test.js` with `describe('computeFare')`, `describe('priceTrip')`, `describe('sanitizeRateRow')`, `describe('comparison')`:

```js
computeFare(puj, 3).gross === 14
computeFare(puj, 4).gross === 14
computeFare(puj, 6.9736, 20) -> distanceKm 6.97, billableKm 2.97, excessCharge 5.95, gross 19.95, discountAmount 3.99, net 15.96
computeFare(puj, 6.9736, 0).net === 19.95
computeFare({ ...puj, discount_pct: 0 }, 6.9736, 20).net === 19.95
effectiveDiscountPct({ ...puj, discount_pct: 10 }, 20) === 10
effectiveDiscountPct({ ...puj, discount_pct: 50 }, 20) === 20
priceTrip([6.9736], puj, 20) -> totalKm 6.97, gross 19.95, net 15.96, legs.length 1
priceTrip([3, 3], puj, 0) -> totalKm 6, gross 18, net 18, legs.length 2
priceTrip([6.9736, 0], puj, 20) -> totalKm 6.97, gross 19.95, legs[1].skipped === true
priceTrip([0], puj) === null
priceTrip([], puj) === null
priceTrip([1], null) === null
compareModes(billableRows(FARE_MATRIX_SEED), 6.9736, 20).map(x => x.row.id) === ['bus-ordinary','bus-aircon','puj-traditional','puj-modern']
billableRows([...FARE_MATRIX_SEED, { id: 'x', active: true, base_fare: 0, per_km: 0 }]) excludes 'x'
sanitizeRateRow({ base_fare: '', per_km: 2, active: true }).active === false
sanitizeRateRow({ base_fare: 14, per_km: -2, active: true }).per_km === 0
sanitizeRateRow({ base_fare: 14, per_km: 2, discount_pct: 150, active: true }).discount_pct === 100
sanitizeRateRow({ base_fare: 14, per_km: 2, discount_pct: -5, active: true }).discount_pct === 0
sanitizeRateRow({ base_fare: 14, per_km: 2, active: true }).active === true
```
Add a rounding-drift test: for every row in `FARE_MATRIX_SEED`, for `km` from 0.5 to 20 step 0.137, and for discount 0 and 20, assert `Math.abs(cent(gross) - cent(discountAmount) - cent(net)) <= 0.01`. This guarantees the displayed build-up lines add up.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/fares.test.js`
Expected: FAIL, `priceTrip is not a function`.

- [ ] **Step 3: Implement the engine in `src/lib/fares.js`**

Keep `cent`, `ROLES`, `roleById`, `FARE_MATRIX_SEED`. Add `effectiveDiscountPct`, `priceTrip`, `billableRows`, `sanitizeRateRow`. Reimplement `compareModes` over `billableRows` using `priceTrip([km], row, discountPct)`. Delete `computeTrip`. In `computeFare`, use `effectiveDiscountPct(row, discountPct)` for the discount so the cap applies everywhere.

`sanitizeRateRow` coerces with `Number`, treats `''`, `null`, and `NaN` as the fallback, floors base fare, base km, and per-km at 0, clamps discount to 0..100, and sets `active: false` unless `active` is truthy and both `base_fare > 0` and `per_km > 0`.

- [ ] **Step 4: Rewire `src/views/Plan.jsx` without touching layout**

Replace the `computeTrip` import with `priceTrip`, `compareModes`, `billableRows`. The ticket uses `priceTrip(route.legs.map(l => l.km ?? 0), mode, role.discount_pct)`. The comparison uses `compareModes(billableRows(matrix), trip?.totalKm ?? route.km, role.discount_pct)` and reads `c.net` instead of `c.totalNet`, `c.row` instead of `c.m`. The leg list reads `trip.legs[i].km` and omits a per-leg peso value when `skipped`.

- [ ] **Step 5: Verify and commit**

Run `npx vitest run src/lib/fares.test.js`, then `npm run build`. Expected: pass, build succeeds.

```bash
git add src/lib/fares.js src/lib/fares.test.js src/views/Plan.jsx
git commit -m "fix: price a trip as one fare and cap the statutory discount per class"
```

---

## Task 2: Store v2 with migration, session, audit, and honest failures

**Files:**
- Modify: `src/lib/store.js`
- Modify: `src/lib/seed.js`
- Create: `src/lib/store.test.js`

**Interfaces:**
- Consumes: `sanitizeRateRow`, `billableRows`, `FARE_MATRIX_SEED` from Task 1.
- Produces:
  - State shape: `{ version: 2, session, matrix, trips, advisories, confirms, admins, audit, settings }`
  - `session`: `{ userId: 'local-commuter', role: 'commuter' | 'admin' }`
  - `actions.addTrip`, `deleteTrip`, `restoreTrip(trip, index)`, `clearTrips`
  - `actions.updateMatrixRow`, `adminUpdateMatrixRow`, `addMatrixRow`, `deleteMatrixRow`, `restoreMatrixDefaults`
  - `actions.addAdvisory`, `setAdvisoryStatus`, `confirmAdvisory`, `deleteAdvisory`
  - `actions.updateSettings`, `signInAdmin`, `signOutAdmin`, `importState`, `resetAll`
  - `useStore()`, `useStorageError()`, `getState()`, `getStorageError()`
  - `publishedAdvisories`, `monthTrips`, `totalsFor`, `aggregateCounts`, `canConfirm`, `normaliseState`
  - `aggregateCounts(state) -> { commuters, admins, trips, advisories, pending, oldestRate, newestRate }`

**Behavior:**
- On load: read `farewise.v2`. If absent, read `farewise.v1`, map it into v2, write v2, then remove v1. If parsing fails or `matrix` is not an array, return the seed state.
- `persist()` returns success. On failure set a module-level message and notify subscribers, do not throw.
- `confirmAdvisory(id)` increments `confirms` and sets `state.confirms[id] = true` only if `canConfirm` is true. `canConfirm(state, id)` is false when already confirmed.
- `addMatrixRow()` creates an inactive, zero-rate draft row.
- `updateMatrixRow` applies `sanitizeRateRow` to the merged row and does not audit. `adminUpdateMatrixRow` does the same and appends one audit row with `{ id, at, action, entity, entityId, before, after }`.
- `setAdvisoryStatus` appends an audit row.
- `deleteMatrixRow` is a no-op when it would remove the last billable row.
- `restoreMatrixDefaults` resets every seed row to its seed values, re-appends any seed row that is missing, and keeps non-seed rows (sanitised and inactive if invalid).
- `signInAdmin` sets `session.role = 'admin'`, stamps `admins[0].lastLoginAt`, and audits. `signOutAdmin` sets it back to `commuter` and audits.
- `importState(parsed)` runs `normaliseState`; on failure returns `{ ok: false, message }` and changes nothing; on success replaces matrix, trips, advisories, settings, confirms, and keeps session and audit.

- [ ] **Step 1: Write the failing tests**

`src/lib/store.test.js` runs in Node, so install a fake `localStorage` before importing the module:

```js
function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  const api = {
    failWrites: false,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      if (api.failWrites) throw new Error('QuotaExceededError')
      map.set(k, String(v))
    },
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  }
  return api
}

async function loadStore(initial) {
  vi.resetModules()
  globalThis.localStorage = fakeStorage(initial)
  return import('./store.js')
}
```
Each test calls `loadStore` and asserts on `getState()` and `actions`.

```js
fresh state: version 2, session.role 'commuter', matrix.length 4, trips.length > 0, admins.length 1, audit []
v1 migration: seed farewise.v1 with one trip -> version 2, trips.length 1, farewise.v2 exists, farewise.v1 removed
corrupt v2 ('not json') -> seed state, no throw
wrong shape ({ matrix: 'x' }) -> seed state
persist failure: failWrites = true, addTrip -> trip is in state, getStorageError() is a non-empty string
addMatrixRow -> active false, not in billableRows(getState().matrix)
updateMatrixRow(puj-traditional, { base_fare: 0 }) -> active false
restoreMatrixDefaults after deleteMatrixRow('puj-modern') and addMatrixRow -> all 4 seed ids present, values equal seed, custom row kept
confirmAdvisory('adv-1') twice -> confirms +1 once, canConfirm false
adminUpdateMatrixRow -> audit.length 1, audit[0].before.per_km is the old value
setAdvisoryStatus -> audit.length 1, entity 'advisory'
deleteMatrixRow on the last billable row -> matrix length unchanged
importState({ matrix: [], trips: [], advisories: [], settings: {} }) -> ok true
importState({ nope: true }) -> ok false, state unchanged
aggregateCounts(getState()).pending equals the number of pending advisories
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/store.test.js`
Expected: FAIL on `version 2`.

- [ ] **Step 3: Implement the store**

Add `ADMIN_SEED` and `SETTINGS_SEED` usage in `src/lib/seed.js`: admin `{ id: 'admin-local', displayName: 'Local admin', role: 'admin', mfaEnrolled: false, createdAt }`. Keep seeded trips unchanged.

Rewrite `src/lib/store.js` around a single `commit(next)` that persists, sets the storage error, and notifies. Keep `useSyncExternalStore` for both the state and the storage error. Export `getStorageError` for tests.

- [ ] **Step 4: Run the tests and the build**

Run: `npx vitest run src/lib/store.test.js`, then `npm run build`. Expected: pass. The existing views read the same keys, so the app still renders.

- [ ] **Step 5: Commit**

```bash
git add src/lib/store.js src/lib/store.test.js src/lib/seed.js
git commit -m "feat: store v2 with session, admin seed, audit, and confirm-once"
```

---

## Task 3: Hash router, commuter shell, bottom tabs, and a real capture check

**Files:**
- Create: `src/lib/router.js`
- Create: `src/lib/router.test.js`
- Create: `src/shell/CommuterShell.jsx`
- Create: `src/views/More.jsx` (minimal in this task)
- Modify: `src/App.jsx`
- Modify: `src/index.css`
- Modify: `scripts/shoot.mjs`

**Interfaces:**
- Consumes: `useStore`, `getState`, storage error from Task 2.
- Produces:
  - `parseHash(hash) -> { kind:'commuter', view } | { kind:'adminLogin' } | { kind:'admin', panel } | { kind:'redirect', to }`
  - `navigate(hash)`, `useHashRoute()`
  - `COMMUTER_TABS = [{ id:'plan', label:'Plan' }, { id:'trips', label:'Trips' }, { id:'budget', label:'Budget' }, { id:'alerts', label:'Alerts' }, { id:'more', label:'More' }]`
  - `CommuterShell({ view })` renders the header, the scroll area, and the bottom tabs, or the left rail at `lg`.

**Router rules:**
- `''`, `'#'`, `'#/'` → commuter `plan`.
- `#/ledger` → redirect `#/trips`; `#/advisories` → redirect `#/alerts`.
- `#/admin/login` → `adminLogin`.
- `#/admin` and `#/admin/<panel>` → `admin` with panel `tariff` for unknown panels.
- Query strings and trailing slashes are ignored.
- Unknown commuter hash → `plan` (no redirect entry).

- [ ] **Step 1: Write the failing router tests**

`src/lib/router.test.js` with the eleven cases above, asserting the full object each time.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/router.test.js`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the router and the commuter shell**

`navigate(hash)` sets `window.location.hash = hash`. `useHashRoute` subscribes to `hashchange` and runs `parseHash` on the current hash. `App.jsx` runs redirects in an effect with `navigate(route.to)`, renders `null` during a redirect, renders `CommuterShell` for commuter routes, and renders the legacy `Admin` view for admin routes until Task 4 replaces it. Delete the `replaceState` effect and the icon rail from `App.jsx`; the rail moves into `CommuterShell`.

Shell layout, mobile first:
```
<div className="flex h-[100dvh] flex-col bg-ink-900">
  <header className="h-[52px] shrink-0 ...">title, sub, commuter-type chip, avatar</header>
  <main className="min-h-0 flex-1 overflow-y-auto">{view}</main>
  <nav className="shrink-0 border-t ... pb-[env(safe-area-inset-bottom)]">5 tabs</nav>
</div>
```
At `lg`, hide the bottom nav and show a 78 px left rail with the same five items plus the reset control. Each tab is at least 44 px tall, carries `aria-current="page"` when active, and uses the existing `Icon` names `route`, `receipt`, `wallet`, `bell`, `layers`.

The header chip reads `settings.defaultRole` through `roleById`. When `session.role === 'admin'`, show an extra `Admin` badge linking to `#/admin`.

Above `<main>`, render a persistent banner when `useStorageError()` returns a message: "Changes are not being saved on this device. Export your data before closing." Keep it until the next successful write.

Replace the stack trace in the `ErrorBoundary` fallback with the message "Something went wrong on this screen." plus a Reload button. No `<pre>`, no stack, no error internals.

`More.jsx` in this task: profile line (session user id and role), default commuter type and vehicle class selects writing to settings, monthly allowance, reset demo data with a confirm, and a link to `#/admin/login` only when `import.meta.env.VITE_ADMIN_DEMO === '1'`. It grows in Task 10.

- [ ] **Step 4: Update `scripts/shoot.mjs` for the new routes**

- Resolve Chrome from `process.env.CHROME_PATH`, then `C:/Program Files/Google/Chrome/Application/chrome.exe`, then `C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`.
- Shots: `#/plan` at 390×844 and 1440×900, `#/trips`, `#/budget`, `#/alerts`, `#/more` at 390×844, and `#/admin` at 1440×900 (whatever the route renders until Task 4).
- Before the 390 px Plan shot, write a `farewise.v2` state whose `settings.homeId` is `cit` and `settings.schoolId` is `usc` (the two longest place names), then reload. This is the long-name stress case, not a prettier screenshot.
- Collect `problems` when `hOverflow` is true, `errorBoundary` is true, `nodes === 0`, any exception exists, or any console error exists. Print them and set `process.exitCode = 1`.
- Keep writing `shots/report.json`.

- [ ] **Step 5: Verify with tests, build, and a real capture**

Run `npx vitest run src/lib/router.test.js`, `npm run build`, start `npm run preview` in one shell, then `node scripts/shoot.mjs` in another. Expected: every shot reports `hOverflow=false`, `errorBoundary=false`, and no exceptions. Read `shots/08-mobile-plan.png` equivalent and confirm the bottom bar is visible and the content is not clipped.

- [ ] **Step 6: Commit**

```bash
git add src/lib/router.js src/lib/router.test.js src/shell/CommuterShell.jsx src/views/More.jsx src/App.jsx src/index.css scripts/shoot.mjs
git commit -m "feat: hash router, phone-first shell, and bottom tab bar"
```

---

## Task 4: Admin login, role gate, separate shell, separate bundle

**Files:**
- Create: `src/lib/auth.js`
- Create: `src/lib/auth.test.js`
- Create: `src/admin/AdminApp.jsx`
- Create: `src/admin/AdminLogin.jsx`
- Create: `.env.example`
- Create: `.env.local` (local only, gitignored)
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `parseHash`, `navigate`, `useStore`, `actions.signInAdmin`, `actions.signOutAdmin`.
- Produces:
  - `checkAdminDemoPassword(input, { enabled, password }) -> { ok: boolean, reason?: 'disabled' | 'invalid' }`
  - `ADMIN_DEMO_ENABLED` (read from `import.meta.env.VITE_ADMIN_DEMO === '1'`)
  - `AdminApp({ route })` rendered through `React.lazy`

**Behavior:**
- `#/admin/login` renders a standalone page: FareWise mark, "Admin console", one password field with a real `<label htmlFor>`, one submit button, and the generic error "Those credentials were not accepted." No sign-up, no social login, no password reset.
- With `VITE_ADMIN_DEMO` unset, the page states that the admin console is disabled in this build and does not render the field.
- On success: `actions.signInAdmin()` then `navigate('#/admin')`.
- `#/admin/*` with `session.role !== 'admin'` renders a blank redirect to `#/admin/login`. Never render the console before the check.
- The console shell has its own header: admin display name, "Signed in as admin", Sign out, and "Back to the commuter app". No commuter tabs.
- In this task the console body renders the existing `src/views/Admin.jsx`; Task 11 and Task 12 replace it panel by panel.

- [ ] **Step 1: Write the failing auth tests**

```js
checkAdminDemoPassword('secret', { enabled: true, password: 'secret' }) -> { ok: true }
checkAdminDemoPassword('nope', { enabled: true, password: 'secret' }) -> { ok: false, reason: 'invalid' }
checkAdminDemoPassword('', { enabled: true, password: 'secret' }) -> { ok: false, reason: 'invalid' }
checkAdminDemoPassword('secret', { enabled: false, password: 'secret' }) -> { ok: false, reason: 'disabled' }
checkAdminDemoPassword('secret', { enabled: true, password: undefined }) -> { ok: false, reason: 'disabled' }
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/auth.test.js`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement auth, the login page, and the shell**

`checkAdminDemoPassword` compares strings and never throws. `AdminLogin` uses local state for the password and the error. `AdminApp` lazy-imports nothing else; it is the lazy boundary.

- [ ] **Step 4: Wire the lazy boundary and the gate in `App.jsx`**

`const AdminApp = lazy(() => import('./admin/AdminApp.jsx'))`. Remove the static `Admin` import from `App.jsx`. Wrap in `<Suspense fallback={<BootScreen />}>`. Redirect with an effect, not during render.

- [ ] **Step 5: Add the env files**

`.env.example`:
```
# Local demo gate only. Not authentication.
VITE_ADMIN_DEMO=1
VITE_ADMIN_DEMO_PASSWORD=change-me
```
`.env.local` sets `VITE_ADMIN_DEMO=1` and `VITE_ADMIN_DEMO_PASSWORD=farewise-demo` for this machine. Confirm `git status` does not list it.

- [ ] **Step 6: Verify the gate, the bundle split, and commit**

Run `npm run build`. Expected: build succeeds and `dist/assets` contains a separate chunk whose name includes `AdminApp`. Confirm no admin module appears in the entry chunk by checking the entry file does not contain `Admin Control Panel`.

Run `npm run preview` and `node scripts/shoot.mjs`. Then check by hand: a fresh profile opening `#/admin` lands on `#/admin/login`; the wrong password shows the generic error; the right password shows the console.

```bash
git add src/lib/auth.js src/lib/auth.test.js src/admin src/App.jsx .env.example
git commit -m "feat: separate admin login, shell, role gate, and lazy bundle"
```

---

## Task 5: Design system pass for touch and contrast

**Files:**
- Modify: `src/index.css`
- Modify: `src/components/ui.jsx`
- Create: `src/components/Sheet.jsx`
- Create: `src/lib/color.js`
- Create: `src/lib/color.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `contrastRatio(hexA, hexB) -> number`
  - Token values: `--color-muted: #8492a3`, `--color-faint: #7b8998`
  - `Field({ label, hint, children, className, as })` where `as` is `'group'` (default) or `'input'`
  - `Segmented` renders `type="button"` and supports arrow-key roving focus
  - `Sheet({ open, onClose, title, children })`

**Rules:**
- Every `Field` gives its control a real accessible name. `as="input"` wraps the control in a `<label>` so clicking the caption focuses it. `as="group"` renders `role="group"` with the caption as its visible label.
- `Segmented` must never submit a surrounding form. It also supports Left/Right/Up/Down between radios with a roving tabindex.
- `Sheet` is a bottom sheet on mobile and a centred dialog at `md`. It closes on Escape and backdrop click, locks body scroll while open, restores focus to the trigger, and exposes `role="dialog"`, `aria-modal="true"`, `aria-labelledby`.
- `pointer-coarse:` variants give every `Btn` size and tab item a 44 px minimum.
- Keep the visual language: dark ground, amber signal, teal route, 14 px panel radius.

- [ ] **Step 1: Write the failing contrast test**

```js
contrastRatio('#ffffff', '#000000') is close to 21 (1 decimal)
contrastRatio('#8492a3', '#0e1319') >= 4.5
contrastRatio('#8492a3', '#12171f') >= 4.5
contrastRatio('#7b8998', '#0e1319') >= 4.5
contrastRatio('#7b8998', '#0a0e13') >= 4.5
contrastRatio('#ffc42e', '#0e1319') >= 4.5
contrastRatio('#3ddc97', '#0e1319') >= 4.5
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/color.test.js`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `color.js` and update the tokens**

`contrastRatio` implements relative luminance with the sRGB breakpoint at 0.03928. Update `--color-muted` and `--color-faint` in `src/index.css` to the values above.

- [ ] **Step 4: Update `Field`, `Segmented`, and `Btn`**

Add `as` to `Field`. Add `type="button"` and roving focus to `Segmented`. Add `pointer-coarse:min-h-[44px]` to `Btn` sizes and to the bottom tabs. Do not change the visual size on fine pointers.

- [ ] **Step 5: Create `Sheet`**

Implement focus restore with a ref, Escape handling on `document`, and a backdrop `<button aria-label="Close">`. Animate with the existing `prefers-reduced-motion` guard. Do not add a focus-trap library.

- [ ] **Step 6: Verify and commit**

Run `npx vitest run src/lib/color.test.js`, `npm run build`, then `node scripts/shoot.mjs`. Expected: pass, and no screen reports overflow at 390 px.

```bash
git add src/index.css src/components/ui.jsx src/components/Sheet.jsx src/lib/color.js src/lib/color.test.js
git commit -m "feat: labelled fields, 44px targets, contrast tokens, and sheet primitive"
```

---

## Task 6: Plan screen in the H1 shape

**Files:**
- Modify: `src/views/Plan.jsx` (rewrite)
- Modify: `src/components/PlaceInput.jsx`
- Create: `src/components/FareTicket.jsx`
- Create: `src/lib/plan.js`
- Create: `src/lib/plan.test.js`
- Create: `src/lib/geo.test.js`

**Interfaces:**
- Consumes: `priceTrip`, `compareModes`, `billableRows`, `effectiveDiscountPct` (Task 1); `actions.addTrip`, `updateSettings` (Task 2); `Sheet`, `Field`, `Segmented`, `Btn` (Task 5).
- Produces:
  - `legsKmFromRoute(route) -> number[]`
  - `duplicateIndex(stops) -> number` (`-1` when none)
  - `canLog(stops, trip) -> boolean`
  - `buildTripRecord({ stops, mode, role, trip, source, now }) -> trip record`
  - `timeline(stops, legsKm) -> { name, km, kind }[]`

**Screen order, top to bottom:**
1. Route card: origin and destination `PlaceInput` rows, swap button, Add stop.
2. Commuter type: four chips (Regular, Student, Senior, PWD), each 44 px tall.
3. Vehicle class: one `Select` showing `name — ₱base first N km · +₱rate/km`.
4. Fare ticket: label, large net fare, distance and time, origin/via/destination timeline with cumulative km, base plus excess, discount, amount payable.
5. Actions: Log this trip (primary), Breakdown (opens the sheet).
6. Route preview strip: 64 px map thumbnail with a chevron, opens a full-screen map sheet. Render `MapView` only while that sheet is open.
7. This month: spent, remaining, link to Budget.

**Behavior:**
- The fare ticket shows a skeleton while `loading` and the previous trip is null.
- When `route.source === 'estimate'`, the ticket shows an `Estimate` badge and the Log button stays enabled.
- `duplicateIndex(stops) >= 0` blocks the fetch and shows "Two stops are the same place." with the row highlighted.
- `canLog` is false with fewer than two stops, a null stop, or no priced trip. The Log button is disabled and the reason is visible.
- Selecting a commuter type or vehicle class calls `updateSettings({ defaultRole })` or `updateSettings({ defaultModeId })`, so the header agrees.
- Logging writes the rate snapshot: `baseFare`, `baseKm`, `perKm`, `discountPct` (effective), `matrixSource`.
- The comparison teaser under the ticket shows only the cheapest class when it differs from the current one: "Cheapest: Bus ordinary ₱13.07". The full list is in the Breakdown sheet.
- Delete the old inline "Search location" block. `PlaceInput` is the search.
- Every place and class name renders with `truncate` (and a `title` where the full string matters). The fare, distance, and unit labels never truncate.

**PlaceInput combobox:**
- Input gets `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-autocomplete="list"`, `aria-activedescendant` pointing at the highlighted option.
- List gets `role="listbox"`; options get `role="option"` and `aria-selected`.
- `Enter` picks, `Escape` closes without clearing, `Tab` closes.

- [ ] **Step 1: Write the failing helper tests**

```js
legsKmFromRoute({ legs: [{ km: 2.5 }, { km: 4.4736 }] }) -> [2.5, 4.4736]
legsKmFromRoute({ legs: [] }) -> []
duplicateIndex([a, a]) === 1
duplicateIndex([a, b, a]) === 2
duplicateIndex([a, b, c]) === -1
canLog([a, b], trip) === true
canLog([a], trip) === false
canLog([a, null], trip) === false
canLog([a, b], null) === false
buildTripRecord({ stops:[mambaling, itpark], mode: puj, role: student, trip: priceTrip([6.9736], puj, 20), source:'osrm', now }) ->
  fare 15.96, gross 19.95, discount 3.99, distanceKm 6.97, baseFare 14, baseKm 4, perKm 2, discountPct 20, matrixSource string, legCount 1
timeline([a, b], [6.9736]) -> [{name:a.name, km:0, kind:'origin'}, {name:b.name, km:6.97, kind:'destination'}]
timeline([a, v, b], [3, 4]) -> kinds ['origin','via','destination'], km [0, 3, 7]
```

`src/lib/geo.test.js` pins the offline path with a stubbed `globalThis.fetch`:
```js
fetch rejects -> fetchRoute([a, b]) resolves { source: 'estimate' } with 1 leg and a positive km
fetch resolves a fake OSRM payload -> { source: 'osrm' }, legs from route.legs, path as [lat, lng]
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/plan.test.js`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/lib/plan.js`**

Pure functions only. `duplicateIndex` compares `id` when present, otherwise `lat|lng`. `buildTripRecord` uses `cent`-safe values already present on the trip object and stores `legCount: trip.legs.length`.

- [ ] **Step 4: Build the ticket and the screen**

`FareTicket` takes `{ trip, route, role, mode, stops, loading, onLog, onBreakdown, logged }` and renders the ticket plus skeleton and estimate badge. `Plan.jsx` keeps the existing debounced fetch, abort handling, and `EMPTY_ROUTE` reset, and adds the duplicate check.

`BreakdownSheet` lives inside `Plan.jsx` (not a separate file unless it exceeds ~120 lines): build-up rows from the trip object, the timeline, and the comparison list. No `mostExpensive`, no per-leg fare.

- [ ] **Step 5: Update `PlaceInput` for combobox semantics**

Keep the scoring and the outside-click close. Add the ARIA attributes and ids derived from a `useId()`. Confirm the dropdown does not reopen after a pick and that picking does not append a stop at the end (the old global search bug). The route card calls `setStop(i, place)`.

- [ ] **Step 6: Verify by test, build, and capture**

Run `npx vitest run src/lib/plan.test.js`, `npm run build`, `npm run preview`, `node scripts/shoot.mjs`. Open `shots` for `#/plan` at 390×844 and confirm: origin and destination visible above the fold, big fare visible, no drawer clipping, map strip tappable, bottom bar visible, no overflow. Check the 1440×900 shot still looks like a deliberate desktop layout.

- [ ] **Step 7: Commit**

```bash
git add src/views/Plan.jsx src/components/PlaceInput.jsx src/components/FareTicket.jsx src/lib/plan.js src/lib/plan.test.js
git commit -m "feat: phone-first plan screen with fare ticket and sheets"
```

---

## Task 7: Trips as day-grouped cards with undo

**Files:**
- Create: `src/views/Trips.jsx`
- Create: `src/lib/trips.js`
- Create: `src/lib/trips.test.js`
- Delete: `src/views/Ledger.jsx`
- Modify: `src/shell/CommuterShell.jsx`

**Interfaces:**
- Consumes: `useStore`, `actions.deleteTrip`, `actions.restoreTrip`, `totalsFor`.
- Produces:
  - `groupByDay(trips) -> { day, trips }[]`
  - `filterTrips(trips, { q, modeId, sort }) -> trip[]` where sort is `recent | highest | longest`
  - `Trips()` view, wired to the `trips` tab.

**Layout:**
- Header with four totals in a 2 × 2 grid: trips, spent, distance, discount saved.
- Search field inline; filter and sort behind a `Sheet` triggered by a `Filters` button with an active-count badge.
- Day groups with a sticky day label, then cards. Each card: time and mode badge on one line, route on the next, distance and fare on the last, with a visible `⋯` menu button.
- The menu offers Delete. Delete removes the trip and shows a toast with Undo for 6 seconds; Undo calls `restoreTrip(trip, index)`.
- Empty state: "No trips yet" with a button back to Plan. No table, no hover-only action.

- [ ] **Step 1: Write the failing tests**

```js
groupByDay([]) -> []
groupByDay([t1, t2SameDay, t3NextDay]) -> 2 groups, newest day first, trips newest first inside
filterTrips(trips, { q: 'it park', modeId: 'all', sort: 'recent' }) keeps matching from or to
filterTrips(trips, { q: '', modeId: 'puj-traditional', sort: 'recent' }) keeps only that class
filterTrips(trips, { q: '', modeId: 'all', sort: 'highest' }) is descending by fare
filterTrips(trips, { q: '', modeId: 'all', sort: 'longest' }) is descending by distanceKm
```
Use fixed ISO timestamps so the grouping does not depend on today.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/trips.test.js`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `trips.js` and the view**

Reuse `isoDay`, `dayLabel`, `clockTime`, `km`, `peso`. Keep the seed data as is.

- [ ] **Step 4: Verify and commit**

Run `npx vitest run src/lib/trips.test.js`, `npm run build`, `node scripts/shoot.mjs`. Open the `#/trips` mobile shot and confirm cards fit, the day label is legible, and the total strip is not clipped.

```bash
git add src/views/Trips.jsx src/lib/trips.js src/lib/trips.test.js src/shell/CommuterShell.jsx
git rm src/views/Ledger.jsx
git commit -m "feat: trips as day-grouped cards with undo"
```

---

## Task 8: Budget reflow

**Files:**
- Modify: `src/views/Budget.jsx`
- Create: `src/lib/budget.js`
- Create: `src/lib/budget.test.js`
- Modify: `src/components/BarChart.jsx`

**Interfaces:**
- Consumes: `monthTrips`, `totalsFor`, `settings.monthlyAllowance`.
- Produces:
  - `monthPacing({ spent, allowance, now }) -> { remaining, usedPct, expectedPct, pacing, daysLeft }`
  - `projectMonth(spent, day, days) -> number`
  - `weeklyBuckets(trips, { weeks, now }) -> { key, label, value }[]`

**Layout changes:**
- Two-column stat grid on mobile, four at `lg`.
- Allowance card with an Edit action that reveals an inline field, not a separate panel.
- Pacing bar with the elapsed-month marker and one sentence of plain advice.
- Eight-week chart at 160 px on mobile, 188 px at `md`.
- Spend by class as a list with percentage bars.
- "This month" lines and a three-trip recent list.
- Replace "Set for <month>" with "Standing monthly setting".
- BarChart value and axis labels go to `text-[12px]`; keep the title attribute for the exact amount.

- [ ] **Step 1: Write the failing tests**

```js
monthPacing({ spent: 450, allowance: 900, now: new Date('2026-11-15T12:00:00') }) -> usedPct 50
  and expectedPct close to 46.7 (15/30 * 100, allow 1 decimal)
monthPacing with spent 1000, allowance 900 -> remaining -100, pacing positive, usedPct 100
monthPacing with allowance 0 -> usedPct 0, remaining 0, no division by zero
projectMonth(450, 15, 30) === 900
projectMonth(0, 0, 30) === 0
weeklyBuckets(trips, { weeks: 8, now }) -> 8 buckets, labels W1..W8, last bucket covers this week
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/budget.test.js`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement and reflow**

Move the existing maths out of the component verbatim where possible. Keep `weekStart` and `isoDay`. Do not add a chart library.

- [ ] **Step 4: Verify and commit**

Run `npx vitest run src/lib/budget.test.js`, `npm run build`, `node scripts/shoot.mjs`. Check the `#/budget` mobile shot for clipped numbers and unreadable axis labels.

```bash
git add src/views/Budget.jsx src/lib/budget.js src/lib/budget.test.js src/components/BarChart.jsx
git commit -m "feat: stacked budget screen with readable chart labels"
```

---

## Task 9: Alerts feed, report sheet, and confirm once

**Files:**
- Create: `src/views/Alerts.jsx`
- Create: `src/lib/advisoryMeta.js`
- Delete: `src/views/Advisories.jsx`
- Modify: `src/shell/CommuterShell.jsx`

**Interfaces:**
- Consumes: `publishedAdvisories`, `actions.confirmAdvisory`, `canConfirm` (Task 2); `Sheet`.
- Produces:
  - `Alerts()` view on the `alerts` tab.
  - `CATEGORIES`, `SEVERITY`, `categoryById(id)` exported from `advisoryMeta.js` for reuse by the admin moderation panel.

**Layout and behavior:**
- Feed of cards: category badge, severity badge, relative time, title, body, area and author, confirmation count.
- Category chips scroll horizontally.
- "Report an advisory" opens the form in a `Sheet`, never inline. The form uses `Field as="input"`, a textarea with a counter, category and severity `Segmented` controls, and a submit button. On success, close the sheet and show a one-line confirmation.
- Confirm button: disabled and labelled "Confirmed" when `canConfirm` is false. It calls `confirmAdvisory` once.
- Commuters never see a moderation status.

- [ ] **Step 1: Verify the submit bug is dead**

`Segmented` already renders `type="button"` from Task 5. Add a manual check in the report sheet: choose a category, and confirm the sheet does not submit and the count on the button does not change.

- [ ] **Step 2: Build the view**

Move `CATEGORIES` and `SEVERITY` to `advisoryMeta.js` unchanged. Replace `dayLabel`/`clockTime` usage with `dayLabel` only for older items and `clockTime` for today.

- [ ] **Step 3: Verify the once-per-device rule end to end**

Run `npm run build`, `npm run preview`, then `node scripts/shoot.mjs`. Extend the Alerts shot in the script to click the first confirm button twice and read the count before and after; expected: it increments once and the button becomes disabled. Add that as a `problems` check.

- [ ] **Step 4: Commit**

```bash
git add src/views/Alerts.jsx src/lib/advisoryMeta.js src/shell/CommuterShell.jsx scripts/shoot.mjs
git rm src/views/Advisories.jsx
git commit -m "feat: alerts feed and report sheet with confirm-once"
```

---

## Task 10: More, export, and import

**Files:**
- Modify: `src/views/More.jsx`
- Create: `src/lib/export.js`
- Create: `src/lib/export.test.js`

**Interfaces:**
- Consumes: `useStore`, `actions.updateSettings`, `actions.importState`, `normaliseState`, `getState`.
- Produces:
  - `toJson(state) -> string`
  - `toCsv(trips) -> string`
  - `csvEscape(value) -> string`
  - `downloadText(filename, text, mime)` helper inside the view (DOM only)

**Sections:**
- Profile: session user id, session role, admin badge when admin.
- Defaults: home and school via `PlaceInput`, commuter type, vehicle class, monthly allowance.
- Data: Export JSON, Export trips CSV, Import JSON. Import reads a file, parses it, calls `importState`, and shows the returned message. A failed import changes nothing.
- About: version, the README link text, and one sentence that data lives in this browser only.
- Danger zone: Reset demo data with a confirm.
- Admin link only when `VITE_ADMIN_DEMO === '1'`.

**CSV rules:** header `date,from,to,mode,role,distance_km,gross,discount,fare`; RFC 4180 quoting; values beginning with `=`, `+`, `-`, or `@` are prefixed with `'` to stop spreadsheet formula execution.

- [ ] **Step 1: Write the failing tests**

```js
csvEscape('plain') === 'plain'
csvEscape('a,b') === '"a,b"'
csvEscape('say "hi"') === '"say ""hi"""'
csvEscape('line\nbreak') === '"line\nbreak"'
csvEscape(undefined) === ''
csvEscape('=SUM(A1)') === "'=SUM(A1)"
toCsv([]) === header line only
toCsv([trip]) has one data row and the fare formatted to two decimals
toJson({ version: 2, trips: [] }) parses back to an object with version 2 and an exportedAt string
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/export.test.js`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement export and the screen**

`toJson` returns `JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2)`. The view builds a `Blob`, creates an object URL, clicks a temporary anchor, and revokes the URL.

- [ ] **Step 4: Verify import by hand and by test**

Run `npx vitest run src/lib/export.test.js`, `npm run build`, `node scripts/shoot.mjs`. In the browser: export JSON, reset, import the file, confirm trips and advisory counts return.

- [ ] **Step 5: Commit**

```bash
git add src/views/More.jsx src/lib/export.js src/lib/export.test.js
git commit -m "feat: more screen with settings, export, and import"
```

---

## Task 11: Admin tariff panel with validation and audit

**Files:**
- Create: `src/admin/TariffPanel.jsx`
- Create: `src/admin/RateField.jsx`
- Modify: `src/admin/AdminApp.jsx`
- Delete: `src/views/Admin.jsx`

**Interfaces:**
- Consumes: `actions.adminUpdateMatrixRow`, `addMatrixRow`, `deleteMatrixRow`, `restoreMatrixDefaults`, `billableRows`, `sanitizeRateRow`, `computeFare`, `effectiveDiscountPct`, `FARE_MATRIX_SEED`.
- Produces: `TariffPanel()`, and `AdminApp` with a left nav: Tariff, Moderation, Health, Admins.

**Rules:**
- Table with columns: class, code, base fare, base km, per km, discount cap, effective date, source, active, delete. Horizontal scroll only; `min-w-[880px]`.
- Each numeric cell is a `RateField`: local draft, commit on blur or Enter, revert on Escape, `inputMode="decimal"`, and an inline error when the draft is not a number. It calls `adminUpdateMatrixRow` only on commit.
- Active toggle is disabled when the row's base fare or per-km rate is zero, with the reason on screen: "Set a base fare and a per-km rate before activating."
- Delete is disabled for the last billable row.
- "Restore LTFRB defaults" calls `restoreMatrixDefaults` and reports how many rows were restored.
- A live worked example panel: a distance field (default 6.97) and a row selector, showing base, excess, gross, discount, and net from `computeFare`. No hardcoded numbers.
- Every committed edit appears in the audit list at the bottom of the panel, newest first, capped at 20 rows.

- [ ] **Step 1: Build the panel against the existing store actions**

No new store code is needed. If a needed action is missing, add it to Task 2's action set and cover it with a test there rather than inventing a second mutation path in the component.

- [ ] **Step 2: Verify validation by hand**

Run `npm run build`, `npm run preview`, `node scripts/shoot.mjs`, then sign in and check:
- clearing a base fare deactivates the row and removes it from the Plan comparison;
- a rate of `0` cannot be activated;
- deleting the last active row does nothing;
- the worked example reads `₱19.95` gross and `₱15.96` net for 6.97 km at 20%.

- [ ] **Step 3: Confirm the audit trail**

Edit a rate, then read the audit list. Expected: one new row with the previous and new value.

- [ ] **Step 4: Commit**

```bash
git add src/admin/TariffPanel.jsx src/admin/RateField.jsx src/admin/AdminApp.jsx
git rm src/views/Admin.jsx
git commit -m "feat: validated tariff panel with a live worked example and audit"
```

---

## Task 12: Admin moderation, health, and admins

**Files:**
- Create: `src/admin/ModerationPanel.jsx`
- Create: `src/admin/HealthPanel.jsx`
- Create: `src/admin/AdminsPanel.jsx`
- Modify: `src/admin/AdminApp.jsx`

**Interfaces:**
- Consumes: `actions.setAdvisoryStatus`, `deleteAdvisory`, `aggregateCounts`, `dayLabel`, `clockTime`, `CATEGORIES`, `SEVERITY`.
- Produces: the three panels wired to the nav panels `moderation`, `health`, `admins`.

**Rules:**
- Moderation: pending list with title, body, area, category, author, and time, plus Approve, Reject, and Delete. Published/rejected list with Unpublish and Restore. Each decision writes one audit row. No commuter identity is shown beyond what the advisory already contains.
- Health: counts only (`commuters`, `admins`, `trips`, `advisories`, `pending`), the oldest and newest rate effective dates, storage status, and the local-only notice. No trip rows, no route names, no per-user data.
- Admins: table of `state.admins` with display name, role, MFA status, last login. No password field. One note: "Admin accounts are provisioned by an operator. There is no self-service path."
- Nav badge on Moderation shows the pending count.

- [ ] **Step 1: Build the panels**

Reuse the existing badge and button primitives. Keep each panel under ~150 lines.

- [ ] **Step 2: Verify the privacy rule by inspection and by search**

Run `rg -n "trips" src/admin` and confirm the only use is the count from `aggregateCounts`. No `useStore().trips` may be read in the admin bundle.

- [ ] **Step 3: Verify with the capture script**

Run `npm run build`, `npm run preview`, `node scripts/shoot.mjs`. Add admin shots: `#/admin/moderation`, `#/admin/health`, `#/admin/admins` at 1440×900 with a seeded admin session. Confirm no console errors, no error boundary, and no overflow.

- [ ] **Step 4: Commit**

```bash
git add src/admin/ModerationPanel.jsx src/admin/HealthPanel.jsx src/admin/AdminsPanel.jsx src/admin/AdminApp.jsx scripts/shoot.mjs
git commit -m "feat: admin moderation, aggregate health, and admin roster"
```

---

## Task 13: README truth pass and full verification

**Files:**
- Modify: `README.md`
- Modify: `scripts/shoot.mjs`

**Interfaces:**
- Consumes: everything.
- Produces: a README that matches the app, and one command that proves the build.

- [ ] **Step 1: Correct every claim in the README**

- Remove "progressive web application" and any PWA claim. There is no manifest and no service worker.
- Replace the Admin paragraph: separate console at `#/admin/login`, tariff, moderation, aggregate health, admin roster. Local demo gate, not authentication.
- Replace "Multi-leg trips repeat the arithmetic per leg" with: a trip is one fare over total distance; via points add distance, not a second minimum fare.
- Update the worked example to use the raw distance:
```
6.9736 km
₱14.00 + (6.9736 − 4) × ₱2.00 = ₱19.9472 → ₱19.95 gross
₱19.9472 × 0.80             = ₱15.95776 → ₱15.96 payable
```
- Update the project layout tree for `src/shell`, `src/admin`, `src/components/Sheet.jsx`, `src/lib/*.js`, and the renamed views.
- Replace `farewise.v1` with `farewise.v2` and describe the one-way migration.
- Add a "Demo admin" section: copy `.env.example` to `.env.local`, set the two variables, restart the dev server, open `#/admin/login`. State plainly that anyone with the file can read the password and that real authorisation arrives with the hosted milestone.
- Add the test commands: `npm test`, `npm run lint`, `npm run check`.

- [ ] **Step 2: Finalise the capture script**

Add the admin session seeding step: before an admin shot, `Runtime.evaluate` writes `farewise.v2` with `session.role = 'admin'`. Add a denied check: with a commuter session, navigate to `#/admin` and assert the final hash is `#/admin/login`. Add the Alerts double-confirm check from Task 9. Print a pass/fail summary and set the exit code.

- [ ] **Step 3: Run the full gate**

```bash
npm run lint
npm test
npm run build
npm run preview      # one shell
node scripts/shoot.mjs   # another shell
```
Expected: lint clean, every test passes, build succeeds, every shot reports no overflow, no error boundary, no exceptions, no console errors, the admin gate behaves, and the confirm count increments once.

- [ ] **Step 4: Verify the demo invariant one last time**

Open `#/plan` at 390×844 with Mambaling and IT Park, Student, Traditional jeepney. Expected on screen: `6.97 km`, `₱19.95` base plus excess, `₱15.96` payable. Log it and confirm the trip appears at the top of `#/trips`.

- [ ] **Step 5: Commit**

```bash
git add README.md scripts/shoot.mjs
git commit -m "docs: truthful README and full capture gate"
```

---

## Self-Review Notes

- Spec coverage: shell, Plan, Trips, Budget, Alerts, More, admin login, admin shell, tariff, moderation, health, admins, local store, hosted schema (documented only, not built), security, accessibility, states, correctness fixes, testing, build order. The hosted Supabase milestone is explicitly out of this plan because it needs a project, keys, and a network; the schema stays in the spec.
- Deliberate deviation from the spec: local storage also holds `confirms`, `admins`, and `audit`. The spec allows this in the Data and identity section.
- Deliberate addition: `discount_pct` on a fare row acts as a cap, not a second discount. The spec was updated to say so.
- No task deletes `dist/` or `shots/`.
