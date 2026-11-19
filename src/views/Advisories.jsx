import { useMemo, useState } from 'react'
import { useStore, actions, publishedAdvisories } from '../lib/store.js'
import { dayLabel, clockTime } from '../lib/format.js'
import Icon from '../components/Icon.jsx'
import { Btn, Field, Badge, Segmented, EmptyState } from '../components/ui.jsx'

const CATEGORIES = [
  { id: 'route-change', label: 'Route change', icon: 'route', tone: 'info' },
  { id: 'fare-update', label: 'Fare update', icon: 'wallet', tone: 'signal' },
  { id: 'traffic', label: 'Traffic', icon: 'alert', tone: 'danger' },
  { id: 'service', label: 'Service', icon: 'bus', tone: 'neutral' },
]

const cat = (id) => CATEGORIES.find((c) => c.id === id) || { label: id, icon: 'info', tone: 'neutral' }

const SEVERITY = {
  high: { label: 'High impact', tone: 'danger' },
  medium: { label: 'Moderate', tone: 'signal' },
  low: { label: 'Minor', tone: 'neutral' },
}

export default function Advisories() {
  const { advisories } = useStore()
  const published = useMemo(() => publishedAdvisories({ advisories }), [advisories])
  const [filter, setFilter] = useState('all')
  const [reporting, setReporting] = useState(false)

  const shown = filter === 'all' ? published : published.filter((a) => a.category === filter)

  /* -------------------------------------------------------- report form -- */
  const [form, setForm] = useState({
    title: '',
    body: '',
    category: 'traffic',
    severity: 'medium',
    area: 'Cebu City',
  })
  const [sent, setSent] = useState(false)

  function submit(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.body.trim()) return
    actions.addAdvisory({ ...form })
    setForm({ title: '', body: '', category: 'traffic', severity: 'medium', area: 'Cebu City' })
    setSent(true)
    setTimeout(() => setSent(false), 3200)
  }

  return (
    <div className="mx-auto max-w-[1180px] px-7 py-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-xs">Community advisories</p>
          <h2 className="mt-1.5 text-[24px] leading-tight font-bold tracking-[-0.02em]">
            What commuters are reporting
          </h2>
          <p className="mt-1.5 max-w-[64ch] text-[12.5px] leading-relaxed text-muted">
            Route changes, fare changes and service interruptions posted by the community. Every
            report is held for moderator review before it is published.
          </p>
        </div>
        <Btn variant="primary" icon="flag" onClick={() => setReporting((v) => !v)}>
          {reporting ? 'Close form' : 'Post an advisory'}
        </Btn>
      </header>

      {/* report form */}
      {reporting && (
        <form onSubmit={submit} className="panel mt-5 p-5">
          <p className="label-xs">New advisory</p>
          <h3 className="mt-1.5 text-[16px] font-bold tracking-[-0.01em]">Report something commuters should know</h3>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Field label="Headline">
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Jeepney rerouted along Osmeña Blvd."
                  className="h-10 w-full rounded-[10px] border border-line bg-ink-800 px-3 text-[13px] placeholder:text-faint"
                />
              </Field>
            </div>
            <Field label="Area">
              <input
                value={form.area}
                onChange={(e) => setForm({ ...form, area: e.target.value })}
                className="h-10 w-full rounded-[10px] border border-line bg-ink-800 px-3 text-[13px]"
              />
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Details" hint={`${form.body.length}/400`}>
              <textarea
                value={form.body}
                maxLength={400}
                rows={3}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="What changed, which routes are affected, and roughly how much extra time to allow."
                className="w-full resize-none rounded-[10px] border border-line bg-ink-800 px-3 py-2.5 text-[13px] leading-relaxed placeholder:text-faint"
              />
            </Field>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Field label="Category">
              <Segmented
                columns={2}
                value={form.category}
                onChange={(v) => setForm({ ...form, category: v })}
                options={CATEGORIES.map((c) => ({ value: c.id, label: c.label }))}
              />
            </Field>
            <Field label="Severity">
              <Segmented
                columns={3}
                value={form.severity}
                onChange={(v) => setForm({ ...form, severity: v })}
                options={[
                  { value: 'low', label: 'Minor' },
                  { value: 'medium', label: 'Moderate' },
                  { value: 'high', label: 'High' },
                ]}
              />
            </Field>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <Btn variant="primary" type="submit" icon="check">
              Submit for review
            </Btn>
            {sent && (
              <span className="flex items-center gap-2 text-[12px] text-route">
                <Icon name="check" size={14} stroke={2.2} />
                Submitted — it is now in the moderation queue.
              </span>
            )}
          </div>
        </form>
      )}

      {/* filters */}
      <div className="mt-5 flex flex-wrap items-center gap-1.5">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
          All ({published.length})
        </FilterChip>
        {CATEGORIES.map((c) => {
          const n = published.filter((a) => a.category === c.id).length
          return (
            <FilterChip key={c.id} active={filter === c.id} onClick={() => setFilter(c.id)}>
              {c.label} ({n})
            </FilterChip>
          )
        })}
      </div>

      {/* feed */}
      {shown.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            icon="bell"
            title="Nothing published here"
            body="Advisories appear once a moderator approves them. Try another category, or post one yourself."
          />
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {shown.map((a) => {
            const c = cat(a.category)
            const s = SEVERITY[a.severity] || SEVERITY.medium
            return (
              <article key={a.id} className="panel flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={c.tone} icon={c.icon}>
                      {c.label}
                    </Badge>
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </div>
                  <span className="num shrink-0 text-[10.5px] whitespace-nowrap text-faint">
                    {dayLabel(a.createdAt)} · {clockTime(a.createdAt)}
                  </span>
                </div>

                <h3 className="mt-3 text-[15px] leading-snug font-bold tracking-[-0.01em] text-fg">
                  {a.title}
                </h3>
                <p className="mt-2 flex-1 text-[12.5px] leading-relaxed text-muted">{a.body}</p>

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-line-soft pt-3">
                  <span className="flex items-center gap-1.5 text-[11px] text-faint">
                    <Icon name="pin" size={12} />
                    {a.area}
                    <span className="mx-1 text-line">·</span>
                    {a.author}
                  </span>
                  <button
                    onClick={() => actions.confirmAdvisory(a.id)}
                    className="flex items-center gap-1.5 rounded-md border border-line bg-ink-800 px-2.5 py-1 text-[11px] font-semibold text-fg-dim hover:border-route hover:text-route"
                  >
                    <Icon name="check" size={12} stroke={2.2} />
                    Still true · {a.confirms || 0}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-[11.5px] font-semibold transition-colors ${
        active
          ? 'border-signal bg-signal text-signal-ink'
          : 'border-line bg-ink-800 text-muted hover:text-fg'
      }`}
    >
      {children}
    </button>
  )
}
