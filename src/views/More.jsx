import { useStore, actions } from '../lib/store.js'
import { ROLES, roleById } from '../lib/fares.js'
import { Btn, Field, Select } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'

const ADMIN_DEMO = import.meta.env.VITE_ADMIN_DEMO === '1'

function Panel({ title, hint, children }) {
  return (
    <section className="panel p-4 lg:p-5">
      <h2 className="text-[13.5px] font-bold text-fg">{title}</h2>
      {hint && <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{hint}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  )
}

export default function More() {
  const { session, settings, matrix } = useStore()
  const role = roleById(settings.defaultRole)

  return (
    <div className="mx-auto max-w-[720px] space-y-4 px-4 py-5 lg:px-7 lg:py-6">
      <header>
        <h2 className="text-[19px] leading-tight font-bold tracking-[-0.015em] text-fg">
          Your settings
        </h2>
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
          Defaults, data, and the demo build. Everything stays in this browser.
        </p>
      </header>

      <Panel title="Profile">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[12.5px]">
          <dt className="text-muted">Device user</dt>
          <dd className="num truncate text-fg-dim">{session.userId}</dd>
          <dt className="text-muted">Role</dt>
          <dd className="text-fg-dim">{session.role === 'admin' ? 'Administrator' : 'Commuter'}</dd>
          <dt className="text-muted">Commuter type</dt>
          <dd className="text-fg-dim">
            {role.label}
            {role.discount_pct > 0 ? ` · ${role.discount_pct}% discount` : ''}
          </dd>
        </dl>
      </Panel>

      <Panel title="Defaults" hint="These set what the planner starts with.">
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
        <Field label="Monthly allowance">
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="50"
            value={settings.monthlyAllowance}
            onChange={(e) =>
              actions.updateSettings({ monthlyAllowance: Number(e.target.value) || 0 })
            }
            className="h-10 w-full rounded-[10px] border border-line bg-ink-800 px-3 text-[13px] text-fg"
          />
        </Field>
      </Panel>

      <Panel title="Data" hint="Demo data lives on this device. Clearing it cannot be undone.">
        <Btn
          variant="danger"
          icon="trash"
          onClick={() => {
            if (confirm('Reset all local demo data? This cannot be undone.')) actions.resetAll()
          }}
        >
          Reset demo data
        </Btn>
      </Panel>

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
              <span className="block text-[11px] text-muted">Separate sign-in for administrators</span>
            </span>
          </span>
          <Icon name="chevronDown" size={15} className="-rotate-90 text-muted" />
        </a>
      )}

      <p className="px-1 pb-2 text-center text-[11px] text-faint">FareWise local demo</p>
    </div>
  )
}
