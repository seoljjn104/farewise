import { useEffect, useMemo, useState } from 'react'
import places from '../data/places.json'
import { ROLES, priceTrip, compareModes, billableRows, roleById } from '../lib/fares.js'
import { fetchRoute } from '../lib/geo.js'
import { useStore, actions, monthTrips, totalsFor } from '../lib/store.js'
import { peso, km as kmFmt, duration } from '../lib/format.js'
import {
  buildTripRecord,
  canLog,
  duplicateIndex,
  legsKmFromRoute,
  timeline,
} from '../lib/plan.js'
import MapView from '../components/MapView.jsx'
import PlaceInput from '../components/PlaceInput.jsx'
import FareTicket from '../components/FareTicket.jsx'
import Icon from '../components/Icon.jsx'
import Sheet from '../components/Sheet.jsx'
import { Badge, Btn, Field, Row, Segmented, Select } from '../components/ui.jsx'

const byId = Object.fromEntries(places.map((p) => [p.id, p]))
const EMPTY_ROUTE = { source: 'none', legs: [], path: [], km: 0, min: 0 }
const ROLE_SHORT = { regular: 'Regular', student: 'Student', senior: 'Senior', pwd: 'PWD' }

export default function Plan({ onOpenBudget }) {
  const { matrix, trips, settings } = useStore()
  const role = roleById(settings.defaultRole)

  const activeRows = useMemo(() => billableRows(matrix), [matrix])
  const mode = activeRows.find((m) => m.id === settings.defaultModeId) || activeRows[0]

  const [stops, setStops] = useState(() => [
    byId[settings.homeId] || null,
    byId[settings.schoolId] || null,
  ])
  const [route, setRoute] = useState(EMPTY_ROUTE)
  const [loading, setLoading] = useState(true)
  const [logged, setLogged] = useState(false)
  const [sheet, setSheet] = useState(null)

  const stopsKey = stops
    .map((s) => (s ? s.id || `${s.lat},${s.lng}` : '_'))
    .join('|')
  const dup = duplicateIndex(stops)

  /* ---- route whenever the waypoint list changes ------------------------- */
  useEffect(() => {
    const blocked = stops.length < 2 || stops.some((s) => !s) || duplicateIndex(stops) >= 0
    if (blocked) {
      setRoute(EMPTY_ROUTE)
      setLoading(false)
      return
    }

    let alive = true
    const ctrl = new AbortController()
    setRoute(EMPTY_ROUTE)
    setLoading(true)

    const t = setTimeout(async () => {
      try {
        const next = await fetchRoute(stops, { signal: ctrl.signal })
        if (alive) {
          setRoute(next)
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
  const legsKm = useMemo(() => legsKmFromRoute(route), [route])

  const trip = useMemo(() => {
    if (!mode || !route.km) return null
    return priceTrip(legsKm, mode, role.discount_pct)
  }, [mode, route.km, legsKm, role.discount_pct])

  const comparisons = useMemo(() => {
    if (!route.km) return []
    return compareModes(matrix, route.km, role.discount_pct)
  }, [route.km, matrix, role.discount_pct])

  const steps = useMemo(
    () => (trip ? timeline(stops, legsKm) : []),
    [trip, stops, legsKm]
  )

  const mtd = totalsFor(monthTrips({ trips }))
  const allowance = Number(settings.monthlyAllowance) || 0
  const remaining = allowance - mtd.spent

  const ready = canLog(stops, trip)
  const logReason = !stops.every(Boolean)
    ? 'Fill in every stop to continue.'
    : stops.length < 2
      ? 'Add an origin and a destination.'
      : dup >= 0
        ? 'Two stops are the same place.'
        : loading
          ? 'Measuring the route.'
          : !trip
            ? 'Waiting for a priced route.'
            : ''

  /* A logged label must not survive a change to the trip it referred to. */
  useEffect(() => {
    setLogged(false)
  }, [stopsKey, mode?.id, role.id])

  useEffect(() => {
    if (!logged) return
    const t = setTimeout(() => setLogged(false), 2400)
    return () => clearTimeout(t)
  }, [logged])

  /* ---- mutations -------------------------------------------------------- */
  function setStop(i, place) {
    setStops((prev) => {
      if (place === null) {
        if (prev.length > 2 && i > 0 && i < prev.length - 1) {
          return prev.filter((_, idx) => idx !== i)
        }
        const next = [...prev]
        next[i] = null
        return next
      }
      const next = [...prev]
      next[i] = place
      return next
    })
  }

  function addStop() {
    setStops((prev) => {
      if (prev.length >= 5) return prev
      return [...prev.slice(0, -1), null, prev[prev.length - 1]]
    })
  }

  function removeStop(i) {
    setStops((prev) => (prev.length <= 2 ? prev : prev.filter((_, idx) => idx !== i)))
  }

  function swap() {
    setStops((prev) => [...prev].reverse())
  }

  function chooseRole(id) {
    actions.updateSettings({ defaultRole: id })
  }

  function chooseMode(id) {
    actions.updateSettings({ defaultModeId: id })
  }

  function logTrip() {
    if (!ready || logged) return
    actions.addTrip(
      buildTripRecord({
        stops,
        mode,
        role,
        trip,
        source: route.source,
      })
    )
    setLogged(true)
  }

  const from = stops[0]
  const to = stops[stops.length - 1]

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 py-4 lg:max-w-[1120px] lg:px-6 lg:py-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,404px)] lg:items-start lg:gap-5">
        <div className="contents lg:block lg:space-y-4">
          {/* ------------------------------------------------------- route */}
          <section className="panel p-4" aria-labelledby="route-heading">
            <div className="flex items-baseline justify-between gap-3">
              <p id="route-heading" className="label-xs">
                Your route
              </p>
              <span className="text-[10.5px] text-faint">
                {stops.filter(Boolean).length} {stops.filter(Boolean).length === 1 ? 'stop' : 'stops'}
              </span>
            </div>

            <div className="mt-3 space-y-2">
              {stops.map((stop, i) => {
                const last = stops.length - 1
                const flagged = i === dup
                return (
                  <div key={i} className="flex items-center gap-2.5">
                    <span
                      className={`num flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-[10.5px] font-bold ${
                        i === 0
                          ? 'border-[#4a3c10] bg-[#2a2109] text-signal'
                          : i === last
                            ? 'border-[#1f4a36] bg-route-dim text-route'
                            : 'border-line bg-ink-800 text-muted'
                      }`}
                      aria-hidden="true"
                    >
                      {i === 0 ? 'A' : i === last ? 'B' : i}
                    </span>

                    <div
                      className={`min-w-0 flex-1 rounded-[11px] ${
                        flagged ? 'ring-2 ring-danger ring-offset-2 ring-offset-ink-850' : ''
                      }`}
                    >
                      <PlaceInput
                        value={stop}
                        onSelect={(place) => setStop(i, place)}
                        label={
                          i === 0 ? 'Origin' : i === last ? 'Destination' : `Via point ${i}`
                        }
                        placeholder={
                          i === 0
                            ? 'Where do you start?'
                            : i === last
                              ? 'Where are you going?'
                              : 'Add a via point'
                        }
                      />
                    </div>

                    {stops.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeStop(i)}
                        aria-label={`Remove stop ${i + 1}`}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-ink-800 hover:text-danger pointer-coarse:h-11 pointer-coarse:w-11"
                      >
                        <Icon name="x" size={15} stroke={2} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            {dup >= 0 && (
              <p
                role="alert"
                className="mt-2.5 rounded-[9px] border border-[#5a2a2a] bg-danger-dim px-3 py-2 text-[11.5px] leading-snug text-danger"
              >
                Two stops are the same place. Change one of them to continue.
              </p>
            )}

            <div className="mt-3 flex items-center gap-1.5">
              <Btn
                type="button"
                size="sm"
                icon="plus"
                onClick={addStop}
                disabled={stops.length >= 5}
              >
                Add stop
              </Btn>
              <Btn type="button" size="sm" icon="swap" onClick={swap}>
                Reverse
              </Btn>
            </div>
          </section>

          {/* -------------------------------------------------------- role */}
          <section className="panel p-4">
            <Field label="Commuter type" hint="LTFRB statutory discount">
              <Segmented
                columns={4}
                className="[&>button]:min-h-[44px]"
                value={role.id}
                onChange={chooseRole}
                options={ROLES.map((r) => ({
                  value: r.id,
                  label: ROLE_SHORT[r.id] || r.label,
                  sub: r.discount_pct ? `−${r.discount_pct}%` : 'Full fare',
                }))}
              />
            </Field>
          </section>

          {/* ----------------------------------------------------- vehicle */}
          <section className="panel p-4">
            <Field
              as="input"
              label="Vehicle class"
              hint={`${activeRows.length} active`}
            >
              <Select
                value={mode?.id || ''}
                onChange={chooseMode}
                options={activeRows.map((m) => ({
                  value: m.id,
                  label: m.mode,
                }))}
              />
            </Field>

            {mode && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-[9px] border border-line bg-ink-800 px-3 py-2">
                  <p className="label-xs leading-none">Base</p>
                  <p className="num mt-1.5 text-[11.5px] leading-none text-fg-dim">
                    {peso(mode.base_fare)} first {mode.base_km} km
                  </p>
                </div>
                <div className="rounded-[9px] border border-line bg-ink-800 px-3 py-2">
                  <p className="label-xs leading-none">Excess</p>
                  <p className="num mt-1.5 text-[11.5px] leading-none text-fg-dim">
                    {peso(mode.per_km)} / km
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="contents lg:block lg:space-y-4">
          {/* -------------------------------------------------------- fare */}
          <FareTicket
            trip={trip}
            route={route}
            role={role}
            mode={mode}
            stops={stops}
            loading={loading}
            cheapest={comparisons[0]}
            onSwitchMode={chooseMode}
          />

          {/* ----------------------------------------------------- actions */}
          <div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <Btn
                type="button"
                variant="primary"
                size="lg"
                icon={logged ? 'check' : 'plus'}
                disabled={!ready || loading || logged}
                onClick={logTrip}
              >
                {logged ? 'Logged to Trips' : 'Log this trip'}
              </Btn>
              <Btn
                type="button"
                size="lg"
                icon="receipt"
                disabled={!trip}
                onClick={() => setSheet('breakdown')}
              >
                Breakdown
              </Btn>
            </div>
            <p
              role="status"
              className={`mt-2 min-h-[15px] px-0.5 text-[11px] leading-snug ${
                logged ? 'text-route' : 'text-muted'
              }`}
            >
              {logged
                ? 'Saved. You can find it under Trips.'
                : !ready
                  ? logReason
                  : `${peso(trip?.net ?? 0)} for this trip, ${role.label.toLowerCase()}.`}
            </p>
          </div>

          {/* --------------------------------------------------- map strip */}
          {trip && (
            <button
              type="button"
              onClick={() => setSheet('map')}
              className="panel flex w-full items-stretch gap-0 overflow-hidden p-0 text-left transition-colors hover:border-ink-600"
              aria-label="Open the route map"
            >
              <span className="hatch flex h-16 w-[76px] shrink-0 items-center justify-center border-r border-line text-route">
                <Icon name="route" size={20} />
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-2 py-2.5 pr-2 pl-3">
                <span className="min-w-0 flex-1">
                  <span className="label-xs">Route preview</span>
                  <span className="mt-0.5 block truncate text-[12px] font-medium text-fg">
                    {from?.name} → {to?.name}
                  </span>
                  <span className="num mt-0.5 block truncate text-[10.5px] text-muted">
                    {kmFmt(route.km)} · {duration(route.min)} ·{' '}
                    {route.source === 'osrm' ? 'Live road routing' : 'Offline estimate'}
                  </span>
                </span>
                <Icon name="chevronRight" size={16} className="shrink-0 text-faint" />
              </span>
            </button>
          )}

          {/* ------------------------------------------------- this month */}
          <section className="panel p-4" aria-labelledby="month-heading">
            <div className="flex items-baseline justify-between gap-3">
              <p id="month-heading" className="label-xs">
                This month
              </p>
              <button
                type="button"
                onClick={onOpenBudget}
                className="text-[11px] font-semibold text-signal pointer-coarse:py-2 hover:underline"
              >
                Open budget
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <div className="rounded-[10px] border border-line bg-ink-800 px-3 py-2.5">
                <p className="label-xs leading-none">Spent</p>
                <p className="num mt-1.5 text-[17px] leading-none font-semibold text-signal">
                  {peso(mtd.spent)}
                </p>
                <p className="mt-1 text-[10.5px] text-faint">of {peso(allowance)} allowance</p>
              </div>
              <div className="rounded-[10px] border border-line bg-ink-800 px-3 py-2.5">
                <p className="label-xs leading-none">Remaining</p>
                <p
                  className={`num mt-1.5 text-[17px] leading-none font-semibold ${
                    remaining < 0 ? 'text-danger' : 'text-route'
                  }`}
                >
                  {peso(remaining)}
                </p>
                <p className="mt-1 text-[10.5px] text-faint">
                  {mtd.count} {mtd.count === 1 ? 'trip' : 'trips'} logged
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>

      <BreakdownSheet
        open={sheet === 'breakdown'}
        onClose={() => setSheet(null)}
        trip={trip}
        steps={steps}
        role={role}
        mode={mode}
        comparisons={comparisons}
        onSwitchMode={(id) => {
          chooseMode(id)
          setSheet(null)
        }}
      />

      <Sheet
        open={sheet === 'map'}
        onClose={() => setSheet(null)}
        title="Route map"
      >
        <div className="h-[58vh] overflow-hidden rounded-[11px] border border-line md:h-[420px]">
          <MapView
            stops={stops.filter(Boolean)}
            path={route.path}
            className="h-full w-full"
          />
        </div>
        <div className="mt-3 flex items-start gap-2.5">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-line bg-ink-800 text-route">
            <Icon name="route" size={13} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-medium text-fg" title={`${from?.name} → ${to?.name}`}>
              {from?.name} → {to?.name}
            </p>
            <p className="num mt-0.5 text-[11px] text-muted">
              {kmFmt(route.km)} · {duration(route.min)} ·{' '}
              {route.source === 'osrm' ? 'OSRM road routing' : 'Offline road estimate'}
            </p>
          </div>
        </div>
      </Sheet>
    </div>
  )
}

/* ------------------------------------------------------- breakdown sheet -- */

function BreakdownSheet({
  open,
  onClose,
  trip,
  steps,
  role,
  mode,
  comparisons,
  onSwitchMode,
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Fare breakdown">
      {trip && (
        <div className="space-y-5">
          <section>
            <p className="label-xs">Build-up</p>
            <div className="mt-2 divide-y divide-[#1d2530] rounded-[10px] border border-line bg-ink-800 px-3">
              <Row label={`Base fare — first ${trip.baseKm} km`} value={peso(trip.baseFare)} />
              <Row
                label="Excess distance"
                sub={`${trip.billableKm.toFixed(2)} km × ${peso(trip.perKm)}/km`}
                value={peso(trip.excessCharge)}
              />
              <Row label="Gross fare" value={peso(trip.gross)} strong />
              {trip.discountPct > 0 && (
                <Row
                  label={`${role.label} discount`}
                  sub={`${trip.discountPct}% statutory`}
                  value={`−${peso(trip.discountAmount)}`}
                  tone="route"
                />
              )}
              <Row label="Amount payable" value={peso(trip.net)} strong />
            </div>
          </section>

          <section>
            <p className="label-xs">Timeline</p>
            <ol className="mt-2 rounded-[10px] border border-line bg-ink-800 px-3 py-2.5">
              {steps.map((step, i) => (
                <li
                  key={`${step.name}-${i}`}
                  className="flex items-baseline justify-between gap-3 py-1"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        step.kind === 'origin'
                          ? 'bg-signal'
                          : step.kind === 'destination'
                            ? 'bg-route'
                            : 'bg-line'
                      }`}
                    />
                    <span className="truncate text-[12px] text-fg-dim" title={step.name}>
                      {step.name}
                    </span>
                  </span>
                  <span className="num shrink-0 text-[10.5px] text-faint">
                    {i === 0 ? 'Start' : kmFmt(step.km)}
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              One fare for the whole trip. A via point adds distance, never a second base fare.
            </p>
          </section>

          <section>
            <p className="label-xs">Every vehicle class</p>
            <div className="mt-2 overflow-hidden rounded-[10px] border border-line">
              {comparisons.map((c, i) => {
                const current = c.row.id === mode?.id
                return (
                  <button
                    key={c.row.id}
                    type="button"
                    onClick={() => onSwitchMode(c.row.id)}
                    className={`block w-full border-b border-line-soft px-3 py-2.5 text-left last:border-b-0 ${
                      current ? 'bg-ink-750' : 'bg-ink-800 hover:bg-ink-750'
                    }`}
                  >
                    <span className="flex items-baseline gap-2">
                      <span className="num w-3.5 shrink-0 text-[10px] text-faint">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-fg">
                        {c.row.mode}
                      </span>
                      <span
                        className={`num shrink-0 text-[12.5px] font-semibold ${
                          current ? 'text-signal' : 'text-fg-dim'
                        }`}
                      >
                        {peso(c.net)}
                      </span>
                    </span>
                    <span className="mt-1 flex items-center gap-2 pl-[22px]">
                      <span className="num min-w-0 flex-1 truncate text-[10px] text-faint">
                        {peso(c.row.base_fare)} first {c.row.base_km} km · +{peso(c.row.per_km)}/km
                      </span>
                      {i === 0 && <Badge tone="route">Cheapest</Badge>}
                      {current && i !== 0 && <Badge>Current</Badge>}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="rounded-[10px] border border-line bg-ink-800 px-3 py-2.5">
            <p className="num text-[11px] leading-relaxed text-fg-dim">
              F = B + max(0, D − D_base) × R
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              Then the statutory discount is applied to the gross fare. Rates follow the LTFRB
              matrix in effect 28 September 2026.
            </p>
          </section>
        </div>
      )}
    </Sheet>
  )
}
