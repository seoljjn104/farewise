import { useMemo, useState } from 'react'
import { useStore, actions } from '../lib/store.js'
import { FARE_MATRIX_SEED } from '../lib/fares.js'
import { peso, dayLabel, clockTime } from '../lib/format.js'
import Icon from '../components/Icon.jsx'
import { Btn, Field, Badge, Row, Toggle } from '../components/ui.jsx'

export default function Admin() {
  const { matrix, advisories, trips, settings } = useStore()
  const [tab, setTab] = useState('tariff')
  const [confirmReset, setConfirmReset] = useState(false)

  const pending = useMemo(() => advisories.filter((a) => a.status === 'pending'), [advisories])

  return (
    <div className="mx-auto max-w-[1180px] px-7 py-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-xs">Admin control panel</p>
          <h2 className="mt-1.5 text-[24px] leading-tight font-bold tracking-[-0.02em]">
            Tariff rules &amp; moderation
          </h2>
          <p className="mt-1.5 max-w-[66ch] text-[12.5px] leading-relaxed text-muted">
            Maintain the <span className="num text-fg-dim">fare_matrices</span> reference data the
            fare engine reads, and review community advisories before they reach commuters.
          </p>
        </div>
        <div className="flex overflow-hidden rounded-[10px] border border-line">
          {[
            ['tariff', 'Tariff rules', 'sliders'],
            ['moderation', 'Moderation', 'shield'],
            ['data', 'Data layer', 'layers'],
          ].map(([id, label, icon]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-[12px] font-semibold transition-colors ${
                tab === id ? 'bg-signal text-signal-ink' : 'bg-ink-800 text-muted hover:text-fg'
              }`}
            >
              <Icon name={icon} size={14} />
              {label}
              {id === 'moderation' && pending.length > 0 && (
                <span
                  className={`num rounded-full px-1.5 text-[10px] ${
                    tab === id ? 'bg-signal-ink text-signal' : 'bg-danger text-[#2a0f0f]'
                  }`}
                >
                  {pending.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* =========================================================== tariff */}
      {tab === 'tariff' && (
        <>
          <div className="panel mt-5 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <p className="label-xs">fare_matrices</p>
                <p className="mt-1 text-[12px] text-muted">
                  Rate in effect{' '}
                  <span className="num text-fg-dim">{matrix[0]?.effective_from || '—'}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Btn
                  size="sm"
                  icon="refresh"
                  onClick={() => {
                    if (!confirmReset) {
                      setConfirmReset(true)
                      setTimeout(() => setConfirmReset(false), 3500)
                      return
                    }
                    FARE_MATRIX_SEED.forEach((r) =>
                      actions.updateMatrixRow(r.id, { ...r, active: r.active !== false })
                    )
                    setConfirmReset(false)
                  }}
                >
                  {confirmReset ? 'Click again to confirm' : 'Restore LTFRB defaults'}
                </Btn>
                <Btn size="sm" variant="primary" icon="plus" onClick={() => actions.addMatrixRow()}>
                  Add class
                </Btn>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left">
                <thead>
                  <tr className="bg-ink-800">
                    <th className="label-xs px-4 py-3">Vehicle class</th>
                    <th className="label-xs px-4 py-3 text-right">Base fare ₱</th>
                    <th className="label-xs px-4 py-3 text-right">Base km</th>
                    <th className="label-xs px-4 py-3 text-right">₱ / km</th>
                    <th className="label-xs px-4 py-3 text-right">Disc. %</th>
                    <th className="label-xs px-4 py-3">8 km example</th>
                    <th className="label-xs px-4 py-3 text-center">Active</th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((m) => {
                    const example = m.base_fare + Math.max(0, 8 - m.base_km) * m.per_km
                    const exampleNet = example * (1 - (m.discount_pct || 0) / 100)
                    return (
                      <tr key={m.id} className="border-t border-line-soft hover:bg-ink-800/50">
                        <td className="px-4 py-3">
                          <input
                            value={m.mode}
                            onChange={(e) => actions.updateMatrixRow(m.id, { mode: e.target.value })}
                            className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-[12.5px] font-medium hover:border-line hover:bg-ink-800"
                          />
                          <div className="mt-1 flex items-center gap-2 px-2">
                            <input
                              value={m.code}
                              onChange={(e) => actions.updateMatrixRow(m.id, { code: e.target.value })}
                              className="num w-[74px] rounded border border-transparent bg-transparent px-1 text-[10px] text-signal hover:border-line"
                            />
                            <span className="truncate text-[10px] text-faint" title={m.source}>
                              {m.source}
                            </span>
                          </div>
                        </td>
                        <NumCell
                          value={m.base_fare}
                          onChange={(v) => actions.updateMatrixRow(m.id, { base_fare: v })}
                        />
                        <NumCell
                          value={m.base_km}
                          step="1"
                          onChange={(v) => actions.updateMatrixRow(m.id, { base_km: v })}
                        />
                        <NumCell
                          value={m.per_km}
                          step="0.05"
                          onChange={(v) => actions.updateMatrixRow(m.id, { per_km: v })}
                        />
                        <NumCell
                          value={m.discount_pct}
                          step="1"
                          onChange={(v) => actions.updateMatrixRow(m.id, { discount_pct: v })}
                        />
                        <td className="px-4 py-3">
                          <span className="num text-[12px] font-semibold text-fg">
                            {peso(exampleNet)}
                          </span>
                          <span className="num block text-[10px] text-faint">
                            8 km · regular {peso(example)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => actions.updateMatrixRow(m.id, { active: !(m.active !== false) })}
                            className={`h-[22px] w-[38px] rounded-full border transition-colors ${
                              m.active !== false ? 'border-route bg-route-dim' : 'border-line bg-ink-700'
                            }`}
                            title={m.active !== false ? 'Active' : 'Inactive'}
                          >
                            <span
                              className={`block h-[14px] w-[14px] rounded-full transition-all ${
                                m.active !== false
                                  ? 'ml-[20px] bg-route'
                                  : 'ml-[3px] bg-muted'
                              }`}
                            />
                          </button>
                        </td>
                        <td className="px-2 py-3 text-right">
                          <button
                            onClick={() => actions.deleteMatrixRow(m.id)}
                            title="Delete class"
                            className="rounded-md p-1.5 text-faint hover:bg-ink-700 hover:text-danger"
                          >
                            <Icon name="trash" size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel mt-3 p-5">
            <p className="label-xs">Fare engine</p>
            <h3 className="mt-1.5 text-[15px] font-bold tracking-[-0.01em]">
              How every quoted fare is produced
            </h3>
            <div className="mt-3 grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="rounded-[11px] border border-line bg-ink-800 px-4 py-3.5">
                <p className="num text-[13px] leading-relaxed text-fg">
                  F<sub>gross</sub> = B + max(0, D − D<sub>base</sub>) × R
                </p>
                <p className="num mt-1.5 text-[13px] leading-relaxed text-fg">
                  F<sub>net</sub> = F<sub>gross</sub> × (1 − discount ÷ 100)
                </p>
                <p className="mt-3 text-[11.5px] leading-relaxed text-muted">
                  <span className="text-fg-dim">D</span> is real road distance from the routing
                  engine, not straight-line. Each leg is priced separately and summed, so a
                  two-jeepney commute costs the sum of both minimum fares rather than one long fare.
                </p>
              </div>
              <div className="rounded-[11px] border border-line bg-ink-800 px-4 py-3.5">
                <p className="label-xs">Worked example</p>
                <div className="mt-2">
                  <Row label="Base fare — first 4 km" value={peso(14)} />
                  <Row label="Excess distance" sub="7.30 km × ₱2.00/km" value={peso(14.6)} />
                  <Row label="Subtotal" value={peso(28.6)} strong />
                  <Row label="Student discount" sub="20% statutory" value="−₱5.72" tone="route" />
                  <Row label="You pay" value={peso(22.88)} strong />
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ======================================================= moderation */}
      {tab === 'moderation' && (
        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="panel p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="label-xs">Pending review</p>
                  <h3 className="mt-1.5 text-[15px] font-bold tracking-[-0.01em]">
                    {pending.length} advisor{pending.length === 1 ? 'y' : 'ies'} awaiting a decision
                  </h3>
                </div>
                <Badge tone={pending.length ? 'danger' : 'route'} icon="shield">
                  {pending.length ? 'Action needed' : 'Queue clear'}
                </Badge>
              </div>

              <div className="mt-4 space-y-3">
                {pending.map((a) => (
                  <div key={a.id} className="rounded-[11px] border border-line bg-ink-800 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="flex-1 text-[13px] leading-snug font-bold text-fg">{a.title}</h4>
                      <span className="num shrink-0 text-[10px] text-faint">
                        {dayLabel(a.createdAt)} · {clockTime(a.createdAt)}
                      </span>
                    </div>
                    <p className="mt-2 text-[12px] leading-relaxed text-muted">{a.body}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge tone="neutral" icon="pin">
                        {a.area}
                      </Badge>
                      <Badge tone="neutral">{a.category}</Badge>
                      <Badge tone="neutral">{a.author}</Badge>
                    </div>
                    <div className="mt-3.5 flex items-center gap-2">
                      <Btn
                        size="sm"
                        variant="route"
                        icon="check"
                        onClick={() => actions.setAdvisoryStatus(a.id, 'published')}
                      >
                        Approve &amp; publish
                      </Btn>
                      <Btn
                        size="sm"
                        variant="danger"
                        icon="x"
                        onClick={() => actions.setAdvisoryStatus(a.id, 'rejected')}
                      >
                        Reject
                      </Btn>
                      <Btn
                        size="sm"
                        variant="quiet"
                        icon="trash"
                        onClick={() => actions.deleteAdvisory(a.id)}
                      >
                        Delete
                      </Btn>
                    </div>
                  </div>
                ))}
                {pending.length === 0 && (
                  <p className="rounded-[11px] border border-dashed border-line px-4 py-8 text-center text-[12.5px] text-muted">
                    Nothing waiting. New community reports land here automatically.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="panel p-5">
              <p className="label-xs">Published</p>
              <h3 className="mt-1.5 text-[15px] font-bold tracking-[-0.01em]">
                {advisories.filter((a) => a.status === 'published').length} live advisories
              </h3>
              <div className="mt-4 space-y-2">
                {advisories
                  .filter((a) => a.status !== 'pending')
                  .map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-3 rounded-[10px] border border-line bg-ink-800 px-3 py-2.5"
                    >
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          a.status === 'published' ? 'bg-route' : 'bg-faint'
                        }`}
                      />
                      <span className="min-w-0 flex-1 truncate text-[12px] text-fg-dim">{a.title}</span>
                      {a.status === 'published' ? (
                        <button
                          onClick={() => actions.setAdvisoryStatus(a.id, 'pending')}
                          className="shrink-0 text-[10.5px] font-semibold text-muted hover:text-signal"
                        >
                          Unpublish
                        </button>
                      ) : (
                        <button
                          onClick={() => actions.setAdvisoryStatus(a.id, 'published')}
                          className="shrink-0 text-[10.5px] font-semibold text-muted hover:text-route"
                        >
                          Restore
                        </button>
                      )}
                    </div>
                  ))}
                {advisories.every((a) => a.status === 'pending') && (
                  <p className="text-[12px] text-muted">Nothing published yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ data */}
      {tab === 'data' && (
        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="panel p-5">
            <p className="label-xs">Local-first persistence</p>
            <h3 className="mt-1.5 text-[15px] font-bold tracking-[-0.01em]">Schema in use</h3>
            <p className="mt-2 text-[12px] leading-relaxed text-muted">
              The demo stores the same three tables the charter specifies, held on this device so the
              app runs with no account and no backend. Swapping the adapter for a Supabase client is
              a one-file change — no component reads storage directly.
            </p>
            <div className="mt-4 space-y-2">
              {[
                ['fare_matrices', `${matrix.length} rows`, 'LTFRB tariff reference data'],
                ['trip_ledger', `${trips.length} rows`, 'Logged trips and fares paid'],
                ['advisories', `${advisories.length} rows`, 'Community notices + moderation state'],
              ].map(([t, n, d]) => (
                <div
                  key={t}
                  className="flex items-center gap-3 rounded-[10px] border border-line bg-ink-800 px-3.5 py-3"
                >
                  <Icon name="layers" size={15} className="shrink-0 text-signal" />
                  <span className="min-w-0 flex-1">
                    <span className="num block text-[12px] font-semibold text-fg">{t}</span>
                    <span className="block text-[11px] text-muted">{d}</span>
                  </span>
                  <span className="num shrink-0 text-[11px] text-faint">{n}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel p-5">
            <p className="label-xs">Workspace</p>
            <h3 className="mt-1.5 text-[15px] font-bold tracking-[-0.01em]">Demo controls</h3>

            <div className="mt-4 space-y-4">
              <Field label="Default commuter type">
                <Toggle
                  checked={settings.defaultRole !== 'regular'}
                  onChange={(v) => actions.updateSettings({ defaultRole: v ? 'student' : 'regular' })}
                  label="Apply the statutory discount by default"
                  hint="Students, senior citizens and PWDs get 20% off the computed fare."
                />
              </Field>

              <div className="rule-fade" />

              <Field label="Distance source" hint="live">
                <div className="flex items-center gap-2.5 rounded-[10px] border border-line bg-ink-800 px-3.5 py-3">
                  <Icon name="zap" size={15} className="shrink-0 text-route" />
                  <span className="flex-1 text-[12px] text-fg-dim">
                    OSRM demo router, falling back to an offline road-factor estimate
                  </span>
                </div>
              </Field>

              <div className="rule-fade" />

              <Field label="Danger zone">
                <Btn
                  variant="danger"
                  icon="refresh"
                  onClick={() => {
                    if (
                      confirm(
                        'Reset all local data — fare matrix, ledger and advisories — back to the demo seed?'
                      )
                    )
                      actions.resetAll()
                  }}
                >
                  Reset demo data
                </Btn>
              </Field>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function NumCell({ value, onChange, step = '0.01' }) {
  return (
    <td className="px-2 py-3 text-right">
      <input
        type="number"
        step={step}
        min="0"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="num w-[92px] rounded-md border border-line bg-ink-800 px-2 py-1.5 text-right text-[12.5px] text-fg"
      />
    </td>
  )
}
