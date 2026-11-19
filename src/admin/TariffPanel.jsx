import { useEffect, useRef, useState } from 'react'
import { actions, useStore } from '../lib/store.js'
import {
  billableRows,
  computeFare,
  effectiveDiscountPct,
} from '../lib/fares.js'
import { clockTime, dayLabel, peso } from '../lib/format.js'
import Icon from '../components/Icon.jsx'
import { Badge, Btn, Field, Select } from '../components/ui.jsx'
import RateField from './RateField.jsx'

const COLUMNS = [
  'Vehicle class',
  'Code',
  'Base fare ₱',
  'Base km',
  '₱ / km',
  'Disc. cap %',
  'Effective from',
  'Source',
  'Active',
  '',
]

const MONTHS = ['base_fare', 'base_km', 'per_km', 'discount_pct']
const TEXT = ['mode', 'code', 'effective_from', 'source', 'active']

function describe(entry) {
  if (entry.action === 'restore') {
    return `Restored ${entry.after?.restored ?? 0} LTFRB rows`
  }
  if (entry.action === 'add') {
    return `Added ${entry.after?.mode || 'a class'}`
  }
  if (entry.action === 'delete') {
    return `Deleted ${entry.before?.mode || 'a class'}`
  }

  const before = entry.before || {}
  const after = entry.after || {}
  const changed = [
    ...MONTHS.filter((key) => Number(before[key]) !== Number(after[key])),
    ...TEXT.filter((key) => String(before[key]) !== String(after[key])),
  ].slice(0, 3)

  const parts = changed.map((key) => {
    const label = key === 'per_km' ? 'per km' : key.replaceAll('_', ' ')
    const fmt = (value) =>
      MONTHS.includes(key) ? String(Number(value) || 0) : String(value ?? '—')
    return `${label} ${fmt(before[key])} → ${fmt(after[key])}`
  })

  return `${after.mode || before.mode || entry.entityId}: ${parts.join(', ') || 'saved'}`
}

export default function TariffPanel() {
  const { matrix, audit } = useStore()
  const billable = billableRows(matrix)
  const [notice, setNotice] = useState('')
  const [confirmRestore, setConfirmRestore] = useState(false)

  /* 6.9736 km is the demo route's raw OSRM distance. Starting here means the
     worked example matches the Plan ticket cent for cent instead of drifting. */
  const [exampleKm, setExampleKm] = useState('6.9736')
  const [exampleId, setExampleId] = useState(billable[0]?.id || '')

  useEffect(() => {
    if (!billable.some((row) => row.id === exampleId)) {
      setExampleId(billable[0]?.id || '')
    }
  }, [billable, exampleId])

  const exampleRow = billable.find((row) => row.id === exampleId) || billable[0]
  const exampleDistance = Number(exampleKm)
  const exampleFare =
    exampleRow && exampleKm.trim() !== '' && Number.isFinite(exampleDistance)
      ? computeFare(exampleRow, exampleDistance, 20)
      : null

  const rateAudit = audit.filter((entry) => entry.entity === 'rate').slice(0, 20)
  const effective = matrix[0]?.effective_from || '—'
  const deletable = (row) =>
    !(billable.length <= 1 && billable.some((b) => b.id === row.id))

  function restore() {
    if (!confirmRestore) {
      setConfirmRestore(true)
      setTimeout(() => setConfirmRestore(false), 3500)
      return
    }
    const count = actions.restoreMatrixDefaults()
    setConfirmRestore(false)
    setNotice(`${count} rate rows restored from the LTFRB seed.`)
  }

  return (
    <div className="space-y-3">
      {/* ------------------------------------------------------------ table */}
      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5 lg:px-5">
          <div>
            <p className="label-xs">fare_matrices</p>
            <p className="mt-1 text-[12px] text-muted">
              Rate effective <span className="num text-fg-dim">{effective}</span> ·{' '}
              {billable.length} billable {billable.length === 1 ? 'class' : 'classes'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Btn size="sm" icon="refresh" onClick={restore}>
              {confirmRestore ? 'Click again to restore' : 'Restore LTFRB defaults'}
            </Btn>
            <Btn
              size="sm"
              variant="primary"
              icon="plus"
              onClick={() => {
                const id = actions.addMatrixRow()
                setNotice('New class added. Set a base fare and a per-km rate.')
                setExampleId(id)
              }}
            >
              Add class
            </Btn>
          </div>
        </div>

        {notice && (
          <p
            role="status"
            className="flex items-center gap-2 border-b border-line bg-route-dim px-4 py-2 text-[11.5px] text-route lg:px-5"
          >
            <Icon name="check" size={13} className="shrink-0" />
            {notice}
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-left">
            <thead>
              <tr className="bg-ink-800">
                {COLUMNS.map((label, i) => (
                  <th
                    key={label || 'actions'}
                    className={`label-xs px-3 py-3 ${
                      i === 0 || i === 1 || i === 6 || i === 7 ? 'text-left' : 'text-right'
                    } ${i === 8 ? 'text-center' : ''}`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row) => {
                const canActivate = Number(row.base_fare) > 0 && Number(row.per_km) > 0

                return (
                  <tr key={row.id} className="border-t border-line-soft hover:bg-ink-800/40">
                    <td className="px-3 py-2 align-top">
                      <TextCell
                        value={row.mode}
                        label={`Class name for ${row.code}`}
                        width="w-[240px]"
                        onCommit={(value) => actions.adminUpdateMatrixRow(row.id, { mode: value })}
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <TextCell
                        value={row.code}
                        label="Code"
                        width="w-[84px]"
                        mono
                        onCommit={(value) => actions.adminUpdateMatrixRow(row.id, { code: value })}
                      />
                    </td>
                    <td className="px-3 py-2 text-right align-top">
                      <RateField
                        value={row.base_fare}
                        label={`Base fare for ${row.mode}`}
                        onCommit={(value) =>
                          actions.adminUpdateMatrixRow(row.id, { base_fare: value })
                        }
                      />
                    </td>
                    <td className="px-3 py-2 text-right align-top">
                      <RateField
                        value={row.base_km}
                        step="1"
                        label={`Base kilometres for ${row.mode}`}
                        onCommit={(value) => actions.adminUpdateMatrixRow(row.id, { base_km: value })}
                      />
                    </td>
                    <td className="px-3 py-2 text-right align-top">
                      <RateField
                        value={row.per_km}
                        step="0.05"
                        label={`Rate per kilometre for ${row.mode}`}
                        onCommit={(value) => actions.adminUpdateMatrixRow(row.id, { per_km: value })}
                      />
                    </td>
                    <td className="px-3 py-2 text-right align-top">
                      <RateField
                        value={row.discount_pct}
                        step="1"
                        label={`Discount cap for ${row.mode}`}
                        onCommit={(value) =>
                          actions.adminUpdateMatrixRow(row.id, { discount_pct: value })
                        }
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <TextCell
                        value={row.effective_from}
                        label={`Effective date for ${row.mode}`}
                        width="w-[104px]"
                        onCommit={(value) =>
                          actions.adminUpdateMatrixRow(row.id, { effective_from: value })
                        }
                      />
                    </td>
                    <td className="max-w-[180px] px-3 py-2 align-top">
                      <span
                        className="line-clamp-2 text-[10px] leading-tight text-faint"
                        title={row.source}
                      >
                        {row.source}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center align-top">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={row.active !== false}
                        aria-label={`${row.mode} active`}
                        disabled={!canActivate}
                        title={
                          canActivate
                            ? row.active !== false
                              ? 'Active'
                              : 'Inactive'
                            : 'Set a base fare and a per-km rate before activating.'
                        }
                        onClick={() =>
                          actions.adminUpdateMatrixRow(row.id, {
                            active: !(row.active !== false),
                          })
                        }
                        className={`mt-0.5 h-[22px] w-[38px] rounded-full border transition-colors ${
                          row.active !== false
                            ? 'border-route bg-route-dim'
                            : 'border-line bg-ink-700'
                        } ${canActivate ? '' : 'cursor-not-allowed opacity-40'}`}
                      >
                        <span
                          className={`block h-[14px] w-[14px] rounded-full transition-all ${
                            row.active !== false ? 'ml-[20px] bg-route' : 'ml-[3px] bg-muted'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-2 py-2 text-right align-top">
                      <button
                        type="button"
                        disabled={!deletable(row)}
                        title={
                          deletable(row)
                            ? `Delete ${row.mode}`
                            : 'One billable class must stay in the matrix.'
                        }
                        onClick={() => actions.deleteMatrixRow(row.id)}
                        aria-label={`Delete ${row.mode}`}
                        className="rounded-md p-1.5 text-faint hover:bg-ink-700 hover:text-danger disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
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

        <p className="border-t border-line px-4 py-2.5 text-[10.5px] leading-relaxed text-faint lg:px-5">
          Set a base fare and a per-km rate before activating a class. The last billable class
          cannot be deleted. A row's discount figure is a cap: it can lower a commuter's statutory
          discount, never raise it.
        </p>
      </section>

      {/* --------------------------------------------------- worked example */}
      <section className="panel p-4 lg:p-5">
        <p className="label-xs">Worked example</p>
        <h2 className="mt-1 text-[15px] font-bold tracking-[-0.01em] text-fg">
          What a commuter would pay
        </h2>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr]">
          <Field as="input" label="Distance (km)">
            <input
              type="text"
              inputMode="decimal"
              value={exampleKm}
              onChange={(e) => setExampleKm(e.target.value)}
              aria-label="Example distance in kilometres"
              className={`num h-10 w-full rounded-[10px] border bg-ink-800 px-3 text-[13px] text-fg ${
                exampleFare || exampleKm.trim() === '' ? 'border-line' : 'border-danger'
              }`}
            />
          </Field>

          <Field label="Vehicle class">
            <Select
              value={exampleRow?.id || ''}
              onChange={setExampleId}
              options={billable.map((row) => ({ value: row.id, label: row.mode }))}
            />
          </Field>
        </div>

        {!exampleRow ? (
          <p className="mt-4 rounded-[10px] border border-dashed border-line px-3 py-6 text-center text-[12px] text-muted">
            No billable class yet. Set a base fare and a per-km rate to see a fare.
          </p>
        ) : !exampleFare ? (
          <p className="mt-4 text-[12px] text-danger">Enter a distance to see the fare.</p>
        ) : (
          <dl className="mt-4 divide-y divide-[#1d2530]">
            <Line
              label={`Base fare, first ${exampleFare.baseKm} km`}
              value={peso(exampleFare.baseFare)}
            />
            <Line
              label={`Excess ${exampleFare.billableKm} km × ${peso(exampleFare.perKm)}/km`}
              value={peso(exampleFare.excessCharge)}
            />
            <Line label="Gross fare" value={peso(exampleFare.gross)} strong />
            <Line
              label={`Discount ${exampleFare.discountPct}%`}
              value={`−${peso(exampleFare.discountAmount)}`}
              tone="route"
            />
            <Line label="Net payable" value={peso(exampleFare.net)} strong tone="signal" />
          </dl>
        )}

        {exampleRow && (
          <p className="mt-3 text-[10.5px] leading-relaxed text-faint">
            Priced at a 20% statutory discount, limited by this row's{' '}
            {effectiveDiscountPct(exampleRow, 20)}% cap. Numbers come from the same fare engine the
            Plan screen uses.
          </p>
        )}
      </section>

      {/* ------------------------------------------------------------ audit */}
      <section className="panel p-4 lg:p-5">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="label-xs">Audit trail</p>
            <h2 className="mt-1 text-[15px] font-bold tracking-[-0.01em] text-fg">Rate changes</h2>
          </div>
          <span className="num text-[10.5px] text-faint">
            {rateAudit.length ? `${rateAudit.length} shown` : 'empty'}
          </span>
        </div>

        {rateAudit.length === 0 ? (
          <p className="mt-3 rounded-[10px] border border-dashed border-line px-3 py-5 text-center text-[11.5px] text-muted">
            No rate changes yet. Every edit, addition, deletion, and restore lands here.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[#1d2530]">
            {rateAudit.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3 py-2">
                <Badge
                  tone={
                    entry.action === 'delete'
                      ? 'danger'
                      : entry.action === 'restore'
                        ? 'info'
                        : 'neutral'
                  }
                  className="mt-0.5 shrink-0"
                >
                  {entry.action}
                </Badge>
                <span className="min-w-0 flex-1 text-[11.5px] leading-snug text-fg-dim">
                  {describe(entry)}
                </span>
                <span className="num shrink-0 text-[10px] whitespace-nowrap text-faint">
                  {dayLabel(entry.at) === 'Today'
                    ? clockTime(entry.at)
                    : `${dayLabel(entry.at)} ${clockTime(entry.at)}`}
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 text-[10.5px] leading-relaxed text-faint">
          The trail keeps the last 200 actions on this device. Restoring the LTFRB seed is recorded
          as one entry, not one per row.
        </p>
      </section>
    </div>
  )
}

function Line({ label, value, strong = false, tone = 'default' }) {
  const tones = { default: 'text-fg-dim', route: 'text-route', signal: 'text-signal' }
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd
        className={`num shrink-0 text-[12.5px] ${
          strong ? 'font-semibold' : ''
        } ${tones[tone]}`}
      >
        {value}
      </dd>
    </div>
  )
}

/**
 * Text equivalent of RateField: same draft, same commit-on-blur rule, so a
 * half-typed class name never reaches the matrix or the audit trail.
 */
function TextCell({ value, onCommit, label, width = 'w-full', mono = false }) {
  const [draft, setDraft] = useState(String(value ?? ''))
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) setDraft(String(value ?? ''))
  }, [value])

  function commit() {
    const next = draft.trim()
    if (!next || next === String(value ?? '')) {
      setDraft(String(value ?? ''))
      return
    }
    onCommit(next)
  }

  return (
    <input
      type="text"
      value={draft}
      title={value}
      aria-label={label}
      onFocus={() => {
        focused.current = true
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        focused.current = false
        commit()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
          e.currentTarget.blur()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          setDraft(String(value ?? ''))
          e.currentTarget.blur()
        }
      }}
      className={`${width} rounded-md border border-transparent bg-transparent px-2 py-1 text-[12px] text-fg hover:border-line hover:bg-ink-800 focus:border-line focus:bg-ink-800 ${
        mono ? 'num text-[10.5px] text-signal' : 'font-medium'
      }`}
    />
  )
}
