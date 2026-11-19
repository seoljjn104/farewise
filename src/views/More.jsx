import { useRef, useState } from 'react'
import { version } from '../../package.json'
import { actions, getState, useStore } from '../lib/store.js'
import { ROLES, roleById } from '../lib/fares.js'
import { toCsv, toJson } from '../lib/export.js'
import { isoDay } from '../lib/format.js'
import places from '../data/places.json'
import Icon from '../components/Icon.jsx'
import PlaceInput from '../components/PlaceInput.jsx'
import { Badge, Btn, Field, Select } from '../components/ui.jsx'

const ADMIN_DEMO = import.meta.env.VITE_ADMIN_DEMO === '1'

const placeById = (id) => places.find((p) => p.id === id) || null

function Panel({ title, hint, children }) {
  return (
    <section className="panel p-4 lg:p-5">
      <h2 className="text-[13.5px] font-bold text-fg">{title}</h2>
      {hint && <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{hint}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  )
}

function downloadText(filename, text, mime) {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export default function More() {
  const { session, settings, matrix, trips } = useStore()
  const role = roleById(settings.defaultRole)
  const fileRef = useRef(null)
  const [notice, setNotice] = useState(null)

  const stamp = isoDay(new Date())

  function exportJson() {
    /* The session is device state, not data: never put a role claim in a file. */
    downloadText(
      `farewise-backup-${stamp}.json`,
      toJson({ ...getState(), session: undefined }),
      'application/json'
    )
    setNotice({ ok: true, text: `Backup saved with ${trips.length} trips.` })
  }

  function exportCsv() {
    downloadText(`farewise-trips-${stamp}.csv`, toCsv(trips), 'text/csv')
    setNotice({ ok: true, text: `Saved ${trips.length} trips as CSV.` })
  }

  async function importFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    let parsed
    try {
      parsed = JSON.parse(await file.text())
    } catch {
      setNotice({ ok: false, text: 'That file is not valid JSON. Nothing changed.' })
      return
    }

    const result = actions.importState(parsed)
    setNotice({
      ok: result.ok,
      text: result.ok ? result.message : `${result.message} Nothing changed.`,
    })
  }

  return (
    <div className="mx-auto w-full max-w-[720px] space-y-2.5 px-4 py-4 lg:px-6 lg:py-6">
      {/* ---------------------------------------------------------- profile */}
      <Panel title="Profile">
        <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2.5 text-[12.5px]">
          <dt className="text-muted">Device user</dt>
          <dd className="num min-w-0 truncate text-fg-dim">{session.userId}</dd>

          <dt className="text-muted">Role</dt>
          <dd className="flex items-center gap-2 text-fg-dim">
            {session.role === 'admin' ? 'Administrator' : 'Commuter'}
            {session.role === 'admin' && <Badge tone="signal" icon="shield">Admin</Badge>}
          </dd>

          <dt className="text-muted">Commuter type</dt>
          <dd className="text-fg-dim">
            {role.label}
            {role.discount_pct > 0 ? ` · ${role.discount_pct}% discount` : ''}
          </dd>
        </dl>
      </Panel>

      {/* --------------------------------------------------------- defaults */}
      <Panel title="Defaults" hint="These are what the planner starts with.">
        <Field label="Home">
          <PlaceInput
            label="Home"
            value={placeById(settings.homeId)}
            onSelect={(place) => actions.updateSettings({ homeId: place?.id || null })}
            placeholder="Where you usually start"
          />
        </Field>

        <Field label="School or work">
          <PlaceInput
            label="School or work"
            value={placeById(settings.schoolId)}
            onSelect={(place) => actions.updateSettings({ schoolId: place?.id || null })}
            placeholder="Where you usually go"
          />
        </Field>

        <Field label="Commuter type">
          <Select
            value={settings.defaultRole}
            onChange={(value) => actions.updateSettings({ defaultRole: value })}
            options={ROLES.map((r) => ({
              value: r.id,
              label: r.discount_pct ? `${r.label} · ${r.discount_pct}% discount` : r.label,
            }))}
          />
        </Field>

        <Field label="Vehicle class">
          <Select
            value={settings.defaultModeId}
            onChange={(value) => actions.updateSettings({ defaultModeId: value })}
            options={matrix
              .filter((m) => m.active !== false)
              .map((m) => ({ value: m.id, label: m.mode }))}
          />
        </Field>

        <Field as="input" label="Monthly allowance (₱)">
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="50"
            value={settings.monthlyAllowance}
            onChange={(e) =>
              actions.updateSettings({ monthlyAllowance: Number(e.target.value) || 0 })
            }
            className="num h-11 w-full rounded-[10px] border border-line bg-ink-800 px-3 text-[13px] text-fg"
          />
        </Field>
      </Panel>

      {/* ------------------------------------------------------------- data */}
      <Panel
        title="Data"
        hint="Backups hold your trips, advisories, rate rows, and settings. The files stay on this device."
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Btn icon="download" onClick={exportJson}>
            Export JSON
          </Btn>
          <Btn icon="download" onClick={exportCsv}>
            Export trips CSV
          </Btn>
        </div>

        <Btn icon="upload" onClick={() => fileRef.current?.click()} className="w-full sm:w-auto">
          Import JSON
        </Btn>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          tabIndex={-1}
          onChange={importFile}
          className="sr-only"
          aria-hidden="true"
        />

        <p className="text-[10.5px] leading-relaxed text-faint">
          Importing replaces the trips, advisories, and settings on this device. A file that does
          not parse leaves everything as it was.
        </p>

        {notice && (
          <p
            role="status"
            className={`flex items-start gap-2 rounded-[10px] border px-3 py-2 text-[11.5px] leading-relaxed ${
              notice.ok
                ? 'border-[#1f4a36] bg-route-dim text-route'
                : 'border-[#5a2a2a] bg-danger-dim text-danger'
            }`}
          >
            <Icon name={notice.ok ? 'check' : 'alert'} size={13} className="mt-px shrink-0" />
            {notice.text}
          </p>
        )}
      </Panel>

      {/* ------------------------------------------------------------ about */}
      <Panel title="About">
        <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2.5 text-[12.5px]">
          <dt className="text-muted">Version</dt>
          <dd className="num text-fg-dim">{version}</dd>
          <dt className="text-muted">Build</dt>
          <dd className="text-fg-dim">Local demo, no server</dd>
        </dl>
        <p className="text-[11.5px] leading-relaxed text-muted">
          Your trips and settings live in this browser only. Clearing site data or resetting the
          demo removes them, so export a backup first. Setup notes are in README.md in the project
          folder.
        </p>
      </Panel>

      {/* ------------------------------------------------------ danger zone */}
      <section className="panel border-[#5a2a2a] p-4 lg:p-5">
        <h2 className="text-[13.5px] font-bold text-danger">Danger zone</h2>
        <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
          Reset returns every setting, trip, and advisory to the seeded demo. It cannot be undone.
        </p>
        <Btn
          variant="danger"
          icon="trash"
          className="mt-4"
          onClick={() => {
            if (confirm('Reset all local demo data? This cannot be undone.')) actions.resetAll()
          }}
        >
          Reset demo data
        </Btn>
      </section>

      {ADMIN_DEMO && (
        <a
          href="#/admin/login"
          className="flex items-center justify-between gap-3 rounded-[14px] border border-line bg-ink-850 px-4 py-3.5 transition-colors hover:bg-ink-800"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#4a3c10] bg-[#2a2109] text-signal">
              <Icon name="shield" size={16} />
            </span>
            <span>
              <span className="block text-[12.5px] font-semibold text-fg">Admin console</span>
              <span className="block text-[11px] text-muted">
                Separate sign-in for administrators
              </span>
            </span>
          </span>
          <Icon name="chevronDown" size={15} className="-rotate-90 text-muted" />
        </a>
      )}

      <p className="px-1 pb-2 text-center text-[11px] text-faint">FareWise local demo</p>
    </div>
  )
}
