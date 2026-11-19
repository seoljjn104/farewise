import { Component, useEffect } from 'react'
import { navigate, useHashRoute } from './lib/router.js'
import CommuterShell from './shell/CommuterShell.jsx'
import Plan from './views/Plan.jsx'
import Ledger from './views/Ledger.jsx'
import Budget from './views/Budget.jsx'
import Advisories from './views/Advisories.jsx'
import More from './views/More.jsx'
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
        <div className="m-4 max-w-[420px] rounded-[14px] border border-[#5a2a2a] bg-danger-dim p-6 lg:m-6">
          <p className="label-xs text-danger">Screen error</p>
          <p className="mt-2 text-[13px] leading-relaxed text-fg">
            Something went wrong on this screen.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-signal px-3 py-2 text-[12px] font-bold text-signal-ink"
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

/* ------------------------------------------------------------------ views -- */
function CommuterView({ view }) {
  if (view === 'trips') return <Ledger />
  if (view === 'budget') return <Budget onOpenPlanner={() => navigate('#/plan')} />
  if (view === 'alerts') return <Advisories />
  if (view === 'more') return <More />
  return <Plan onOpenBudget={() => navigate('#/budget')} />
}

export default function App() {
  const route = useHashRoute()
  const redirectTo = route.kind === 'redirect' ? route.to : null

  useEffect(() => {
    if (redirectTo) navigate(redirectTo)
  }, [redirectTo])

  if (route.kind === 'redirect') return null

  if (route.kind === 'admin' || route.kind === 'adminLogin') {
    return (
      <div className="h-[100dvh] overflow-y-auto bg-ink-900">
        <ErrorBoundary key="admin">
          <Admin />
        </ErrorBoundary>
      </div>
    )
  }

  return (
    <CommuterShell view={route.view}>
      <ErrorBoundary key={route.view}>
        <CommuterView view={route.view} />
      </ErrorBoundary>
    </CommuterShell>
  )
}
