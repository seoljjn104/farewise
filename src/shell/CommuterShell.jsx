import Icon from '../components/Icon.jsx'
import { useStore, useStorageError, actions } from '../lib/store.js'
import { roleById } from '../lib/fares.js'
import { COMMUTER_TABS } from '../lib/router.js'

/* Launcher mark. Small enough to sit inside a 52 px header. */
function Mark({ size = 34 }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-[10px] border border-[#4a3c10] bg-[#2a2109]"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 32 32" width={size * 0.55} height={size * 0.55} aria-hidden="true">
        <path d="M8.5 23V9h11v3.4h-7.2v2.1h6v3.4h-6V23z" fill="var(--color-signal)" />
        <circle cx="24" cy="23" r="2.3" fill="var(--color-route)" />
      </svg>
    </span>
  )
}

function TabLink({ tab, active, rail = false }) {
  return (
    <a
      href={'#/' + tab.id}
      aria-current={active ? 'page' : undefined}
      className={`group relative flex flex-col items-center justify-center gap-1 rounded-[10px] transition-colors ${
        rail ? 'w-full py-2.5' : 'min-h-[56px] py-1.5'
      } ${active ? 'text-signal' : 'text-muted hover:bg-ink-800 hover:text-fg'}`}
    >
      {rail && active && (
        <span className="absolute top-1/2 left-0 h-7 w-[3px] -translate-y-1/2 rounded-r bg-signal" />
      )}
      <Icon name={tab.icon} size={rail ? 19 : 20} stroke={active ? 2 : 1.7} />
      <span
        className={`leading-none font-semibold tracking-[0.02em] ${
          rail ? 'text-[9.5px] tracking-[0.1em] uppercase' : 'text-[10.5px]'
        }`}
      >
        {tab.label}
      </span>
    </a>
  )
}

export default function CommuterShell({ view, children }) {
  const { settings, session } = useStore()
  const storageError = useStorageError()
  const role = roleById(settings.defaultRole)
  const current = COMMUTER_TABS.find((t) => t.id === view) || COMMUTER_TABS[0]
  const isAdmin = session.role === 'admin'

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-ink-900">
      {/* ------------------------------------------------------------- rail */}
      <nav
        aria-label="Primary"
        className="hidden w-[78px] shrink-0 flex-col items-center border-r border-line bg-ink-950 py-3.5 lg:flex"
      >
        <div className="mb-4 flex flex-col items-center gap-1.5">
          <Mark size={40} />
          <span className="text-[8.5px] font-extrabold tracking-[0.16em] text-faint uppercase">
            FareWise
          </span>
        </div>

        <div className="flex w-full flex-1 flex-col gap-1 px-2">
          {COMMUTER_TABS.map((tab) => (
            <TabLink key={tab.id} tab={tab} active={view === tab.id} rail />
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            if (confirm('Reset all local demo data? This cannot be undone.')) actions.resetAll()
          }}
          title="Reset demo data"
          className="mt-2 flex h-9 w-9 items-center justify-center rounded-[10px] text-faint transition-colors hover:bg-ink-800 hover:text-danger"
        >
          <Icon name="refresh" size={16} />
          <span className="sr-only">Reset demo data</span>
        </button>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* ----------------------------------------------------------- header */}
        <header className="flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-line bg-ink-850 px-4 lg:h-[58px] lg:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="lg:hidden">
              <Mark size={30} />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-[14px] leading-tight font-bold tracking-[-0.01em] text-fg">
                {current.title}
              </h1>
              <p className="truncate text-[11px] leading-tight text-muted">{current.sub}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {isAdmin && (
              <a
                href="#/admin"
                className="hidden items-center gap-1.5 rounded-lg border border-[#4a3c10] bg-[#2a2109] px-2.5 py-1.5 text-[10.5px] font-bold tracking-[0.06em] text-signal uppercase sm:flex"
              >
                <Icon name="shield" size={12} />
                Admin
              </a>
            )}
            <span className="num flex items-center gap-1.5 rounded-lg border border-line bg-ink-800 px-2.5 py-1.5 text-[11px] font-semibold text-fg-dim">
              <Icon name="users" size={12} />
              {role.label}
              {role.discount_pct > 0 && <span className="text-route">−{role.discount_pct}%</span>}
            </span>
            <span
              aria-label="Local profile"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-ink-700 text-[10.5px] font-bold text-fg-dim"
            >
              MC
            </span>
            <span
              aria-label="Local profile"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-ink-700 text-[10.5px] font-bold text-fg-dim"
            >
              MC
            </span>
          </div>
        </header>

        {storageError && (
          <p
            role="status"
            className="shrink-0 border-b border-[#5a2a2a] bg-danger-dim px-4 py-2 text-[11.5px] leading-snug text-danger lg:px-5"
          >
            {storageError}
          </p>
        )}

        {/* ------------------------------------------------------------- main */}
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>

        {/* -------------------------------------------------------- bottom nav */}
        <nav
          aria-label="Primary"
          className="shrink-0 border-t border-line bg-ink-850 pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          <div className="grid grid-cols-5">
            {COMMUTER_TABS.map((tab) => (
              <TabLink key={tab.id} tab={tab} active={view === tab.id} />
            ))}
          </div>
        </nav>
      </div>
    </div>
  )
}
