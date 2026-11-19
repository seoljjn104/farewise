import { Component, useEffect, useState } from 'react'
import Icon from './components/Icon.jsx'
import { useStore, actions } from './lib/store.js'
import { roleById } from './lib/fares.js'
import { fullDate } from './lib/format.js'
import Plan from './views/Plan.jsx'
import Ledger from './views/Ledger.jsx'
import Budget from './views/Budget.jsx'
import Advisories from './views/Advisories.jsx'
import Admin from './views/Admin.jsx'

/* ------------------------------------------------------------ error guard -- */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    console.error('[farewise] render error', error, info)
  }
  render() {
    if (this.state.error) {
      return (
        <div className="m-6 rounded-[14px] border border-[#5a2a2a] bg-danger-dim p-6">
          <p className="label-xs text-danger">Render error</p>
          <p className="num mt-2 text-[13px] text-fg">{String(this.state.error?.message || this.state.error)}</p>
          <pre className="mt-3 max-h-[300px] overflow-auto rounded-lg bg-ink-900 p-3 text-[11px] text-muted">
            {String(this.state.error?.stack || '')}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-3 rounded-lg bg-signal px-3 py-2 text-[12px] font-bold text-signal-ink"
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

/* ---------------------------------------------------------------- config -- */
const NAV = [
  { id: 'plan', label: 'Plan', icon: 'route', title: 'Trip Planner', sub: 'Routing & fare breakdown' },
  { id: 'ledger', label: 'Ledger', icon: 'receipt', title: 'Trip Ledger', sub: 'Every logged commute' },
  { id: 'budget', label: 'Budget', icon: 'wallet', title: 'Budget Tracker', sub: 'Allowance & analytics' },
  { id: 'advisories', label: 'Advisory', icon: 'bell', title: 'Community Advisories', sub: 'Live commute notices' },
  { id: 'admin', label: 'Admin', icon: 'shield', title: 'Admin Control Panel', sub: 'Tariff rules & moderation' },
]

const viewFromHash = () => {
  const id = window.location.hash.replace(/^#\/?/, '').split('?')[0]
  return NAV.some((n) => n.id === id) ? id : 'plan'
}

export default function App() {
  const [view, setView] = useState(() => viewFromHash())
  const { settings, advisories, trips } = useStore()
  const role = roleById(settings.defaultRole)
  const current = NAV.find((n) => n.id === view)
  const pendingCount = advisories.filter((a) => a.status === 'pending').length

  /* Deep-linkable views: #/plan, #/ledger, #/budget, #/advisories, #/admin */
  useEffect(() => {
    const onHash = () => setView(viewFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    const want = '#/' + view
    if (window.location.hash !== want) window.history.replaceState(null, '', want)
  }, [view])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-ink-900">
      {/* ============================================================== rail */}
      <nav className="flex w-[62px] shrink-0 flex-col items-center border-r border-line bg-ink-950 py-3.5 md:w-[78px]">
        {/* mark */}
        <div className="mb-4 flex flex-col items-center gap-1.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-[11px] border border-[#4a3c10] bg-[#2a2109]">
            <svg viewBox="0 0 32 32" width="19" height="19" aria-hidden="true">
              <path
                d="M8.5 23V9h11v3.4h-7.2v2.1h6v3.4h-6V23z"
                fill="var(--color-signal)"
              />
              <circle cx="24" cy="23" r="2.3" fill="var(--color-route)" />
            </svg>
          </span>
          <span className="hidden text-[8.5px] font-extrabold tracking-[0.16em] text-faint uppercase md:block">
            FareWise
          </span>
        </div>

        <div className="flex w-full flex-1 flex-col gap-1 px-2">
          {NAV.map((n) => {
            const on = view === n.id
            return (
              <button
                key={n.id}
                onClick={() => setView(n.id)}
                title={n.title}
                className={`group relative flex flex-col items-center gap-1 rounded-[11px] py-2.5 transition-colors ${
                  on ? 'bg-signal text-signal-ink' : 'text-muted hover:bg-ink-800 hover:text-fg'
                }`}
              >
                <Icon name={n.icon} size={19} stroke={on ? 2 : 1.7} />
                <span className="hidden text-[8.5px] font-bold tracking-[0.11em] uppercase md:block">
                  {n.label}
                </span>
                {n.id === 'admin' && pendingCount > 0 && (
                  <span className="absolute top-1.5 right-2.5 h-1.5 w-1.5 rounded-full bg-danger" />
                )}
              </button>
            )
          })}
        </div>

        <button
          onClick={() => {
            if (confirm('Reset all local demo data?')) actions.resetAll()
          }}
          title="Reset demo data"
          className="mt-2 flex h-9 w-9 items-center justify-center rounded-[10px] text-faint transition-colors hover:bg-ink-800 hover:text-danger"
        >
          <Icon name="refresh" size={16} />
        </button>
      </nav>

      {/* ============================================================= main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[58px] shrink-0 items-center justify-between gap-6 border-b border-line bg-ink-850 px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-[14.5px] leading-tight font-bold tracking-[-0.01em] text-fg">
                {current.title}
              </h1>
              <p className="truncate text-[11px] leading-tight text-muted">{current.sub}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            <span className="hidden items-center gap-2 rounded-lg border border-line bg-ink-800 px-2.5 py-1.5 text-[11px] text-muted lg:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-route" />
              <span className="num">{trips.length}</span> trips on device
            </span>

            <span className="num hidden items-center gap-2 rounded-lg border border-line bg-ink-800 px-2.5 py-1.5 text-[11px] text-muted xl:flex">
              {fullDate(new Date())}
            </span>

            <span className="flex items-center gap-2 rounded-lg border border-[#4a3c10] bg-[#2a2109] px-2.5 py-1.5 text-[11px] font-semibold text-signal">
              <Icon name="users" size={13} />
              {role.label}
              {role.discount_pct > 0 && <span className="num">−{role.discount_pct}%</span>}
            </span>

            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-ink-700 text-[10.5px] font-bold text-fg-dim">
              MC
            </span>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-hidden">
          <ErrorBoundary key={view}>
            {view === 'plan' && <Plan onOpenBudget={() => setView('budget')} />}
            {view === 'ledger' && (
              <div className="h-full overflow-y-auto">
                <Ledger />
              </div>
            )}
            {view === 'budget' && (
              <div className="h-full overflow-y-auto">
                <Budget onOpenPlanner={() => setView('plan')} />
              </div>
            )}
            {view === 'advisories' && (
              <div className="h-full overflow-y-auto">
                <Advisories />
              </div>
            )}
            {view === 'admin' && (
              <div className="h-full overflow-y-auto">
                <Admin />
              </div>
            )}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
