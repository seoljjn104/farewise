import { Fragment, useMemo, useState } from 'react'
import { useStore, actions, totalsFor } from '../lib/store.js'
import { peso, km as kmFmt, dayLabel, clockTime, fullDate, isoDay } from '../lib/format.js'
import Icon from '../components/Icon.jsx'
import { Btn, Badge, EmptyState, Select } from '../components/ui.jsx'

export default function Ledger() {
  const { trips, matrix } = useStore()
  const [q, setQ] = useState('')
  const [mode, setMode] = useState('all')
  const [sort, setSort] = useState('recent')

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    let rows = trips.filter((t) => {
      if (mode !== 'all' && t.modeId !== mode) return false
      if (!s) return true
      return (
        (t.fromName || '').toLowerCase().includes(s) ||
        (t.toName || '').toLowerCase().includes(s) ||
        (t.modeName || '').toLowerCase().includes(s)
      )
    })
    rows = [...rows]
    if (sort === 'recent') rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    if (sort === 'highest') rows.sort((a, b) => b.fare - a.fare)
    if (sort === 'longest') rows.sort((a, b) => b.distanceKm - a.distanceKm)
    return rows
  }, [trips, q, mode, sort])

  // group by local day
  const groups = useMemo(() => {
    const map = new Map()
    for (const t of filtered) {
      const k = isoDay(t.createdAt)
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(t)
    }
    return [...map.entries()]
  }, [filtered])

  const totals = totalsFor(filtered)
  const all = totalsFor(trips)

  return (
    <div className="mx-auto max-w-[1180px] px-7 py-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-xs">Trip ledger</p>
          <h2 className="mt-1.5 text-[24px] leading-tight font-bold tracking-[-0.02em]">
            Every trip, every fare
          </h2>
          <p className="mt-1.5 max-w-[62ch] text-[12.5px] leading-relaxed text-muted">
            The <span className="num text-fg-dim">trip_ledger</span> record — route, vehicle class,
            road distance and the fare actually paid. Rows are written by the Trip Planner and kept
            on this device.
          </p>
        </div>
        {trips.length > 0 && (
          <Btn
            variant="danger"
            icon="trash"
            size="sm"
            onClick={() => {
              if (confirm('Delete all logged trips? This only clears this device.')) actions.clearTrips()
            }}
          >
            Clear ledger
          </Btn>
        )}
      </header>

      {/* summary strip */}
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Strip label="Trips shown" value={String(totals.count)} sub={`${all.count} total`} icon="receipt" />
        <Strip label="Total spent" value={peso(totals.spent)} sub="actual fares paid" icon="wallet" tone="signal" />
        <Strip label="Distance" value={kmFmt(totals.km)} sub="road distance" icon="route" />
        <Strip label="Discount saved" value={peso(totals.saved)} sub="students · seniors · PWDs" icon="check" tone="route" />
      </div>

      {/* filters */}
      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[240px] flex-1">
          <Icon name="search" size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search route or vehicle class"
            className="h-10 w-full rounded-[10px] border border-line bg-ink-800 pr-3 pl-9 text-[13px] placeholder:text-faint"
          />
        </div>
        <Select
          className="w-[220px]"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'all', label: 'All vehicle classes' },
            ...matrix.map((m) => ({ value: m.id, label: m.mode })),
          ]}
        />
        <Select
          className="w-[160px]"
          value={sort}
          onChange={setSort}
          options={[
            { value: 'recent', label: 'Most recent' },
            { value: 'highest', label: 'Highest fare' },
            { value: 'longest', label: 'Longest distance' },
          ]}
        />
      </div>

      {/* table */}
      {filtered.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            icon="receipt"
            title="No trips match"
            body="Log a trip from the Trip Planner and it will appear here. You can also clear the filters above."
          />
        </div>
      ) : (
        <div className="mt-5 overflow-hidden rounded-[14px] border border-line">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-ink-800">
                {['When', 'Route', 'Vehicle class', 'Distance', 'Fare', 'Saved', ''].map((h, i) => (
                  <th
                    key={h + i}
                    className={`label-xs px-4 py-3 font-bold ${i >= 3 ? 'text-right' : ''} ${i === 6 ? 'w-12' : ''}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map(([day, rows]) => (
                <Fragment key={day}>
                  <tr className="bg-ink-850">
                    <td colSpan={7} className="px-4 py-2">
                      <span className="text-[11px] font-bold tracking-[0.08em] text-fg-dim uppercase">
                        {dayLabel(day)}
                      </span>
                      <span className="num ml-2 text-[10.5px] text-faint">{fullDate(day)}</span>
                    </td>
                  </tr>
                  {rows.map((t) => (
                    <tr key={t.id} className="group border-t border-line-soft hover:bg-ink-800/70">
                      <td className="num px-4 py-3 text-[11.5px] whitespace-nowrap text-muted">
                        {clockTime(t.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-[12.5px] font-medium text-fg">
                          <span className="truncate">{t.fromName}</span>
                          <Icon name="arrowRight" size={12} className="shrink-0 text-faint" />
                          <span className="truncate">{t.toName}</span>
                        </div>
                        {t.legCount > 1 && (
                          <span className="num text-[10.5px] text-faint">{t.legCount} legs</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-md border border-line bg-ink-800 px-2 py-[3px] text-[10.5px] font-semibold text-fg-dim">
                          {matrix.find((m) => m.id === t.modeId)?.code || t.modeName}
                        </span>
                        <span className="ml-2 hidden text-[11px] text-muted xl:inline">{t.roleLabel}</span>
                      </td>
                      <td className="num px-4 py-3 text-right text-[12px] text-fg-dim">
                        {kmFmt(t.distanceKm)}
                      </td>
                      <td className="num px-4 py-3 text-right text-[13px] font-semibold text-fg">
                        {peso(t.fare)}
                      </td>
                      <td className="num px-4 py-3 text-right text-[12px] text-route">
                        {t.discount > 0 ? `−${peso(t.discount)}` : '—'}
                      </td>
                      <td className="px-2 py-3 text-right">
                        <button
                          onClick={() => actions.deleteTrip(t.id)}
                          title="Delete trip"
                          className="rounded-md p-1.5 text-faint opacity-0 transition-opacity group-hover:opacity-100 hover:bg-ink-700 hover:text-danger"
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Strip({ label, value, sub, icon, tone = 'neutral' }) {
  const tones = { neutral: 'text-fg', signal: 'text-signal', route: 'text-route' }
  return (
    <div className="panel px-4 py-3.5">
      <div className="flex items-start justify-between">
        <span className="label-xs">{label}</span>
        <Icon name={icon} size={14} className="text-faint" />
      </div>
      <p className={`num mt-2 text-[20px] leading-none font-semibold ${tones[tone]}`}>{value}</p>
      <p className="mt-1.5 text-[10.5px] text-muted">{sub}</p>
    </div>
  )
}
