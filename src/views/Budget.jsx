import { useMemo, useState } from 'react'
import { useStore, actions, monthTrips, totalsFor } from '../lib/store.js'
import { peso, km as kmFmt, isoDay, weekStart, dayLabel } from '../lib/format.js'
import BarChart from '../components/BarChart.jsx'
import Icon from '../components/Icon.jsx'
import { Stat, Field, Btn, Badge, EmptyState } from '../components/ui.jsx'

export default function Budget({ onOpenPlanner }) {
  const { trips, settings } = useStore()
  const [draftAllowance, setDraftAllowance] = useState(String(settings.monthlyAllowance))
  const [editing, setEditing] = useState(false)

  const allowance = Number(settings.monthlyAllowance) || 0
  const mtd = useMemo(() => totalsFor(monthTrips({ trips })), [trips])
  const remaining = allowance - mtd.spent
  const usedPct = allowance > 0 ? Math.min(100, (mtd.spent / allowance) * 100) : 0

  /* ---- weekly spend, last 8 ISO weeks ---------------------------------- */
  const weekly = useMemo(() => {
    const buckets = new Map()
    const now = new Date()
    for (let i = 7; i >= 0; i--) {
      const start = weekStart(now)
      start.setDate(start.getDate() - i * 7)
      buckets.set(isoDay(start), { label: `W${8 - i}`, value: 0, start, key: isoDay(start) })
    }
    for (const t of trips) {
      const k = isoDay(weekStart(t.createdAt))
      const b = buckets.get(k)
      if (b) b.value = Math.round((b.value + (Number(t.fare) || 0)) * 100) / 100
    }
    return [...buckets.values()]
  }, [trips])

  const avgWeek = useMemo(() => {
    const active = weekly.filter((w) => w.value > 0)
    if (!active.length) return 0
    return Math.round((active.reduce((a, w) => a + w.value, 0) / active.length) * 100) / 100
  }, [weekly])

  /* ---- split by vehicle class ------------------------------------------ */
  const byMode = useMemo(() => {
    const map = new Map()
    for (const t of trips) {
      const key = t.modeId
      const cur = map.get(key) || { id: key, name: t.modeName, value: 0, trips: 0 }
      cur.value = Math.round((cur.value + (Number(t.fare) || 0)) * 100) / 100
      cur.trips += 1
      map.set(key, cur)
    }
    const rows = [...map.values()].sort((a, b) => b.value - a.value)
    const total = rows.reduce((a, r) => a + r.value, 0) || 1
    return rows.map((r) => ({ ...r, pct: (r.value / total) * 100 }))
  }, [trips])

  const all = useMemo(() => totalsFor(trips), [trips])

  /* ---- how the month is tracking against a 4-week allowance ------------ */
  const dayOfMonth = new Date().getDate()
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  const expectedPct = (dayOfMonth / daysInMonth) * 100
  const pacing = usedPct - expectedPct

  return (
    <div className="mx-auto max-w-[1180px] px-7 py-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-xs">Budget tracker</p>
          <h2 className="mt-1.5 text-[24px] leading-tight font-bold tracking-[-0.02em]">
            Your commute allowance
          </h2>
          <p className="mt-1.5 max-w-[64ch] text-[12.5px] leading-relaxed text-muted">
            Set a monthly allowance and FareWise tracks what your commute is actually costing —
            including the 20% statutory discount, so you can see what you would have paid without it.
          </p>
        </div>
        <Btn variant="ghost" size="sm" icon="route" onClick={onOpenPlanner}>
          Log another trip
        </Btn>
      </header>

      {/* summary cards */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Monthly allowance"
          value={peso(allowance)}
          icon="wallet"
          sub={`Set for ${new Date().toLocaleDateString('en-PH', { month: 'long' })}`}
          className="relative"
        />
        <Stat
          label="Total spent this month"
          value={peso(mtd.spent)}
          icon="receipt"
          tone="signal"
          sub={`${mtd.count} trips · ${kmFmt(mtd.km)}`}
        />
        <Stat
          label="Remaining balance"
          value={peso(remaining)}
          icon="gauge"
          tone={remaining < 0 ? 'danger' : 'route'}
          sub={
            remaining < 0
              ? `Over allowance by ${peso(Math.abs(remaining))}`
              : `${peso(remaining / Math.max(1, daysInMonth - dayOfMonth))} a day for ${daysInMonth - dayOfMonth} more days`
          }
        />
        <Stat
          label="Saved by discount"
          value={peso(mtd.saved)}
          icon="check"
          tone="route"
          sub="vs. paying the full fare"
        />
      </div>

      {/* allowance editor */}
      <div className="panel mt-3 p-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-[260px] flex-1">
            <Field
              label="Allowance pacing"
              hint={`${usedPct.toFixed(0)}% used · ${expectedPct.toFixed(0)}% of the month elapsed`}
            >
              <div className="relative mt-1 h-[10px] overflow-hidden rounded-full border border-line bg-ink-800">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    remaining < 0 ? 'bg-danger' : pacing > 12 ? 'bg-signal' : 'bg-route'
                  }`}
                  style={{ width: `${usedPct}%` }}
                />
                <div
                  className="absolute top-0 h-full w-px bg-fg-dim"
                  style={{ left: `${expectedPct}%` }}
                  title="Where you should be if you spent evenly"
                />
              </div>
              <p className="mt-2 text-[11.5px] text-muted">
                {remaining < 0
                  ? 'You have gone past your allowance for this month.'
                  : pacing > 12
                    ? `Running ${pacing.toFixed(0)} points ahead of an even pace.`
                    : pacing < -12
                      ? `Running ${Math.abs(pacing).toFixed(0)} points behind an even pace — good.`
                      : 'Tracking close to an even pace.'}
              </p>
            </Field>
          </div>

          <div className="flex items-end gap-2.5">
            {editing ? (
              <>
                <div>
                  <span className="label-xs mb-2 block">New allowance (₱)</span>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={draftAllowance}
                    onChange={(e) => setDraftAllowance(e.target.value)}
                    className="num h-10 w-[140px] rounded-[10px] border border-line bg-ink-800 px-3 text-[13px]"
                  />
                </div>
                <Btn
                  variant="primary"
                  onClick={() => {
                    actions.updateSettings({ monthlyAllowance: Number(draftAllowance) || 0 })
                    setEditing(false)
                  }}
                >
                  Save
                </Btn>
                <Btn
                  variant="quiet"
                  onClick={() => {
                    setDraftAllowance(String(settings.monthlyAllowance))
                    setEditing(false)
                  }}
                >
                  Cancel
                </Btn>
              </>
            ) : (
              <Btn icon="pencil" onClick={() => setEditing(true)}>
                Edit allowance
              </Btn>
            )}
          </div>
        </div>
      </div>

      {/* weekly chart */}
      <div className="panel mt-3 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="label-xs">Weekly spending</p>
            <h3 className="mt-1.5 text-[16px] font-bold tracking-[-0.01em]">Last 8 weeks</h3>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="label-xs leading-none">Average active week</p>
              <p className="num mt-1.5 text-[15px] leading-none font-semibold text-fg">
                {peso(avgWeek)}
              </p>
            </div>
            <Badge tone="signal" icon="clock">
              {all.count} trips on record
            </Badge>
          </div>
        </div>
        <div className="mt-5">
          <BarChart data={weekly} height={188} tone="signal" />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-5">
        {/* by vehicle class */}
        <div className="panel p-5 lg:col-span-3">
          <p className="label-xs">Where the money goes</p>
          <h3 className="mt-1.5 text-[16px] font-bold tracking-[-0.01em]">Spend by vehicle class</h3>

          {byMode.length === 0 ? (
            <div className="mt-4">
              <EmptyState icon="bus" title="Nothing logged yet" body="Log a trip and the split appears here." />
            </div>
          ) : (
            <div className="mt-4 space-y-3.5">
              {byMode.map((r) => (
                <div key={r.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[12.5px] font-medium text-fg">
                      {r.name}
                      <span className="num ml-2 text-[10.5px] text-faint">{r.trips} trips</span>
                    </span>
                    <span className="num shrink-0 text-[12.5px] font-semibold text-fg-dim">
                      {peso(r.value)}
                      <span className="ml-1.5 text-[10.5px] text-faint">{r.pct.toFixed(0)}%</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-[7px] overflow-hidden rounded-full border border-line bg-ink-800">
                    <div
                      className="h-full rounded-full bg-signal transition-all duration-500"
                      style={{ width: `${Math.max(r.pct, 1.5)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* month at a glance */}
        <div className="panel p-5 lg:col-span-2">
          <p className="label-xs">At a glance</p>
          <h3 className="mt-1.5 text-[16px] font-bold tracking-[-0.01em]">This month</h3>
          <div className="mt-4 divide-y divide-[#1d2530]">
            <Line label="Trips" value={String(mtd.count)} />
            <Line label="Road distance" value={kmFmt(mtd.km)} />
            <Line label="Fares paid" value={peso(mtd.spent)} />
            <Line label="Statutory discount" value={`−${peso(mtd.saved)}`} tone="route" />
            <Line label="Average per trip" value={peso(mtd.count ? mtd.spent / mtd.count : 0)} />
            <Line label="Projected month" value={peso(projectMonth(mtd.spent, dayOfMonth, daysInMonth))} tone="signal" />
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-[10px] border border-line bg-ink-800 px-3 py-2.5">
            <Icon name="info" size={13} className="mt-px shrink-0 text-muted" />
            <p className="text-[11px] leading-relaxed text-muted">
              Projection assumes your spending rate for the remaining {daysInMonth - dayOfMonth} days
              matches the first {dayOfMonth}.
            </p>
          </div>
        </div>
      </div>

      {/* recent */}
      <div className="panel mt-3 p-5">
        <p className="label-xs">Recent activity</p>
        <h3 className="mt-1.5 text-[16px] font-bold tracking-[-0.01em]">Last 6 trips</h3>
        <div className="mt-4 divide-y divide-[#1d2530]">
          {[...trips]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 6)
            .map((t) => (
              <div key={t.id} className="flex items-center gap-4 py-2.5">
                <span className="w-[86px] shrink-0 text-[11px] font-semibold text-muted">
                  {dayLabel(t.createdAt)}
                </span>
                <span className="flex min-w-0 flex-1 items-center gap-2 text-[12.5px] text-fg">
                  <span className="truncate">{t.fromName}</span>
                  <Icon name="arrowRight" size={12} className="shrink-0 text-faint" />
                  <span className="truncate">{t.toName}</span>
                </span>
                <span className="hidden shrink-0 text-[11px] text-muted sm:block">{t.modeName}</span>
                <span className="num w-[76px] shrink-0 text-right text-[12.5px] font-semibold text-fg">
                  {peso(t.fare)}
                </span>
              </div>
            ))}
          {trips.length === 0 && <p className="py-3 text-[12px] text-muted">No trips logged yet.</p>}
        </div>
      </div>
    </div>
  )
}

function Line({ label, value, tone = 'default' }) {
  const tones = { default: 'text-fg-dim', route: 'text-route', signal: 'text-signal' }
  return (
    <div className="flex items-baseline justify-between py-2">
      <span className="text-[12px] text-muted">{label}</span>
      <span className={`num text-[12.5px] font-semibold ${tones[tone]}`}>{value}</span>
    </div>
  )
}

const projectMonth = (spent, day, days) => (day > 0 ? Math.round((spent / day) * days * 100) / 100 : 0)
