import { useMemo, useState } from 'react'
import { actions, canConfirm, publishedAdvisories, useStore } from '../lib/store.js'
import {
  CATEGORIES,
  SEVERITY_OPTIONS,
  categoryById,
  severityById,
} from '../lib/advisoryMeta.js'
import { clockTime, dayLabel, isoDay } from '../lib/format.js'
import Icon from '../components/Icon.jsx'
import Sheet from '../components/Sheet.jsx'
import { Badge, Btn, EmptyState, Field, Segmented } from '../components/ui.jsx'

const EMPTY_FORM = {
  title: '',
  body: '',
  category: 'traffic',
  severity: 'medium',
  area: 'Cebu City',
}

/** Today reads as a time, older notices read as a day. Never both. */
function whenLabel(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return isoDay(date) === isoDay(new Date()) ? clockTime(date) : dayLabel(date)
}

export default function Alerts() {
  const state = useStore()
  const published = useMemo(
    () => publishedAdvisories({ advisories: state.advisories }),
    [state.advisories]
  )

  const [filter, setFilter] = useState('all')
  const [reporting, setReporting] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [sent, setSent] = useState(false)

  const shown = filter === 'all' ? published : published.filter((a) => a.category === filter)
  const counts = useMemo(() => {
    const out = { all: published.length }
    for (const category of CATEGORIES) {
      out[category.id] = published.filter((a) => a.category === category.id).length
    }
    return out
  }, [published])

  function openReport() {
    setSent(false)
    setReporting(true)
  }

  function closeReport() {
    setReporting(false)
    setForm(EMPTY_FORM)
  }

  function submit(event) {
    event.preventDefault()
    if (!form.title.trim() || !form.body.trim()) return
    actions.addAdvisory({ ...form, title: form.title.trim(), body: form.body.trim() })
    setForm(EMPTY_FORM)
    setReporting(false)
    setSent(true)
  }

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 py-4 lg:max-w-[900px] lg:px-6 lg:py-6">
      <div className="flex items-start justify-between gap-3">
        <p className="max-w-[42ch] text-[11.5px] leading-relaxed text-muted">
          Reports from other commuters, checked by a moderator before they appear here.
        </p>
        <Btn variant="primary" size="sm" icon="flag" onClick={openReport} className="shrink-0">
          Report
        </Btn>
      </div>

      {sent && (
        <p
          role="status"
          className="mt-3 flex items-center gap-2 rounded-[10px] border border-[#1f4a36] bg-route-dim px-3 py-2 text-[11.5px] text-route"
        >
          <Icon name="check" size={13} stroke={2.2} className="shrink-0" />
          Report sent. A moderator will review it before it appears.
        </p>
      )}

      {/* --------------------------------------------------------- category */}
      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
          All {counts.all}
        </Chip>
        {CATEGORIES.filter((c) => (counts[c.id] || 0) > 0 || filter === c.id).map((category) => (
          <Chip
            key={category.id}
            active={filter === category.id}
            onClick={() => setFilter(category.id)}
          >
            {category.label} {counts[category.id] || 0}
          </Chip>
        ))}
      </div>

      {/* ------------------------------------------------------------- feed */}
      {shown.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            icon="bell"
            title={filter === 'all' ? 'No notices yet' : 'Nothing in this category'}
            body={
              filter === 'all'
                ? 'Advisories appear once a moderator publishes them. If you know about a change, report it.'
                : 'No published notices carry this category. Try All, or report what you saw.'
            }
            action={
              filter === 'all' ? (
                <Btn variant="primary" icon="flag" onClick={openReport}>
                  Report an advisory
                </Btn>
              ) : (
                <Btn variant="ghost" icon="refresh" onClick={() => setFilter('all')}>
                  Show all
                </Btn>
              )
            }
          />
        </div>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {shown.map((advisory) => {
            const category = categoryById(advisory.category)
            const severity = severityById(advisory.severity)
            const confirmed = !canConfirm(state, advisory.id)

            return (
              <li key={advisory.id}>
                <article className="panel p-3.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={category.tone} icon={category.icon}>
                      {category.label}
                    </Badge>
                    {advisory.severity !== 'low' && (
                      <Badge tone={severity.tone}>{severity.label}</Badge>
                    )}
                    <span className="num ml-auto text-[10px] whitespace-nowrap text-faint">
                      {whenLabel(advisory.createdAt)}
                    </span>
                  </div>

                  <h2 className="mt-2 text-[13.5px] leading-snug font-bold tracking-[-0.01em] text-fg">
                    {advisory.title}
                  </h2>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted">{advisory.body}</p>

                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-line-soft pt-2.5">
                    <span className="flex min-w-0 items-center gap-1 text-[10.5px] text-faint">
                      <Icon name="pin" size={11} className="shrink-0" />
                      <span className="truncate">
                        {advisory.area} · {advisory.author || 'Community'}
                      </span>
                    </span>

                    <button
                      type="button"
                      disabled={confirmed}
                      onClick={() => actions.confirmAdvisory(advisory.id)}
                      aria-label={
                        confirmed
                          ? `Already confirmed, ${advisory.confirms || 0} confirmations`
                          : `Confirm this is still true, ${advisory.confirms || 0} confirmations so far`
                      }
                      className={`flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold transition-colors pointer-coarse:min-h-11 ${
                        confirmed
                          ? 'cursor-default border-[#1f4a36] bg-route-dim text-route'
                          : 'border-line bg-ink-800 text-fg-dim hover:border-route hover:text-route'
                      }`}
                    >
                      <Icon name="check" size={12} stroke={2.2} />
                      {confirmed ? 'Confirmed' : 'Still true'}
                      <span className="num text-[10px] text-faint">
                        {advisory.confirms || 0}
                      </span>
                    </button>
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      )}

      {/* ----------------------------------------------------------- report */}
      <Sheet
        open={reporting}
        onClose={closeReport}
        title="Report an advisory"
        footer={
          <div className="flex items-center gap-2">
            <Btn type="button" variant="quiet" onClick={closeReport} className="flex-1">
              Cancel
            </Btn>
            <Btn
              type="submit"
              form="advisory-form"
              variant="primary"
              icon="check"
              className="flex-[2]"
            >
              Submit for review
            </Btn>
          </div>
        }
      >
        <form id="advisory-form" onSubmit={submit} className="space-y-4">
          <Field as="input" label="Headline" hint={`${form.title.length}/90`}>
            <input
              value={form.title}
              maxLength={90}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Jeepney rerouted along Osmeña Blvd."
              className="h-11 w-full rounded-[10px] border border-line bg-ink-800 px-3 text-[13px] text-fg placeholder:text-faint"
            />
          </Field>

          <Field as="input" label="Area">
            <input
              value={form.area}
              maxLength={60}
              onChange={(e) => setForm({ ...form, area: e.target.value })}
              placeholder="Cebu City"
              className="h-11 w-full rounded-[10px] border border-line bg-ink-800 px-3 text-[13px] text-fg placeholder:text-faint"
            />
          </Field>

          <Field label="Details" hint={`${form.body.length}/400`}>
            <textarea
              value={form.body}
              maxLength={400}
              rows={4}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="What changed, which routes are affected, and roughly how much extra time to allow."
              className="w-full resize-none rounded-[10px] border border-line bg-ink-800 px-3 py-2.5 text-[13px] leading-relaxed text-fg placeholder:text-faint"
            />
          </Field>

          <Field label="Category">
            <Segmented
              columns={2}
              value={form.category}
              onChange={(value) => setForm({ ...form, category: value })}
              options={CATEGORIES.map((c) => ({ value: c.id, label: c.label }))}
            />
          </Field>

          <Field label="Severity">
            <Segmented
              columns={3}
              value={form.severity}
              onChange={(value) => setForm({ ...form, severity: value })}
              options={SEVERITY_OPTIONS}
            />
          </Field>

          <p className="text-[10.5px] leading-relaxed text-faint">
            Reports are held for review. Nothing you send appears in the feed until a moderator
            publishes it.
          </p>
        </form>
      </Sheet>
    </div>
  )
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-semibold whitespace-nowrap transition-colors pointer-coarse:min-h-11 ${
        active
          ? 'border-signal bg-signal text-signal-ink'
          : 'border-line bg-ink-800 text-muted hover:text-fg'
      }`}
    >
      {children}
    </button>
  )
}
