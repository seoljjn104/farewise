import { useMemo, useState } from 'react'
import { useStore, actions, monthTrips, totalsFor } from '../lib/store.js'
import { monthPacing, projectMonth, spendByMode, weeklyBuckets } from '../lib/budget.js'
import { peso, km as kmFmt, dayLabel } from '../lib/format.js'
import BarChart from '../components/BarChart.jsx'
import Icon from '../components/Icon.jsx'
import { Badge, Btn, EmptyState, Row, Stat } from '../components/ui.jsx'

export default function Budget({ onOpenPlanner }) {
  const { trips, settings } = useStore()
  const allowance = Number(settings.monthlyAllowance) || 0
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(allowance))

  const mtd = useMemo(() => totalsFor(monthTrips({ trips })), [trips])
  const pacing = monthPacing({ spent: mtd.spent, allowance })
  const projected = projectMonth(mtd.spent, pacing.day, pacing.days)

  const weekly = useMemo(() => weeklyBuckets(trips, { weeks: 8 }), [trips])
  const avgWeek = useMemo(() => {
    const active = weekly.filter((w) => w.value > 0)
    if (!active.length) return 0
    return active.reduce((a, w) => a + w.value, 0) / active.length
  }, [weekly])
  const byMode = useMemo(() => spendByMode(trips), [trips])
  const recent = useMemo(
    () =>
      [...trips]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 3),
    [trips]
  )

  function startEditing() {
    setDraft(String(allowance))
    setEditing(true)
  }

  function save(event) {
    event.preventDefault()
    const next = Math.max(0, Number(draft) || 0)
    actions.updateSettings({ monthlyAllowance: next })
    setEditing(false)
  }

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-4 lg:max-w-[1000px] lg:px-6 lg:py-6">
      {/* ---------------------------------------------------------- summary */}
      <section aria-label="This month" className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Stat
          label="Spent"
          value={peso(mtd.spent)}
          tone="signal"
          sub={`${mtd.count} trips · ${kmFmt(mtd.km)}`}
        />
        <Stat
          label="Remaining"
          value={peso(pacing.remaining)}
          tone={pacing.remaining < 0 ? 'danger' : 'route'}
          sub={
            allowance <= 0
              ? 'No allowance set'
              : pacing.remaining < 0
                ? `Over by ${peso(Math.abs(pacing.remaining))}`
                : pacing.daysLeft === 0
                  ? 'Last day of the month'
                  : `${peso(pacing.remaining / pacing.daysLeft)} a day for ${pacing.daysLeft} more days`
          }
        />
        <Stat
          label="Trip discount"
          value={peso(mtd.saved)}
          tone="route"
          sub="statutory discount"
        />
        <Stat
          label="Projected month"
          value={peso(projected)}
          sub={`at ${pacing.day} of ${pacing.days} days`}
        />
      </section>

      {/* -------------------------------------------------------- allowance */}
      <section aria-label="Allowance pacing" className="panel mt-2.5 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="label-xs">Monthly allowance</p>
            <p className="num mt-1.5 text-[26px] leading-none font-semibold text-fg">
              {peso(allowance)}
            </p>
            <p className="mt-1.5 text-[10.5px] text-faint">
              Standing monthly setting, not month by month
            </p>
          </div>
          {!editing && (
            <Btn size="sm" icon="pencil" onClick={startEditing}>
              Edit
            </Btn>
          )}
        </div>

        {editing && (
          <form onSubmit={save} className="mt-3 flex items-end gap-2 border-t border-line-soft pt-3">
            <label className="min-w-0 flex-1">
              <span className="label-xs mb-1.5 block">New allowance (₱)</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="50"
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="num h-11 w-full rounded-[10px] border border-line bg-ink-800 px-3 text-[13px] text-fg"
              />
            </label>
            <Btn type="submit" variant="primary">
              Save
            </Btn>
            <Btn type="button" variant="quiet" onClick={() => setEditing(false)}>
              Cancel
            </Btn>
          </form>
        )}

        <div className="mt-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="label-xs">
              {pacing.usedPct.toFixed(0)}% used
            </span>
            <span className="num text-[10px] text-faint">
              {pacing.expectedPct.toFixed(0)}% of the month elapsed
            </span>
          </div>

          <div
            className="relative mt-2 h-2.5 rounded-full border border-line bg-ink-800"
            role="img"
            aria-label={`${pacing.usedPct.toFixed(0)} percent of the allowance used, ${pacing.expectedPct.toFixed(0)} percent of the month elapsed`}
          >
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                pacing.remaining < 0 ? 'bg-danger' : pacing.pacing > 12 ? 'bg-signal' : 'bg-route'
              }`}
              style={{ width: `${pacing.usedPct}%` }}
            />
            <div
              className="absolute -top-1 h-[18px] w-px bg-fg-dim"
              style={{ left: `${Math.min(99.5, pacing.expectedPct)}%` }}
              title="Where an even month would be"
            />
          </div>

          <p className="mt-2.5 text-[11.5px] leading-relaxed text-muted">
            {allowance <= 0
              ? 'Set an allowance to see how the month is tracking.'
              : pacing.remaining < 0
                ? 'You have spent past the allowance for this month.'
                : pacing.pacing > 12
                  ? `Spending faster than the month is passing, about ${pacing.pacing.toFixed(0)} points ahead.`
                  : pacing.pacing < -12
                    ? `Comfortably behind, about ${Math.abs(pacing.pacing).toFixed(0)} points under an even month.`
                    : 'Tracking close to an even pace for the month.'}
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------ chart */}
      <section aria-label="Weekly spending" className="panel mt-2.5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div>
            <p className="label-xs">Weekly spending</p>
            <h2 className="mt-1 text-[15px] font-bold tracking-[-0.01em] text-fg">Last 8 weeks</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="label-xs leading-none">Active week avg</p>
              <p className="num mt-1.5 text-[14px] leading-none font-semibold text-fg">
                {peso(avgWeek)}
              </p>
            </div>
            <Badge tone="signal">{mtd.count} this month</Badge>
          </div>
        </div>
        <div className="mt-4">
          <BarChart data={weekly} height={160} tone="signal" />
        </div>
      </section>

      <div className="mt-2.5 grid grid-cols-1 gap-2.5 lg:grid-cols-5">
        {/* -------------------------------------------------- by vehicle class */}
        <section aria-label="Spend by vehicle class" className="panel p-4 lg:col-span-3">
          <p className="label-xs">Where the money goes</p>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="mt-1 text-[15px] font-bold tracking-[-0.01em] text-fg">
              Spend by vehicle class
            </h2>
            <span className="text-[10px] text-faint">all logged trips</span>
          </div>

          {byMode.length === 0 ? (
            <div className="mt-3">
              <EmptyState
                icon="bus"
                title="Nothing logged yet"
                body="Log a trip and the split across vehicle classes appears here."
              />
            </div>
          ) : (
            <ul className="mt-3 space-y-3">
              {byMode.map((row) => (
                <li key={row.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-[12px] font-medium text-fg">
                      {row.name}
                      <span className="num ml-1.5 text-[10px] text-faint">
                        {row.trips} {row.trips === 1 ? 'trip' : 'trips'}
                      </span>
                    </span>
                    <span className="num shrink-0 text-[12px] font-semibold text-fg-dim">
                      {peso(row.value)}
                      <span className="ml-1.5 text-[10px] text-faint">{row.pct.toFixed(0)}%</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-[6px] overflow-hidden rounded-full border border-line bg-ink-800">
                    <div
                      className="h-full rounded-full bg-signal transition-all duration-500"
                      style={{ width: `${Math.max(row.pct, 1.5)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---------------------------------------------------- month at a glance */}
        <section aria-label="This month at a glance" className="panel p-4 lg:col-span-2">
          <p className="label-xs">At a glance</p>
          <h2 className="mt-1 text-[15px] font-bold tracking-[-0.01em] text-fg">This month</h2>
          <div className="mt-3 divide-y divide-[#1d2530]">
            <Row label="Trips" value={String(mtd.count)} />
            <Row label="Road distance" value={kmFmt(mtd.km)} />
            <Row label="Fares paid" value={peso(mtd.spent)} />
            <Row label="Discount saved" value={`−${peso(mtd.saved)}`} tone="route" />
            <Row label="Average per trip" value={peso(mtd.count ? mtd.spent / mtd.count : 0)} />
            <Row label="Projected month" value={peso(projected)} tone="signal" />
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-[10px] border border-line bg-ink-800 px-3 py-2.5">
            <Icon name="info" size={13} className="mt-px shrink-0 text-muted" />
            <p className="text-[11px] leading-relaxed text-muted">
              The projection carries your daily rate over the remaining {pacing.daysLeft} days.
            </p>
          </div>
        </section>
      </div>

      {/* ----------------------------------------------------------- recent */}
      <section aria-label="Recent activity" className="panel mt-2.5 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="label-xs">Recent activity</p>
            <h2 className="mt-1 text-[15px] font-bold tracking-[-0.01em] text-fg">Last 3 trips</h2>
          </div>
          <Btn size="sm" variant="quiet" icon="route" onClick={onOpenPlanner}>
            Plan
          </Btn>
        </div>

        {recent.length === 0 ? (
          <p className="mt-3 text-[12px] text-muted">No trips logged yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-[#1d2530]">
            {recent.map((trip) => (
              <li key={trip.id} className="flex items-center gap-3 py-2.5">
                <span className="w-[62px] shrink-0 text-[10.5px] font-semibold text-muted">
                  {dayLabel(trip.createdAt)}
                </span>
                <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[12px] text-fg">
                  <span className="truncate">{trip.fromName}</span>
                  <Icon name="arrowRight" size={11} className="shrink-0 text-faint" />
                  <span className="truncate">{trip.toName}</span>
                </span>
                <span className="num shrink-0 text-[12px] font-semibold text-fg">
                  {peso(trip.fare)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
