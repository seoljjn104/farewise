import { useEffect, useMemo, useState } from 'react'
import places from '../data/places.json'
import { ROLES, computeTrip, roleById } from '../lib/fares.js'
import { fetchRoute } from '../lib/geo.js'
import { useStore, actions, monthTrips, totalsFor } from '../lib/store.js'
import { peso, km as kmFmt, duration, dayLabel } from '../lib/format.js'
import { allPlaces, placeIndex } from '../lib/places.js'
import MapView from '../components/MapView.jsx'
import PlaceInput from '../components/PlaceInput.jsx'
import Icon from '../components/Icon.jsx'
import { Btn, Field, Badge, Segmented, Row } from '../components/ui.jsx'

const byId = Object.fromEntries(places.map((p) => [p.id, p]))
const EMPTY_ROUTE = { source: 'none', legs: [], path: [], km: 0, min: 0 }

export default function Plan({ onOpenBudget }) {
  const { matrix, trips, settings } = useStore()

  const [stops, setStops] = useState(() => [byId[settings.homeId] || byId.mabolo, byId[settings.schoolId] || byId.itpark].filter(Boolean))
  const [modeId, setModeId] = useState(settings.defaultModeId)
  const [roleId, setRoleId] = useState(settings.defaultRole)
  const [route, setRoute] = useState(EMPTY_ROUTE)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [logged, setLogged] = useState(false)
  const [tileStyle, setTileStyle] = useState('dark')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])

  // Filter places when query changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    const lower = searchQuery.trim().toLowerCase()
    // 1) index lookup
    const idxHits = placeIndex[lower] || []
    // 2) substring scan
    const substringHits = allPlaces.filter(
      (p) => p.name.toLowerCase().includes(lower)
    )
    // 3) prefer exact/token matches, then substring; dedupe
    const seen = new Set()
    const results = []
    for (const p of [...idxHits, ...substringHits].sort(
      (a, b) => b.name.localeCompare(a.name)
    )) {
      const norm = p.name.toLowerCase()
      if (!seen.has(norm)) {
        seen.add(norm)
        results.push(p)
      }
    }
    setSearchResults(results)
  }, [searchQuery])

  const mode = matrix.find((m) => m.id === modeId) || matrix[0]
  const role = roleById(roleId)
  const stopsKey = stops.map((s) => s?.id || s?.lat).join('|')

  /* ---- route whenever the waypoint list changes ------------------------- */
  useEffect(() => {
    if (stops.length < 2 || stops.some((s) => !s)) {
      setRoute(EMPTY_ROUTE)
      return
    }
    let alive = true
    const ctrl = new AbortController()
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const r = await fetchRoute(stops, { signal: ctrl.signal })
        if (alive) {
          setRoute(r)
          setLoading(false)
        }
      } catch {
        /* superseded by a newer waypoint list */
      }
    }, 280)
    return () => {
      alive = false
      clearTimeout(t)
      ctrl.abort()
    }
  }, [stopsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- pricing ---------------------------------------------------------- */
  const trip = useMemo(() => {
    if (stops.length < 2) return null
    const legs = stops.slice(1).map((_, i) => ({
      row: mode,
      km: route.legs[i]?.km ?? 0,
    }))
    if (!legs.length || legs.every((l) => !l.km)) return null
    return computeTrip(legs, role.discount_pct)
  }, [stopsKey, route, mode, role]) // eslint-disable-line react-hooks/exhaustive-deps

  const comparisons = useMemo(() => {
    if (!route.km) return []
    const rows = matrix
      .filter((m) => m.active !== false)
      .map((m) => ({ m, ...computeTrip([{ row: m, km: route.km }], role.discount_pct) }))
      .sort((a, b) => a.totalNet - b.totalNet)
    return rows
  }, [route.km, matrix, role])

  const cheapest = comparisons[0]

  const mtd = totalsFor(monthTrips({ trips }))
  const allowance = Number(settings.monthlyAllowance) || 0
  const remaining = allowance - mtd.spent

  /* ---- mutations -------------------------------------------------------- */
  function setStop(i, place) {
    setStops((prev) => {
      const next = [...prev]
      if (place === null) {
        if (next.length <= 2) next[i] = null
        else next.splice(i, 1)
        return next.filter((s, idx) => s !== null || idx === 0 || idx === next.length - 1)
      }
      next[i] = place
      return next
    })
    setLogged(false)
  }

  function addStop() {
    setStops((prev) => [...prev, prev[prev.length - 1] ? { ...prev[prev.length - 1] } : null])
  }

  function removeStop(i) {
    setStops((prev) => (prev.length <= 2 ? prev : prev.filter((_, idx) => idx !== i)))
  }

  function swap() {
    setStops((prev) => [...prev].reverse())
  }

  function logTrip() {
    if (!trip || !stops[0] || !stops[stops.length - 1]) return
    actions.addTrip({
      createdAt: new Date().toISOString(),
      fromId: stops[0].id,
      toId: stops[stops.length - 1].id,
      fromName: stops[0].name,
      toName: stops[stops.length - 1].name,
      modeId: mode.id,
      modeName: mode.mode,
      roleId: role.id,
      roleLabel: role.label,
      distanceKm: trip.totalKm,
      distanceSource: route.source,
      fare: trip.totalNet,
      gross: trip.totalGross,
      discount: trip.totalDiscount,
      legCount: trip.legs.length,
    })
    setLogged(true)
    setTimeout(() => setLogged(false), 2400)
  }

  const ready = stops.length >= 2 && stops.every(Boolean) && trip

  return (
    <div className="relative flex h-full min-h-0 flex-col md:flex-row">
      {/* ===================================================== control panel */}
      <aside className="flex min-h-0 flex-1 flex-col border-b border-line bg-ink-850 md:w-[412px] md:flex-none md:border-r md:border-b-0">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="border-b border-line-soft px-5 py-5">
            <p className="label-xs">Trip planner</p>
            <h2 className="mt-1.5 text-[19px] leading-tight font-bold tracking-[-0.015em] text-fg">
              Where are you headed?
            </h2>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
              Chain jeepney, modern PUV and bus legs into one commute. Fares follow the
              LTFRB matrix in effect 28 Sep 2026.
            </p>
            {/* ---- searchable gazetteer ---- */}
            <Field
              label="Search location"
              hint="Type a street, barangay, or landmark. Results appear as you type."
            >
              <div className="relative">
                <input
                  className="w-full p-3 border border-line rounded-md bg-ink-800 text-fg focus:ring-2 focus:ring-signal text-sm"
                  value={searchQuery}
                  onInput={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. Mabini, Colon, IT Park, Casa Verde"
                  disabled={loading}
                />
                {searchResults.length > 0 && (
                  <div
                    className="absolute top-full left-0 mt-2 max-h-[200px] overflow-y-auto bg-ink-850 rounded-md p-2 shadow-lg z-20"
                  >
                    {searchResults.map((p) => (
                      <div
                        key={p.id}
                        className="px-3 py-1.5 cursor-pointer text-[11px] text-fg hover:bg-ink-700 hover:text-fg"
                        onClick={() => {
                          setSearchQuery(p.name)
                          setSearchResults([])
                          setStop(stops.length, p)
                        }}
                      >
                        {p.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Field>
          </div>

          {/* --------------------------------------------------------- route */}
          <div className="border-b border-line-soft px-5 py-5">
            <Field
              label="Your route"
              hint={`${stops.filter(Boolean).length} stop${stops.filter(Boolean).length === 1 ? '' : 's'}`}
            >
              <div className="space-y-2">
                {stops.map((s, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <span
                      className={`num flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-[10.5px] font-bold ${
                        i === 0
                          ? 'border-[#4a3c10] bg-[#2a2109] text-signal'
                          : i === stops.length - 1
                            ? 'border-[#1f4a36] bg-route-dim text-route'
                            : 'border-line bg-ink-800 text-muted'
                      }`}
                    >
                      {i === 0 ? 'A' : i === stops.length - 1 ? 'B' : i}
                    </span>

                    <div className="min-w-0 flex-1">
                      <PlaceInput
                        value={s}
                        onSelect={(p) => setStop(i, p)}
                        placeholder={
                          i === 0 ? 'Origin' : i === stops.length - 1 ? 'Destination' : 'Via point'
                        }
                      />
                    </div>

                    {stops.length > 2 && (
                      <button
                        onClick={() => removeStop(i)}
                        title="Remove stop"
                        className="shrink-0 rounded-md p-1.5 text-muted hover:bg-ink-800 hover:text-danger"
                      >
                        <Icon name="x" size={14} stroke={2} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-2.5 flex items-center gap-1.5">
                <Btn size="sm" icon="plus" onClick={addStop}>
                  Add stop
                </Btn>
                <Btn size="sm" icon="swap" onClick={swap}>
                  Reverse
                </Btn>
              </div>
            </Field>
          </div>

          {/* ---------------------------------------------------------- role */}
          <div className="border-b border-line-soft px-5 py-5">
            <Field label="Commuter type" hint="LTFRB statutory discount">
              <Segmented
                columns={2}
                value={roleId}
                onChange={setRoleId}
                options={ROLES.map((r) => ({
                  value: r.id,
                  label: r.label,
                  sub: r.discount_pct ? `−${r.discount_pct}%` : 'full fare',
                }))}
              />
            </Field>
          </div>

          {/* ----------------------------------------------------- vehicle */}
          <div className="border-b border-line-soft px-5 py-5">
            <Field label="Vehicle class" hint={`${matrix.filter((m) => m.active !== false).length} active`}>
              <Segmented
                columns={1}
                value={modeId}
                onChange={setModeId}
                options={matrix
                  .filter((m) => m.active !== false)
                  .map((m) => ({
                    value: m.id,
                    label: m.mode,
                    sub: `${peso(m.base_fare)} first ${m.base_km} km · +${peso(m.per_km)}/km`,
                  }))}
              />
            </Field>
          </div>

          {/* ------------------------------------------------------ compare */}
          {comparisons.length > 0 && (
            <div className="border-b border-line-soft px-5 py-5">
              <Field
                label="Cost if you took each class"
                hint={`${kmFmt(route.km)} one way`}
              >
                <div className="overflow-hidden rounded-[11px] border border-line">
                  {comparisons.map((c, i) => {
                    const isCurrent = c.m.id === modeId
                    return (
                      <button
                        key={c.m.id}
                        onClick={() => setModeId(c.m.id)}
                        className={`flex w-full items-center gap-3 border-b border-line-soft px-3 py-2.5 text-left last:border-b-0 ${
                          isCurrent ? 'bg-ink-750' : 'bg-ink-800 hover:bg-ink-750'
                        }`}
                      >
                        <span className="num w-4 shrink-0 text-[10px] text-faint">{i + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] font-medium text-fg">
                            {c.m.mode}
                          </span>
                        </span>
                        {i === 0 && <Badge tone="route">Cheapest</Badge>}
                        <span
                          className={`num shrink-0 text-[13px] font-semibold ${
                            isCurrent ? 'text-signal' : 'text-fg-dim'
                          }`}
                        >
                          {peso(c.totalNet)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </Field>
            </div>
          )}

          {/* --------------------------------------------------- quick picks */}
          <div className="px-5 py-5">
            <Field label="Saved trips">
              <div className="flex flex-wrap gap-1.5">
                <QuickChip
                  label="Home → School"
                  onClick={() =>
                    setStops(
                      [byId[settings.homeId], byId[settings.schoolId]].filter(Boolean)
                    )
                  }
                />
                <QuickChip
                  label="School → Home"
                  onClick={() =>
                    setStops(
                      [byId[settings.schoolId], byId[settings.homeId]].filter(Boolean)
                    )
                  }
                />
                <QuickChip
                  label="To the airport"
                  onClick={() => setStops([byId[settings.homeId] || byId.mabolo, byId.mcita])}
                />
                <QuickChip
                  label="Downtown run"
                  onClick={() => setStops([byId[maboloId], byId.colon])}
                />
              </div>
            </Field>

            <div className="rule-fade my-5" />

            <div className="flex items-baseline justify-between">
              <span className="label-xs">This month</span>
              <button
                onClick={onOpenBudget}
                className="text-[11px] font-semibold text-signal hover:underline"
              >
                Open budget
              </button>
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2.5">
              <MiniStat label="Spent" value={peso(mtd.spent)} tone="signal" />
              <MiniStat
                label="Left of allowance"
                value={peso(remaining)}
                tone={remaining < 0 ? 'danger' : 'route'}
                sub={`of ${peso(allowance)}`}
              />
            </div>
            <div className="mt-2.5 flex items-center justify-between rounded-[10px] border border-line bg-ink-800 px-3 py-2">
              <span className="text-[11.5px] text-muted">Trips logged</span>
              <span className="num text-[12.5px] font-semibold text-fg">{mtd.count}</span>
            </div>
          </div>
        </div>

        {/* --------------------------------------------------------- footer */}
        <div className="border-t border-line bg-ink-800 p-4">
          <Btn
            variant="primary"
            size="lg"
            className="w-full"
            icon="gauge"
            disabled={!ready || loading}
            onClick={() => setExpanded(true)}
          >
            {loading ? 'Measuring route…' : ready ? `Compute fare · ${peso(trip.totalNet)}` : 'Pick your route'}
          </Btn>
        </div>
      </aside>

      {/* =============================================================== map */}
      <div className="relative h-[42vh] shrink-0 md:h-auto md:min-w-0 md:flex-1">
        <MapView
          className="h-full w-full"
          stops={stops.filter(Boolean)}
          path={route.path}
          tileStyle={tileStyle}
        />

        {/* route read-out */}
        <div className="pointer-events-none absolute top-4 left-4 z-10 flex flex-col gap-2">
          <div className="pointer-events-auto flex items-center gap-2.5 rounded-[11px] border border-line bg-ink-850/92 px-3 py-2.5 shadow-[0_12px_34px_rgba(0,0,0,.55)] backdrop-blur">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-lg border ${
                route.source === 'osrm'
                  ? 'border-[#1f4a36] bg-route-dim text-route'
                  : 'border-line bg-ink-800 text-muted'
              }`}
            >
              <Icon name={route.source === 'osrm' ? 'zap' : 'info'} size={14} />
            </span>
            <div>
              <p className="label-xs leading-none">
                {route.source === 'osrm'
                  ? 'OSRM road routing'
                  : route.source === 'estimate'
                    ? 'Offline estimate'
                    : 'Awaiting route'}
              </p>
              <p className="num mt-1 text-[12.5px] leading-none font-semibold text-fg">
                {route.km ? `${kmFmt(route.km)} · ${duration(route.min)}` : '—'}
              </p>
            </div>
          </div>

          {loading && (
            <div className="pointer-events-auto flex items-center gap-2 rounded-[11px] border border-line bg-ink-850/92 px-3 py-2 backdrop-blur">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal" />
              <span className="text-[11px] text-fg-dim">Recalculating…</span>
            </div>
          )}
        </div>

        {/* map style toggle */}
        <div className="absolute top-4 right-4 z-10">
          <div className="flex overflow-hidden rounded-[11px] border border-line bg-ink-850/92 shadow-[0_12px_34px_rgba(0,0,0,.55)] backdrop-blur">
            {[
              ['dark', 'layers', 'Dark'],
              ['light', 'layers', 'Light'],
            ].map(([v, ic, lbl]) => (
              <button
                key={v}
                onClick={() => setTileStyle(v)}
                className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold transition-colors ${
                  tileStyle === v
                    ? 'bg-signal text-signal-ink'
                    : 'text-muted hover:bg-ink-800 hover:text-fg'
                }`}
              >
                <Icon name={ic} size={13} />
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* ------------------------------------------------ fare drawer ---- */}
      </div>

      <FareDrawer
        trip={trip}
        route={route}
        stops={stops.filter(Boolean)}
        role={role}
        mode={mode}
        expanded={expanded}
        setExpanded={setExpanded}
        comparisons={comparisons}
        cheapest={cheapest}
        onLog={logTrip}
        onSwitchMode={setModeId}
        logged={logged}
      />
    </div>
  )
}

const maboloId = 'mabolo'

function QuickChip({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg border border-line bg-ink-800 px-2.5 py-1.5 text-[11.5px] font-medium text-fg-dim hover:border-line hover:bg-ink-700 hover:text-fg"
    >
      {label}
    </button>
  )
}

function MiniStat({ label, value, sub, tone = 'neutral' }) {
  const tones = { neutral: 'text-fg', signal: 'text-signal', route: 'text-route', danger: 'text-danger' }
  return (
    <div className="rounded-[10px] border border-line bg-ink-800 px-3 py-2.5">
      <p className="label-xs leading-none">{label}</p>
      <p className={`num mt-1.5 text-[16px] leading-none font-semibold ${tones[tone]}`}>{value}</p>
      {sub && <p className="num mt-1 text-[10px] text-faint">{sub}</p>}
    </div>
  )
}

/* ==========================================================================
   Fare Breakdown Drawer — the expandable card from §9 of the charter.
   ========================================================================== */

function FareDrawer({
  trip,
  route,
  stops,
  role,
  mode,
  expanded,
  setExpanded,
  comparisons,
  cheapest,
  onLog,
  onSwitchMode,
  logged,
}) {
  const hasResult = Boolean(trip)

  return (
    <div className="absolute right-0 bottom-0 left-0 z-20 md:left-[412px]">
      <div className="border-t border-line bg-ink-850/97 shadow-[0_-18px_54px_rgba(0,0,0,.6)] backdrop-blur-md">
        {/* handle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          disabled={!hasResult}
          className="flex w-full items-center justify-center gap-2 py-2 text-muted hover:text-fg disabled:opacity-40"
          aria-expanded={expanded}
        >
          <span className="h-[3px] w-9 rounded-full bg-line" />
          <span className="label-xs">
            {expanded ? 'Collapse breakdown' : 'Fare breakdown'}
          </span>
          <Icon name={expanded ? 'chevronDown' : 'chevronUp'} size={13} stroke={2} />
        </button>

        {/* summary bar */}
        <div className="flex items-center gap-6 px-5 pb-4">
          <div className="shrink-0">
            <p className="label-xs leading-none">
              {role.discount_pct ? `${role.label} fare` : 'Total fare'}
            </p>
            <p className="num mt-1.5 text-[34px] leading-none font-bold tracking-[-0.02em] text-signal">
              {hasResult ? peso(trip.totalNet) : '—'}
            </p>
          </div>

          <div className="h-10 w-px shrink-0 bg-line" />

          <div className="flex min-w-0 flex-1 items-center gap-6">
            <SummaryBit label="Distance" value={route.km ? kmFmt(trip.totalKm) : '—'} />
            <SummaryBit label="Travel time" value={route.min ? duration(route.min) : '—'} />
            <SummaryBit label="Legs" value={hasResult ? String(trip.legs.length) : '—'} />
            <SummaryBit
              label="Vehicle"
              value={mode ? mode.code : '—'}
              hint={mode?.mode}
            />
            {trip?.totalDiscount > 0 && (
              <div className="ml-auto shrink-0">
                <Badge tone="route" icon="check">
                  Saved {peso(trip.totalDiscount)}
                </Badge>
              </div>
            )}
          </div>

          <Btn
            variant={logged ? 'route' : 'primary'}
            icon={logged ? 'check' : 'plus'}
            disabled={!hasResult || logged}
            onClick={onLog}
          >
            {logged ? 'Logged to ledger' : 'Log this trip'}
          </Btn>
        </div>

        {/* expanded body */}
        <div
          className={`overflow-hidden transition-[max-height] duration-300 ease-out ${
            expanded && hasResult ? 'max-h-[68vh] md:max-h-[460px]' : 'max-h-0'
          }`}
        >
          <div className="grid max-h-[68vh] grid-cols-12 gap-5 overflow-y-auto border-t border-line-soft px-5 py-5 md:max-h-[460px]">
            {/* itemised build-up */}
            <div className="col-span-12 lg:col-span-5">
              <p className="label-xs">Fare build-up</p>
              <div className="mt-3 divide-y divide-[#1d2530]">
                <Row
                  label={`Base fare — first ${trip?.baseKm ?? mode?.base_km} km`}
                  value={peso(mostExpensive(trip)?.baseFare ?? mode?.base_fare ?? 0)}
                />
                <Row
                  label="Excess distance"
                  sub={`${(mostExpensive(trip)?.billableKm ?? 0).toFixed(2)} km × ${peso(
                    mode?.per_km ?? 0
                  )}/km`}
                  value={peso(mostExpensive(trip)?.excessCharge ?? 0)}
                />
                <Row label="Subtotal" value={peso(trip?.totalGross ?? 0)} strong />
                {role.discount_pct > 0 && (
                  <Row
                    label={`${role.label} discount`}
                    sub={`${role.discount_pct}% statutory`}
                    value={`−${peso(trip?.totalDiscount ?? 0)}`}
                    tone="route"
                  />
                )}
                <Row label="You pay" value={peso(trip?.totalNet ?? 0)} strong />
              </div>

              <div className="mt-4 flex items-start gap-2 rounded-[10px] border border-line bg-ink-800 px-3 py-2.5">
                <Icon name="info" size={13} className="mt-px shrink-0 text-muted" />
                <p className="text-[11px] leading-relaxed text-muted">
                  Formula{' '}
                  <span className="num text-fg-dim">
                    F = B + max(0, D − D_base) × R
                  </span>
                  , then × (1 − {role.discount_pct / 100}). Rates per the LTFRB matrix effective
                  28 Sep 2026.
                </p>
              </div>
            </div>

            {/* legs */}
            <div className="col-span-12 lg:col-span-4">
              <p className="label-xs">Legs</p>
              <div className="mt-3 space-y-2">
                {trip?.legs.map((l, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-[10px] border border-line bg-ink-800 px-3 py-2.5"
                  >
                    <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-line bg-ink-750 text-[10.5px] font-bold text-muted">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11.5px] font-medium text-fg">
                        {stops[i]?.name} → {stops[i + 1]?.name}
                      </span>
                      <span className="num block text-[10.5px] text-muted">
                        {kmFmt(l.distanceKm)} · {mode?.code}
                      </span>
                    </span>
                    <span className="num shrink-0 text-[12px] font-semibold text-fg-dim">
                      {peso(l.net)}
                    </span>
                  </div>
                ))}
                {!trip && <p className="text-[12px] text-muted">No priced legs yet.</p>}
              </div>
            </div>

            {/* comparison */}
            <div className="col-span-12 lg:col-span-3">
              <p className="label-xs">Cheaper alternatives</p>
              <div className="mt-3 space-y-1.5">
                {comparisons
                  .filter((c) => c.m.id !== mode?.id)
                  .slice(0, 3)
                  .map((c) => {
                    const diff = c.totalNet - (trip?.totalNet ?? 0)
                    return (
                      <div
                        key={c.m.id}
                        className="flex items-center justify-between gap-3 rounded-[10px] border border-line bg-ink-800 px-3 py-2"
                      >
                        <span className="min-w-0 truncate text-[11.5px] text-fg-dim">{c.m.mode}</span>
                        <span
                          className={`num shrink-0 text-[11.5px] font-semibold ${
                            diff < 0 ? 'text-route' : 'text-muted'
                          }`}
                        >
                          {diff < 0 ? '−' : '+'}
                          {peso(Math.abs(diff))}
                        </span>
                      </div>
                    )
                  })}
                {comparisons.length <= 1 && (
                  <p className="text-[12px] text-muted">No other classes active.</p>
                )}
              </div>
              {cheapest && cheapest.m.id !== mode?.id && (
                <Btn
                  size="sm"
                  variant="route"
                  className="mt-3 w-full"
                  icon="zap"
                  onClick={() => onSwitchMode?.(cheapest.m.id)}
                >
                  Switch to {cheapest.m.code} and save {peso((trip?.totalNet ?? 0) - cheapest.totalNet)}
                </Btn>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SummaryBit({ label, value, hint }) {
  return (
    <div className="min-w-0 shrink-0">
      <p className="label-xs leading-none">{label}</p>
      <p className="num mt-1.5 text-[14px] leading-none font-semibold text-fg">{value}</p>
      {hint && <p className="mt-1 max-w-[16ch] truncate text-[10px] text-faint">{hint}</p>}
    </div>
  )
}

/** The drawer shows one base-fare line; take it from the most expensive leg. */
function mostExpensive(trip) {
  if (!trip || !trip.legs.length) return null
  return trip.legs.reduce((a, b) => (b.excessCharge > a.excessCharge ? b : a), trip.legs[0])
}
