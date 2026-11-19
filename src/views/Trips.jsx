import { useEffect, useMemo, useState } from 'react'
import { actions, totalsFor, useStore } from '../lib/store.js'
import { filterTrips, groupByDay } from '../lib/trips.js'
import { clockTime, dayLabel, km, peso } from '../lib/format.js'
import { navigate } from '../lib/router.js'
import Icon from '../components/Icon.jsx'
import Sheet from '../components/Sheet.jsx'
import { Badge, Btn, EmptyState, Field, Segmented } from '../components/ui.jsx'

const SORT_OPTIONS = [
  { value: 'recent', label: 'Recent', sub: 'newest first' },
  { value: 'highest', label: 'Highest', sub: 'fare' },
  { value: 'longest', label: 'Longest', sub: 'distance' },
]

function dayHeading(day) {
  return dayLabel(new Date(`${day}T12:00:00`))
}

export default function Trips() {
  const { trips } = useStore()
  const [q, setQ] = useState('')
  const [modeId, setModeId] = useState('all')
  const [sort, setSort] = useState('recent')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [openMenu, setOpenMenu] = useState(null)
  const [undo, setUndo] = useState(null)

  const totals = totalsFor(trips)

  const classes = useMemo(() => {
    const seen = new Map()
    for (const trip of trips) {
      if (trip.modeId) seen.set(trip.modeId, trip.modeName || trip.modeId)
    }
    return [...seen.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [trips])

  const visible = useMemo(
    () => filterTrips(trips, { q, modeId, sort }),
    [trips, q, modeId, sort]
  )
  const groups = useMemo(() => groupByDay(visible), [visible])
  const activeFilters = (modeId !== 'all' ? 1 : 0) + (sort !== 'recent' ? 1 : 0)

  useEffect(() => {
    if (!undo) return
    const t = setTimeout(() => setUndo(null), 6000)
    return () => clearTimeout(t)
  }, [undo])

  function resetFilters() {
    setQ('')
    setModeId('all')
    setSort('recent')
  }

  function removeTrip(trip) {
    const index = trips.findIndex((t) => t.id === trip.id)
    actions.deleteTrip(trip.id)
    setOpenMenu(null)
    setUndo({ trip, index: Math.max(0, index) })
  }

  function undoDelete() {
    if (!undo) return
    actions.restoreTrip(undo.trip, undo.index)
    setUndo(null)
  }

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 py-4 lg:max-w-[900px] lg:px-6 lg:py-6">
      {/* ---------------------------------------------------------- totals */}
      <section aria-label="Ledger totals" className="grid grid-cols-2 gap-2.5">
        <TotalBox label="Trips logged" value={String(totals.count)} sub="on this device" />
        <TotalBox label="Total spent" value={peso(totals.spent)} sub="fares paid" tone="signal" />
        <TotalBox label="Distance" value={km(totals.km)} sub="road distance" />
        <TotalBox
          label="Discount saved"
          value={peso(totals.saved)}
          sub="statutory discount"
          tone="route"
        />
      </section>

      {/* --------------------------------------------------------- search */}
      {trips.length > 0 && (
        <div className="mt-4 flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Icon
              name="search"
              size={15}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
            />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search trips"
              placeholder="Search route or vehicle class"
              className="h-11 w-full appearance-none rounded-[10px] border border-line bg-ink-850 pr-9 pl-9 text-[13px] text-fg placeholder:text-faint"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ('')}
                aria-label="Clear search"
                className="absolute top-1/2 right-1 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:bg-ink-800 hover:text-fg"
              >
                <Icon name="x" size={14} stroke={2} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="relative flex h-11 shrink-0 items-center gap-2 rounded-[10px] border border-line bg-ink-850 px-3 text-[12.5px] font-semibold text-fg-dim hover:bg-ink-800 hover:text-fg"
          >
            <Icon name="sliders" size={15} />
            Filters
            {activeFilters > 0 && (
              <span className="num flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-signal px-1 text-[9.5px] font-bold text-signal-ink">
                {activeFilters}
              </span>
            )}
          </button>
        </div>
      )}

      {/* ----------------------------------------------------------- list */}
      {trips.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon="receipt"
            title="No trips yet"
            body="Plan a route on the Plan tab and log it. Every trip you log appears here with its fare and the discount you saved."
            action={
              <Btn variant="primary" icon="route" onClick={() => navigate('#/plan')}>
                Plan a trip
              </Btn>
            }
          />
        </div>
      ) : groups.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon="search"
            title="No trips match"
            body="Try a different search, or clear the filters to see the whole ledger."
            action={
              <Btn variant="ghost" icon="refresh" onClick={resetFilters}>
                Clear filters
              </Btn>
            }
          />
        </div>
      ) : (
        <div className="mt-2">
          {groups.map((group) => (
            <section key={group.day} aria-label={dayHeading(group.day)}>
              <h2 className="sticky top-0 z-10 -mx-4 mt-3 flex items-baseline justify-between gap-3 bg-ink-900/95 px-4 py-2 text-[10px] font-bold tracking-[0.13em] text-muted uppercase backdrop-blur lg:-mx-6 lg:px-6">
                <span>{dayHeading(group.day)}</span>
                <span className="num text-[10px] font-medium tracking-normal text-faint normal-case">
                  {group.trips.length} {group.trips.length === 1 ? 'trip' : 'trips'}
                </span>
              </h2>

              <div className="mt-1.5 space-y-2">
                {group.trips.map((trip) => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    open={openMenu === trip.id}
                    onToggle={() => setOpenMenu((id) => (id === trip.id ? null : trip.id))}
                    onDelete={() => removeTrip(trip)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------- undo bar */}
      {undo && (
        <div className="fixed inset-x-3 bottom-[calc(57px+env(safe-area-inset-bottom)+12px)] z-40 mx-auto max-w-[520px] lg:bottom-5">
          <div
            role="status"
            className="flex items-center gap-3 rounded-[12px] border border-line bg-ink-750 px-3 py-2.5 shadow-[0_18px_48px_rgba(0,0,0,.65)]"
          >
            <Icon name="trash" size={15} className="shrink-0 text-danger" />
            <p className="min-w-0 flex-1 truncate text-[12px] text-fg-dim">
              Trip to {undo.trip.toName} deleted.
            </p>
            <button
              type="button"
              onClick={undoDelete}
              className="shrink-0 rounded-lg border border-line bg-ink-800 px-2.5 py-1.5 text-[11.5px] font-bold text-signal hover:bg-ink-700"
            >
              Undo
            </button>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- filters */}
      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Filter trips">
        <div className="space-y-5">
          <Field label="Vehicle class" hint={`${classes.length} in ledger`}>
            <div className="flex flex-wrap gap-1.5">
              <ClassChip
                on={modeId === 'all'}
                onClick={() => setModeId('all')}
                label="All classes"
              />
              {classes.map((row) => (
                <ClassChip
                  key={row.id}
                  on={modeId === row.id}
                  onClick={() => setModeId(row.id)}
                  label={row.label}
                />
              ))}
            </div>
          </Field>

          <Field label="Sort by">
            <Segmented
              columns={3}
              value={sort}
              onChange={setSort}
              options={SORT_OPTIONS}
            />
          </Field>

          <div className="flex items-center gap-2 border-t border-line pt-4">
            <Btn
              type="button"
              icon="refresh"
              onClick={resetFilters}
              className="flex-1"
            >
              Reset
            </Btn>
            <Btn
              type="button"
              variant="primary"
              onClick={() => setSheetOpen(false)}
              className="flex-1"
            >
              Show {visible.length} {visible.length === 1 ? 'trip' : 'trips'}
            </Btn>
          </div>
        </div>
      </Sheet>
    </div>
  )
}

/* ------------------------------------------------------------- elements -- */

function TotalBox({ label, value, sub, tone = 'neutral' }) {
  const tones = {
    neutral: 'text-fg',
    signal: 'text-signal',
    route: 'text-route',
  }
  return (
    <div className="panel px-3.5 py-3">
      <p className="label-xs leading-none">{label}</p>
      <p className={`num mt-1.5 text-[17px] leading-none font-semibold ${tones[tone]}`}>{value}</p>
      <p className="mt-1 text-[10px] text-faint">{sub}</p>
    </div>
  )
}

function ClassChip({ on, onClick, label }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-lg border px-2.5 py-2 text-left text-[11.5px] font-medium transition-colors pointer-coarse:min-h-11 ${
        on
          ? 'border-signal bg-signal text-signal-ink'
          : 'border-line bg-ink-800 text-fg-dim hover:bg-ink-700 hover:text-fg'
      }`}
    >
      {label}
    </button>
  )
}

function TripCard({ trip, open, onToggle, onDelete }) {
  const discount = Number(trip.discount) || 0

  return (
    <article
      className={`panel px-3.5 py-3 transition-colors ${open ? 'border-ink-600' : ''}`}
    >
      <div className="flex items-start gap-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="num shrink-0 text-[10.5px] text-muted">
              {clockTime(trip.createdAt)}
            </span>
            <Badge className="min-w-0">
              <span className="truncate">{trip.modeName}</span>
            </Badge>
          </div>

          <p
            className="mt-1.5 truncate text-[13px] font-semibold text-fg"
            title={`${trip.fromName} → ${trip.toName}`}
          >
            {trip.fromName} → {trip.toName}
          </p>

          <div className="mt-1.5 flex items-baseline justify-between gap-3">
            <span className="num min-w-0 truncate text-[10.5px] text-muted">
              {km(trip.distanceKm)}
              {trip.roleLabel ? ` · ${trip.roleLabel}` : ''}
            </span>
            <span className="flex shrink-0 items-baseline gap-2">
              {discount > 0 && (
                <span
                  className="num text-[10px] font-semibold text-route"
                  title={`Saved ${peso(discount)} against the full fare`}
                >
                  saved {peso(discount)}
                </span>
              )}
              <span className="num text-[15px] leading-none font-semibold text-fg">
                {peso(trip.fare)}
              </span>
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={`Actions for the trip from ${trip.fromName} to ${trip.toName}`}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors pointer-coarse:h-11 pointer-coarse:w-11 ${
            open
              ? 'border-ink-600 bg-ink-700 text-fg'
              : 'border-line bg-ink-800 text-muted hover:text-fg'
          }`}
        >
          <Icon name="more" size={16} />
        </button>
      </div>

      {open && (
        <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-line-soft pt-2.5">
          <p className="num min-w-0 truncate text-[10px] text-faint">
            {trip.legCount ? `${trip.legCount} leg${trip.legCount === 1 ? '' : 's'}` : 'Logged trip'}
            {trip.distanceSource === 'estimate' ? ' · estimated distance' : ''}
          </p>
          <Btn type="button" size="sm" variant="danger" icon="trash" onClick={onDelete}>
            Delete trip
          </Btn>
        </div>
      )}
    </article>
  )
}
