import { useEffect } from 'react'
import { actions, useStore } from '../lib/store.js'
import { navigate } from '../lib/router.js'
import { roleById } from '../lib/fares.js'
import Icon from '../components/Icon.jsx'
import AdminLogin from './AdminLogin.jsx'
import TariffPanel from './TariffPanel.jsx'

/* Panels that exist. The nav renders from this list, so it cannot link to a
   screen the console does not ship. */
const PANELS = [
  { id: 'tariff', label: 'Tariff', icon: 'sliders', title: 'Tariff rules', sub: 'Rate rows and audit' },
]

const findPanel = (id) => PANELS.find((panel) => panel.id === id) || PANELS[0]

/**
 * The admin boundary. It owns the gate, so no console component can render
 * before the session role has been checked.
 */
export default function AdminApp({ route }) {
  const { session, admins, settings } = useStore()
  const isAdmin = session.role === 'admin'
  const isLogin = route.kind === 'adminLogin'

  useEffect(() => {
    if (!isLogin && !isAdmin) navigate('#/admin/login')
  }, [isLogin, isAdmin])

  if (isLogin) return <AdminLogin />
  if (!isAdmin) return null

  const admin = admins[0]
  const commuterRole = roleById(settings.defaultRole)
  const current = findPanel(route.panel)

  function signOut() {
    actions.signOutAdmin()
    navigate('#/')
  }

  return (
    <div className="flex min-h-[100dvh] bg-ink-900">
      {/* ------------------------------------------------------------- rail */}
      <aside className="hidden w-[214px] shrink-0 flex-col border-r border-line bg-ink-950 lg:flex">
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[#4a3c10] bg-[#2a2109] text-signal">
            <Icon name="shield" size={17} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[12.5px] leading-tight font-bold text-fg">FareWise</p>
            <p className="truncate text-[10px] leading-tight tracking-[0.08em] text-faint uppercase">
              Admin console
            </p>
          </div>
        </div>

        <nav aria-label="Admin" className="flex-1 space-y-1 p-2.5">
          {PANELS.map((panel) => {
            const active = panel.id === current.id
            return (
              <a
                key={panel.id}
                href={`#/admin/${panel.id}`}
                aria-current={active ? 'page' : undefined}
                className={`relative flex items-start gap-2.5 rounded-[10px] px-2.5 py-2 transition-colors ${
                  active
                    ? 'bg-ink-800 text-fg'
                    : 'text-muted hover:bg-ink-800/60 hover:text-fg-dim'
                }`}
              >
                {active && (
                  <span className="absolute top-1/2 left-0 h-7 w-[3px] -translate-y-1/2 rounded-r bg-signal" />
                )}
                <Icon
                  name={panel.icon}
                  size={16}
                  className={`mt-0.5 shrink-0 ${active ? 'text-signal' : 'text-faint'}`}
                />
                <span className="min-w-0">
                  <span className="block text-[12.5px] leading-tight font-semibold">
                    {panel.label}
                  </span>
                  <span className="block text-[10.5px] leading-tight text-faint">{panel.sub}</span>
                </span>
              </a>
            )
          })}
        </nav>

        <div className="border-t border-line p-2.5">
          <p className="px-2.5 pb-2 text-[10px] leading-snug text-faint">
            Signed in as
            <span className="mt-0.5 block truncate text-[11.5px] font-semibold text-fg-dim">
              {admin?.displayName || 'Admin'}
            </span>
          </p>
          <a
            href="#/"
            className="flex items-center gap-2 rounded-[9px] px-2.5 py-2 text-[11.5px] font-semibold text-muted hover:bg-ink-800 hover:text-fg"
          >
            <Icon name="arrowRight" size={14} className="rotate-180 text-faint" />
            Commuter app
          </a>
          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-[9px] px-2.5 py-2 text-left text-[11.5px] font-semibold text-muted hover:bg-ink-800 hover:text-danger"
          >
            <Icon name="logout" size={14} className="text-faint" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* ---------------------------------------------------------- header */}
        <header className="shrink-0 border-b border-line bg-ink-850">
          <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-6">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="lg:hidden">
                <span className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-[#4a3c10] bg-[#2a2109] text-signal">
                  <Icon name="shield" size={15} />
                </span>
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-[14px] leading-tight font-bold text-fg">
                  {current.title}
                </h1>
                <p className="truncate text-[11px] leading-tight text-muted">{current.sub}</p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden rounded-lg border border-line bg-ink-800 px-2.5 py-1.5 text-[10.5px] text-muted md:inline">
                Commuter view: {commuterRole.label}
              </span>
              <a
                href="#/"
                className="rounded-lg border border-line bg-ink-800 px-2.5 py-1.5 text-[10.5px] font-semibold text-fg-dim hover:text-fg lg:hidden"
              >
                Commuter
              </a>
              <button
                type="button"
                onClick={signOut}
                className="rounded-lg border border-line bg-ink-800 px-2.5 py-1.5 text-[10.5px] font-semibold text-muted hover:text-danger lg:hidden"
              >
                Sign out
              </button>
            </div>
          </div>

          <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-4 pb-2 lg:hidden">
            {PANELS.map((panel) => {
              const active = panel.id === current.id
              return (
                <a
                  key={panel.id}
                  href={`#/admin/${panel.id}`}
                  aria-current={active ? 'page' : undefined}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-semibold whitespace-nowrap ${
                    active
                      ? 'border-signal bg-signal text-signal-ink'
                      : 'border-line bg-ink-800 text-muted'
                  }`}
                >
                  <Icon name={panel.icon} size={13} />
                  {panel.label}
                </a>
              )
            })}
          </nav>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:px-6 lg:py-5">
          <div className="mx-auto w-full max-w-[1180px]">
            <TariffPanel />
          </div>
        </main>

        <footer className="shrink-0 border-t border-line px-4 py-2.5 text-center text-[10.5px] text-faint">
          Local demo. Admin accounts are provisioned by an operator. There is no self-service path.
        </footer>
      </div>
    </div>
  )
}
